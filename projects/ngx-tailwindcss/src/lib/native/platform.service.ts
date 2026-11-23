import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { OsPlatform, PlatformTheme, WindowState } from './native.types';
import { dynamicImport } from './dynamic-import.util';
import { getExposedElectronIpc, loadElectronIpc } from './electron-bridge.util';
import { splitShortcut } from './shortcut-keys.util';

// Type definitions for dynamic imports (Tauri/Electron may not be present)
interface TauriWindow {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  close(): Promise<void>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  setTitle(title: string): Promise<void>;
}

/**
 * Service for detecting and interacting with the native platform
 * Supports Tauri, Electron, and web browsers
 */
@Injectable({ providedIn: 'root' })
export class NativeAppPlatformService implements OnDestroy {
  /** Teardown for the global listeners registered in the constructor. */
  private readonly cleanups: Array<() => void> = [];

  // Platform detection
  private readonly _platform = signal<OsPlatform>(this.detectPlatform());
  private readonly _isTauri = signal(this.checkTauri());
  private readonly _isElectron = signal(this.checkElectron());
  private readonly _theme = signal<PlatformTheme>('system');
  // Tracks the OS color scheme so `isDarkMode` re-evaluates when it changes
  private readonly _systemPrefersDark = signal(this.querySystemPrefersDark());

  // Window state
  private readonly _windowState = signal<WindowState>({
    isMaximized: false,
    isMinimized: false,
    isFullscreen: false,
    isFocused: true,
  });

  // Public signals
  /** Detected operating system. Use `isTauri`/`isElectron` for runtime-shell detection. */
  public readonly platform = this._platform.asReadonly();
  public readonly isTauri = this._isTauri.asReadonly();
  public readonly isElectron = this._isElectron.asReadonly();
  public readonly isNative = computed(() => this._isTauri() || this._isElectron());
  public readonly isWeb = computed(() => !this.isNative());
  public readonly theme = this._theme.asReadonly();
  public readonly windowState = this._windowState.asReadonly();

  public readonly isDarkMode = computed(() => {
    if (this._theme() === 'system') {
      return this._systemPrefersDark();
    }
    return this._theme() === 'dark';
  });

  constructor() {
    this.initThemeListener();
    this.initWindowStateListener();
  }

  private detectPlatform(): OsPlatform {
    if (typeof window === 'undefined') return 'web';

    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';

    return 'web';
  }

  private checkTauri(): boolean {
    return (
      typeof window !== 'undefined' &&
      // `__TAURI_INTERNALS__` is injected by Tauri v2; `__TAURI__` by Tauri v1
      // (and by v2 when `app.withGlobalTauri` is enabled).
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
  }

  /**
   * Electron detection. `window.process.type` is only visible with
   * `nodeIntegration`/no context isolation, so the user agent (Electron adds
   * `Electron/x.y.z` by default) and a preload-exposed ipcRenderer bridge
   * (see `loadElectronIpc`) are checked as well.
   */
  private checkElectron(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof (window as Window & { process?: { type?: string } }).process?.type === 'string') {
      return true;
    }
    if (typeof navigator !== 'undefined' && /\belectron\//i.test(navigator.userAgent)) {
      return true;
    }
    return getExposedElectronIpc() !== null;
  }

  /**
   * Send a window command to the Electron main process.
   * @returns false when no ipcRenderer is reachable, so callers can fall back
   * to web behaviour.
   */
  private async sendElectron(channel: string, ...args: unknown[]): Promise<boolean> {
    try {
      const { ipcRenderer } = await loadElectronIpc();
      ipcRenderer.send(channel, ...args);
      return true;
    } catch (error) {
      console.warn(`Electron ${channel} failed:`, error);
      return false;
    }
  }

  private querySystemPrefersDark(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  private initThemeListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      // A same-value set on `_theme` would not notify; track the OS scheme directly
      this._systemPrefersDark.set(event.matches);
    };
    mediaQuery.addEventListener('change', onChange);
    this.cleanups.push(() => {
      mediaQuery.removeEventListener('change', onChange);
    });
  }

  private initWindowStateListener(): void {
    if (typeof window === 'undefined') return;

    const onFocus = () => {
      // A minimized window is restored before it can regain focus
      this._windowState.update(s => ({ ...s, isFocused: true, isMinimized: false }));
    };
    const onBlur = () => {
      this._windowState.update(s => ({ ...s, isFocused: false }));
    };
    // Fullscreen detection
    const onFullscreenChange = () => {
      this._windowState.update(s => ({
        ...s,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    this.cleanups.push(() => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    });
  }

  public ngOnDestroy(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  // Theme methods
  public setTheme(theme: PlatformTheme): void {
    this._theme.set(theme);
  }

  // Window control methods
  public async minimize(): Promise<void> {
    let minimized = false;
    if (this._isTauri()) {
      try {
        const tauriWindow = await dynamicImport('@tauri-apps/api/window');
        const win = tauriWindow.getCurrentWindow() as TauriWindow;
        await win.minimize();
        minimized = true;
      } catch (error) {
        console.warn('Tauri minimize failed:', error);
      }
    } else if (this._isElectron()) {
      minimized = await this.sendElectron('window-minimize');
    }
    // A browser tab can't be minimized; don't report a state that didn't happen
    if (minimized) {
      this._windowState.update(s => ({ ...s, isMinimized: true }));
    }
  }

  public async maximize(): Promise<void> {
    if (this._isTauri()) {
      try {
        const tauriWindow = await dynamicImport('@tauri-apps/api/window');
        const win = tauriWindow.getCurrentWindow() as TauriWindow;
        if (await win.isMaximized()) {
          await win.unmaximize();
          this._windowState.update(s => ({ ...s, isMaximized: false }));
        } else {
          await win.maximize();
          this._windowState.update(s => ({ ...s, isMaximized: true }));
        }
      } catch (error) {
        console.warn('Tauri maximize failed:', error);
      }
    } else if (this._isElectron()) {
      await this.sendElectron('window-maximize');
    }
  }

  public async close(): Promise<void> {
    if (this._isTauri()) {
      try {
        const tauriWindow = await dynamicImport('@tauri-apps/api/window');
        const win = tauriWindow.getCurrentWindow() as TauriWindow;
        await win.close();
      } catch (error) {
        console.warn('Tauri close failed:', error);
      }
    } else if (this._isElectron() && (await this.sendElectron('window-close'))) {
      // Handled by the main process
    } else if (typeof window !== 'undefined') {
      window.close();
    }
  }

  public async toggleFullscreen(): Promise<void> {
    if (this._isTauri()) {
      try {
        const tauriWindow = await dynamicImport('@tauri-apps/api/window');
        const win = tauriWindow.getCurrentWindow() as TauriWindow;
        if (await win.isFullscreen()) {
          await win.setFullscreen(false);
        } else {
          await win.setFullscreen(true);
        }
      } catch (error) {
        console.warn('Tauri fullscreen failed:', error);
      }
    } else if (this._isElectron() && (await this.sendElectron('window-fullscreen'))) {
      // Handled by the main process
    } else if (typeof document === 'undefined') {
      // SSR: nothing to do
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen?.();
    }
  }

  public async setTitle(title: string): Promise<void> {
    if (this._isTauri()) {
      try {
        const tauriWindow = await dynamicImport('@tauri-apps/api/window');
        const win = tauriWindow.getCurrentWindow() as TauriWindow;
        await win.setTitle(title);
      } catch (error) {
        console.warn('Tauri setTitle failed:', error);
      }
    } else if (this._isElectron() && (await this.sendElectron('window-set-title', title))) {
      // Handled by the main process
    } else if (typeof document !== 'undefined') {
      document.title = title;
    }
  }

  // Utility methods
  public getModifierKey(): string {
    return this._platform() === 'macos' ? '⌘' : 'Ctrl';
  }

  public getAltKey(): string {
    return this._platform() === 'macos' ? '⌥' : 'Alt';
  }

  /**
   * Format a shortcut such as `Ctrl+Shift+P` for display on the current
   * platform (`⌘⇧P` on macOS). `Ctrl++` / `Ctrl+Plus` denote the plus key.
   */
  public formatShortcut(shortcut: string): string {
    if (this._platform() !== 'macos') return shortcut;

    // Map whole parts only: a substring replace would mangle e.g. `CmdOrCtrl`,
    // and stripping every '+' would drop the plus key itself.
    const macSymbols: Record<string, string> = {
      ctrl: '⌘',
      control: '⌘',
      cmd: '⌘',
      command: '⌘',
      meta: '⌘',
      cmdorctrl: '⌘',
      commandorcontrol: '⌘',
      alt: '⌥',
      option: '⌥',
      shift: '⇧',
      plus: '+',
    };
    return splitShortcut(shortcut)
      .map(part => macSymbols[part.toLowerCase()] ?? part)
      .join('');
  }
}

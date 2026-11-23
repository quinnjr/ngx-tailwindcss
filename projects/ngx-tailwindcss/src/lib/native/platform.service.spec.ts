import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeAppPlatformService } from './platform.service';
import { OsPlatform } from './native.types';
import { setElectronIpcBridge } from './electron-bridge.util';

interface RuntimeGlobals {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  process?: { type?: string };
  electron?: unknown;
}

const runtimeWindow = window as Window & RuntimeGlobals;

function setUserAgent(userAgent: string): void {
  // Shadow the prototype getter with an instance-level value
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

function restoreUserAgent(): void {
  // Remove the instance-level override so the prototype getter is visible again
  delete (navigator as unknown as Record<string, unknown>)['userAgent'];
}

describe('NativeAppPlatformService', () => {
  afterEach(() => {
    restoreUserAgent();
    delete runtimeWindow.__TAURI_INTERNALS__;
    delete runtimeWindow.__TAURI__;
    delete runtimeWindow.process;
    delete runtimeWindow.electron;
    setElectronIpcBridge(null);
  });

  describe('detectPlatform()', () => {
    const cases: Array<{ userAgent: string; expected: OsPlatform }> = [
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        expected: 'macos',
      },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        expected: 'windows',
      },
      {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        expected: 'linux',
      },
      {
        userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 5/2.26)',
        expected: 'web',
      },
    ];

    for (const { userAgent, expected } of cases) {
      it(`detects '${expected}' from user agent '${userAgent}'`, () => {
        setUserAgent(userAgent);
        const service = new NativeAppPlatformService();
        expect(service.platform()).toBe(expected);
      });
    }
  });

  describe('runtime detection', () => {
    it('reports web (not Tauri, not Electron) in a plain browser', () => {
      const service = new NativeAppPlatformService();
      expect(service.isTauri()).toBe(false);
      expect(service.isElectron()).toBe(false);
      expect(service.isNative()).toBe(false);
      expect(service.isWeb()).toBe(true);
    });

    it('detects Tauri v2 when __TAURI_INTERNALS__ is present', () => {
      runtimeWindow.__TAURI_INTERNALS__ = {};
      const service = new NativeAppPlatformService();
      expect(service.isTauri()).toBe(true);
      expect(service.isNative()).toBe(true);
      expect(service.isWeb()).toBe(false);
    });

    it('detects Tauri v1 when __TAURI__ is present', () => {
      runtimeWindow.__TAURI__ = {};
      const service = new NativeAppPlatformService();
      expect(service.isTauri()).toBe(true);
    });

    it('detects Electron when window.process.type is a string', () => {
      runtimeWindow.process = { type: 'renderer' };
      const service = new NativeAppPlatformService();
      expect(service.isElectron()).toBe(true);
      expect(service.isNative()).toBe(true);
      expect(service.isWeb()).toBe(false);
    });

    it('detects Electron from the user agent (contextIsolation hides process)', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 my-app/1.0 Electron/33.0.0');
      expect(new NativeAppPlatformService().isElectron()).toBe(true);
    });

    it('detects Electron from a preload-exposed window.electron.ipcRenderer bridge', () => {
      runtimeWindow.electron = {
        ipcRenderer: { send: () => {}, invoke: async () => {}, on: () => {}, once: () => {} },
      };
      expect(new NativeAppPlatformService().isElectron()).toBe(true);
    });
  });

  describe('Electron window commands', () => {
    it('sends window commands through the preload-exposed bridge', async () => {
      const send = vi.fn();
      runtimeWindow.electron = {
        ipcRenderer: { send, invoke: async () => {}, on: () => {}, once: () => {} },
      };
      const service = new NativeAppPlatformService();
      const before = document.title;
      await service.setTitle('Bridged');
      expect(send).toHaveBeenCalledWith('window-set-title', 'Bridged');
      expect(document.title).toBe(before);
    });

    it('falls back to web behaviour when no ipcRenderer is reachable', async () => {
      setUserAgent('Mozilla/5.0 Electron/33.0.0');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const service = new NativeAppPlatformService();
        expect(service.isElectron()).toBe(true);
        await expect(service.setTitle('Fallback title')).resolves.toBeUndefined();
        expect(document.title).toBe('Fallback title');
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('isDarkMode', () => {
    it('re-evaluates when the OS color scheme changes in system mode', () => {
      let changeListener: ((event: { matches: boolean }) => void) | undefined;
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
              changeListener = listener;
            },
            removeEventListener: () => {},
          }) as unknown as MediaQueryList
      );

      try {
        const service = new NativeAppPlatformService();
        expect(service.isDarkMode()).toBe(false);

        changeListener?.({ matches: true });
        expect(service.isDarkMode()).toBe(true);

        service.setTheme('light');
        expect(service.isDarkMode()).toBe(false);
      } finally {
        matchMediaSpy.mockRestore();
      }
    });
  });
});

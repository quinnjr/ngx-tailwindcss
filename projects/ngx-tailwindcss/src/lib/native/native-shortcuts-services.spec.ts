import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { splitShortcut } from './shortcut-keys.util';
import { TwShortcutDirective } from './shortcut.directive';
import { TwShortcutDisplayComponent } from './shortcut-display.component';
import { NativeAppPlatformService } from './platform.service';
import { NativeStorageService } from './storage.service';
import { NativeIpcService } from './ipc.service';
import { UpdateService } from './update.service';
import { ElectronIpcRendererLike, setElectronIpcBridge } from './electron-bridge.util';

@Component({
  template: `<button [twShortcut]="shortcut()" (shortcutTriggered)="count = count + 1">x</button>`,
  standalone: true,
  imports: [TwShortcutDirective],
})
class ShortcutHostComponent {
  shortcut = signal('ctrl++');
  count = 0;
}

function press(target: Element, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('splitShortcut', () => {
  it('splits on + and treats an empty part as the plus key', () => {
    expect(splitShortcut('ctrl+shift+p')).toEqual(['ctrl', 'shift', 'p']);
    expect(splitShortcut('ctrl++')).toEqual(['ctrl', '+']);
    expect(splitShortcut('ctrl + +')).toEqual(['ctrl', '+']);
    expect(splitShortcut('+')).toEqual(['+']);
    expect(splitShortcut('ctrl+')).toEqual(['ctrl']);
  });
});

describe('TwShortcutDirective', () => {
  function setup(shortcut: string) {
    const fixture = TestBed.createComponent(ShortcutHostComponent);
    fixture.componentInstance.shortcut.set(shortcut);
    fixture.detectChanges();
    return { fixture, button: fixture.nativeElement.querySelector('button') as HTMLElement };
  }

  it('binds ctrl++ to the plus key, including Shift+= on US layouts', () => {
    const { fixture, button } = setup('ctrl++');
    press(button, { key: '+', ctrlKey: true });
    press(button, { key: '+', ctrlKey: true, shiftKey: true });
    expect(fixture.componentInstance.count).toBe(2);
  });

  it('still binds ctrl+plus', () => {
    const { fixture, button } = setup('ctrl+plus');
    press(button, { key: '+', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });

  it('still rejects an unrequested Shift for letters', () => {
    const { fixture, button } = setup('ctrl+s');
    press(button, { key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true });
    expect(fixture.componentInstance.count).toBe(0);
    press(button, { key: 's', code: 'KeyS', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });
});

describe('TwShortcutDisplayComponent', () => {
  function keysFor(shortcut: string, platform: string): string[] {
    const fixture = TestBed.createComponent(TwShortcutDisplayComponent);
    fixture.componentRef.setInput('shortcut', shortcut);
    fixture.componentRef.setInput('platform', platform);
    fixture.detectChanges();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('kbd')].map(k =>
      (k.textContent ?? '').trim()
    );
  }

  it('shows the plus key distinctly from the separator', () => {
    expect(keysFor('Ctrl++', 'windows')).toEqual(['Ctrl', 'Plus']);
    expect(keysFor('Ctrl+Plus', 'windows')).toEqual(['Ctrl', 'Plus']);
    expect(keysFor('Ctrl++', 'mac')).toEqual(['⌃', '+']);
  });

  it("renders with platform 'linux' (previously threw)", () => {
    expect(keysFor('Ctrl+Shift+P', 'linux')).toEqual(['Ctrl', 'Shift', 'P']);
  });
});

describe('NativeAppPlatformService.formatShortcut', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>)['userAgent'];
  });

  it('keeps the plus key and maps whole modifier names on macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    const service = new NativeAppPlatformService();
    expect(service.formatShortcut('Ctrl++')).toBe('⌘+');
    expect(service.formatShortcut('Ctrl+Shift+P')).toBe('⌘⇧P');
    expect(service.formatShortcut('CmdOrCtrl+Alt+S')).toBe('⌘⌥S');
  });
});

describe('NativeStorageService without Web Storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remove/clear/keys/has do not throw when localStorage is unavailable', () => {
    const service = TestBed.inject(NativeStorageService);
    vi.stubGlobal('localStorage', undefined);
    expect(() => {
      service.remove('a');
    }).not.toThrow();
    expect(() => {
      service.clear();
    }).not.toThrow();
    expect(service.keys()).toEqual([]);
    expect(service.has('a')).toBe(false);
  });
});

describe('Electron services without a reachable ipcRenderer', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>)['userAgent'];
    setElectronIpcBridge(null);
  });

  it('once() falls back to window events', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Electron/33.0.0',
      configurable: true,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      TestBed.resetTestingModule();
      const ipc = TestBed.inject(NativeIpcService);
      const callback = vi.fn();
      await ipc.once('fallback-channel', callback);
      ipc.emit('fallback-channel', 42);
      expect(callback).toHaveBeenCalledWith(42);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('UpdateService teardown', () => {
  afterEach(() => {
    setElectronIpcBridge(null);
  });

  it('unsubscribes its updater IPC listeners on destroy', async () => {
    const unsubscribe = vi.fn();
    const bridge: ElectronIpcRendererLike = {
      invoke: () => Promise.resolve(null),
      send: () => {},
      on: () => unsubscribe,
      once: () => {},
    };
    setElectronIpcBridge(bridge);
    TestBed.resetTestingModule();
    TestBed.inject(UpdateService);
    // Let the async listener setup resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
    TestBed.resetTestingModule();
    expect(unsubscribe).toHaveBeenCalledTimes(5);
  });
});

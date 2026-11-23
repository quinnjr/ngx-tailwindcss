import { dynamicImport } from './dynamic-import.util';

/**
 * The subset of Electron's `ipcRenderer` API used by the native services.
 *
 * `on` may return an unsubscribe function (as `@electron-toolkit/preload`
 * does); when it does, it is preferred over `removeListener`, because a
 * listener that crossed the `contextBridge` is proxied and cannot be removed
 * by identity.
 */
export interface ElectronIpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<any>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: unknown, ...args: any[]) => void): unknown;
  once(channel: string, listener: (event: unknown, ...args: any[]) => void): unknown;
  removeListener?(channel: string, listener: (event: unknown, ...args: any[]) => void): unknown;
}

let configuredBridge: ElectronIpcRendererLike | null = null;

/**
 * Explicitly provide the `ipcRenderer`-like bridge the native services should
 * use in Electron (e.g. one exposed under a custom name by your preload
 * script). Pass `null` to clear it.
 */
export function setElectronIpcBridge(bridge: ElectronIpcRendererLike | null): void {
  configuredBridge = bridge;
}

function isIpcLike(value: unknown): value is ElectronIpcRendererLike {
  return (
    !!value &&
    typeof (value as ElectronIpcRendererLike).send === 'function' &&
    typeof (value as ElectronIpcRendererLike).invoke === 'function' &&
    typeof (value as ElectronIpcRendererLike).on === 'function'
  );
}

/**
 * Find a preload-exposed `ipcRenderer` bridge, if any. Checked in order:
 * the bridge passed to {@link setElectronIpcBridge}, `window.electron.ipcRenderer`
 * (the `@electron-toolkit/preload` convention), then `window.ipcRenderer`.
 */
export function getExposedElectronIpc(): ElectronIpcRendererLike | null {
  if (configuredBridge) return configuredBridge;
  if (typeof window === 'undefined') return null;

  const win = window as unknown as {
    electron?: { ipcRenderer?: unknown };
    ipcRenderer?: unknown;
  };
  if (isIpcLike(win.electron?.ipcRenderer)) return win.electron.ipcRenderer;
  if (isIpcLike(win.ipcRenderer)) return win.ipcRenderer;
  return null;
}

/**
 * Resolve Electron's `ipcRenderer` for the renderer process.
 *
 * With Electron's secure defaults (`contextIsolation: true`,
 * `nodeIntegration: false`) the renderer cannot `import('electron')`. Your
 * preload script must expose an ipcRenderer-like bridge via `contextBridge`,
 * e.g. `contextBridge.exposeInMainWorld('electron', { ipcRenderer: {...} })`
 * (as `@electron-toolkit/preload` does), or you must register one with
 * {@link setElectronIpcBridge}. Only when no bridge is found is
 * `import('electron')` attempted (works with `nodeIntegration` only).
 *
 * @returns a promise rejecting when no ipcRenderer is reachable; callers must
 * catch and fall back to web behaviour.
 */
export async function loadElectronIpc(): Promise<{ ipcRenderer: ElectronIpcRendererLike }> {
  const exposed = getExposedElectronIpc();
  if (exposed) return { ipcRenderer: exposed };

  const electron = await dynamicImport('electron');
  if (!isIpcLike(electron?.ipcRenderer)) {
    throw new Error('Electron ipcRenderer is not available in this renderer');
  }
  return { ipcRenderer: electron.ipcRenderer };
}

/**
 * Subscribe on an ipcRenderer and return a reliable unsubscribe function.
 */
export function subscribeElectronIpc(
  ipcRenderer: ElectronIpcRendererLike,
  channel: string,
  listener: (event: unknown, ...args: any[]) => void
): () => void {
  const result = ipcRenderer.on(channel, listener);
  if (typeof result === 'function') {
    return result as () => void;
  }
  return () => {
    ipcRenderer.removeListener?.(channel, listener);
  };
}

/**
 * Whether an Electron ipcRenderer can be reached (preload bridge or
 * `nodeIntegration`). Use it to fall back to web behaviour when it can't.
 */
export function isElectronIpcAvailable(): Promise<boolean> {
  return loadElectronIpc().then(
    () => true,
    () => false
  );
}

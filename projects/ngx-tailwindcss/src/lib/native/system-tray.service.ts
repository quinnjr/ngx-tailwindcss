import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { NativeAppPlatformService } from './platform.service';
import { NativeMenuItem } from './native.types';
import { dynamicImport } from './dynamic-import.util';
import { loadElectronIpc, subscribeElectronIpc } from './electron-bridge.util';

export interface TrayConfig {
  icon: string;
  tooltip?: string;
  title?: string;
  menu?: NativeMenuItem[];
}

@Injectable({
  providedIn: 'root',
})
export class SystemTrayService implements OnDestroy {
  private readonly platformService = inject(NativeAppPlatformService);

  public readonly isSupported = signal(false);
  public readonly isVisible = signal(false);

  private trayInstance: unknown = null;

  // Id -> action routing table for Electron menu clicks (see convertMenuForElectron)
  private readonly electronMenuActions = new Map<string, () => void>();
  private electronMenuListenerRegistered = false;
  private unsubscribeMenuClick: (() => void) | null = null;
  private destroyed = false;

  constructor() {
    this.checkSupport();
  }

  /** Remove the IPC menu-click listener (it would otherwise outlive the app). */
  public ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeMenuClick?.();
    this.unsubscribeMenuClick = null;
    this.electronMenuListenerRegistered = false;
    this.electronMenuActions.clear();
  }

  private checkSupport(): void {
    this.isSupported.set(this.platformService.isTauri() || this.platformService.isElectron());
  }

  public async create(config: TrayConfig): Promise<boolean> {
    if (this.platformService.isTauri()) {
      return this.createTauriTray(config);
    }
    if (this.platformService.isElectron()) {
      return this.createElectronTray(config);
    }

    console.warn('System tray is not supported on this platform');
    return false;
  }

  /**
   * Set the tray icon.
   * @returns false when the tray has not been created yet (Tauri) or the
   * platform has no tray support; true when the update was dispatched.
   */
  public async setIcon(icon: string): Promise<boolean> {
    if (this.platformService.isTauri()) {
      if (!this.trayInstance) return false;
      const tray = this.trayInstance as { setIcon: (icon: string) => Promise<void> };
      await tray.setIcon(icon);
      return true;
    }
    if (this.platformService.isElectron()) {
      try {
        const { ipcRenderer } = await loadElectronIpc();
        ipcRenderer.send('tray-set-icon', icon);
        return true;
      } catch (error) {
        console.error('Failed to update Electron tray:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Set the tray tooltip.
   * @returns false when the tray has not been created yet (Tauri) or the
   * platform has no tray support; true when the update was dispatched.
   */
  public async setTooltip(tooltip: string): Promise<boolean> {
    if (this.platformService.isTauri()) {
      if (!this.trayInstance) return false;
      const tray = this.trayInstance as { setTooltip: (tooltip: string) => Promise<void> };
      await tray.setTooltip(tooltip);
      return true;
    }
    if (this.platformService.isElectron()) {
      try {
        const { ipcRenderer } = await loadElectronIpc();
        ipcRenderer.send('tray-set-tooltip', tooltip);
        return true;
      } catch (error) {
        console.error('Failed to update Electron tray:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Set the tray context menu.
   * On Electron, item `action` callbacks are routed by id: the main process
   * must echo the clicked item's id back on the 'tray-menu-click' channel.
   * @returns false when the tray has not been created yet (Tauri) or the
   * platform has no tray support; true when the update was dispatched.
   */
  public async setMenu(menu: NativeMenuItem[]): Promise<boolean> {
    if (this.platformService.isTauri()) {
      if (!this.trayInstance) return false;
      await this.setTauriMenu(menu);
      return true;
    }
    if (this.platformService.isElectron()) {
      try {
        const { ipcRenderer } = await loadElectronIpc();
        await this.registerElectronMenuClickListener();
        ipcRenderer.send('tray-set-menu', this.convertMenuForElectron(menu));
        return true;
      } catch (error) {
        console.error('Failed to set Electron tray menu:', error);
        return false;
      }
    }
    return false;
  }

  public async destroy(): Promise<void> {
    if (this.platformService.isTauri() && this.trayInstance) {
      // Dropping the JS reference alone leaves the native tray icon visible
      const tray = this.trayInstance as { close?: () => Promise<void> };
      this.trayInstance = null;
      try {
        await tray.close?.();
      } catch (error) {
        console.error('Failed to destroy Tauri tray:', error);
      }
    } else if (this.platformService.isElectron()) {
      try {
        const { ipcRenderer } = await loadElectronIpc();
        ipcRenderer.send('tray-destroy');
      } catch (error) {
        console.error('Failed to destroy Electron tray:', error);
      }
    }

    this.electronMenuActions.clear();
    this.isVisible.set(false);
  }

  private async createTauriTray(config: TrayConfig): Promise<boolean> {
    try {
      const tauriTray = await dynamicImport('@tauri-apps/api/tray');

      this.trayInstance = await tauriTray.TrayIcon.new({
        icon: config.icon,
        tooltip: config.tooltip,
        title: config.title,
      });

      if (config.menu) {
        await this.setTauriMenu(config.menu);
      }

      this.isVisible.set(true);
      return true;
    } catch (error) {
      console.error('Failed to create Tauri tray:', error);
      return false;
    }
  }

  private async createElectronTray(config: TrayConfig): Promise<boolean> {
    try {
      const { ipcRenderer } = await loadElectronIpc();

      await this.registerElectronMenuClickListener();
      await ipcRenderer.invoke('tray-create', {
        icon: config.icon,
        tooltip: config.tooltip,
        menu: config.menu ? this.convertMenuForElectron(config.menu) : undefined,
      });

      this.isVisible.set(true);
      return true;
    } catch (error) {
      console.error('Failed to create Electron tray:', error);
      return false;
    }
  }

  private async buildTauriMenuItems(items: NativeMenuItem[]): Promise<unknown[]> {
    const tauriMenu = await dynamicImport('@tauri-apps/api/menu');
    const { MenuItem, PredefinedMenuItem, Submenu } = tauriMenu;

    const menuItems: unknown[] = [];

    for (const item of items) {
      if (item.type === 'separator') {
        // A real native separator (a MenuItem would render a disabled '-' entry)
        menuItems.push(await PredefinedMenuItem.new({ item: 'Separator' }));
      } else if (item.submenu) {
        menuItems.push(
          await Submenu.new({
            id: item.id,
            text: item.label,
            items: await this.buildTauriMenuItems(item.submenu),
          })
        );
      } else {
        menuItems.push(
          await MenuItem.new({
            id: item.id,
            text: item.label,
            enabled: !item.disabled,
            accelerator: item.shortcut,
            action: item.action,
          })
        );
      }
    }

    return menuItems;
  }

  private async buildTauriMenu(items: NativeMenuItem[]): Promise<unknown> {
    const tauriMenu = await dynamicImport('@tauri-apps/api/menu');
    const { Menu } = tauriMenu;

    return Menu.new({ items: await this.buildTauriMenuItems(items) });
  }

  private async setTauriMenu(items: NativeMenuItem[]): Promise<void> {
    if (!this.trayInstance) return;

    const menu = await this.buildTauriMenu(items);
    const tray = this.trayInstance as { setMenu: (menu: unknown) => Promise<void> };
    await tray.setMenu(menu);
  }

  /**
   * Listen for tray menu clicks echoed back from the Electron main process on
   * the 'tray-menu-click' channel (payload: the clicked item's id) and invoke
   * the matching registered action.
   */
  private async registerElectronMenuClickListener(): Promise<void> {
    if (this.electronMenuListenerRegistered) return;

    try {
      const { ipcRenderer } = await loadElectronIpc();
      if (this.electronMenuListenerRegistered || this.destroyed) return;
      this.unsubscribeMenuClick = subscribeElectronIpc(
        ipcRenderer,
        'tray-menu-click',
        (_event: unknown, id: unknown) => {
          this.electronMenuActions.get(String(id))?.();
        }
      );
      this.electronMenuListenerRegistered = true;
    } catch (error) {
      console.warn('Failed to register tray menu click listener:', error);
    }
  }

  /**
   * Convert menu items to a serializable structure for the Electron main
   * process. Functions cannot cross the IPC boundary, so each item's `action`
   * is registered locally under its id; the main process must echo the
   * clicked item's id back on the 'tray-menu-click' channel for actions to
   * fire (see registerElectronMenuClickListener).
   */
  private convertMenuForElectron(items: NativeMenuItem[], isRoot = true): unknown[] {
    if (isRoot) {
      this.electronMenuActions.clear();
    }

    return items.map(item => {
      if (item.type === 'separator') {
        return { type: 'separator' };
      }

      const electronItem: Record<string, unknown> = {
        id: item.id,
        label: item.label,
        enabled: !item.disabled,
        accelerator: item.shortcut,
        type: item.type === 'checkbox' ? 'checkbox' : item.type === 'radio' ? 'radio' : 'normal',
        checked: item.checked,
      };

      if (item.submenu) {
        electronItem['submenu'] = this.convertMenuForElectron(item.submenu, false);
      }

      if (item.action) {
        this.electronMenuActions.set(item.id, item.action);
      }

      return electronItem;
    });
  }
}

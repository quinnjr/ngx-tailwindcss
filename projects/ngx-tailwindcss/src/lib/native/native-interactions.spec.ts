import { Component, NgZone, provideZoneChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwShortcutDirective } from './shortcut.directive';
import { ShortcutBinding, TwShortcutsEditorComponent } from './shortcuts-editor.component';
import { QuickSwitcherItem, TwQuickSwitcherComponent } from './quick-switcher.component';
import { TwTabBarComponent } from './tab-bar.component';
import { TwResizablePanelsComponent } from './resizable-panels.component';
import { TwFileTreeComponent } from './file-tree.component';
import { TwNativeConfirmDialogComponent } from './confirm-dialog.component';
import { TwAboutDialogComponent } from './about-dialog.component';
import { TwSidebarNavComponent } from './sidebar.component';
import { DockService } from './dock.service';
import { SystemTrayService } from './system-tray.service';
import { ElectronIpcRendererLike, setElectronIpcBridge } from './electron-bridge.util';
import { FileTreeEvent, FileTreeNode, NativeMenuItem, TabItem } from './native.types';

@Component({
  template: `<button [twShortcut]="shortcut()" (shortcutTriggered)="count = count + 1">x</button>`,
  standalone: true,
  imports: [TwShortcutDirective],
})
class ShortcutHostComponent {
  shortcut = signal('ctrl+shift+/');
  count = 0;
}

function press(target: Element, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

function nextMacrotask(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

describe('TwShortcutDirective with shifted punctuation', () => {
  function setup(shortcut: string) {
    const fixture = TestBed.createComponent(ShortcutHostComponent);
    fixture.componentInstance.shortcut.set(shortcut);
    fixture.detectChanges();
    return { fixture, button: fixture.nativeElement.querySelector('button') as HTMLElement };
  }

  it('fires ctrl+shift+/ although Shift turns the key into "?"', () => {
    const { fixture, button } = setup('ctrl+shift+/');
    press(button, { key: '?', code: 'Slash', ctrlKey: true, shiftKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });

  it('does not fire ctrl+/ for Ctrl+Shift+/ ("?")', () => {
    const { fixture, button } = setup('ctrl+/');
    press(button, { key: '?', code: 'Slash', ctrlKey: true, shiftKey: true });
    expect(fixture.componentInstance.count).toBe(0);
    press(button, { key: '/', code: 'Slash', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });
});

describe('TwShortcutsEditorComponent conflicts', () => {
  it('detects a conflict regardless of key case', () => {
    const fixture = TestBed.createComponent(TwShortcutsEditorComponent);
    const save: ShortcutBinding = {
      id: 'save',
      command: 'Save',
      keys: ['Ctrl', 'S'],
      defaultKeys: ['Ctrl', 'S'],
    };
    const open: ShortcutBinding = {
      id: 'open',
      command: 'Open',
      keys: ['Ctrl', 'O'],
      defaultKeys: ['Ctrl', 'O'],
    };
    fixture.componentRef.setInput('shortcuts', [save, open]);
    fixture.detectChanges();

    const editor = fixture.componentInstance;
    editor.startEdit(open);
    editor.handleKeydown(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));

    expect(editor.conflictWarning()).toContain('Save');
    editor.cancelEdit();
  });
});

describe('TwQuickSwitcherComponent recent items', () => {
  it('lists recent items in recentItemIds order', () => {
    const fixture = TestBed.createComponent(TwQuickSwitcherComponent);
    const items: QuickSwitcherItem[] = ['a', 'b', 'c'].map(id => ({
      id,
      label: id,
      type: 'file',
    }));
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('recentItemIds', ['c', 'missing', 'a']);
    fixture.detectChanges();

    expect(fixture.componentInstance.recentItems().map(item => item.id)).toEqual(['c', 'a']);
  });
});

describe('TwTabBarComponent', () => {
  const tabs: TabItem[] = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
  ];

  function setup() {
    const fixture = TestBed.createComponent(TwTabBarComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.detectChanges();
    return fixture;
  }

  it('closes the overflow menu on an outside click and on Escape', () => {
    const fixture = setup();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('[aria-label="More tabs"]')!;

    toggle.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Close All Tabs');

    document.body.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Close All Tabs');

    toggle.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Close All Tabs');
  });

  it('does not reorder on a drop after a cancelled tab drag', () => {
    const fixture = setup();
    const reorders: unknown[] = [];
    fixture.componentInstance.tabReorder.subscribe(e => reorders.push(e));
    const tabEls = fixture.nativeElement.querySelectorAll('[draggable="true"]');

    tabEls[0].dispatchEvent(new Event('dragstart'));
    tabEls[0].dispatchEvent(new Event('dragend'));
    tabEls[1].dispatchEvent(new Event('drop'));

    expect(reorders).toEqual([]);
  });
});

describe('TwResizablePanelsComponent collapse', () => {
  it('lets the remaining panel fill the space when the other collapses', () => {
    const fixture = TestBed.createComponent(TwResizablePanelsComponent);
    fixture.detectChanges();
    fixture.componentInstance.togglePanel1Collapse();
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('div') as HTMLElement;
    const panel2 = container.lastElementChild as HTMLElement;
    expect(panel2.style.flexBasis).toBe('100%');
  });
});

describe('TwFileTreeComponent keyboard access', () => {
  it('makes items focusable and operable with Enter, Space and arrows', () => {
    const fixture = TestBed.createComponent(TwFileTreeComponent);
    const folder: FileTreeNode = {
      id: 'src',
      name: 'src',
      type: 'folder',
      children: [{ id: 'main', name: 'main.ts', type: 'file' }],
    };
    fixture.componentRef.setInput('nodes', [folder]);
    fixture.detectChanges();

    const selected: string[] = [];
    const opened: string[] = [];
    fixture.componentInstance.nodeSelect.subscribe((e: FileTreeEvent) => selected.push(e.node.id));
    fixture.componentInstance.nodeDoubleClick.subscribe((e: FileTreeEvent) =>
      opened.push(e.node.id)
    );

    const items = () =>
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="treeitem"]');
    expect(items()[0].getAttribute('tabindex')).toBe('0');

    press(items()[0], { key: 'ArrowRight' });
    fixture.detectChanges();
    expect(folder.expanded).toBe(true);
    expect(items().length).toBe(2);

    press(items()[1], { key: ' ' });
    press(items()[1], { key: 'Enter' });
    expect(selected).toEqual(['main', 'main']);
    expect(opened).toEqual(['main']);
  });
});

@Component({
  template: `
    <button id="opener">open</button>
    <tw-native-confirm-dialog [open]="open()"></tw-native-confirm-dialog>
    <tw-native-confirm-dialog [open]="open()"></tw-native-confirm-dialog>
    <tw-about-dialog [open]="open()"></tw-about-dialog>
  `,
  standalone: true,
  imports: [TwNativeConfirmDialogComponent, TwAboutDialogComponent],
})
class DialogsHostComponent {
  open = signal(false);
}

describe('Native confirm/about dialogs', () => {
  it('move focus into the dialog and use unique aria ids', async () => {
    const fixture = TestBed.createComponent(DialogsHostComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    try {
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      await nextMacrotask();

      const dialogs = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBe(3);
      expect(dialogs[2].contains(document.activeElement)).toBe(true);

      const ids = [...dialogs].map(d => d.getAttribute('aria-labelledby'));
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(document.querySelector(`#${id}`)).not.toBeNull();
      }
    } finally {
      fixture.nativeElement.remove();
    }
  });
});

describe('TwSidebarNavComponent position', () => {
  it('puts the border only on the inner edge of a right sidebar', () => {
    const fixture = TestBed.createComponent(TwSidebarNavComponent);
    fixture.componentRef.setInput('position', 'right');
    fixture.detectChanges();

    const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
    expect(aside.classList).toContain('border-l');
    expect(aside.classList).not.toContain('border-r');
  });
});

describe('Electron dock/tray menu clicks', () => {
  afterEach(() => {
    setElectronIpcBridge(null);
  });

  function fakeBridge() {
    const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>();
    const bridge: ElectronIpcRendererLike = {
      invoke: () => Promise.resolve(null),
      send: () => {},
      on: (channel, listener) => {
        listeners.set(channel, listener);
        return () => listeners.delete(channel);
      },
      once: () => {},
    };
    return { bridge, listeners };
  }

  it.each([
    ['dock-menu-click', DockService],
    ['tray-menu-click', SystemTrayService],
  ] as const)('runs %s actions inside the Angular zone', async (channel, serviceType) => {
    const { bridge, listeners } = fakeBridge();
    setElectronIpcBridge(bridge);
    TestBed.resetTestingModule();
    // A zone-based app (TestBed defaults to zoneless)
    TestBed.configureTestingModule({ providers: [provideZoneChangeDetection()] });
    const service: { setMenu(items: NativeMenuItem[]): Promise<unknown> } = TestBed.inject<
      DockService | SystemTrayService
    >(serviceType);

    let inZone: boolean | null = null;
    const action = vi.fn(() => {
      inZone = NgZone.isInAngularZone();
    });
    await service.setMenu([{ id: 'prefs', label: 'Preferences', action }]);

    // IPC callbacks are delivered outside the zone
    Zone.root.run(() => listeners.get(channel)?.(null, 'prefs'));
    expect(action).toHaveBeenCalledTimes(1);
    expect(inZone).toBe(true);
  });
});

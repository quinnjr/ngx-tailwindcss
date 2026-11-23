import { Component, NgZone, provideZoneChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwShortcutDirective } from './shortcut.directive';
import { ShortcutBinding, TwShortcutsEditorComponent } from './shortcuts-editor.component';
import { QuickSwitcherItem, TwQuickSwitcherComponent } from './quick-switcher.component';
import { TwTabBarComponent } from './tab-bar.component';
import { TwOnboardingWizardComponent } from './onboarding-wizard.component';
import { TwUpdateDialogComponent, UpdateDialogInfo } from './update-dialog.component';
import { TwResizablePanelsComponent } from './resizable-panels.component';
import { TwFileTreeComponent } from './file-tree.component';
import { TwLogViewerComponent } from './log-viewer.component';
import { TwNativeConfirmDialogComponent } from './confirm-dialog.component';
import { TwAboutDialogComponent } from './about-dialog.component';
import { TwPreferencesDialogComponent } from './preferences-dialog.component';
import { TwSidebarNavComponent } from './sidebar.component';
import { TwDropZoneDirective } from './drop-zone.directive';
import { DockService } from './dock.service';
import { SystemTrayService } from './system-tray.service';
import { ElectronIpcRendererLike, setElectronIpcBridge } from './electron-bridge.util';
import { TwMenuBarComponent } from './menu-bar.component';
import { TwNativeContextMenuComponent } from './context-menu.component';
import { TwSettingsPanelComponent } from './settings-panel.component';
import { TwSearchBarComponent } from './search-bar.component';
import { TwToolbarComponent } from './toolbar.component';
import { TwPropertyInspectorComponent } from './property-inspector.component';
import { TwCommandPaletteComponent } from './command-palette.component';
import { TwPromptDialogComponent } from './prompt-dialog.component';
import {
  DropEvent,
  FileTreeEvent,
  FileTreeNode,
  NativeMenuBarItem,
  NativeMenuItem,
  TabItem,
} from './native.types';

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

  it('closes when the backdrop is clicked but not when the panel is', () => {
    const fixture = TestBed.createComponent(TwQuickSwitcherComponent);
    fixture.componentInstance.open();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('[role="dialog"] > .max-w-xl')!.click();
    expect(fixture.componentInstance.isOpen()).toBe(true);

    // The backdrop covers the whole overlay, so it is what a user clicks
    el.querySelector<HTMLElement>('.backdrop-blur-sm')!.click();
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });
});

describe('TwSidebarNavComponent collapsed accessible names', () => {
  it('names a collapsed icon item by its label, not its icon glyph', () => {
    const fixture = TestBed.createComponent(TwSidebarNavComponent);
    fixture.componentRef.setInput('items', [{ id: 'files', label: 'Files', icon: '📁' }]);
    fixture.detectChanges();
    const button = () => (fixture.nativeElement as HTMLElement).querySelector('nav button')!;
    expect(button().hasAttribute('aria-label')).toBe(false);

    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Files');
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

describe('TwShortcutDirective on non-QWERTY layouts', () => {
  function setup(shortcut: string) {
    const fixture = TestBed.createComponent(ShortcutHostComponent);
    fixture.componentInstance.shortcut.set(shortcut);
    fixture.detectChanges();
    return { fixture, button: fixture.nativeElement.querySelector('button') as HTMLElement };
  }

  it('does not fire ctrl+y for QWERTZ Ctrl+Z (typed at KeyY)', () => {
    const { fixture, button } = setup('ctrl+y');
    press(button, { key: 'z', code: 'KeyY', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(0);
    press(button, { key: 'y', code: 'KeyZ', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });

  it('does not fire ctrl+/ for QWERTZ Ctrl+- (typed at Slash)', () => {
    const { fixture, button } = setup('ctrl+/');
    press(button, { key: '-', code: 'Slash', ctrlKey: true });
    expect(fixture.componentInstance.count).toBe(0);
  });

  it('still falls back to the physical key for non-ASCII characters', () => {
    const { fixture, button } = setup('alt+s');
    press(button, { key: 'ß', code: 'KeyS', altKey: true });
    expect(fixture.componentInstance.count).toBe(1);
  });

  it('falls back to the physical key when Option/AltGr types ASCII punctuation', () => {
    // German macOS: Option+5 types '['
    const mac = setup('alt+5');
    press(mac.button, { key: '[', code: 'Digit5', altKey: true });
    expect(mac.fixture.componentInstance.count).toBe(1);

    // German Windows: Ctrl+Alt (AltGr) +8 types '['
    const win = setup('ctrl+alt+8');
    press(win.button, { key: '[', code: 'Digit8', ctrlKey: true, altKey: true });
    expect(win.fixture.componentInstance.count).toBe(1);
  });
});

describe('TwShortcutsEditorComponent recording', () => {
  it('cancels recording on a bare Escape instead of binding it', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(TwShortcutsEditorComponent);
      const save: ShortcutBinding = {
        id: 'save',
        command: 'Save',
        keys: ['Ctrl', 'S'],
        defaultKeys: ['Ctrl', 'S'],
      };
      fixture.componentRef.setInput('shortcuts', [save]);
      fixture.detectChanges();
      const editor = fixture.componentInstance;
      const changes: unknown[] = [];
      editor.shortcutChanged.subscribe(e => changes.push(e));

      editor.startEdit(save);
      editor.handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      vi.advanceTimersByTime(1000);

      expect(editor.editingId()).toBeNull();
      expect(changes).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TwTabBarComponent close button', () => {
  it('is not nested inside the tab button', () => {
    const fixture = TestBed.createComponent(TwTabBarComponent);
    fixture.componentRef.setInput('tabs', [{ id: 'one', label: 'One' }]);
    fixture.detectChanges();
    const closes: unknown[] = [];
    fixture.componentInstance.tabClose.subscribe(e => closes.push(e));
    const selects: unknown[] = [];
    fixture.componentInstance.tabSelect.subscribe(e => selects.push(e));

    const close = fixture.nativeElement.querySelector(
      '[aria-label="Close One"]'
    ) as HTMLButtonElement;
    expect(close.parentElement?.closest('button')).toBeNull();

    close.click();
    expect(closes.length).toBe(1);
    expect(selects.length).toBe(0);
  });
});

describe('Native a11y semantics', () => {
  it('onboarding wizard is a labelled modal dialog with named step buttons', () => {
    const fixture = TestBed.createComponent(TwOnboardingWizardComponent);
    fixture.componentRef.setInput('steps', [
      { id: 'a', title: 'Welcome' },
      { id: 'b', title: 'Sync' },
    ]);
    fixture.componentInstance.open();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = el.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent?.trim()).toBe('Welcome');
    const dot = el.querySelector<HTMLButtonElement>('[aria-label="Go to step 2: Sync"]')!;
    expect(dot).not.toBeNull();
    // Inactive dots must reach 3:1 against the panel; the current one differs by size too
    expect(dot.classList).toContain('bg-slate-500');
    expect(dot.classList).toContain('dark:bg-slate-400');
    expect(dot.classList).not.toContain('bg-slate-300');
    dot.click();
    fixture.detectChanges();
    expect(dot.getAttribute('aria-current')).toBe('step');
    expect(dot.classList).toContain('w-6');
  });

  it('update dialog auto-update toggle exposes its state as a switch', () => {
    const fixture = TestBed.createComponent(TwUpdateDialogComponent);
    const info: UpdateDialogInfo = { currentVersion: '1.0.0', newVersion: '2.0.0' };
    fixture.componentRef.setInput('updateInfo', info);
    fixture.componentInstance.open(info);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});

describe('TwPreferencesDialogComponent tabs', () => {
  it('emits tabChanged when a tab button is clicked', () => {
    const fixture = TestBed.createComponent(TwPreferencesDialogComponent);
    fixture.componentRef.setInput('tabs', [
      { id: 'general', label: 'General' },
      { id: 'advanced', label: 'Advanced' },
    ]);
    fixture.componentInstance.open();
    fixture.detectChanges();
    const changes: string[] = [];
    fixture.componentInstance.tabChanged.subscribe(id => changes.push(id));

    const tab = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find(b => b.textContent?.includes('Advanced'))!;
    tab.click();
    fixture.detectChanges();

    expect(changes).toEqual(['advanced']);
    expect(fixture.componentInstance.selectedTab()?.id).toBe('advanced');
    expect(tab.getAttribute('type')).toBe('button');
    expect(tab.getAttribute('aria-pressed')).toBe('true');
  });
});

@Component({
  template: `<div twDropZone [acceptTypes]="acceptTypes" (dropped)="drops.push($event)"></div>`,
  standalone: true,
  imports: [TwDropZoneDirective],
})
class DropZoneHostComponent {
  acceptTypes: string[] = ['text'];
  drops: DropEvent[] = [];
}

describe('TwDropZoneDirective', () => {
  it('reports a plain-text drop as text data', () => {
    const fixture = TestBed.createComponent(DropZoneHostComponent);
    fixture.detectChanges();
    const zone = (fixture.nativeElement as HTMLElement).querySelector('div')!;
    const store: Record<string, string> = { 'text/plain': 'hello' };
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        types: ['text/plain'],
        files: [],
        getData: (type: string) => store[type] ?? '',
      },
    });
    zone.dispatchEvent(drop);

    expect(fixture.componentInstance.drops.length).toBe(1);
    expect(fixture.componentInstance.drops[0].data).toEqual({ type: 'text', data: 'hello' });
  });
});

describe('TwResizablePanelsComponent keyboard', () => {
  it('resizes from the keyboard via a focusable separator, within the bounds', () => {
    const fixture = TestBed.createComponent(TwResizablePanelsComponent);
    fixture.detectChanges();
    const separator = fixture.nativeElement.querySelector('[role="separator"]') as HTMLElement;
    expect(separator.tabIndex).toBe(0);
    expect(separator.getAttribute('aria-valuenow')).toBe('50');

    const sizes: number[] = [];
    fixture.componentInstance.sizeChanged.subscribe(s => sizes.push(s.panel1));
    const pressKey = (key: string, shiftKey = false) => {
      press(separator, { key, shiftKey });
      fixture.detectChanges();
    };

    pressKey('ArrowRight');
    pressKey('ArrowLeft', true);
    pressKey('Home');
    pressKey('End');
    expect(sizes).toEqual([52, 42, 10, 90]);
    expect(separator.getAttribute('aria-valuenow')).toBe('90');
  });
});

describe('native keyboard operability (round 20)', () => {
  it('tab bar reorders the focused tab with Ctrl+Shift+PageUp/PageDown', () => {
    const fixture = TestBed.createComponent(TwTabBarComponent);
    fixture.componentRef.setInput('tabs', [
      { id: 'one', label: 'One' },
      { id: 'two', label: 'Two' },
      { id: 'three', label: 'Three' },
    ]);
    fixture.detectChanges();
    const reorders: Array<{ from: number; to: number }> = [];
    fixture.componentInstance.tabReorder.subscribe(e => reorders.push(e));
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;

    press(tabs[1], { key: 'PageDown', ctrlKey: true, shiftKey: true });
    press(tabs[1], { key: 'PageUp', ctrlKey: true, shiftKey: true });
    // Out of range and without the modifiers: nothing
    press(tabs[0], { key: 'PageUp', ctrlKey: true, shiftKey: true });
    press(tabs[1], { key: 'PageDown' });

    expect(reorders).toEqual([
      { from: 1, to: 2 },
      { from: 1, to: 0 },
    ]);
  });

  it('log viewer entries can be selected from the keyboard', () => {
    const fixture = TestBed.createComponent(TwLogViewerComponent);
    fixture.componentRef.setInput('entries', [
      { id: '1', level: 'info', message: 'hello', timestamp: new Date() },
    ]);
    fixture.detectChanges();
    const selected: string[] = [];
    fixture.componentInstance.entrySelect.subscribe(e => selected.push(e.id));
    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(row.tabIndex).toBe(0);

    press(row, { key: 'Enter' });
    press(row, { key: ' ' });
    expect(selected).toEqual(['1', '1']);
  });

  it('quick switcher leaves Enter on a focused option to that option', () => {
    const fixture = TestBed.createComponent(TwQuickSwitcherComponent);
    fixture.componentRef.setInput(
      'items',
      ['alpha', 'beta'].map((id): QuickSwitcherItem => ({ id, label: id, type: 'file' }))
    );
    fixture.componentInstance.open();
    fixture.componentInstance.searchQuery.set('a');
    fixture.detectChanges();
    const picked: string[] = [];
    fixture.componentInstance.itemSelected.subscribe(item => picked.push(item.id));
    const options = fixture.nativeElement.querySelectorAll(
      '[role="option"]'
    ) as NodeListOf<HTMLButtonElement>;

    // Highlight is on the first option, but the second has focus
    press(options[1], { key: 'Enter' });
    expect(picked).toEqual([]);
    options[1].click();
    expect(picked).toEqual(['beta']);
  });
});

describe('native keyboard operability (round 21)', () => {
  it('log viewer rows use a single roving tab stop and show the selection', () => {
    const fixture = TestBed.createComponent(TwLogViewerComponent);
    fixture.componentRef.setInput(
      'entries',
      ['1', '2', '3'].map(id => ({
        id,
        level: 'info' as const,
        message: `m${id}`,
        timestamp: new Date(),
      }))
    );
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    const rows = () => [...fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    expect(rows().map(row => row.tabIndex)).toEqual([0, -1, -1]);

    rows()[0].focus();
    press(rows()[0], { key: 'ArrowDown' });
    fixture.detectChanges();
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows().map(row => row.tabIndex)).toEqual([-1, 0, -1]);

    press(rows()[1], { key: 'End' });
    fixture.detectChanges();
    expect(document.activeElement).toBe(rows()[2]);

    press(rows()[2], { key: 'Enter' });
    fixture.detectChanges();
    expect(rows()[2].getAttribute('aria-current')).toBe('true');
    expect(rows()[2].classList).toContain('border-l-4');
    expect(rows()[0].hasAttribute('aria-current')).toBe(false);
    fixture.nativeElement.remove();
  });

  it('quick switcher returns focus to the opener when it closes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const fixture = TestBed.createComponent(TwQuickSwitcherComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('input') as HTMLInputElement).focus();
    expect(document.activeElement).not.toBe(opener);

    press(document.body, { key: 'Escape' });
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener);
    fixture.nativeElement.remove();
    opener.remove();
  });
});

describe('native defects (round 22)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('menu bar opens submenu items instead of selecting their parent', () => {
    const menus: NativeMenuBarItem[] = [
      {
        id: 'file',
        label: 'File',
        items: [
          { id: 'new', label: 'New' },
          {
            id: 'recent',
            label: 'Open Recent',
            type: 'submenu',
            submenu: [
              { id: 'a', label: 'a.txt' },
              { id: 'b', label: 'b.txt' },
            ],
          },
        ],
      },
    ];
    const fixture = TestBed.createComponent(TwMenuBarComponent);
    fixture.componentRef.setInput('items', menus);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    const selected = vi.fn();
    fixture.componentInstance.itemSelect.subscribe(selected);
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector<HTMLElement>('[data-menubar-trigger]')!;

    trigger.focus();
    press(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();
    const parent = el.querySelector<HTMLElement>('[role="menu"] [aria-haspopup="menu"]')!;
    expect(parent.getAttribute('aria-expanded')).toBe('false');

    parent.focus();
    press(parent, { key: 'ArrowRight' });
    fixture.detectChanges();
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toContain('a.txt');
    expect(selected).not.toHaveBeenCalled();

    // Arrows stay inside the submenu, ArrowLeft returns to its parent
    press(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('b.txt');
    press(document.activeElement!, { key: 'ArrowLeft' });
    fixture.detectChanges();
    expect(document.activeElement).toBe(parent);
    expect(parent.getAttribute('aria-expanded')).toBe('false');

    // Clicking the parent opens the submenu; clicking a child selects it
    parent.click();
    fixture.detectChanges();
    expect(selected).not.toHaveBeenCalled();
    const child = [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(b =>
      b.textContent?.includes('b.txt')
    )!;
    child.click();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    expect(el.querySelector('[role="menu"]')).toBeNull();
    fixture.nativeElement.remove();
  });

  it('context menu shows and exposes the checked state of radio items', () => {
    const fixture = TestBed.createComponent(TwNativeContextMenuComponent);
    const items: NativeMenuItem[] = [
      { id: 'small', label: 'Small', type: 'radio', checked: true },
      { id: 'large', label: 'Large', type: 'radio', checked: false },
    ];
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    fixture.componentInstance.open(10, 10);
    fixture.detectChanges();
    const radios = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="menuitemradio"]'),
    ];
    expect(radios.map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(radios[0].querySelector('svg')).not.toBeNull();
    expect(radios[1].querySelector('svg')).toBeNull();
    fixture.componentInstance.close();
  });

  it('settings panel highlights the category it shows before one is clicked', () => {
    const fixture = TestBed.createComponent(TwSettingsPanelComponent);
    fixture.componentRef.setInput('categories', [
      { id: 'general', label: 'General' },
      { id: 'editor', label: 'Editor' },
    ]);
    fixture.detectChanges();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('nav button'),
    ];
    expect(buttons[0].getAttribute('aria-current')).toBe('true');
    expect(buttons[0].classList).toContain('bg-blue-50');
    expect(buttons[1].hasAttribute('aria-current')).toBe(false);
  });

  it('search bar suggestions stay open while keyboard focus moves into them', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TwSearchBarComponent);
    fixture.componentRef.setInput('suggestions', [{ id: 's', label: 'Settings' }]);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('input')!.focus();
    fixture.detectChanges();

    const suggestion = () =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find(b =>
        b.textContent?.includes('Settings')
      );
    suggestion()!.focus();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(suggestion()).toBeDefined();
    expect(document.activeElement).toBe(suggestion());

    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(suggestion()).toBeUndefined();
    outside.remove();
    fixture.nativeElement.remove();
  });

  it('disclosure buttons expose their expanded state', () => {
    const toolbar = TestBed.createComponent(TwToolbarComponent);
    toolbar.componentRef.setInput('items', [
      {
        id: 'd',
        type: 'dropdown',
        label: 'More',
        items: [{ id: 'x', type: 'button', label: 'X' }],
      },
    ]);
    toolbar.detectChanges();
    const trigger = (toolbar.nativeElement as HTMLElement).querySelector('button')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    toolbar.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const tabs = TestBed.createComponent(TwTabBarComponent);
    tabs.componentRef.setInput('tabs', [{ id: 't', label: 'main.ts', dirty: true }]);
    tabs.detectChanges();
    const tabEl = tabs.nativeElement as HTMLElement;
    expect(tabEl.querySelector('[role="tab"]')?.textContent).toContain('unsaved changes');
    const more = tabEl.querySelector<HTMLButtonElement>('[aria-label="More tabs"]')!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    more.click();
    tabs.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('true');

    const inspector = TestBed.createComponent(TwPropertyInspectorComponent);
    inspector.componentRef.setInput('properties', [{ key: 'a', value: 1, type: 'number' }]);
    inspector.detectChanges();
    const category = (inspector.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-expanded]'
    )!;
    expect(category.getAttribute('aria-expanded')).toBe('true');
    category.click();
    inspector.detectChanges();
    expect(category.getAttribute('aria-expanded')).toBe('false');
  });

  it('small text meets 4.5:1 on its background', () => {
    const about = TestBed.createComponent(TwAboutDialogComponent);
    about.componentRef.setInput('open', true);
    about.componentRef.setInput('copyright', 'Copyright Acme');
    about.detectChanges();
    const copyright = [...(about.nativeElement as HTMLElement).querySelectorAll('p')].find(p =>
      p.textContent?.includes('Copyright Acme')
    )!;
    expect(copyright.classList).toContain('dark:text-gray-400');
    expect(copyright.classList).not.toContain('dark:text-gray-500');

    const prompt = TestBed.createComponent(TwPromptDialogComponent);
    prompt.componentRef.setInput('required', true);
    prompt.componentInstance.open();
    prompt.componentInstance.confirm();
    prompt.detectChanges();
    const error = (prompt.nativeElement as HTMLElement).querySelector('[role="alert"]')!;
    expect(error.classList).toContain('text-red-600');
    expect(error.classList).not.toContain('text-red-500');

    const palette = TestBed.createComponent(TwCommandPaletteComponent);
    palette.detectChanges();
    palette.componentInstance.open();
    palette.detectChanges();
    const paletteKbds = [...(palette.nativeElement as HTMLElement).querySelectorAll('kbd')];
    expect(paletteKbds.length).toBeGreaterThan(0);
    paletteKbds.forEach(kbd => {
      expect(kbd.classList).toContain('text-gray-600');
      expect(kbd.classList).toContain('dark:text-gray-300');
    });

    const switcher = TestBed.createComponent(TwQuickSwitcherComponent);
    switcher.detectChanges();
    const switcherKbds = [...(switcher.nativeElement as HTMLElement).querySelectorAll('kbd')];
    expect(switcherKbds.length).toBe(3);
    switcherKbds.forEach(kbd => {
      expect(kbd.classList).toContain('text-slate-700');
      expect(kbd.classList).toContain('dark:text-slate-200');
    });

    const menuBar = TestBed.createComponent(TwMenuBarComponent);
    menuBar.componentRef.setInput('items', [
      { id: 'f', label: 'File', items: [{ id: 's', label: 'Save', shortcut: 'Ctrl+S' }] },
    ]);
    menuBar.detectChanges();
    (menuBar.nativeElement as HTMLElement).querySelector<HTMLElement>('button')!.click();
    menuBar.detectChanges();
    const shortcut = (menuBar.nativeElement as HTMLElement).querySelector(
      '[role="menu"] .text-xs'
    )!;
    expect(shortcut.classList).toContain('opacity-75');
    expect(shortcut.classList).not.toContain('opacity-60');

    const toolbar = TestBed.createComponent(TwToolbarComponent);
    toolbar.componentRef.setInput('items', [
      { id: 't', type: 'toggle', label: 'Bold', active: true },
    ]);
    toolbar.detectChanges();
    const toggle = (toolbar.nativeElement as HTMLElement).querySelector('button')!;
    expect(toggle.classList).toContain('text-blue-700');
    expect(toggle.classList).not.toContain('text-blue-600');

    const editor = TestBed.createComponent(TwShortcutsEditorComponent);
    editor.componentRef.setInput('shortcuts', [
      { id: 'x', command: 'Cut', keys: [], defaultKeys: ['x'], isCustom: true },
    ]);
    editor.detectChanges();
    const editorSpans = [...(editor.nativeElement as HTMLElement).querySelectorAll('span')];
    const modified = editorSpans.find(s => s.textContent?.trim() === 'Modified')!;
    expect(modified.classList).toContain('text-blue-700');
    const notSet = editorSpans.find(s => s.textContent?.trim() === 'Not set')!;
    expect(notSet.classList).toContain('text-slate-600');
    expect(notSet.classList).toContain('dark:text-slate-300');

    const log = TestBed.createComponent(TwLogViewerComponent);
    log.componentRef.setInput('entries', [
      { id: '1', level: 'error', message: 'boom', source: 'app', timestamp: new Date() },
    ]);
    log.detectChanges();
    const cells = [...(log.nativeElement as HTMLElement).querySelectorAll('tbody td')];
    expect(cells[0].classList).toContain('text-gray-600');
    expect(cells[2].classList).toContain('text-gray-600');
  });
});

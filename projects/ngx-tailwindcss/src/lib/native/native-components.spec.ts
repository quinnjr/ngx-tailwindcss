import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwNativeConfirmDialogComponent } from './confirm-dialog.component';
import { TwPromptDialogComponent } from './prompt-dialog.component';
import { TwTerminalComponent } from './terminal.component';
import { TwCodeViewerComponent } from './code-viewer.component';
import { TwSidebarNavComponent } from './sidebar.component';
import { ShortcutBinding, TwShortcutsEditorComponent } from './shortcuts-editor.component';
import { TwNativeContextMenuComponent } from './context-menu.component';
import { NativeStorageService } from './storage.service';
import { TwStatusBarComponent } from './status-bar.component';
import { TwFileTreeComponent } from './file-tree.component';
import { TwSearchBarComponent } from './search-bar.component';
import { TwLogViewerComponent } from './log-viewer.component';
import { TwUpdateDialogComponent } from './update-dialog.component';
import { TwPropertyInspectorComponent } from './property-inspector.component';
import { TwBreadcrumbsNavComponent } from './breadcrumbs.component';
import { TwPreferencesDialogComponent } from './preferences-dialog.component';
import { TwToolbarComponent } from './toolbar.component';
import { TwTabBarComponent } from './tab-bar.component';
import { TwThemeSelectorComponent } from './theme-selector.component';
import {
  SettingItem,
  TwSettingsPanelComponent,
  TwSettingTemplateDirective,
} from './settings-panel.component';
import { NativeMenuItem, SidebarItem, ToolbarItem } from './native.types';

@Component({
  template: `
    <tw-settings-panel
      [categories]="[{ id: 'c', label: 'General' }]"
      [settings]="settings"
      (settingChanged)="changed = $event.value"
    >
      <ng-template twSettingTemplate="fancy" let-setting let-update="update">
        <button class="custom-control" (click)="update('picked')">{{ setting.label }}</button>
      </ng-template>
    </tw-settings-panel>
  `,
  standalone: true,
  imports: [TwSettingsPanelComponent, TwSettingTemplateDirective],
})
class SettingsTemplateHostComponent {
  settings: SettingItem[] = [
    { id: 'fancy', categoryId: 'c', label: 'Fancy', type: 'text', value: '' },
    { id: 'plain', categoryId: 'c', label: 'Plain', type: 'text', value: '' },
  ];
  changed: unknown = null;
}

@Component({
  template: `
    <tw-native-confirm-dialog
      [open]="open()"
      (confirm)="confirmed = confirmed + 1"
      (cancel)="cancelled = cancelled + 1"
    ></tw-native-confirm-dialog>
  `,
  standalone: true,
  imports: [TwNativeConfirmDialogComponent],
})
class ConfirmHostComponent {
  open = signal(true);
  confirmed = 0;
  cancelled = 0;
}

describe('TwNativeConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmHostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfirmHostComponent);
    fixture.detectChanges();
  });

  it('does not confirm when Enter is pressed on the focused Cancel button', () => {
    const cancelButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    cancelButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(fixture.componentInstance.confirmed).toBe(0);
  });

  it('confirms when Enter is pressed outside an interactive control', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(fixture.componentInstance.confirmed).toBe(1);
  });
});

describe('TwPromptDialogComponent', () => {
  it('keeps the value passed to open(value)', () => {
    const fixture = TestBed.createComponent(TwPromptDialogComponent);
    fixture.componentRef.setInput('defaultValue', 'default');
    fixture.detectChanges();

    fixture.componentInstance.open('custom');
    fixture.detectChanges();

    expect(fixture.componentInstance.inputValue()).toBe('custom');
  });
});

describe('TwTerminalComponent', () => {
  it('recalls the most recent command on ArrowUp and walks back on ArrowDown', () => {
    const fixture = TestBed.createComponent(TwTerminalComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const component = fixture.componentInstance as unknown as {
      currentInput: { (): string; set(v: string): void };
      submitCommand(): void;
    };

    component.currentInput.set('first');
    component.submitCommand();
    component.currentInput.set('second');
    component.submitCommand();

    const press = (key: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    press('ArrowUp');
    expect(component.currentInput()).toBe('second');
    press('ArrowUp');
    expect(component.currentInput()).toBe('first');
    press('ArrowDown');
    expect(component.currentInput()).toBe('second');
    press('ArrowDown');
    expect(component.currentInput()).toBe('');
  });

  it('uses dark line text on the white light variant', () => {
    const fixture = TestBed.createComponent(TwTerminalComponent);
    fixture.componentRef.setInput('variant', 'light');
    fixture.componentRef.setInput('lines', [
      { id: '1', content: 'ls', type: 'input' },
      { id: '2', content: 'file.txt', type: 'output' },
    ]);
    fixture.detectChanges();

    const rows = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.whitespace-pre-wrap'
      ),
    ];
    expect(rows[0].classList).toContain('text-gray-900');
    expect(rows[1].classList).toContain('text-gray-700');
    expect(rows[0].classList).not.toContain('text-gray-100');
    expect(rows[1].classList).not.toContain('text-gray-300');
  });

  it('uses readable prompt and timestamp colours for each variant', () => {
    const fixture = TestBed.createComponent(TwTerminalComponent);
    fixture.componentRef.setInput('variant', 'light');
    fixture.componentRef.setInput('showTimestamps', true);
    fixture.componentRef.setInput('lines', [
      { id: '1', content: 'ls', type: 'input', timestamp: new Date() },
    ]);
    fixture.detectChanges();

    const output = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.overflow-y-auto'
    )!;
    const spans = () => [...output.querySelectorAll<HTMLElement>('span')];
    const find = (text: string) => spans().find(s => s.textContent?.includes(text))!;

    expect(find('[').classList).toContain('text-gray-500');
    expect(spans().filter(s => s.textContent === '$ ')).toHaveLength(2);
    for (const prompt of spans().filter(s => s.textContent === '$ ')) {
      expect(prompt.classList).toContain('text-green-700');
      expect(prompt.classList).not.toContain('text-green-400');
    }

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(find('[').classList).toContain('text-gray-400');
    expect(find('[').classList).not.toContain('text-gray-600');
    for (const prompt of spans().filter(s => s.textContent === '$ ')) {
      expect(prompt.classList).toContain('text-green-400');
    }
  });
});

describe('TwSidebarNavComponent', () => {
  it('collapses via its toggle button without a parent binding', () => {
    const fixture = TestBed.createComponent(TwSidebarNavComponent);
    fixture.componentRef.setInput('showHeader', true);
    fixture.componentRef.setInput('items', [{ id: 'a', label: 'A' }] as SidebarItem[]);
    fixture.detectChanges();

    const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
    expect(aside.style.width).toBe('240px');

    const emitted: boolean[] = [];
    fixture.componentInstance.collapsedChange.subscribe(v => emitted.push(v));
    (fixture.nativeElement.querySelector('[aria-label="Collapse sidebar"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(aside.style.width).toBe('56px');
    expect(emitted).toEqual([true]);
  });
});

describe('TwShortcutsEditorComponent', () => {
  it('emits recorded keys in modifier-first order', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(TwShortcutsEditorComponent);
      const binding: ShortcutBinding = {
        id: 'save',
        command: 'Save',
        keys: ['Ctrl', 'S'],
        defaultKeys: ['Ctrl', 'S'],
      };
      fixture.componentRef.setInput('shortcuts', [binding]);
      fixture.detectChanges();

      const emitted: string[][] = [];
      fixture.componentInstance.shortcutChanged.subscribe(e => emitted.push(e.keys));
      fixture.componentInstance.startEdit(binding);
      fixture.componentInstance.handleKeydown(
        new KeyboardEvent('keydown', { key: 'A', shiftKey: true })
      );

      expect(fixture.componentInstance.recordedKeys()).toEqual(['Shift', 'A']);
      vi.advanceTimersByTime(500);
      expect(emitted).toEqual([['Shift', 'A']]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TwNativeContextMenuComponent', () => {
  it('keeps a submenu open while the pointer moves from its parent into it', () => {
    const fixture = TestBed.createComponent(TwNativeContextMenuComponent);
    const items: NativeMenuItem[] = [
      {
        id: 'more',
        label: 'More',
        type: 'submenu',
        submenu: [{ id: 'child', label: 'Child' }],
      },
    ];
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    fixture.componentInstance.open(10, 10);
    fixture.detectChanges();

    const parentButton = fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
    const wrapper = parentButton.parentElement!;
    wrapper.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    // Leaving the parent button for the submenu stays inside the wrapper
    parentButton.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Child');
    fixture.destroy();
  });
});

describe('NativeStorageService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns null (not the storage wrapper) for a stored null value', () => {
    const service = TestBed.inject(NativeStorageService);
    service.set('k', null);
    expect(service.get('k')).toBeNull();
    expect(service.get('k', 'fallback')).toBe('fallback');
  });

  it('round-trips falsy values', () => {
    const service = TestBed.inject(NativeStorageService);
    service.set('zero', 0);
    service.set('no', false);
    expect(service.get('zero')).toBe(0);
    expect(service.get('no')).toBe(false);
  });
});

describe('TwCodeViewerComponent match navigation', () => {
  it('marks and scrolls to the current match when stepping through matches', () => {
    const fixture = TestBed.createComponent(TwCodeViewerComponent);
    fixture.componentRef.setInput('code', 'foo\nbar\nfoo again\nbaz');
    fixture.componentInstance.searchQuery.set('foo');
    fixture.detectChanges();

    const lineEl = (i: number) =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-code-line="${i}"]`)!;
    const scrolled: number[] = [];
    for (const i of [0, 2]) {
      lineEl(i).scrollIntoView = () => scrolled.push(i);
    }

    expect(lineEl(0).classList).toContain('bg-yellow-600/60');
    expect(lineEl(2).classList).not.toContain('bg-yellow-600/60');

    fixture.componentInstance.nextMatch();
    fixture.detectChanges();

    expect(scrolled).toEqual([2]);
    expect(lineEl(2).classList).toContain('bg-yellow-600/60');
    expect(lineEl(0).classList).not.toContain('bg-yellow-600/60');
  });
});

describe('TwStatusBarComponent variant', () => {
  const render = (variant?: 'default' | 'minimal') => {
    const fixture = TestBed.createComponent(TwStatusBarComponent);
    if (variant) fixture.componentRef.setInput('variant', variant);
    fixture.componentRef.setInput('items', [
      { id: 'a', content: 'Ready', position: 'left', clickable: true },
    ]);
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    return { footer, button };
  };

  it('renders white text on the blue bar by default', () => {
    const { footer, button } = render();
    expect(footer.classList).toContain('bg-blue-600');
    expect(footer.classList).toContain('text-white');
    expect(button.classList).toContain('hover:bg-white/20');
  });

  it('renders dark text on a neutral bar for the minimal variant', () => {
    const { footer, button } = render('minimal');
    expect(footer.classList).not.toContain('bg-blue-600');
    expect(footer.classList).not.toContain('text-white');
    expect(footer.classList).toContain('bg-gray-100');
    expect(footer.classList).toContain('text-gray-700');
    expect(footer.classList).toContain('dark:text-gray-300');
    expect(button.classList).toContain('hover:bg-gray-200');
    expect(button.classList).not.toContain('hover:bg-white/20');
  });
});

describe('native inputs are honoured', () => {
  it('confirm dialog colours its icon by type', () => {
    const fixture = TestBed.createComponent(TwNativeConfirmDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('type', 'success');
    fixture.detectChanges();
    const icon = (fixture.nativeElement as HTMLElement).querySelector('.rounded-full')!;
    expect(icon.classList).toContain('bg-green-100');
    expect(icon.classList).not.toContain('bg-blue-100');

    fixture.componentRef.setInput('destructive', true);
    fixture.detectChanges();
    expect(icon.classList).toContain('bg-red-100');
  });

  it('file tree shows modified dates only when showDate is set', () => {
    const fixture = TestBed.createComponent(TwFileTreeComponent);
    fixture.componentRef.setInput('nodes', [
      { id: 'f', name: 'a.txt', type: 'file', modified: new Date(2024, 0, 2, 3, 4) },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('1/2/24');

    fixture.componentRef.setInput('showDate', true);
    fixture.detectChanges();
    expect(el.textContent).toContain('1/2/24');
  });

  it('search bar renders filters passed via the filters input', () => {
    const fixture = TestBed.createComponent(TwSearchBarComponent);
    fixture.componentRef.setInput('filters', [{ id: 'x', label: 'Type: TS', value: 'ts' }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Type: TS');

    const emitted: unknown[] = [];
    fixture.componentInstance.filterChange.subscribe(f => emitted.push(f));
    el.querySelector<HTMLButtonElement>('[aria-label="Remove filter Type: TS"]')!.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Type: TS');
    expect(emitted).toEqual([[]]);
  });

  it('settings panel renders a twSettingTemplate in place of the default control', () => {
    const fixture = TestBed.createComponent(SettingsTemplateHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const custom = el.querySelector<HTMLButtonElement>('.custom-control');
    expect(custom?.textContent?.trim()).toBe('Fancy');
    expect(el.querySelector('#fancy')).toBeNull();
    expect(el.querySelector('input#plain')).not.toBeNull();

    custom!.click();
    expect(fixture.componentInstance.changed).toBe('picked');
  });
});

describe('native text contrast', () => {
  it('file tree size and date text is readable on light and dark surfaces', () => {
    const fixture = TestBed.createComponent(TwFileTreeComponent);
    fixture.componentRef.setInput('nodes', [
      { id: 'f', name: 'a.txt', type: 'file', size: 2048, modified: new Date(2024, 0, 2) },
    ]);
    fixture.componentRef.setInput('showSize', true);
    fixture.componentRef.setInput('showDate', true);
    fixture.detectChanges();
    const meta = (fixture.nativeElement as HTMLElement).querySelectorAll('span.text-xs');
    expect(meta.length).toBe(2);
    meta.forEach(span => {
      expect(span.classList).toContain('text-gray-600');
      expect(span.classList).toContain('dark:text-gray-400');
      expect(span.classList).not.toContain('text-gray-400');
    });
  });

  it('search bar shortcut hint is readable on its gray chip', () => {
    const fixture = TestBed.createComponent(TwSearchBarComponent);
    fixture.detectChanges();
    const kbd = (fixture.nativeElement as HTMLElement).querySelector('kbd')!;
    expect(kbd.classList).toContain('text-gray-600');
    expect(kbd.classList).not.toContain('text-gray-400');
  });

  it('log viewer inactive level filters are readable and expose their pressed state', () => {
    const fixture = TestBed.createComponent(TwLogViewerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const debug = [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
      b => b.textContent?.trim().toLowerCase() === 'debug'
    )!;
    expect(debug.getAttribute('aria-pressed')).toBe('true');
    debug.click();
    fixture.detectChanges();
    expect(debug.getAttribute('aria-pressed')).toBe('false');
    expect(debug.classList).toContain('text-gray-600');
    expect(debug.classList).toContain('dark:text-gray-300');
    expect(debug.classList).not.toContain('text-gray-400');
  });
});

describe('native toggle state and control contrast', () => {
  it('log viewer auto-scroll button shows its on/off state in both themes', () => {
    const fixture = TestBed.createComponent(TwLogViewerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = () => el.querySelector<HTMLButtonElement>('button[aria-label$="auto-scroll"]')!;
    const on = button().getAttribute('aria-label') === 'Disable auto-scroll';
    const check = (active: boolean) => {
      const cls = button().classList;
      expect(cls.contains('text-blue-600')).toBe(active);
      expect(cls.contains('dark:text-blue-400')).toBe(active);
      // Static gray classes would always override the active colour (Tailwind order).
      expect(cls.contains('text-gray-500')).toBe(!active);
      expect(cls.contains('dark:text-gray-400')).toBe(!active);
    };
    check(on);
    button().click();
    fixture.detectChanges();
    check(!on);
  });

  it('code viewer word-wrap toggle shows and exposes its pressed state', () => {
    const fixture = TestBed.createComponent(TwCodeViewerComponent);
    fixture.componentRef.setInput('code', 'a');
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[title="Toggle word wrap"]'
    )!;
    const initial = button.getAttribute('aria-pressed') === 'true';
    expect(button.classList.contains('text-slate-400')).toBe(!initial);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe(String(!initial));
    expect(button.classList.contains('text-blue-400')).toBe(!initial);
    expect(button.classList.contains('text-slate-400')).toBe(initial);
  });

  it('update dialog install button uses an AA-contrast green', () => {
    const fixture = TestBed.createComponent(TwUpdateDialogComponent);
    const info = { currentVersion: '1.0.0', newVersion: '1.1.0' };
    fixture.componentRef.setInput('updateInfo', info);
    const dialog = fixture.componentInstance;
    dialog.open(info);
    dialog.startDownload();
    dialog.setDownloadProgress(100);
    fixture.detectChanges();
    const install = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(b =>
      b.textContent?.includes('Install')
    )!;
    expect(install.classList).toContain('bg-green-700');
    expect(install.classList).not.toContain('bg-green-600');
  });

  it('property inspector boolean values and refresh icon meet contrast', () => {
    const fixture = TestBed.createComponent(TwPropertyInspectorComponent);
    fixture.componentRef.setInput('properties', [
      { key: 'on', value: true, type: 'boolean' },
      { key: 'off', value: false, type: 'boolean' },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const values = [...el.querySelectorAll<HTMLElement>('span.font-mono')];
    const on = values.find(v => v.textContent?.trim() === 'true')!;
    const off = values.find(v => v.textContent?.trim() === 'false')!;
    expect(on.classList).toContain('text-green-700');
    expect(on.classList).toContain('dark:text-green-400');
    expect(on.classList).not.toContain('text-green-600');
    expect(off.classList).toContain('dark:text-red-400');
    const refresh = el.querySelector<HTMLButtonElement>('button[title="Refresh"]')!;
    expect(refresh.classList).toContain('text-slate-500');
    expect(refresh.classList).not.toContain('text-slate-400');
  });

  it('breadcrumb and search clear icon buttons meet 3:1 in light mode', () => {
    const crumbs = TestBed.createComponent(TwBreadcrumbsNavComponent);
    crumbs.componentRef.setInput('editable', true);
    crumbs.componentRef.setInput('showCopyButton', true);
    crumbs.detectChanges();
    for (const label of ['Edit path', 'Copy path']) {
      const svg = (crumbs.nativeElement as HTMLElement).querySelector(
        `button[aria-label="${label}"] svg`
      )!;
      expect(svg.classList).toContain('text-gray-500');
      expect(svg.classList).not.toContain('text-gray-400');
    }

    const search = TestBed.createComponent(TwSearchBarComponent);
    search.detectChanges();
    const input = (search.nativeElement as HTMLElement).querySelector('input')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    search.detectChanges();
    const clear = (search.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Clear search"] svg'
    )!;
    expect(clear.classList).toContain('text-gray-500');
    expect(clear.classList).not.toContain('text-gray-400');
  });

  it('shortcuts editor reset icon button meets 3:1 in light mode', () => {
    const fixture = TestBed.createComponent(TwShortcutsEditorComponent);
    fixture.componentRef.setInput('shortcuts', [
      { id: 's', command: 'Save', keys: ['Ctrl', 'S'], defaultKeys: ['Ctrl', 'O'], isCustom: true },
    ]);
    fixture.detectChanges();
    const reset = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[title="Reset to default"]'
    )!;
    expect(reset.classList).toContain('text-slate-500');
    expect(reset.classList).not.toContain('text-slate-400');
  });
});

// Tailwind 4 emits same-property utilities in a fixed (alphabetical) order, so a
// static grey text/border class would always beat the conditional selected one.
describe('native selected states are not overridden by static classes', () => {
  const expectExclusive = (el: Element, on: string[], off: string[], selected: boolean) => {
    for (const c of on) expect(el.classList.contains(c)).toBe(selected);
    for (const c of off) expect(el.classList.contains(c)).toBe(!selected);
  };

  it('preferences dialog selected tab shows its blue text', () => {
    const fixture = TestBed.createComponent(TwPreferencesDialogComponent);
    fixture.componentRef.setInput('tabs', [
      { id: 'general', label: 'General' },
      { id: 'advanced', label: 'Advanced' },
    ]);
    fixture.componentInstance.open();
    fixture.detectChanges();
    const tabs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button[aria-pressed]'
      ),
    ];
    expect(tabs.length).toBe(2);
    for (const tab of tabs) {
      expectExclusive(
        tab,
        ['text-blue-600', 'dark:text-blue-400'],
        ['text-slate-600', 'dark:text-slate-400'],
        tab.getAttribute('aria-pressed') === 'true'
      );
    }
  });

  it('settings panel selected category shows its blue text', () => {
    const fixture = TestBed.createComponent(TwSettingsPanelComponent);
    fixture.componentRef.setInput('categories', [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ]);
    fixture.detectChanges();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('nav button'),
    ];
    expect(buttons.length).toBe(2);
    buttons[1].click();
    fixture.detectChanges();
    expectExclusive(
      buttons[1],
      ['text-blue-600', 'dark:text-blue-400'],
      ['text-slate-700', 'dark:text-slate-300'],
      true
    );
    expectExclusive(
      buttons[0],
      ['text-blue-600', 'dark:text-blue-400'],
      ['text-slate-700', 'dark:text-slate-300'],
      false
    );
  });

  it('toolbar active toggle shows its blue text', () => {
    const fixture = TestBed.createComponent(TwToolbarComponent);
    fixture.componentRef.setInput('items', [
      { id: 'on', type: 'toggle', label: 'On', active: true },
      { id: 'off', type: 'toggle', label: 'Off', active: false },
    ] as ToolbarItem[]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const on = el.querySelector('button[aria-label="On"]')!;
    const off = el.querySelector('button[aria-label="Off"]')!;
    const groups = [
      ['text-blue-600', 'dark:text-blue-400'],
      ['text-gray-700', 'dark:text-gray-300'],
    ];
    expectExclusive(on, groups[0], groups[1], true);
    expectExclusive(off, groups[0], groups[1], false);
  });

  it('prompt dialog shows a red border while invalid', () => {
    const fixture = TestBed.createComponent(TwPromptDialogComponent);
    fixture.componentRef.setInput('minLength', 3);
    fixture.componentInstance.open('');
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expectExclusive(
      input,
      ['border-red-500'],
      ['border-slate-200', 'dark:border-slate-700'],
      false
    );
    input.value = 'ab';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expectExclusive(input, ['border-red-500'], ['border-slate-200', 'dark:border-slate-700'], true);
  });

  it('collapsed sidebar active icon is legible on its blue fill', () => {
    const fixture = TestBed.createComponent(TwSidebarNavComponent);
    fixture.componentRef.setInput('items', [
      { id: 'a', label: 'A', icon: 'A', active: true, children: [{ id: 'c', label: 'C' }] },
    ] as SidebarItem[]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const icon = () => el.querySelector('button span.flex-shrink-0')!;
    expect(icon().classList).toContain('text-blue-600');
    expect(icon().classList).not.toContain('text-white');
    expect(el.querySelector('button svg.transition-transform')!.classList).toContain(
      'text-gray-500'
    );

    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();
    expect(icon().classList).toContain('text-white');
    expect(icon().classList).not.toContain('text-blue-600');
    expect(icon().classList).not.toContain('dark:text-blue-400');
  });

  it('tab pin indicator inherits the tab text colour', () => {
    const fixture = TestBed.createComponent(TwTabBarComponent);
    fixture.componentRef.setInput('variant', 'pills');
    fixture.componentRef.setInput('tabs', [{ id: 'p', label: 'Pinned', pinned: true }]);
    fixture.componentRef.setInput('activeTabId', 'p');
    fixture.detectChanges();
    const pin = (fixture.nativeElement as HTMLElement).querySelector('[role="tab"] svg')!;
    expect(pin.classList).not.toContain('text-gray-400');
  });
});

describe('native form controls have accessible names and visible actions', () => {
  it('property inspector editable inputs are named and the copy button can be revealed', () => {
    const fixture = TestBed.createComponent(TwPropertyInspectorComponent);
    fixture.componentRef.setInput('properties', [
      { key: 'width', value: 10, type: 'number', editable: true },
      { key: 'name', value: 'x', type: 'string', editable: true },
      { key: 'fill', value: '#ff0000', type: 'color', editable: true },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const labels = [...el.querySelectorAll('input')].map(i => i.getAttribute('aria-label'));
    expect(labels).toEqual(['width', 'name', 'fill']);

    const copy = el.querySelector<HTMLButtonElement>('button[title="Copy value"]')!;
    // group-hover needs a `group` ancestor; focus must reveal it for keyboard users
    expect(copy.closest('.group')).not.toBeNull();
    expect(copy.classList).toContain('focus:opacity-100');
    expect(copy.classList).toContain('text-slate-500');
  });

  it('shortcuts editor category filter is named', () => {
    const fixture = TestBed.createComponent(TwShortcutsEditorComponent);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe('Filter by category');
  });

  it('settings panel colour hex input is named', () => {
    const fixture = TestBed.createComponent(TwSettingsPanelComponent);
    fixture.componentRef.setInput('categories', [{ id: 'a', label: 'Alpha' }]);
    fixture.componentRef.setInput('settings', [
      { id: 'accent', categoryId: 'a', label: 'Accent', type: 'color', value: '#000000' },
    ]);
    fixture.detectChanges();
    const hex = (fixture.nativeElement as HTMLElement).querySelector('input.font-mono')!;
    expect(hex.getAttribute('aria-label')).toBe('Accent (hex value)');
  });

  it('property inspector null value and empty state are readable in both themes', () => {
    const fixture = TestBed.createComponent(TwPropertyInspectorComponent);
    fixture.componentRef.setInput('properties', [{ key: 'n', value: null, type: 'null' }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const nullText = [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === 'null')!;
    expect(nullText.classList).toContain('text-slate-500');
    expect(nullText.classList).not.toContain('text-slate-400');

    fixture.componentRef.setInput('properties', []);
    fixture.detectChanges();
    const empty = el.querySelector('p')!.parentElement!;
    expect(empty.textContent).toContain('No properties to display');
    expect(empty.classList).toContain('dark:text-slate-400');
  });

  it('breadcrumbs path editor input is named', () => {
    const fixture = TestBed.createComponent(TwBreadcrumbsNavComponent);
    fixture.componentRef.setInput('items', [{ id: 'h', label: 'home' }]);
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit path"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('input')!.getAttribute('aria-label')).toBe('Path');
  });

  it('theme selector custom colour and font size are named, choices expose pressed state', () => {
    const fixture = TestBed.createComponent(TwThemeSelectorComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const color = el.querySelector<HTMLInputElement>('input[type="color"]')!;
    expect(color.getAttribute('aria-label')).toBe('Custom accent color');
    expect(color.closest('label')!.classList).toContain('focus-within:ring-2');
    expect(el.querySelector('input[type="range"]')!.getAttribute('aria-label')).toBe('Font size');

    const dark = [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
      b => b.textContent?.trim() === 'Dark'
    )!;
    expect(dark.getAttribute('aria-pressed')).toBe('false');
    dark.click();
    fixture.detectChanges();
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('button[title="Blue"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('button[title="Red"]')!.getAttribute('aria-pressed')).toBe('false');
  });
});

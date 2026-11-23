import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwNativeConfirmDialogComponent } from './confirm-dialog.component';
import { TwPromptDialogComponent } from './prompt-dialog.component';
import { TwTerminalComponent } from './terminal.component';
import { TwSidebarNavComponent } from './sidebar.component';
import { ShortcutBinding, TwShortcutsEditorComponent } from './shortcuts-editor.component';
import { TwNativeContextMenuComponent } from './context-menu.component';
import { NativeStorageService } from './storage.service';
import { NativeMenuItem, SidebarItem } from './native.types';

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

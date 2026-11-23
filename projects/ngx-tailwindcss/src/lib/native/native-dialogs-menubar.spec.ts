import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwMenuBarComponent } from './menu-bar.component';
import { TwAlertDialogComponent } from './alert-dialog.component';
import { TwThemeSelectorComponent } from './theme-selector.component';
import { TwPromptDialogComponent } from './prompt-dialog.component';
import { NativeMenuBarItem } from './native.types';

const key = (el: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
};

describe('TwMenuBarComponent keyboard navigation', () => {
  const menus: NativeMenuBarItem[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New' },
        { id: 'sep', label: '', type: 'separator' },
        { id: 'disabled', label: 'Disabled', disabled: true },
        { id: 'open', label: 'Open' },
      ],
    },
    { id: 'edit', label: 'Edit', items: [{ id: 'undo', label: 'Undo' }] },
    { id: 'view', label: 'View', items: [{ id: 'zoom', label: 'Zoom' }] },
  ];

  let fixture: ComponentFixture<TwMenuBarComponent>;
  const triggers = (): HTMLButtonElement[] => [
    ...fixture.nativeElement.querySelectorAll('[data-menubar-trigger]'),
  ];
  const menuItems = (): HTMLButtonElement[] => [
    ...fixture.nativeElement.querySelectorAll('[role="menu"] [role="menuitem"]'),
  ];

  const setup = (): void => {
    fixture = TestBed.createComponent(TwMenuBarComponent);
    fixture.componentRef.setInput('items', menus);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.nativeElement.remove();
  });

  it('uses a roving tabindex on the top-level items', () => {
    setup();
    expect(triggers().map(t => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves between top-level items with ArrowLeft/Right, Home and End', () => {
    setup();
    triggers()[0].focus();
    key(triggers()[0], 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement).toBe(triggers()[1]);
    expect(triggers()[1].tabIndex).toBe(0);

    key(triggers()[1], 'End');
    fixture.detectChanges();
    expect(document.activeElement).toBe(triggers()[2]);

    key(triggers()[2], 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement).toBe(triggers()[0]);

    key(triggers()[0], 'ArrowLeft');
    fixture.detectChanges();
    expect(document.activeElement).toBe(triggers()[2]);

    key(triggers()[2], 'Home');
    fixture.detectChanges();
    expect(document.activeElement).toBe(triggers()[0]);
  });

  it('opens a menu with ArrowDown, focuses the first item and skips disabled items', () => {
    setup();
    triggers()[0].focus();
    key(triggers()[0], 'ArrowDown');
    fixture.detectChanges();

    expect(triggers()[0].getAttribute('aria-expanded')).toBe('true');
    const [first, , last] = menuItems();
    expect(document.activeElement).toBe(first);

    key(first, 'ArrowDown');
    expect(document.activeElement).toBe(last);
    key(last, 'ArrowDown');
    expect(document.activeElement).toBe(first);
    key(first, 'End');
    expect(document.activeElement).toBe(last);
    key(last, 'Home');
    expect(document.activeElement).toBe(first);
  });

  it('ArrowUp on a trigger opens the menu on its last item', () => {
    setup();
    triggers()[0].focus();
    key(triggers()[0], 'ArrowUp');
    fixture.detectChanges();
    expect(document.activeElement?.textContent).toContain('Open');
  });

  it('ArrowRight inside an open menu opens the next menu', () => {
    setup();
    triggers()[0].focus();
    key(triggers()[0], 'ArrowDown');
    fixture.detectChanges();

    key(document.activeElement!, 'ArrowRight');
    fixture.detectChanges();
    expect(triggers()[1].getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toContain('Undo');
  });

  it('Escape closes the menu and returns focus to its trigger', () => {
    setup();
    triggers()[1].focus();
    key(triggers()[1], 'Enter');
    fixture.detectChanges();
    expect(menuItems().length).toBe(1);

    key(document.activeElement!, 'Escape');
    fixture.detectChanges();
    expect(menuItems().length).toBe(0);
    expect(document.activeElement).toBe(triggers()[1]);
  });

  it('activating an item closes the menu, returns focus and emits itemSelect', () => {
    setup();
    const selected = vi.fn();
    fixture.componentInstance.itemSelect.subscribe(selected);
    triggers()[1].focus();
    key(triggers()[1], 'ArrowDown');
    fixture.detectChanges();

    (document.activeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: 'undo' }));
    expect(menuItems().length).toBe(0);
    expect(document.activeElement).toBe(triggers()[1]);
  });
});

describe('TwAlertDialogComponent', () => {
  const create = (): ComponentFixture<TwAlertDialogComponent> => {
    const fixture = TestBed.createComponent(TwAlertDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Title');
    fixture.componentRef.setInput('showDontAskAgain', true);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  };

  it('is modal and uses unique aria ids per instance', () => {
    const a = create();
    const b = create();
    const dialogA = a.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    const dialogB = b.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;

    expect(dialogA.getAttribute('aria-modal')).toBe('true');
    expect(dialogA.getAttribute('aria-labelledby')).not.toBe(
      dialogB.getAttribute('aria-labelledby')
    );
    const labelledBy = dialogA.getAttribute('aria-labelledby')!;
    expect(a.nativeElement.querySelector(`#${labelledBy}`)?.textContent).toContain('Title');
    a.nativeElement.remove();
    b.nativeElement.remove();
  });

  it('focuses the OK button on open, traps Tab, and dismisses on Escape', () => {
    const fixture = create();
    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    const checkbox = dialog.querySelector('input')!;
    const ok = dialog.querySelector('button')!;
    expect(document.activeElement).toBe(ok);

    expect(key(ok, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(checkbox);
    expect(key(checkbox, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ok);

    const confirm = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirm);
    key(ok, 'Escape');
    expect(confirm).toHaveBeenCalledWith({ dontAskAgain: false });
    fixture.nativeElement.remove();
  });
});

describe('TwThemeSelectorComponent', () => {
  afterEach(() => {
    document.documentElement.style.fontSize = '';
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('does not change the root font size just by rendering', () => {
    const fixture = TestBed.createComponent(TwThemeSelectorComponent);
    fixture.detectChanges();
    expect(document.documentElement.style.fontSize).toBe('');

    fixture.componentInstance.setFontSize(16);
    fixture.detectChanges();
    expect(document.documentElement.style.fontSize).toBe('16px');
  });

  it('follows OS theme changes in system mode', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => {
            listener = fn;
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );

    const fixture = TestBed.createComponent(TwThemeSelectorComponent);
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    listener?.({ matches: true });
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fixture.destroy();
  });
});

describe('TwPromptDialogComponent validation', () => {
  const create = (): ComponentFixture<TwPromptDialogComponent> => {
    const fixture = TestBed.createComponent(TwPromptDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('does not throw for an invalid pattern', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fixture = create();
    fixture.componentRef.setInput('pattern', '([');
    fixture.componentInstance.open('abc');
    fixture.detectChanges();

    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    expect(() => {
      fixture.componentInstance.confirm();
    }).not.toThrow();
    expect(confirmed).toHaveBeenCalledWith('abc');
    warn.mockRestore();
  });

  it('shows validation errors as the user types, before confirming', () => {
    const fixture = create();
    fixture.componentRef.setInput('minLength', 3);
    fixture.componentInstance.open('');
    fixture.detectChanges();
    expect(fixture.componentInstance.validationError()).toBeNull();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'ab';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.validationError()).toBe('Minimum 3 characters required');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Minimum 3 characters required');

    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.validationError()).toBeNull();
  });

  it('shows the required error on blur', () => {
    const fixture = create();
    fixture.componentRef.setInput('required', true);
    fixture.componentInstance.open('');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.componentInstance.validationError()).toBe('This field is required');
  });
});

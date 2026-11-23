import { Component, signal, ViewChild, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { TwCommandPaletteComponent } from './command-palette.component';
import { NativeAppPlatformService } from './platform.service';
import { CommandItem } from './native.types';

@Component({
  template: `
    <tw-command-palette
      [commands]="commands()"
      (commandSelect)="onSelect($event)"
    ></tw-command-palette>
  `,
  standalone: true,
  imports: [TwCommandPaletteComponent],
})
class TestHostComponent {
  @ViewChild(TwCommandPaletteComponent) palette!: TwCommandPaletteComponent;
  commands = signal<CommandItem[]>([]);
  selected: CommandItem | null = null;
  onSelect(command: CommandItem): void {
    this.selected = command;
  }
}

describe('TwCommandPaletteComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let copyAction: Mock<() => void>;
  let pasteAction: Mock<() => void>;
  let mockPlatformService: {
    platform: WritableSignal<'macos' | 'windows' | 'linux' | 'web'>;
    formatShortcut: (shortcut: string) => string;
  };

  const getOptions = (): HTMLButtonElement[] => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="option"]'
    ),
  ];

  const getSearchInput = (): HTMLInputElement => {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(input).toBeTruthy();
    return input!;
  };

  const setQuery = (query: string): void => {
    const input = getSearchInput();
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };

  const pressKey = (key: string): void => {
    getSearchInput().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockPlatformService = {
      platform: signal<'macos' | 'windows' | 'linux' | 'web'>('linux'),
      formatShortcut: (shortcut: string) => shortcut,
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: NativeAppPlatformService,
          useValue: mockPlatformService as unknown as NativeAppPlatformService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    copyAction = vi.fn<() => void>();
    pasteAction = vi.fn<() => void>();
    component.commands.set([
      { id: 'copy', label: 'Copy', action: copyAction },
      { id: 'paste', label: 'Paste', action: pasteAction },
      { id: 'settings', label: 'Open Settings', action: vi.fn() },
    ]);
    fixture.detectChanges();
  });

  it('should create the command palette', () => {
    expect(component.palette).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TwCommandPaletteComponent))).toBeTruthy();
  });

  it('should not render the dialog until opened', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should render the dialog with all commands when opened', () => {
    component.palette.open();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(getOptions()).toHaveLength(3);
  });

  it('should narrow the results when filtering', () => {
    component.palette.open();
    fixture.detectChanges();

    setQuery('copy');

    const options = getOptions();
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Copy');
  });

  it('should show an empty state when nothing matches', () => {
    component.palette.open();
    fixture.detectChanges();

    setQuery('zzzz');

    expect(getOptions()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No results found');
  });

  it('should select the highlighted command with ArrowDown + Enter', () => {
    component.palette.open();
    fixture.detectChanges();

    pressKey('ArrowDown');
    pressKey('Enter');

    expect(component.selected?.id).toBe('paste');
    expect(pasteAction).toHaveBeenCalledTimes(1);
    expect(copyAction).not.toHaveBeenCalled();
    // Palette closes after selection
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should mark the highlighted row with aria-selected', () => {
    component.palette.open();
    fixture.detectChanges();

    expect(getOptions()[0].getAttribute('aria-selected')).toBe('true');

    pressKey('ArrowDown');

    const options = getOptions();
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });

  it('exposes the search input as a combobox controlling the results listbox', () => {
    component.palette.open();
    fixture.detectChanges();

    const input = getSearchInput();
    const listbox = fixture.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(listbox.id).toBeTruthy();
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input.getAttribute('aria-activedescendant')).toBe(getOptions()[0].id);
  });

  it('should run the highlighted command when categories are interleaved', () => {
    const editAction = vi.fn();
    const viewAction = vi.fn();
    const undoAction = vi.fn();
    component.commands.set([
      { id: 'cut', label: 'Cut', category: 'Edit', action: editAction },
      { id: 'zoom', label: 'Zoom', category: 'View', action: viewAction },
      { id: 'undo', label: 'Undo', category: 'Edit', action: undoAction },
    ]);
    fixture.detectChanges();
    component.palette.open();
    fixture.detectChanges();

    // Display order is grouped: Cut, Undo (Edit) then Zoom (View)
    pressKey('ArrowDown');
    expect(getOptions()[1].textContent).toContain('Undo');
    expect(getOptions()[1].getAttribute('aria-selected')).toBe('true');

    pressKey('Enter');

    expect(component.selected?.id).toBe('undo');
    expect(undoAction).toHaveBeenCalledTimes(1);
    expect(viewAction).not.toHaveBeenCalled();
  });

  it('keeps the selected row description and shortcut chip readable', () => {
    component.commands.set([
      { id: 'copy', label: 'Copy', description: 'Copy text', shortcut: 'Ctrl+C', action: vi.fn() },
      {
        id: 'paste',
        label: 'Paste',
        description: 'Paste text',
        shortcut: 'Ctrl+V',
        action: vi.fn(),
      },
    ]);
    component.palette.open();
    fixture.detectChanges();
    const [selected, other] = getOptions();
    const desc = (option: HTMLElement) => option.querySelector('.text-sm')!;

    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(desc(selected).classList).not.toContain('opacity-60');
    expect(desc(selected).classList).not.toContain('text-blue-200');
    expect(desc(other).classList).toContain('opacity-60');
    const kbd = selected.querySelector('kbd')!;
    expect(kbd.classList).toContain('bg-blue-700');
    expect(kbd.classList).not.toContain('bg-blue-400');
  });
});

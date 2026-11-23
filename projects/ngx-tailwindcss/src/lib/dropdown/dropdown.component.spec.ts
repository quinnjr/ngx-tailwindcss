import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DropdownPosition,
  TwDropdownComponent,
  TwDropdownDividerComponent,
  TwDropdownHeaderComponent,
  TwDropdownItemDirective,
  TwDropdownMenuComponent,
  TwDropdownTriggerDirective,
} from './dropdown.component';
import { TwClassService } from '../core/tw-class.service';
import { TwModalComponent } from '../modal/modal.component';

/** Reads the protected open state without widening the component's public API */
const isDropdownOpen = (dropdown: TwDropdownComponent): boolean =>
  (dropdown as unknown as { isOpen: () => boolean }).isOpen();

@Component({
  template: `
    <tw-dropdown
      [position]="position()"
      [disabled]="disabled()"
      [closeOnSelect]="closeOnSelect()"
      (opened)="onOpened()"
      (closed)="onClosed()"
      data-testid="test-dropdown"
    >
      <button twDropdownTrigger data-testid="trigger">Open Menu</button>
      <tw-dropdown-menu>
        <button twDropdownItem data-testid="item-1">Item 1</button>
        <button twDropdownItem data-testid="item-2">Item 2</button>
      </tw-dropdown-menu>
    </tw-dropdown>
  `,
  standalone: true,
  imports: [
    TwDropdownComponent,
    TwDropdownItemDirective,
    TwDropdownMenuComponent,
    TwDropdownTriggerDirective,
  ],
})
class TestHostComponent {
  @ViewChild(TwDropdownComponent) dropdown!: TwDropdownComponent;
  position = signal<DropdownPosition>('bottom-start');
  disabled = signal(false);
  closeOnSelect = signal(true);
  openedCount = 0;
  closedCount = 0;

  onOpened(): void {
    this.openedCount++;
  }

  onClosed(): void {
    this.closedCount++;
  }
}

describe('TwDropdownComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let trigger: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    trigger = fixture.debugElement.query(By.css('[data-testid="trigger"]')).nativeElement;
  });

  afterEach(() => {
    // Ensure dropdown is closed and cleanup
    component.dropdown?.close();
    fixture.detectChanges();
  });

  it('should create the dropdown', () => {
    expect(component.dropdown).toBeTruthy();
  });

  it('should not be open initially', () => {
    // Test internal state since portal is created dynamically
    expect(isDropdownOpen(component.dropdown)).toBe(false);
  });

  it('should open when trigger is clicked', () => {
    trigger.click();
    fixture.detectChanges();

    expect(isDropdownOpen(component.dropdown)).toBe(true);
    expect(component.openedCount).toBe(1);
  });

  it('should close when clicked again (toggle)', () => {
    trigger.click();
    fixture.detectChanges();

    trigger.click();
    fixture.detectChanges();

    expect(isDropdownOpen(component.dropdown)).toBe(false);
    expect(component.closedCount).toBe(1);
  });

  it('should return the menu content to its hidden container after closing', () => {
    const menu = fixture.debugElement.query(By.directive(TwDropdownMenuComponent))
      .nativeElement as HTMLElement;
    const originalParent = menu.parentElement!;
    expect(originalParent.style.display).toBe('none');

    trigger.click();
    fixture.detectChanges();
    expect(menu.parentElement).not.toBe(originalParent);

    trigger.click();
    fixture.detectChanges();
    expect(menu.parentElement).toBe(originalParent);
  });

  it('should not emit closed when close() is called while already closed', () => {
    component.dropdown.close();
    expect(component.closedCount).toBe(0);
  });

  it('should apply a menuClass changed after the first open', () => {
    trigger.click();
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();

    component.dropdown.menuClass = 'custom-late-menu';
    trigger.click();
    fixture.detectChanges();

    expect(document.querySelector('[role="menu"]')?.classList).toContain('custom-late-menu');
  });

  it('should give dropdown items a visible keyboard focus ring', () => {
    trigger.click();
    fixture.detectChanges();

    const item = document.querySelector<HTMLElement>('[data-testid="item-1"]')!;
    expect(item.className).toContain('focus:outline-none');
    expect(item.className).toContain('focus-visible:ring-2');
    expect(item.className).toContain('focus-visible:ring-blue-500');
  });

  it('should not open when disabled', () => {
    component.disabled.set(true);
    fixture.detectChanges();

    trigger.click();
    fixture.detectChanges();

    expect(isDropdownOpen(component.dropdown)).toBe(false);
  });

  describe('trigger aria-expanded', () => {
    it('should be false initially', () => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should be true while open and false again after close', () => {
      trigger.click();
      fixture.detectChanges();

      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      component.dropdown.close();
      fixture.detectChanges();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('keyboard navigation', () => {
    const keydown = (key: string): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    it('should move focus over menu items with arrow keys', () => {
      trigger.click();
      fixture.detectChanges();

      const item1 = document.querySelector<HTMLElement>('[data-testid="item-1"]');
      const item2 = document.querySelector<HTMLElement>('[data-testid="item-2"]');
      expect(item1).toBeTruthy();
      expect(item2).toBeTruthy();

      keydown('ArrowDown');
      expect(document.activeElement).toBe(item1);

      keydown('ArrowDown');
      expect(document.activeElement).toBe(item2);

      keydown('ArrowUp');
      expect(document.activeElement).toBe(item1);

      keydown('End');
      expect(document.activeElement).toBe(item2);

      keydown('Home');
      expect(document.activeElement).toBe(item1);
    });

    it('should close on Escape and restore focus to the trigger', () => {
      trigger.click();
      fixture.detectChanges();

      keydown('ArrowDown');
      keydown('Escape');

      expect(isDropdownOpen(component.dropdown)).toBe(false);
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('positions', () => {
    const positions: DropdownPosition[] = [
      'bottom-start',
      'bottom-end',
      'top-start',
      'top-end',
      'left',
      'right',
    ];

    positions.forEach(position => {
      it(`should accept ${position} position`, () => {
        component.position.set(position);
        fixture.detectChanges();

        expect(component.dropdown.position).toBe(position);

        trigger.click();
        fixture.detectChanges();

        expect(isDropdownOpen(component.dropdown)).toBe(true);
      });
    });
  });

  describe('public methods', () => {
    it('should open via open()', () => {
      component.dropdown.open();
      fixture.detectChanges();

      expect(isDropdownOpen(component.dropdown)).toBe(true);
    });

    it('should close via close()', () => {
      component.dropdown.open();
      fixture.detectChanges();

      component.dropdown.close();
      fixture.detectChanges();

      expect(isDropdownOpen(component.dropdown)).toBe(false);
    });

    it('should toggle via toggle()', () => {
      component.dropdown.toggle();
      fixture.detectChanges();

      expect(isDropdownOpen(component.dropdown)).toBe(true);

      component.dropdown.toggle();
      fixture.detectChanges();

      expect(isDropdownOpen(component.dropdown)).toBe(false);
    });
  });
});

@Component({
  template: ` <tw-dropdown-divider></tw-dropdown-divider> `,
  standalone: true,
  imports: [TwDropdownDividerComponent],
})
class DividerTestComponent {}

describe('TwDropdownDividerComponent', () => {
  let fixture: ComponentFixture<DividerTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DividerTestComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DividerTestComponent);
    fixture.detectChanges();
  });

  it('should have role separator', () => {
    const divider = fixture.debugElement.query(By.directive(TwDropdownDividerComponent));
    expect(divider.nativeElement.getAttribute('role')).toBe('separator');
  });
});

@Component({
  template: ` <tw-dropdown-header>Actions</tw-dropdown-header> `,
  standalone: true,
  imports: [TwDropdownHeaderComponent],
})
class HeaderTestComponent {}

describe('TwDropdownHeaderComponent', () => {
  let fixture: ComponentFixture<HeaderTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderTestComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderTestComponent);
    fixture.detectChanges();
  });

  it('should render header content', () => {
    const header = fixture.debugElement.query(By.directive(TwDropdownHeaderComponent));
    expect(header.nativeElement.textContent).toContain('Actions');
  });
});

@Component({
  template: `
    <tw-modal [open]="modalOpen()" (openChange)="modalOpen.set($event)">
      <tw-dropdown>
        <button twDropdownTrigger class="dd-trigger">Open</button>
        <tw-dropdown-menu>
          <button twDropdownItem>Item</button>
        </tw-dropdown-menu>
      </tw-dropdown>
    </tw-modal>
  `,
  standalone: true,
  imports: [
    TwModalComponent,
    TwDropdownComponent,
    TwDropdownItemDirective,
    TwDropdownMenuComponent,
    TwDropdownTriggerDirective,
  ],
})
class DropdownInModalHostComponent {
  @ViewChild(TwDropdownComponent) dropdown!: TwDropdownComponent;
  modalOpen = signal(true);
}

describe('TwDropdownComponent inside a modal', () => {
  it('should close only the dropdown on Escape, not the enclosing modal', async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DropdownInModalHostComponent);
    fixture.detectChanges();

    const ddTrigger = document.querySelector<HTMLElement>('.dd-trigger')!;
    ddTrigger.click();
    fixture.detectChanges();
    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(true);

    ddTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(false);
    expect(fixture.componentInstance.modalOpen()).toBe(true);
    fixture.destroy();
  });

  it('should not swallow Escape from handlers inside the menu, and close layers one at a time', async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DropdownInModalHostComponent);
    fixture.detectChanges();

    const ddTrigger = document.querySelector<HTMLElement>('.dd-trigger')!;
    ddTrigger.click();
    fixture.detectChanges();

    const item = document.querySelector<HTMLElement>('[twdropdownitem]')!;
    const itemHandler = vi.fn();
    item.addEventListener('keydown', itemHandler);
    const escape = () =>
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    item.dispatchEvent(escape());
    fixture.detectChanges();
    expect(itemHandler).toHaveBeenCalledTimes(1);
    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(false);
    expect(fixture.componentInstance.modalOpen()).toBe(true);

    ddTrigger.dispatchEvent(escape());
    fixture.detectChanges();
    expect(fixture.componentInstance.modalOpen()).toBe(false);
    fixture.destroy();
  });

  it('should not hijack arrow keys while focus is outside the dropdown', async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DropdownInModalHostComponent);
    fixture.detectChanges();
    document.querySelector<HTMLElement>('.dd-trigger')!.click();
    fixture.detectChanges();

    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    input.remove();
    fixture.destroy();
  });
});

@Component({
  template: `
    <tw-dropdown>
      <button twDropdownTrigger class="dd-trigger">Actions</button>
      <tw-dropdown-menu>
        <button twDropdownItem class="dd-edit" (click)="modalOpen.set(true)">Edit</button>
      </tw-dropdown-menu>
    </tw-dropdown>
    <tw-modal [open]="modalOpen()" (openChange)="modalOpen.set($event)">
      <button class="modal-btn">Save</button>
    </tw-modal>
  `,
  standalone: true,
  imports: [
    TwModalComponent,
    TwDropdownComponent,
    TwDropdownItemDirective,
    TwDropdownMenuComponent,
    TwDropdownTriggerDirective,
  ],
})
class DropdownOpensModalHostComponent {
  modalOpen = signal(false);
}

describe('TwDropdownComponent item opening a modal', () => {
  it('should return focus to the dropdown trigger (not the hidden item) when the modal closes', async () => {
    vi.useFakeTimers();
    try {
      await TestBed.configureTestingModule({
        imports: [DropdownOpensModalHostComponent, NoopAnimationsModule],
        providers: [TwClassService],
      }).compileComponents();
      const fixture = TestBed.createComponent(DropdownOpensModalHostComponent);
      fixture.detectChanges();

      const ddTrigger = document.querySelector<HTMLElement>('.dd-trigger')!;
      ddTrigger.click();
      fixture.detectChanges();
      const item = document.querySelector<HTMLElement>('.dd-edit')!;
      item.focus();
      expect(document.activeElement).toBe(item);

      // Keyboard activation of the item opens the modal
      item.click();
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();
      expect(fixture.componentInstance.modalOpen()).toBe(true);

      fixture.componentInstance.modalOpen.set(false);
      fixture.detectChanges();
      vi.runAllTimers();

      expect(document.activeElement).toBe(ddTrigger);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

@Component({
  template: `
    <tw-modal [open]="true">
      <tw-dropdown>
        <button twDropdownTrigger class="dd-trigger">Open</button>
        <tw-dropdown-menu>
          <button twDropdownItem class="dd-first">First</button>
          <button twDropdownItem class="dd-last">Last</button>
        </tw-dropdown-menu>
      </tw-dropdown>
      <button class="after">After</button>
    </tw-modal>
  `,
  standalone: true,
  imports: [
    TwModalComponent,
    TwDropdownComponent,
    TwDropdownItemDirective,
    TwDropdownMenuComponent,
    TwDropdownTriggerDirective,
  ],
})
class DropdownTabInModalHostComponent {
  @ViewChild(TwDropdownComponent) dropdown!: TwDropdownComponent;
}

describe('TwDropdownComponent Tab key', () => {
  // The modal's focus trap only counts laid-out elements; jsdom has no layout
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(10);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(10);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const tab = (target: HTMLElement, shiftKey = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };

  async function setup(): Promise<ComponentFixture<DropdownTabInModalHostComponent>> {
    await TestBed.configureTestingModule({
      imports: [DropdownTabInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DropdownTabInModalHostComponent);
    fixture.detectChanges();
    document.querySelector<HTMLElement>('.dd-trigger')!.click();
    fixture.detectChanges();
    return fixture;
  }

  it('should keep Tab between menu items away from an enclosing modal focus trap', async () => {
    const fixture = await setup();
    const first = document.querySelector<HTMLElement>('.dd-first')!;
    first.focus();

    const event = tab(first);

    // The browser's default action moves to the next item; the modal must not pull focus back
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(true);
    fixture.destroy();
  });

  it('should close and continue from the trigger when tabbing past the last item', async () => {
    const fixture = await setup();
    const last = document.querySelector<HTMLElement>('.dd-last')!;
    last.focus();

    const event = tab(last);
    fixture.detectChanges();

    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(false);
    // Focus is on the trigger, from where the default action moves on to the next element
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('.dd-trigger'));
    fixture.destroy();
  });

  it('should close and stop on the trigger on Shift+Tab from the first item', async () => {
    const fixture = await setup();
    const first = document.querySelector<HTMLElement>('.dd-first')!;
    first.focus();

    const event = tab(first, true);
    fixture.detectChanges();

    expect(isDropdownOpen(fixture.componentInstance.dropdown)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('.dd-trigger'));
    fixture.destroy();
  });
});

describe('TwDropdownComponent scrolling container', () => {
  it('should follow the trigger when an enclosing container (not the window) scrolls', async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownTabInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DropdownTabInModalHostComponent);
    fixture.detectChanges();
    document.querySelector<HTMLElement>('.dd-trigger')!.click();
    fixture.detectChanges();

    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    const container = fixture.debugElement.query(By.directive(TwDropdownComponent))
      .nativeElement as HTMLElement;
    vi.spyOn(container.querySelector('div')!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(20, 100, 80, 30)
    );

    // `scroll` from an element does not bubble to the window
    document.querySelector('.after')!.dispatchEvent(new Event('scroll'));

    expect(menu.style.top).toBe('134px');
    vi.restoreAllMocks();
    fixture.destroy();
  });
});

@Component({
  template: `
    <tw-dropdown>
      <button twDropdownTrigger class="dd-trigger">Open</button>
      <tw-dropdown-menu>
        <button twDropdownItem class="dd-enabled" (click)="clicks.push('enabled')">On</button>
        <button
          twDropdownItem
          class="dd-disabled"
          [disabled]="true"
          (click)="clicks.push('disabled')"
        >
          Off
        </button>
      </tw-dropdown-menu>
    </tw-dropdown>
  `,
  standalone: true,
  imports: [
    TwDropdownComponent,
    TwDropdownItemDirective,
    TwDropdownMenuComponent,
    TwDropdownTriggerDirective,
  ],
})
class DisabledItemHostComponent {
  clicks: string[] = [];
}

describe('TwDropdownItemDirective disabled', () => {
  it('should natively disable a disabled button item so it cannot be activated', async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledItemHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(DisabledItemHostComponent);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('.dd-disabled') as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.getAttribute('aria-disabled')).toBe('true');
    item.click();
    expect(fixture.componentInstance.clicks).toEqual([]);

    const enabled = fixture.nativeElement.querySelector('.dd-enabled') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    expect(enabled.hasAttribute('aria-disabled')).toBe(false);
    fixture.destroy();
  });
});

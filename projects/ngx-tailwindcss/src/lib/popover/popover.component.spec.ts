import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopoverPosition, PopoverTrigger, TwPopoverComponent } from './popover.component';
import { TwClassService } from '../core/tw-class.service';

/** Reads the protected visibility state without widening the component's public API */
const isPopoverVisible = (popover: TwPopoverComponent): boolean =>
  (popover as unknown as { visible: () => boolean }).visible();

@Component({
  template: `
    <tw-popover
      [position]="position()"
      [trigger]="trigger()"
      [header]="header()"
      [showArrow]="showArrow()"
      [dismissible]="dismissible()"
      [closeOnEscape]="closeOnEscape()"
      [hoverDelay]="hoverDelay()"
      [classOverride]="classOverride()"
      (onShow)="onShow()"
      (onHide)="onHide()"
    >
      <button twPopoverTrigger>Click me</button>
      <div class="popover-content">Popover content here</div>
      <button type="button" data-testid="action" (click)="actionCount = actionCount + 1">
        Action
      </button>
    </tw-popover>
  `,
  standalone: true,
  imports: [TwPopoverComponent],
})
class TestHostComponent {
  @ViewChild(TwPopoverComponent) popover!: TwPopoverComponent;
  position = signal<PopoverPosition>('bottom');
  trigger = signal<PopoverTrigger>('click');
  header = signal('');
  showArrow = signal(true);
  dismissible = signal(true);
  closeOnEscape = signal(true);
  hoverDelay = signal(200);
  classOverride = signal('');

  showCount = 0;
  hideCount = 0;
  actionCount = 0;

  onShow() {
    this.showCount++;
  }
  onHide() {
    this.hideCount++;
  }
}

describe('TwPopoverComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let popoverEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    popoverEl = fixture.debugElement.query(By.directive(TwPopoverComponent)).nativeElement;
  });

  afterEach(() => {
    // Clean up any portals
    document.querySelectorAll('[style*="position: fixed"]').forEach(el => {
      el.remove();
    });
  });

  it('should create the popover', () => {
    expect(popoverEl).toBeTruthy();
    expect(component.popover).toBeTruthy();
  });

  it('should render trigger element', () => {
    const trigger = popoverEl.querySelector('button');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toContain('Click me');
  });

  describe('click trigger', () => {
    it('should show popover on trigger click', () => {
      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.click();
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(true);
      expect(component.showCount).toBe(1);
    });

    it('should hide popover on second click', () => {
      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.click();
      fixture.detectChanges();
      triggerContainer.click();
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
      expect(component.hideCount).toBe(1);
    });
  });

  describe('live projected content', () => {
    it('should keep projected event handlers working inside the portal', () => {
      component.popover.show();
      fixture.detectChanges();

      const portal = document.querySelector('[role="dialog"]');
      const action = portal?.querySelector<HTMLButtonElement>('[data-testid="action"]');
      expect(action).toBeTruthy();

      action!.click();
      fixture.detectChanges();

      expect(component.actionCount).toBe(1);
    });

    it('should restore projected content to the host on close', () => {
      component.popover.show();
      fixture.detectChanges();
      component.popover.hide();
      fixture.detectChanges();

      const source = popoverEl.querySelector<HTMLElement>('.popover-content-source')!;
      expect(source).toBeTruthy();
      expect(source.style.display).toBe('none');
      expect(source.querySelector('[data-testid="action"]')).toBeTruthy();

      // Content survives a second open/close cycle
      component.popover.show();
      fixture.detectChanges();
      const portal = document.querySelector('[role="dialog"]');
      expect(portal?.querySelector('.popover-content')).toBeTruthy();
    });
  });

  describe('focus trigger', () => {
    it('should show popover on focusin and hide on focusout', () => {
      component.trigger.set('focus');
      fixture.detectChanges();

      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(true);

      triggerContainer.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
    });

    it('should open on focusin for hover trigger (keyboard equivalence)', () => {
      component.trigger.set('hover');
      fixture.detectChanges();

      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(true);
    });

    it('should close a keyboard-opened hover popover when focus leaves the trigger', () => {
      component.trigger.set('hover');
      fixture.detectChanges();

      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();
      triggerContainer.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
    });
  });

  describe('programmatic control', () => {
    it('should show popover via show()', () => {
      component.popover.show();
      fixture.detectChanges();
      expect(isPopoverVisible(component.popover)).toBe(true);
    });

    it('should hide popover via hide()', () => {
      component.popover.show();
      fixture.detectChanges();
      component.popover.hide();
      fixture.detectChanges();
      expect(isPopoverVisible(component.popover)).toBe(false);
    });

    it('should toggle popover via toggle()', () => {
      component.popover.toggle();
      expect(isPopoverVisible(component.popover)).toBe(true);
      component.popover.toggle();
      expect(isPopoverVisible(component.popover)).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit onShow when opened', () => {
      component.popover.show();
      expect(component.showCount).toBe(1);
    });

    it('should emit onHide when closed', () => {
      component.popover.show();
      component.popover.hide();
      expect(component.hideCount).toBe(1);
    });

    it('should emit only on actual open/close transitions', () => {
      component.popover.hide();
      expect(component.hideCount).toBe(0);

      component.popover.show();
      component.popover.show();
      expect(component.showCount).toBe(1);

      component.popover.hide();
      component.popover.hide();
      expect(component.hideCount).toBe(1);
    });

    it('should apply a classOverride changed after the first open', () => {
      component.popover.show();
      fixture.detectChanges();
      component.popover.hide();
      fixture.detectChanges();

      component.classOverride.set('custom-late-class');
      fixture.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      expect(document.querySelector('[role="dialog"]')?.classList).toContain('custom-late-class');
    });
  });

  describe('escape key', () => {
    it('should close on escape key when closeOnEscape is true', () => {
      component.popover.show();
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
    });

    it('should return focus to the trigger when Escape closes with focus inside', () => {
      component.popover.show();
      fixture.detectChanges();

      const action = document.querySelector<HTMLElement>('[role="dialog"] [data-testid="action"]')!;
      action.focus();
      action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
      expect(document.activeElement).toBe(popoverEl.querySelector('[twPopoverTrigger]'));
    });
  });

  describe('escape layering', () => {
    it('should let handlers inside the content run, and stay open when they claim Escape', () => {
      component.popover.show();
      fixture.detectChanges();

      const portal = document.querySelector('[role="dialog"]');
      const action = portal!.querySelector<HTMLElement>('[data-testid="action"]')!;
      const inner = vi.fn((event: KeyboardEvent) => {
        event.preventDefault();
      });
      action.addEventListener('keydown', inner);
      action.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      fixture.detectChanges();

      expect(inner).toHaveBeenCalled();
      expect(isPopoverVisible(component.popover)).toBe(true);
    });

    it('should close only the topmost of nested popovers', () => {
      const outer = TestBed.createComponent(TwPopoverComponent);
      outer.detectChanges();
      outer.componentInstance.show();
      outer.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(isPopoverVisible(component.popover)).toBe(false);
      expect(isPopoverVisible(outer.componentInstance)).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(isPopoverVisible(outer.componentInstance)).toBe(false);
      outer.destroy();
    });
  });

  describe('ARIA semantics', () => {
    const trigger = () => popoverEl.querySelector('[twPopoverTrigger]')!;

    it('should expose click popovers as dialogs controlled by the trigger', () => {
      expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(trigger().getAttribute('aria-controls')).toBeNull();

      component.header.set('Settings');
      fixture.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      const panel = document.querySelector('[role="dialog"]')!;
      expect(panel).toBeTruthy();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(trigger().getAttribute('aria-controls')).toBe(panel.id);
      const labelledBy = panel.getAttribute('aria-labelledby');
      expect(document.querySelector(`#${labelledBy}`)?.textContent).toBe('Settings');

      component.popover.hide();
      fixture.detectChanges();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(trigger().getAttribute('aria-controls')).toBeNull();
    });

    it('should keep tooltip semantics for hover popovers', () => {
      component.trigger.set('hover');
      fixture.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      const panel = document.querySelector('[role="tooltip"]')!;
      expect(panel).toBeTruthy();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(trigger().getAttribute('aria-describedby')).toBe(panel.id);
      expect(trigger().getAttribute('aria-expanded')).toBeNull();

      component.popover.hide();
      fixture.detectChanges();
      expect(trigger().getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('hover trigger', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      component.trigger.set('hover');
      component.hoverDelay.set(0);
      fixture.detectChanges();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show on mouseenter', () => {
      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(10);
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(true);
    });

    it('should hide on mouseleave', () => {
      const triggerContainer = popoverEl.querySelector('div') as HTMLElement;
      triggerContainer.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(10);
      fixture.detectChanges();

      triggerContainer.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(10);
      fixture.detectChanges();

      expect(isPopoverVisible(component.popover)).toBe(false);
    });
  });

  describe('position', () => {
    it('should accept bottom position', () => {
      expect(component.popover.position).toBe('bottom');
    });

    it('should accept top position', () => {
      component.position.set('top');
      fixture.detectChanges();
      expect(component.popover.position).toBe('top');
    });

    it('should accept left position', () => {
      component.position.set('left');
      fixture.detectChanges();
      expect(component.popover.position).toBe('left');
    });

    it('should accept right position', () => {
      component.position.set('right');
      fixture.detectChanges();
      expect(component.popover.position).toBe('right');
    });
  });

  describe('header', () => {
    it('should not show header by default', () => {
      component.popover.show();
      fixture.detectChanges();

      const portal = document.querySelector('[role="dialog"]');
      expect(portal?.textContent).not.toContain('Settings');
    });

    it('should show header when provided', () => {
      component.header.set('Settings');
      fixture.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      const portal = document.querySelector('[role="dialog"]');
      expect(portal?.textContent).toContain('Settings');
    });
  });

  describe('class customization', () => {
    it('should apply classOverride', () => {
      component.classOverride.set('custom-popover-class');
      fixture.detectChanges();
      component.popover.show();
      fixture.detectChanges();

      const portal = document.querySelector('[role="dialog"]');
      expect(portal?.className).toContain('custom-popover-class');
    });
  });

  describe('cleanup', () => {
    it('should remove portal on destroy', () => {
      component.popover.show();
      fixture.detectChanges();

      const portalsBefore = document.querySelectorAll('[role="dialog"]').length;
      expect(portalsBefore).toBe(1);

      fixture.destroy();

      const portalsAfter = document.querySelectorAll('[role="dialog"]').length;
      expect(portalsAfter).toBe(0);
    });
  });
});

import { Component, DebugElement, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SplitterDirection,
  TwSplitterComponent,
  TwSplitterPaneComponent,
} from './splitter.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-splitter
      [direction]="direction()"
      [initialSizes]="initialSizes()"
      [disabled]="disabled()"
      (sizesChange)="onSizesChangeSpy($event)"
      data-testid="test-splitter"
    >
      <div twSplitterPaneStart data-testid="pane-start">Left Panel</div>
      <div twSplitterPaneEnd data-testid="pane-end">Right Panel</div>
    </tw-splitter>
  `,
  standalone: true,
  imports: [TwSplitterComponent, TwSplitterPaneComponent],
})
class TestHostComponent {
  @ViewChild(TwSplitterComponent) splitter!: TwSplitterComponent;
  direction = signal<SplitterDirection>('horizontal');
  initialSizes = signal<[number, number]>([30, 70]);
  disabled = signal(false);

  onSizesChangeSpy = vi.fn();
}

describe('TwSplitterComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let splitterEl: DebugElement;

  const gutter = () => splitterEl.query(By.css('[role="separator"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    splitterEl = fixture.debugElement.query(By.directive(TwSplitterComponent));
  });

  it('should create the splitter', () => {
    expect(splitterEl).toBeTruthy();
    expect(component.splitter).toBeTruthy();
  });

  describe('pane projection', () => {
    it('should project both panes into their slots', () => {
      const start = splitterEl.query(By.css('[data-testid="pane-start"]'));
      const end = splitterEl.query(By.css('[data-testid="pane-end"]'));
      expect(start.nativeElement.textContent).toContain('Left Panel');
      expect(end.nativeElement.textContent).toContain('Right Panel');
    });

    it('should project the start pane before and the end pane after the gutter', () => {
      const container = splitterEl.query(By.css('div')).nativeElement as HTMLElement;
      const [firstPane, , secondPane] = [...container.children] as HTMLElement[];
      expect(firstPane.textContent).toContain('Left Panel');
      expect(secondPane.textContent).toContain('Right Panel');
    });

    it('should apply initial sizes to the panes', () => {
      const container = splitterEl.query(By.css('div')).nativeElement as HTMLElement;
      const [firstPane, , secondPane] = [...container.children] as HTMLElement[];
      expect(firstPane.style.flexBasis).toBe('30%');
      expect(secondPane.style.flexBasis).toBe('70%');
    });
  });

  describe('setSizes and reset', () => {
    it('should set sizes programmatically and emit', () => {
      component.splitter.setSizes([40, 60]);
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).toHaveBeenCalledWith([40, 60]);

      const container = splitterEl.query(By.css('div')).nativeElement as HTMLElement;
      expect((container.children[0] as HTMLElement).style.flexBasis).toBe('40%');
    });

    it('should reset to initial sizes', () => {
      component.splitter.setSizes([10, 90]);
      component.splitter.reset();
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).toHaveBeenLastCalledWith([30, 70]);
    });
  });

  describe('gutter accessibility and keyboard resize', () => {
    it('should expose separator semantics', () => {
      const el = gutter().nativeElement as HTMLElement;
      expect(el.getAttribute('tabindex')).toBe('0');
      expect(el.getAttribute('aria-orientation')).toBe('vertical');
      expect(el.getAttribute('aria-valuenow')).toBe('30');
      expect(el.getAttribute('aria-valuemin')).toBe('0');
      expect(el.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should grow the first pane on ArrowRight', () => {
      gutter().nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).toHaveBeenCalledWith([32, 68]);
      expect((gutter().nativeElement as HTMLElement).getAttribute('aria-valuenow')).toBe('32');
    });

    it('should shrink the first pane on ArrowLeft', () => {
      gutter().nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
      );
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).toHaveBeenCalledWith([28, 72]);
    });

    it('should use ArrowUp/ArrowDown in vertical direction', () => {
      component.direction.set('vertical');
      fixture.detectChanges();

      gutter().nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).toHaveBeenCalledWith([32, 68]);
      expect((gutter().nativeElement as HTMLElement).getAttribute('aria-orientation')).toBe(
        'horizontal'
      );
    });

    it('should not resize when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      gutter().nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
      fixture.detectChanges();
      expect(component.onSizesChangeSpy).not.toHaveBeenCalled();
      expect((gutter().nativeElement as HTMLElement).getAttribute('tabindex')).toBe('-1');
    });
  });
  describe('robustness', () => {
    it('should follow later initialSizes changes', () => {
      component.initialSizes.set([60, 40]);
      fixture.detectChanges();
      const container = splitterEl.query(By.css('div')).nativeElement as HTMLElement;
      expect((container.children[0] as HTMLElement).style.flexBasis).toBe('60%');
    });

    it('should end a touch drag on touchcancel and release document listeners', () => {
      const dragEnd = vi.fn();
      component.splitter.dragEnd.subscribe(dragEnd);
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, 'touches', { value: [{ clientX: 100, clientY: 0 }] });
      gutter().nativeElement.dispatchEvent(touchStart);

      document.dispatchEvent(new Event('touchcancel'));

      expect(dragEnd).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});

describe('TwSplitterComponent static class attribute', () => {
  it('forwards a static class to the inner element without painting it on the host too', async () => {
    @Component({
      template: `<tw-splitter class="tw-test-box p-4 extra"
        ><div twSplitterPaneStart>A</div>
        <div twSplitterPaneEnd>B</div></tw-splitter
      >`,
      standalone: true,
      imports: [TwSplitterComponent],
    })
    class StaticClassHostComponent {}

    // Stand-in for utility classes defined by the app's stylesheet
    const style = document.createElement('style');
    style.textContent =
      '.tw-test-box { padding: 16px; border: 2px solid red; background: red; opacity: 0.5; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [StaticClassHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(StaticClassHostComponent);
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css('tw-splitter')).nativeElement as HTMLElement;
      const inner = host.querySelector<HTMLElement>(':scope > div')!;

      // Angular keeps the static class on the host as well as passing it to the input
      expect(host.classList.contains('tw-test-box')).toBe(true);
      expect(inner.className).toContain('tw-test-box');
      expect(inner.className).toContain('p-4');

      const hostStyle = getComputedStyle(host);
      expect(hostStyle.paddingTop).toBe('0px');
      expect(hostStyle.borderTopWidth).toBe('0px');
      expect(hostStyle.opacity).toBe('1');

      const innerStyle = getComputedStyle(inner);
      expect(innerStyle.paddingTop).toBe('16px');
      expect(innerStyle.borderTopWidth).toBe('2px');
    } finally {
      style.remove();
    }
  });
});

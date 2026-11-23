import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialSize, DialVariant, TwVolumeDialComponent } from './volume-dial.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-volume-dial
      [value]="value()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled()"
      [label]="label()"
      [unit]="unit()"
      [showValue]="showValue()"
      [showTicks]="showTicks()"
      (valueChange)="onValueChange($event)"
    ></tw-volume-dial>
  `,
  standalone: true,
  imports: [TwVolumeDialComponent],
})
class TestHostComponent {
  @ViewChild(TwVolumeDialComponent) dial!: TwVolumeDialComponent;
  value = signal(50);
  min = signal(0);
  max = signal(100);
  step = signal(1);
  variant = signal<DialVariant>('modern');
  size = signal<DialSize>('md');
  disabled = signal(false);
  label = signal('Volume');
  unit = signal('%');
  showValue = signal(true);
  showTicks = signal(true);

  valueChanges: number[] = [];
  onValueChange(value: number): void {
    this.valueChanges.push(value);
  }
}

interface FakeTouch {
  identifier: number;
  clientX: number;
  clientY: number;
}
/** A DOMRect at the origin with the given size */
function rect(width: number, height: number): DOMRect {
  const r = { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height };
  return { ...r, toJSON: () => r };
}

function touchEvent(
  type: string,
  touches: FakeTouch[],
  changedTouches: FakeTouch[] = touches
): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: touches },
    targetTouches: { value: changedTouches },
    changedTouches: { value: changedTouches },
  });
  return event as TouchEvent;
}

/**
 * Capture document listeners (jsdom's AbortSignal does not mix with zone.js-patched
 * document listeners) so drag handlers can be driven directly.
 */
function captureDocumentListeners(): Record<string, (e: Event) => void> {
  const listeners: Record<string, (e: Event) => void> = {};
  vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    listener: (e: Event) => void,
    options?: AddEventListenerOptions
  ) => {
    // Honour AbortController-based removal
    listeners[type] = e => {
      if (!options?.signal?.aborted) listener(e);
    };
  }) as typeof document.addEventListener);
  return listeners;
}

describe('TwVolumeDialComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let svgEl: SVGElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    svgEl = fixture.debugElement.query(By.css('svg')).nativeElement;
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component.dial).toBeTruthy();
    });

    it('should render SVG element', () => {
      expect(svgEl).toBeTruthy();
      expect(svgEl.tagName.toLowerCase()).toBe('svg');
    });
  });

  describe('inputs', () => {
    it('should reflect the bound value in aria-valuenow', () => {
      component.value.set(75);
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('75');
    });

    it('should render the value text when showValue is enabled', () => {
      component.value.set(42);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('42');
    });

    it('should clamp keyboard-driven changes at max', () => {
      component.min.set(10);
      component.max.set(90);
      component.value.set(90);
      fixture.detectChanges();

      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('90');
      expect(component.valueChanges).toHaveLength(0);
    });

    it('should clamp to min via the Home key', () => {
      component.min.set(10);
      component.max.set(90);
      fixture.detectChanges();

      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('10');
      expect(component.valueChanges).toContain(10);
    });

    it('should jump to max via the End key', () => {
      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('100');
      expect(component.valueChanges).toContain(100);
    });

    it('should keep the drawn arc within the dial for out-of-range or degenerate values', () => {
      const indicator = (): SVGLineElement =>
        svgEl.querySelectorAll('line')[svgEl.querySelectorAll('line').length - 1];
      component.value.set(100);
      fixture.detectChanges();
      const atMax = [indicator().getAttribute('x2'), indicator().getAttribute('y2')];
      const fillAtMax = svgEl.querySelectorAll('path')[1].getAttribute('d');

      component.value.set(250);
      fixture.detectChanges();
      expect([indicator().getAttribute('x2'), indicator().getAttribute('y2')]).toEqual(atMax);
      expect(svgEl.querySelectorAll('path')[1].getAttribute('d')).toBe(fillAtMax);

      component.min.set(100);
      fixture.detectChanges();
      expect(svgEl.querySelectorAll('path')[1].getAttribute('d')).not.toContain('NaN');
    });

    it('should apply the step to keyboard increments', () => {
      component.step.set(5);
      fixture.detectChanges();

      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('55');
      expect(component.valueChanges).toContain(55);
    });

    it('should resize the SVG according to the size input', () => {
      const expected: Record<Exclude<DialSize, 'xs'>, string> = {
        sm: '48',
        md: '72',
        lg: '96',
        xl: '128',
      };

      for (const [size, dimension] of Object.entries(expected)) {
        component.size.set(size as DialSize);
        fixture.detectChanges();

        expect(svgEl.getAttribute('width')).toBe(dimension);
        expect(svgEl.getAttribute('height')).toBe(dimension);
      }
    });

    it('should render each variant without errors', () => {
      const variants: DialVariant[] = ['modern', 'vintage', 'minimal', 'led'];

      for (const variant of variants) {
        component.variant.set(variant);
        fixture.detectChanges();

        expect(svgEl.querySelectorAll('path').length).toBeGreaterThan(0);
      }
    });
  });

  describe('regressions', () => {
    it('should not leak floating-point noise with fractional steps', () => {
      component.value.set(0.2);
      component.step.set(0.1);
      fixture.detectChanges();

      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('0.3');
    });

    it('should honour setDisabledState from the forms API', () => {
      component.dial.setDisabledState(true);
      fixture.detectChanges();

      expect(svgEl.getAttribute('tabindex')).toBe('-1');
      svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();
      expect(component.valueChanges).toHaveLength(0);
    });

    it('should sweep the full range in a single drag beyond 180 degrees', () => {
      component.value.set(0);
      fixture.detectChanges();

      // jsdom rects are all zero, so the dial centre is at (0, 0)
      const point = (deg: number) => ({
        clientX: 100 * Math.cos((deg * Math.PI) / 180),
        clientY: 100 * Math.sin((deg * Math.PI) / 180),
      });

      // Drive the drag handlers directly (jsdom's AbortSignal does not mix with
      // zone.js-patched document listeners)
      const drag = component.dial as unknown as {
        startDrag(x: number, y: number): void;
        handleDrag(x: number, y: number): void;
      };
      const start = point(0);
      drag.startDrag(start.clientX, start.clientY);
      for (let deg = 10; deg <= 280; deg += 10) {
        const p = point(deg);
        drag.handleDrag(p.clientX, p.clientY);
      }
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-valuenow')).toBe('100');
    });
  });

  describe('disabled state', () => {
    it('should set tabindex to -1 when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(svgEl.getAttribute('tabindex')).toBe('-1');
    });

    it('should set aria-disabled when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(svgEl.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('accessibility', () => {
    it('should have role="slider"', () => {
      expect(svgEl.getAttribute('role')).toBe('slider');
    });

    it('should have aria-valuenow', () => {
      expect(svgEl.getAttribute('aria-valuenow')).toBeTruthy();
    });

    it('should have aria-valuemin', () => {
      expect(svgEl.getAttribute('aria-valuemin')).toBeTruthy();
    });

    it('should have aria-valuemax', () => {
      expect(svgEl.getAttribute('aria-valuemax')).toBeTruthy();
    });

    it('should have aria-label', () => {
      expect(svgEl.getAttribute('aria-label')).toBeTruthy();
    });

    it('should be focusable when enabled', () => {
      expect(svgEl.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('SVG structure', () => {
    it('should have path elements for the dial', () => {
      const paths = svgEl.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should have circle element for the knob', () => {
      const circles = svgEl.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });
  });

  describe('multi-touch', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should follow only the finger that started the drag', () => {
      const doc = captureDocumentListeners();
      component.value.set(0);
      fixture.detectChanges();
      svgEl.getBoundingClientRect = (): DOMRect => rect(100, 100);

      const other = { identifier: 1, clientX: 0, clientY: 50 }; // holding another control
      const own = { identifier: 2, clientX: 50, clientY: 0 }; // lands at 12 o'clock
      svgEl.dispatchEvent(touchEvent('touchstart', [other, own], [own]));

      // Own finger rotates 90 degrees clockwise; the other finger sits at 9 o'clock
      doc['touchmove'](touchEvent('touchmove', [other, { ...own, clientX: 100, clientY: 50 }]));
      fixture.detectChanges();
      expect(component.dial.value()).toBe(33);

      // The other finger lifting must not end this drag
      doc['touchend'](touchEvent('touchend', [own], [other]));
      doc['touchmove'](touchEvent('touchmove', [{ ...own, clientX: 50, clientY: 100 }]));
      expect(component.dial.value()).toBe(67);

      doc['touchend'](touchEvent('touchend', [], [own]));
      doc['touchmove'](touchEvent('touchmove', [{ ...own, clientX: 0, clientY: 50 }]));
      expect(component.dial.value()).toBe(67);
    });
  });
});

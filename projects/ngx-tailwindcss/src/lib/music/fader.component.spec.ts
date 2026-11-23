import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwFaderComponent } from './fader.component';

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

describe('TwFaderComponent', () => {
  let fixture: ComponentFixture<TwFaderComponent>;
  let component: TwFaderComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwFaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwFaderComponent);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  describe('ControlValueAccessor', () => {
    it('writeValue should update the rendered value', () => {
      component.writeValue(6);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('6');
    });

    it('writeValue should fall back to the default value for null', () => {
      component.writeValue(null as unknown as number);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('registerOnChange callback should fire on keyboard changes', () => {
      const received: number[] = [];
      component.registerOnChange(value => received.push(value));

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();

      expect(received).toContain(12); // default max
    });
  });

  describe('step precision', () => {
    it('should not leak floating-point noise into aria-valuenow on keyboard steps', () => {
      component.writeValue(0.2);
      fixture.detectChanges();

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0.3');
    });
  });

  describe('setDisabledState', () => {
    it('should reflect the disabled state on the host', () => {
      component.setDisabledState(true);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-disabled')).toBe('true');
      expect(hostEl.getAttribute('tabindex')).toBe('-1');
    });

    it('should block keyboard interaction while disabled', () => {
      component.setDisabledState(true);
      fixture.detectChanges();

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('should not reset the value on double-click while disabled', () => {
      component.writeValue(-20);
      component.setDisabledState(true);
      fixture.detectChanges();
      const emitted: number[] = [];
      component.valueChange.subscribe(v => emitted.push(v));

      hostEl.querySelector('[title^="Double-click"]')!.dispatchEvent(new MouseEvent('dblclick'));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('-20');
      expect(emitted).toEqual([]);
    });

    it('should re-enable interaction when cleared', () => {
      component.setDisabledState(true);
      fixture.detectChanges();
      component.setDisabledState(false);
      fixture.detectChanges();

      expect(hostEl.getAttribute('tabindex')).toBe('0');

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('12');
    });
  });

  describe('slider accessibility', () => {
    it('should expose the slider role and range', () => {
      expect(hostEl.getAttribute('role')).toBe('slider');
      expect(hostEl.getAttribute('aria-valuemin')).toBe('-60');
      expect(hostEl.getAttribute('aria-valuemax')).toBe('12');
      expect(hostEl.getAttribute('aria-valuetext')).toContain('dB');
    });
  });

  describe('peak hold', () => {
    const held = (): number =>
      (component as unknown as { peakHoldLevel(): number }).peakHoldLevel();

    it('should keep holding the peak while the level rises below it', () => {
      fixture.componentRef.setInput('peakLevel', 80);
      fixture.detectChanges();
      fixture.componentRef.setInput('peakLevel', 30);
      fixture.detectChanges();
      fixture.componentRef.setInput('peakLevel', 40);
      fixture.detectChanges();

      expect(held()).toBe(80);
    });

    it('should follow the level down once the hold time has elapsed', () => {
      vi.useFakeTimers();
      try {
        fixture.componentRef.setInput('peakHoldTime', 100);
        fixture.componentRef.setInput('peakLevel', 80);
        fixture.detectChanges();
        fixture.componentRef.setInput('peakLevel', 30);
        fixture.detectChanges();
        vi.advanceTimersByTime(150);
        expect(held()).toBe(30);

        fixture.componentRef.setInput('peakLevel', 0);
        fixture.detectChanges();
        expect(held()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('peak meter fill', () => {
    const fill = (): Record<string, string> =>
      (component as unknown as { peakFillStyle(): Record<string, string> }).peakFillStyle();

    it('should size the gradient to the whole meter so a low level stays green', () => {
      fixture.componentRef.setInput('size', 'md');
      fixture.componentRef.setInput('showPeakMeter', true);
      fixture.componentRef.setInput('peakLevel', 20);
      fixture.detectChanges();

      expect(fill()['height']).toBe('20%');
      expect(fill()['background-image']).toContain('to top');
      // md track is 150px: the gradient spans it, not just the lit 20%
      expect(fill()['background-size']).toBe('100% 150px');
      expect(fill()['background-position']).toBe('bottom');
    });

    it('should run the gradient along a horizontal meter', () => {
      fixture.componentRef.setInput('orientation', 'horizontal');
      fixture.componentRef.setInput('peakLevel', 50);
      fixture.detectChanges();

      expect(fill()['width']).toBe('50%');
      expect(fill()['background-image']).toContain('to right');
      expect(fill()['background-size']).toBe('150px 100%');
      expect(fill()['background-position']).toBe('left');
    });
  });

  describe('multi-touch', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should follow only the finger that started the drag', () => {
      const doc = captureDocumentListeners();
      // The track sits right before the fader cap
      const track = hostEl.querySelector('[title^="Double-click"]')!
        .previousElementSibling as HTMLElement;
      track.getBoundingClientRect = (): DOMRect => rect(10, 100);
      const value = () => Number(hostEl.getAttribute('aria-valuenow'));

      const other = { identifier: 1, clientX: 5, clientY: 90 }; // holding another fader
      const own = { identifier: 2, clientX: 5, clientY: 10 };
      hostEl.dispatchEvent(touchEvent('touchstart', [other, own], [own]));
      fixture.detectChanges();
      expect(value()).toBe(8.2);

      doc['touchmove'](touchEvent('touchmove', [other, { ...own, clientY: 50 }]));
      fixture.detectChanges();
      expect(value()).toBe(-24);

      // The other finger lifting must not end this drag
      doc['touchend'](touchEvent('touchend', [own], [other]));
      doc['touchmove'](touchEvent('touchmove', [{ ...own, clientY: 30 }]));
      fixture.detectChanges();
      expect(value()).toBe(-7.9);

      doc['touchend'](touchEvent('touchend', [], [own]));
      doc['touchmove'](touchEvent('touchmove', [{ ...own, clientY: 90 }]));
      fixture.detectChanges();
      expect(value()).toBe(-7.9);
    });
  });

  describe('pointer presses', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should ignore presses beyond the track ends (label, value readout)', () => {
      captureDocumentListeners();
      const track = hostEl.querySelector('[title^="Double-click"]')!
        .previousElementSibling as HTMLElement;
      // Track spans y 100..200
      track.getBoundingClientRect = (): DOMRect => {
        const r = { x: 0, y: 100, left: 0, top: 100, width: 10, height: 100 };
        return { ...r, right: 10, bottom: 200, toJSON: () => r };
      };
      const value = () => Number(hostEl.getAttribute('aria-valuenow'));
      const press = (clientY: number) => {
        hostEl.dispatchEvent(
          new MouseEvent('mousedown', { clientX: 5, clientY, bubbles: true, cancelable: true })
        );
        fixture.detectChanges();
      };

      press(230); // value readout below the track
      expect(value()).toBe(0);
      press(50); // label above the track
      expect(value()).toBe(0);

      press(150); // on the track
      expect(value()).toBe(-24);
    });
  });

  describe('scale alignment', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should put the scale marks and zero line where the cap centre sits for that value', () => {
      // Default md fader: 150px track, 16px cap, -60..+12 dB
      fixture.componentInstance.writeValue(0);
      fixture.detectChanges();
      const cap = hostEl.querySelector<HTMLElement>('[title^="Double-click"]')!;
      const capCentre = Number.parseFloat(cap.style.bottom) + 8;
      const markBottom = (label: string): number => {
        const span = [...hostEl.querySelectorAll('span')].find(
          s => s.textContent?.trim() === label && s.parentElement?.style.bottom
        )!;
        return (Number.parseFloat(span.parentElement!.style.bottom) / 100) * 150;
      };

      // Spread over the whole track, "0" sat 5px above the cap centre (cap read ~-2.5 dB)
      expect(markBottom('0')).toBeCloseTo(capCentre, 3);
      const zeroLine = hostEl.querySelector<HTMLElement>('[class~="bg-white/60"]')!;
      expect((Number.parseFloat(zeroLine.style.bottom) / 100) * 150).toBeCloseTo(capCentre, 3);

      fixture.componentInstance.writeValue(-48);
      fixture.detectChanges();
      expect(markBottom('-48')).toBeCloseTo(Number.parseFloat(cap.style.bottom) + 8, 3);
    });

    it('should set the value whose cap centre lands under the pointer', () => {
      captureDocumentListeners();
      const track = hostEl.querySelector('[title^="Double-click"]')!
        .previousElementSibling as HTMLElement;
      track.getBoundingClientRect = (): DOMRect => rect(10, 150);
      // The -48 mark: cap centre 8 + (12 / 72) * 134 = 30.33px above the track bottom
      hostEl.dispatchEvent(
        new MouseEvent('mousedown', {
          clientX: 5,
          clientY: 150 - (8 + (12 / 72) * 134),
          bubbles: true,
          cancelable: true,
        })
      );
      fixture.detectChanges();
      expect(Number(hostEl.getAttribute('aria-valuenow'))).toBe(-48);
    });
  });

  describe('container classes', () => {
    it('should apply both the layout classes and the variant container classes', () => {
      fixture.componentRef.setInput('variant', 'channel');
      fixture.componentRef.setInput('classOverride', 'my-fader');
      fixture.detectChanges();
      const container = hostEl.firstElementChild as HTMLElement;

      expect(container.classList).toContain('flex-col');
      expect(container.classList).toContain('my-fader');
      expect(container.classList).toContain('bg-slate-800');
    });

    it('should show the disabled styling', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect((hostEl.firstElementChild as HTMLElement).classList).toContain('opacity-50');
    });
  });

  describe('keyboard', () => {
    it('should not re-emit an unchanged value at the boundary', () => {
      const received: number[] = [];
      component.registerOnChange(value => received.push(value));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));

      expect(received).toEqual([12]);
    });

    it('should mark the control touched after a double-click reset (updateOn: blur commits)', () => {
      const calls: string[] = [];
      component.registerOnChange(() => calls.push('change'));
      component.registerOnTouched(() => calls.push('touched'));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      calls.length = 0;

      const cap = hostEl.querySelector<HTMLElement>('[title^="Double-click"]')!;
      cap.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      // The reset value is only committed by a touched call that follows it
      expect(calls).toEqual(['change', 'touched']);
    });

    it('should mark the control touched on keyboard interaction', () => {
      let touched = false;
      component.registerOnTouched(() => (touched = true));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

      expect(touched).toBe(true);
    });
  });
});

describe('TwFaderComponent text colours', () => {
  it('should keep label and scale readable on the page and the value on its dark chip', async () => {
    await TestBed.configureTestingModule({ imports: [TwFaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwFaderComponent);
    fixture.componentRef.setInput('label', 'Vol');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const label = () =>
      [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === 'Vol')!;
    const value = () => el.querySelector<HTMLElement>('div.font-mono.text-center')!;
    const scale = () => el.querySelector<HTMLElement>('.absolute.flex.items-center')!;

    // default has no surface of its own: slate-300 label text vanished on a light page
    expect(label().className).toContain('text-slate-700');
    expect(label().className).toContain('dark:text-slate-300');
    expect(scale().className).toContain('dark:text-slate-400');
    // ...while the value readout stays light on its slate-800 chip
    expect(value().className).toContain('bg-slate-800');
    expect(value().className).toContain('text-slate-300');
    expect(value().className).not.toContain('text-slate-700');

    fixture.componentRef.setInput('variant', 'studio');
    fixture.detectChanges();
    expect(label().className).toContain('text-slate-800');
    expect(scale().className).toContain('text-slate-600');

    // channel scale sits on the slate-800 container (slate-500 is ~3:1 there)
    fixture.componentRef.setInput('variant', 'channel');
    fixture.detectChanges();
    expect(scale().className).toContain('text-slate-400');
    expect(scale().className).not.toContain('text-slate-500');
  });

  it('should not dim the dB unit of the chipless minimal readout', async () => {
    await TestBed.configureTestingModule({ imports: [TwFaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwFaderComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const unit = () => [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === 'dB')!;

    // On its dark chip the dimmed unit keeps 4.5:1
    expect(unit().classList).toContain('opacity-70');

    // Minimal has no chip: slate-700 at 70% opacity is ~4.3:1 on a white page
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(unit().classList).not.toContain('opacity-70');
  });
});

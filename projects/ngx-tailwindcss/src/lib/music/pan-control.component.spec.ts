import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwPanControlComponent } from './pan-control.component';

describe('TwPanControlComponent', () => {
  let fixture: ComponentFixture<TwPanControlComponent>;
  let component: TwPanControlComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwPanControlComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwPanControlComponent);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should leave center with arrow keys despite the center detent', () => {
    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(hostEl.getAttribute('aria-valuenow')).toBe('1');
    expect(hostEl.getAttribute('aria-valuetext')).toBe('R1');
  });

  it('should honour setDisabledState from the forms API', () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    expect(hostEl.getAttribute('tabindex')).toBe('-1');
    expect(hostEl.getAttribute('aria-disabled')).toBe('true');

    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
  });

  it('should not map stereo-width clicks into the -100..100 pan range', () => {
    fixture.componentRef.setInput('variant', 'stereo-width');
    fixture.detectChanges();
    component.writeValue(50);
    const received: number[] = [];
    component.registerOnChange(v => received.push(v));

    // Host-level mousedown (bubbled from the overlaid range input) must not set a pan value
    component.onMouseDown(new MouseEvent('mousedown', { clientX: 0 }));
    fixture.detectChanges();

    expect(received).toEqual([]);
  });

  it('should show a focus indicator for the invisible stereo-width range input', () => {
    fixture.componentRef.setInput('variant', 'stereo-width');
    fixture.detectChanges();

    // The range input is opacity-0, so its own focus ring is never visible
    const range = hostEl.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range.className).toContain('opacity-0');
    expect(range.parentElement!.className).toContain('has-[:focus-visible]:ring-2');
  });

  it('should leave stereo-width keyboard handling to the native range input', () => {
    fixture.componentRef.setInput('variant', 'stereo-width');
    fixture.detectChanges();
    const received: number[] = [];
    component.registerOnChange(v => received.push(v));

    const range = hostEl.querySelector<HTMLInputElement>('input[type="range"]')!;
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    range.dispatchEvent(event);

    // Must not be swallowed by the host and must not drive width below 0
    expect(event.defaultPrevented).toBe(false);
    expect(received).toEqual([]);
  });

  it('should only set the slider value from presses on the slider area', () => {
    const received: number[] = [];
    component.registerOnChange(v => received.push(v));
    // jsdom's AbortSignal does not mix with zone.js-patched document listeners: capture them
    const listeners: Record<string, (e: Event) => void> = {};
    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      listener: (e: Event) => void
    ) => {
      listeners[type] = listener;
    }) as typeof document.addEventListener);
    const track = hostEl.querySelector<HTMLElement>('.shadow-inner')!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 12 })
    );

    // The value readout and the L/R badges sit outside the track: no jump
    const readout = hostEl.querySelector<HTMLElement>('.font-mono.text-center')!;
    readout.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100 }));
    expect(received).toEqual([]);

    track.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 75 }));
    listeners['mouseup'](new MouseEvent('mouseup'));
    expect(received).toEqual([50]);
    vi.restoreAllMocks();
  });

  it('should draw no knob value arc in the dial opening at hard left', () => {
    fixture.componentRef.setInput('variant', 'knob');
    // Path intervals (0..circumference) a dash covers, given the circle's dash pattern
    const litSpans = (value: number): Array<[number, number]> => {
      component.writeValue(value);
      fixture.detectChanges();
      const arc = hostEl.querySelector<SVGCircleElement>('circle[stroke="#22d3ee"]')!;
      const [dash, gap = dash] = arc
        .getAttribute('stroke-dasharray')!
        .split(/[\s,]+/)
        .map(Number);
      const offset = Number(arc.getAttribute('stroke-dashoffset'));
      const length = 2 * Math.PI * 46;
      const spans: Array<[number, number]> = [];
      for (let start = -offset; start < length; start += dash + gap) {
        const from = Math.max(0, start);
        const to = Math.min(length, start + dash);
        if (to - from > 0.5) spans.push([from, to]);
      }
      return spans;
    };

    // Hard left: nothing lit (the opening is the 217..289 stretch of the path)
    expect(litSpans(-100)).toEqual([]);
    // Quarter way: only the start of the 270° arc
    expect(litSpans(-50)).toEqual([[0, 54.25]]);
    expect(litSpans(100)).toEqual([[0, 217]]);
  });

  it('should draw the knob L/R labels on the dark knob body, clear of the arc and indicator', () => {
    fixture.componentRef.setInput('variant', 'knob');
    fixture.detectChanges();
    const labels = [...hostEl.querySelectorAll<SVGTextElement>('svg text')];
    expect(labels.map(t => t.textContent?.trim())).toEqual(['L', 'R']);
    for (const label of labels) {
      const x = Number(label.getAttribute('x'));
      const y = Number(label.getAttribute('y'));
      expect(label.getAttribute('text-anchor')).toBe('middle');
      // Glyph box (~6 wide, ~7 tall above the baseline) stays inside the r=40 body, so it is
      // off the r=43-49 arc ring and the page
      for (const [px, py] of [
        [x - 3, y],
        [x + 3, y],
        [x - 3, y - 7],
        [x + 3, y - 7],
      ]) {
        expect(Math.hypot(px - 50, py - 50)).toBeLessThan(40);
      }
      // ...and below the indicator dot's lowest reach (cy 72.6 + r 4 at either end stop)
      expect(y - 7).toBeGreaterThan(76.7);
    }
  });

  it('should keep its text readable on the page in light and dark mode', () => {
    fixture.componentRef.setInput('label', 'Pan');
    fixture.detectChanges();
    const span = (t: string) =>
      [...hostEl.querySelectorAll('span')].find(s => s.textContent?.trim() === t)!;

    // slate-300 on a light page was ~1.5:1
    expect(span('Pan').className).toContain('text-slate-600');
    expect(span('Pan').className).not.toContain('text-slate-300');
    // slate-500 is below 4.5:1 on a dark page
    expect(span('PAN').className).toContain('dark:text-slate-400');
    // Off L/R chips sit on slate-700, where slate-400 is ~3.9:1
    expect(span('L').className).toContain('text-slate-300');
    expect(span('R').className).toContain('text-slate-300');

    // Active chips: white on cyan-500 was ~2.4:1
    component.writeValue(-50);
    fixture.detectChanges();
    expect(span('L').className).toContain('bg-cyan-400');
    expect(span('L').className).toContain('text-slate-900');
    expect(span('L').className).not.toContain('text-white');
    component.writeValue(50);
    fixture.detectChanges();
    expect(span('R').className).toContain('bg-cyan-400');
    expect(span('R').className).toContain('text-slate-900');
    expect(span('L').className).toContain('text-slate-300');
  });
});

@Component({
  imports: [TwPanControlComponent, ReactiveFormsModule],
  template: `<tw-pan-control [variant]="variant" [formControl]="control" />`,
})
class PanBlurHostComponent {
  variant: 'slider' | 'knob' = 'slider';
  readonly control = new FormControl(0, { updateOn: 'blur' });
}

describe('TwPanControlComponent with updateOn: blur', () => {
  let listeners: Record<string, (e: Event) => void>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PanBlurHostComponent] }).compileComponents();
    // jsdom's AbortSignal does not mix with zone.js-patched document listeners: capture them
    listeners = {};
    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      listener: (e: Event) => void
    ) => {
      listeners[type] = listener;
    }) as typeof document.addEventListener);
  });

  afterEach(() => vi.restoreAllMocks());

  it('should commit the dragged-to slider value and a double-click reset', () => {
    const fixture = TestBed.createComponent(PanBlurHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('tw-pan-control') as HTMLElement;
    const track = host.querySelector<HTMLElement>('.shadow-inner')!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 12 })
    );

    track.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 75 }));
    listeners['mousemove'](new MouseEvent('mousemove', { clientX: 100 }));
    listeners['mouseup'](new MouseEvent('mouseup'));
    expect(fixture.componentInstance.control.value).toBe(100);

    host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(fixture.componentInstance.control.value).toBe(0);
  });

  it('should commit the dragged-to knob value', () => {
    const fixture = TestBed.createComponent(PanBlurHostComponent);
    fixture.componentInstance.variant = 'knob';
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('tw-pan-control') as HTMLElement;
    const knob = host.querySelector<HTMLElement>('.cursor-pointer')!;

    knob.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 100 }));
    listeners['mousemove'](new MouseEvent('mousemove', { clientY: 75 }));
    listeners['mouseup'](new MouseEvent('mouseup'));
    expect(fixture.componentInstance.control.value).toBe(50);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

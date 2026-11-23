import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwOscilloscopeComponent } from './oscilloscope.component';

describe('TwOscilloscopeComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should keep a held single-trigger capture when a display input changes', async () => {
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) => (prop === 'canvas' ? undefined : vi.fn()),
        set: () => true,
      }
    ) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    // Rising edge through the 0.5 trigger level on the first read
    const getByteTimeDomainData = vi.fn((data: Uint8Array) => {
      data.fill(100);
      data.fill(200, 4);
    });
    const analyser = {
      fftSize: 32,
      context: { sampleRate: 44_100 },
      getByteTimeDomainData,
    } as unknown as AnalyserNode;

    await TestBed.configureTestingModule({
      imports: [TwOscilloscopeComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwOscilloscopeComponent);
    fixture.componentRef.setInput('analyserNode', analyser);
    fixture.componentRef.setInput('triggerMode', 'single');
    fixture.detectChanges();

    const internals = fixture.componentInstance as any;
    expect(internals.singleFrozen).toBe(true);
    expect(getByteTimeDomainData).toHaveBeenCalledTimes(1);
    const captured = [...(internals.dataArray as Uint8Array)];

    fixture.componentRef.setInput('showGrid', false);
    fixture.detectChanges();

    expect(getByteTimeDomainData).toHaveBeenCalledTimes(1);
    expect([...(internals.dataArray as Uint8Array)]).toEqual(captured);
    expect(internals.singleFrozen).toBe(true);

    fixture.destroy();
  });

  it('should arm a fresh single sweep when switching back to single mode', async () => {
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) => (prop === 'canvas' ? undefined : vi.fn()),
        set: () => true,
      }
    ) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    const getByteTimeDomainData = vi.fn((data: Uint8Array) => {
      data.fill(100);
      data.fill(200, 4);
    });
    const analyser = {
      fftSize: 32,
      context: { sampleRate: 44_100 },
      getByteTimeDomainData,
    } as unknown as AnalyserNode;

    await TestBed.configureTestingModule({
      imports: [TwOscilloscopeComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwOscilloscopeComponent);
    fixture.componentRef.setInput('analyserNode', analyser);
    fixture.componentRef.setInput('triggerMode', 'single');
    fixture.detectChanges();
    expect(getByteTimeDomainData).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('triggerMode', 'auto');
    fixture.detectChanges();
    expect(getByteTimeDomainData).toHaveBeenCalledTimes(2);

    // Back to single: a new sweep is captured, not the previous data re-frozen
    fixture.componentRef.setInput('triggerMode', 'single');
    fixture.detectChanges();
    expect(getByteTimeDomainData).toHaveBeenCalledTimes(3);
    expect((fixture.componentInstance as any).singleFrozen).toBe(true);

    fixture.destroy();
  });
  it('should draw canvas text (No Signal, labels) at readable contrast', async () => {
    const texts: Array<{ text: string; fillStyle: unknown }> = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get: (target, prop) => {
        if (prop === 'canvas') return undefined;
        if (prop === 'fillText') {
          return (text: string) => texts.push({ text, fillStyle: target['fillStyle'] });
        }
        return prop in target ? target[prop] : vi.fn();
      },
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    await TestBed.configureTestingModule({
      imports: [TwOscilloscopeComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwOscilloscopeComponent);
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('showLabels', true);
    fixture.detectChanges();

    const noSignal = texts.find(t => t.text === 'No Signal');
    expect(noSignal?.fillStyle).toBe('#2563EB');
    expect(texts.find(t => t.text === '+1')?.fillStyle).toBe('#2563EB');

    texts.length = 0;
    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(texts.find(t => t.text === 'No Signal')?.fillStyle).toBe('#22D3EE');

    // The amplitude scale follows the gain: at gain 2 the edges are ±0.5
    texts.length = 0;
    fixture.componentRef.setInput('gain', 2);
    fixture.detectChanges();
    (fixture.componentInstance as any).drawLabels();
    expect(texts.map(t => t.text)).toEqual(expect.arrayContaining(['+0.5', '-0.5']));
    expect(texts.some(t => t.text === '+1')).toBe(false);

    fixture.destroy();
  });
});

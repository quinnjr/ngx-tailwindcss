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
});

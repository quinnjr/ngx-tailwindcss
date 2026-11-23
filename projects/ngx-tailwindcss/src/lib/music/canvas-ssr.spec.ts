import { PLATFORM_ID, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwOscilloscopeComponent } from './oscilloscope.component';
import { TwParametricEQComponent } from './parametric-eq.component';
import { TwSpectrumComponent } from './spectrum.component';
import { TwVisualizerComponent } from './visualizer.component';
import { TwWaveformComponent } from './waveform.component';

// Server DOMs (domino) throw "not yet implemented" from canvas.getContext (and
// have no requestAnimationFrame), so canvas components must not render there.
describe('canvas components during SSR', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  const components: Array<[string, Type<unknown>]> = [
    ['tw-oscilloscope', TwOscilloscopeComponent],
    ['tw-parametric-eq', TwParametricEQComponent],
    ['tw-spectrum', TwSpectrumComponent],
    ['tw-visualizer', TwVisualizerComponent],
    ['tw-waveform', TwWaveformComponent],
  ];

  for (const [name, component] of components) {
    it(`${name} renders without touching the canvas`, async () => {
      await TestBed.configureTestingModule({
        imports: [component],
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      }).compileComponents();
      const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(() => {
          throw new Error('NotYetImplemented');
        });

      const fixture = TestBed.createComponent(component);
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
      fixture.destroy();

      expect(getContext).not.toHaveBeenCalled();
    });
  }
});

describe('static canvases redraw on device pixel ratio change', () => {
  // The test setup defines window.matchMedia as writable but not configurable
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    (window as { matchMedia: unknown }).matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('tw-oscilloscope redraws its no-signal frame at the new resolution', async () => {
    let fireChange: (() => void) | null = null;
    (window as { matchMedia: unknown }).matchMedia = () => ({
      addEventListener: (_: string, listener: () => void) => {
        fireChange = listener;
      },
      removeEventListener: () => {},
    });
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) => (prop === 'canvas' ? undefined : vi.fn()),
        set: () => true,
      }
    ) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

    await TestBed.configureTestingModule({
      imports: [TwOscilloscopeComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwOscilloscopeComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(400);

    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    fireChange!();
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);

    fixture.destroy();
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });
});

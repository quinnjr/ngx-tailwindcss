import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwVisualizerComponent } from './visualizer.component';

/**
 * Minimal 2D-context stand-in: jsdom has no canvas implementation, so drawing
 * calls resolve to no-ops while property writes are accepted silently.
 */
function createFakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => gradient;
        }
        return () => {};
      },
      set: () => true,
    }
  ) as unknown as CanvasRenderingContext2D;
}

function createFakeAnalyser(): AnalyserNode {
  return {
    frequencyBinCount: 128,
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData: () => {},
    getByteTimeDomainData: () => {},
  } as unknown as AnalyserNode;
}

describe('TwVisualizerComponent', () => {
  let fixture: ComponentFixture<TwVisualizerComponent>;
  let component: TwVisualizerComponent;

  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwVisualizerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwVisualizerComponent);
    component = fixture.componentInstance;
    internals = component;
    fixture.detectChanges();

    // Substitute a working 2D context (jsdom's getContext returns null)
    internals.ctx = createFakeContext();
  });

  describe('beat detection gating', () => {
    it('should not run beat detection without an analyser or demo mode', () => {
      const detectSpy = vi.spyOn(internals, 'detectBeat');

      internals.draw();

      expect(detectSpy).not.toHaveBeenCalled();
      expect(component.currentBpm()).toBe(0);
    });

    it('should not run beat detection on demo-mode mock data', () => {
      fixture.componentRef.setInput('demoMode', true);
      fixture.detectChanges();
      const detectSpy = vi.spyOn(internals, 'detectBeat');

      internals.draw();

      expect(detectSpy).not.toHaveBeenCalled();
      expect(component.currentBpm()).toBe(0);
    });

    it('should run beat detection when a real analyser is connected', () => {
      fixture.componentRef.setInput('analyserNode', createFakeAnalyser());
      fixture.detectChanges();
      const detectSpy = vi.spyOn(internals, 'detectBeat');

      internals.draw();

      expect(detectSpy).toHaveBeenCalled();
    });
  });

  describe('idle state', () => {
    it('should render a single idle frame without a data source', () => {
      const idleSpy = vi.spyOn(internals, 'drawIdleFrame');

      internals.draw();
      internals.draw();

      // The idle frame is only painted once until a data source appears
      expect(idleSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('beat effects', () => {
    it('should animate and expire beat particles under a non-particle variant', () => {
      fixture.componentRef.setInput('beatHighlightMode', 'particles');
      fixture.componentRef.setInput('variant', 'circular');
      fixture.componentRef.setInput('demoMode', true);
      fixture.detectChanges();

      internals.spawnBeatParticles(1);
      expect(internals.particles.length).toBeGreaterThan(0);

      for (let i = 0; i < 60; i++) internals.draw();

      expect(internals.particles.length).toBe(0);
    });

    it('should not draw an expanding ring before the first beat', () => {
      fixture.componentRef.setInput('beatHighlightMode', 'ring');
      fixture.detectChanges();
      const arcSpy = vi.fn();
      internals.ctx = new Proxy(
        {},
        {
          get: (_t, prop) => (prop === 'arc' ? arcSpy : () => ({ addColorStop: () => {} })),
          set: () => true,
        }
      );

      internals.drawBeatEffects();

      expect(arcSpy).not.toHaveBeenCalled();
    });
  });

  describe('wave variant', () => {
    function recordLineTo(): Array<[number, number]> {
      const points: Array<[number, number]> = [];
      internals.ctx = new Proxy(
        {},
        {
          get: (_t, prop) =>
            prop === 'lineTo' || prop === 'moveTo'
              ? (x: number, y: number) => points.push([x, y])
              : () => ({ addColorStop: () => {} }),
          set: () => true,
        }
      );
      return points;
    }

    it('should plot positive samples above the centre line', () => {
      fixture.componentRef.setInput('height', 200);
      fixture.componentRef.setInput('sensitivity', 1);
      fixture.detectChanges();
      const points = recordLineTo();
      internals.timeDomainData = new Uint8Array([255, 255, 0, 0]);

      internals.drawWave();

      // [initial moveTo to centre, then the 4 samples]
      expect(points[1][1]).toBeLessThan(100);
      expect(points[3][1]).toBeGreaterThan(100);
    });

    it('should generate centred mock waveform data in demo mode', () => {
      fixture.componentRef.setInput('demoMode', true);
      fixture.detectChanges();

      internals.draw();

      const data: Uint8Array = internals.timeDomainData;
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      expect(Math.abs(mean - 128)).toBeLessThan(10);
    });
  });
});

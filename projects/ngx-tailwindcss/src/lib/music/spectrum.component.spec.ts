import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwSpectrumComponent } from './spectrum.component';

describe('TwSpectrumComponent', () => {
  let fixture: ComponentFixture<TwSpectrumComponent>;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwSpectrumComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwSpectrumComponent);
    internals = fixture.componentInstance;
  });

  it('should keep the line variant within the configured frequency range', () => {
    const analyser = {
      frequencyBinCount: 1024,
      context: { sampleRate: 48_000 },
      getByteFrequencyData: () => {},
    } as unknown as AnalyserNode;
    fixture.componentRef.setInput('analyserNode', analyser);
    fixture.componentRef.setInput('variant', 'line');
    fixture.componentRef.setInput('barCount', 8);
    fixture.componentRef.setInput('maxFrequency', 1000);
    fixture.componentRef.setInput('height', 100);
    fixture.detectChanges();

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

    // Energy only at ~10 kHz, far above maxFrequency (bin width = 23.4 Hz)
    const data = new Uint8Array(1024);
    data[427] = 255;

    internals.drawLine(data);

    // One point per bar, all silent (the closing fill adds two more points)
    const linePoints = points.slice(0, 8);
    expect(linePoints.length).toBe(8);
    for (const [, y] of linePoints) {
      expect(y).toBe(100);
    }
    expect(linePoints.at(-1)![0]).toBeCloseTo(300, 6);
  });
});

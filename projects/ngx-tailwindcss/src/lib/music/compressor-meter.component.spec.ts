import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwCompressorMeterComponent } from './compressor-meter.component';

describe('TwCompressorMeterComponent', () => {
  let fixture: ComponentFixture<TwCompressorMeterComponent>;
  let component: TwCompressorMeterComponent;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwCompressorMeterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwCompressorMeterComponent);
    component = fixture.componentInstance;
    internals = component;
    fixture.detectChanges();
  });

  it('should emit clipInput once per clip event rather than on every tick', () => {
    let clips = 0;
    component.clipInput.subscribe(() => clips++);
    fixture.componentRef.setInput('inputLevel', 0);

    internals.updateLevels();
    internals.updateLevels();
    internals.updateLevels();
    expect(clips).toBe(1);

    internals.resetClip('input');
    internals.updateLevels();
    expect(clips).toBe(2);
  });

  it('should decay the release envelope from its level at release start', () => {
    fixture.componentRef.setInput('release', 100);
    fixture.componentRef.setInput('gainReduction', -10);
    internals.updateLevels();
    internals.envelopePosition.set(1);

    fixture.componentRef.setInput('gainReduction', 0);
    internals.updateLevels(); // release starts at position 1

    const start = internals.releaseStartTime();
    // Several ticks at the same elapsed time must not compound the decay
    internals.updateEnvelopePosition(start + 50, false);
    internals.updateEnvelopePosition(start + 50, false);

    expect(internals.envelopePosition()).toBeCloseTo(Math.exp(-1.5), 5);
  });

  describe('peak hold', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should track sub-0 dB peaks and fall back once the hold expires', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('peakHoldTime', 1000);
      fixture.componentRef.setInput('inputLevel', -12);
      internals.updateLevels();
      expect(internals.inputPeakLevel()).toBe(-12);

      // Lower level: the peak is held
      fixture.componentRef.setInput('inputLevel', -30);
      internals.updateLevels();
      expect(internals.inputPeakLevel()).toBe(-12);

      // Hold expires: the marker drops to the current level...
      vi.advanceTimersByTime(1000);
      expect(internals.inputPeakLevel()).toBe(-30);

      // ...and keeps following the level down afterwards
      fixture.componentRef.setInput('inputLevel', -40);
      vi.advanceTimersByTime(1000);
      internals.updateLevels();
      expect(internals.inputPeakLevel()).toBe(-40);
    });
  });
});

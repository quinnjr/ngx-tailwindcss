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

  it('should size the meter gradients to the full meter height, not the fill', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(internals.levelMeterBackground()).toContain('bottom / 100% 180px no-repeat');
    expect(internals.grMeterBackground()).toContain('top / 100% 180px no-repeat');
  });

  it('should be silent with no clip indication when no levels are bound', () => {
    let clips = 0;
    component.clipInput.subscribe(() => clips++);
    component.clipOutput.subscribe(() => clips++);

    internals.updateLevels();
    fixture.detectChanges();

    expect(clips).toBe(0);
    expect(internals.inputClip()).toBe(false);
    expect(internals.outputClip()).toBe(false);
    expect(internals.inputMeterPercent()).toBe(0);
    expect(internals.formatInputLevel()).toBe('-∞');
  });

  it('should not treat NaN levels as a clip', () => {
    let clips = 0;
    component.clipInput.subscribe(() => clips++);
    fixture.componentRef.setInput('inputLevel', 'not-a-number');
    internals.updateLevels();
    expect(clips).toBe(0);
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

  it('should keep programmatic levels until the bound input changes', () => {
    fixture.componentRef.setInput('inputLevel', -20);
    fixture.componentRef.setInput('outputLevel', -22);
    fixture.componentRef.setInput('gainReduction', -2);
    internals.updateLevels();
    expect(internals.internalInputLevel()).toBe(-20);

    component.setInputLevel(-6);
    component.setOutputLevel(-8);
    component.setGainReduction(-9);
    expect(internals.internalInputLevel()).toBe(-6);

    // The next tick must not snap back to the (unchanged) inputs
    internals.updateLevels();
    expect(internals.internalInputLevel()).toBe(-6);
    expect(internals.internalOutputLevel()).toBe(-8);
    expect(internals.internalGainReduction()).toBe(-9);

    // A new input value takes over again
    fixture.componentRef.setInput('inputLevel', -30);
    internals.updateLevels();
    expect(internals.internalInputLevel()).toBe(-30);
    expect(internals.internalOutputLevel()).toBe(-8);
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

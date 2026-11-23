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

  it('should render labels and readouts at a readable contrast for the variant', () => {
    fixture.componentRef.setInput('showSettings', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const label = (text: string): HTMLElement =>
      [...el.querySelectorAll<HTMLElement>('span')].find(s => s.textContent?.trim() === text)!;

    // Dark panel: slate-500/600 (~2.4-3:1) replaced by slate-400 / slate-300
    expect(el.querySelectorAll('.text-slate-500, .text-slate-600')).toHaveLength(0);
    expect(label('Thresh').classList).toContain('text-slate-400');
    expect(label('Thresh').classList).toContain('uppercase');
    expect(label('IN').classList).toContain('text-slate-400');

    // Light panel: dark text instead of light grey on white
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(label('Thresh').classList).toContain('text-slate-600');
    expect(label('Thresh').nextElementSibling!.classList).toContain('text-slate-800');
    expect(el.querySelectorAll('.text-slate-300')).toHaveLength(0);
  });

  it('should use readable gain-reduction and graph A/R text colours on the light variant', () => {
    fixture.componentRef.setInput('showSettings', true);
    fixture.componentRef.setInput('attackReleaseDisplay', 'graph');
    fixture.componentRef.setInput('variant', 'light');
    internals.setGainReduction(-12);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const grValue = [...el.querySelectorAll<HTMLElement>('span')].find(s =>
      s.textContent?.includes(' dB')
    )!;
    expect(grValue.classList).toContain('text-orange-700');
    expect(grValue.classList).toContain('font-mono');
    // amber/green/orange/red 400 shades are ~1.7-2.8:1 on the white panel
    expect(
      el.querySelectorAll('.text-amber-400, .text-green-400, .text-orange-400, .text-red-400')
    ).toHaveLength(0);
    expect(el.querySelector('.text-green-700')).not.toBeNull();
    expect(el.querySelector('.text-amber-700')).not.toBeNull();

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(grValue.classList).toContain('text-orange-400');
  });

  it('should render the vintage attack/release labels at readable contrast', () => {
    fixture.componentRef.setInput('variant', 'vintage');
    fixture.componentRef.setInput('attackReleaseDisplay', 'none');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const labels = [...el.querySelectorAll<HTMLElement>('span.text-\\[9px\\]')].filter(s =>
      ['Attack', 'Release'].includes(s.textContent?.trim() ?? '')
    );
    expect(labels).toHaveLength(2);
    // amber-600 at 80% on the slate-900 panel was ~4:1
    for (const label of labels) {
      expect(label.classList).toContain('text-amber-500');
      expect(label.classList).not.toContain('text-amber-600/80');
    }
  });

  it('should use page-readable, dark-mode-aware text on the transparent minimal variant', () => {
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();

    expect(internals.labelClass()).toBe('text-slate-600 dark:text-slate-400');
    expect(internals.valueClass()).toBe('text-slate-800 dark:text-slate-300');
    expect(internals.grValueClass()).toBe('text-amber-700 dark:text-amber-400');
    expect(internals.attackTextClass()).toBe('text-green-700 dark:text-green-400');
    expect(internals.releaseTextClass()).toBe('text-amber-700 dark:text-amber-400');

    const label = [...(fixture.nativeElement as HTMLElement).querySelectorAll('span')].find(
      s => s.textContent?.trim() === 'Compressor'
    )!;
    expect(label.classList).toContain('text-slate-600');
    expect(label.classList).toContain('dark:text-slate-400');
  });

  it('should keep the per-variant text tones on the light and dark panels', () => {
    expect(internals.labelClass()).toBe('text-slate-400');
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(internals.labelClass()).toBe('text-slate-600');
    expect(internals.grValueClass()).toBe('text-amber-700');
  });
});

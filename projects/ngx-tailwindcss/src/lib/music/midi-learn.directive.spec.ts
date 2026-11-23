import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { TwMidiLearnDirective } from './midi-learn.directive';
import { MidiService } from './midi.service';

@Component({
  template: `<button twMidiLearn="volume">Volume</button>`,
  standalone: true,
  imports: [TwMidiLearnDirective],
})
class TestHostComponent {}

@Component({
  template: `<button
    twMidiLearn="cutoff"
    [midiCC]="cc()"
    [midiMinValue]="min()"
    [midiMaxValue]="max()"
    [midiCurve]="curve()"
    [midiInverted]="inverted()"
  >
    Cutoff
  </button>`,
  standalone: true,
  imports: [TwMidiLearnDirective],
})
class ConfiguredHostComponent {
  readonly cc = signal<number | null>(74);
  readonly min = signal(0);
  readonly max = signal(127);
  readonly curve = signal<'linear' | 'logarithmic' | 'exponential'>('linear');
  readonly inverted = signal(false);
}

describe('TwMidiLearnDirective', () => {
  it('should not report a pending (unlearned) mapping as mapped', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const debugEl = fixture.debugElement.query(By.directive(TwMidiLearnDirective));
    const directive = debugEl.injector.get(TwMidiLearnDirective);
    const midi = TestBed.inject(MidiService);

    directive.startLearn();
    directive.cancelLearn();
    fixture.detectChanges();

    expect(directive.isMapped()).toBe(false);
    expect(debugEl.nativeElement.classList.contains('tw-midi-mapped')).toBe(false);

    midi.updateCCMapping('volume', { ccNumber: 7 });
    fixture.detectChanges();

    expect(directive.isMapped()).toBe(true);
    expect(debugEl.nativeElement.classList.contains('tw-midi-mapped')).toBe(true);
  });

  it('should emit midiLearnCancel when learn mode ends without completing (timeout)', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
      const directive = fixture.debugElement
        .query(By.directive(TwMidiLearnDirective))
        .injector.get(TwMidiLearnDirective);
      const cancel = vi.fn();
      const complete = vi.fn();
      directive.midiLearnCancel.subscribe(cancel);
      directive.midiLearnComplete.subscribe(complete);

      directive.startLearn();
      fixture.detectChanges();
      expect(directive.isLearning()).toBe(true);

      // Service-side timeout (default 10 s)
      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(directive.isLearning()).toBe(false);
      expect(cancel).toHaveBeenCalledOnce();
      expect(complete).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should emit midiLearnCancel once (not twice) for an explicit cancelLearn()', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const directive = fixture.debugElement
      .query(By.directive(TwMidiLearnDirective))
      .injector.get(TwMidiLearnDirective);
    const cancel = vi.fn();
    directive.midiLearnCancel.subscribe(cancel);

    directive.startLearn();
    fixture.detectChanges();
    directive.cancelLearn();
    fixture.detectChanges();

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('should not emit midiLearnCancel when learn completes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const directive = fixture.debugElement
      .query(By.directive(TwMidiLearnDirective))
      .injector.get(TwMidiLearnDirective);
    const midi = TestBed.inject(MidiService);
    const cancel = vi.fn();
    directive.midiLearnCancel.subscribe(cancel);

    directive.startLearn();
    fixture.detectChanges();
    midi.completeMidiLearn(7, 0);
    fixture.detectChanges();

    expect(cancel).not.toHaveBeenCalled();
    expect(directive.isMapped()).toBe(true);
  });

  it('should apply later changes of the mapping inputs to its existing mapping', () => {
    const fixture = TestBed.createComponent(ConfiguredHostComponent);
    fixture.detectChanges();
    const midi = TestBed.inject(MidiService);
    expect(midi.getCCMapping('cutoff')).toMatchObject({ ccNumber: 74, minValue: 0, maxValue: 127 });

    const host = fixture.componentInstance;
    host.min.set(20);
    host.max.set(20_000);
    host.curve.set('logarithmic');
    host.inverted.set(true);
    host.cc.set(71);
    fixture.detectChanges();

    expect(midi.getCCMapping('cutoff')).toMatchObject({
      ccNumber: 71,
      minValue: 20,
      maxValue: 20_000,
      curve: 'logarithmic',
      inverted: true,
    });
  });

  it('should not clobber service-side mapping changes when the inputs did not change', () => {
    const fixture = TestBed.createComponent(ConfiguredHostComponent);
    fixture.detectChanges();
    const midi = TestBed.inject(MidiService);

    midi.updateCCMapping('cutoff', { ccNumber: 10, maxValue: 64, channel: 3 });
    fixture.componentInstance.min.set(5);
    fixture.detectChanges();

    expect(midi.getCCMapping('cutoff')).toMatchObject({
      ccNumber: 10,
      channel: 3,
      minValue: 5,
      maxValue: 64,
    });
  });

  it('should map a CC configured after init', () => {
    const fixture = TestBed.createComponent(ConfiguredHostComponent);
    fixture.componentInstance.cc.set(null);
    fixture.detectChanges();
    const midi = TestBed.inject(MidiService);
    expect(midi.getCCMapping('cutoff')).toBeUndefined();

    fixture.componentInstance.cc.set(1);
    fixture.detectChanges();

    expect(midi.getCCMapping('cutoff')).toMatchObject({ ccNumber: 1, minValue: 0, maxValue: 127 });
  });
});

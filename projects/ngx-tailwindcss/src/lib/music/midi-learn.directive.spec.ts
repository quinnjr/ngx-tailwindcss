import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { TwMidiLearnDirective } from './midi-learn.directive';
import { MidiService } from './midi.service';

@Component({
  template: `<button twMidiLearn="volume">Volume</button>`,
  standalone: true,
  imports: [TwMidiLearnDirective],
})
class TestHostComponent {}

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
});

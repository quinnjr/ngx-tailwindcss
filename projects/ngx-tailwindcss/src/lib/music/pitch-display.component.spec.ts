import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwPitchDisplayComponent } from './pitch-display.component';

describe('TwPitchDisplayComponent', () => {
  let fixture: ComponentFixture<TwPitchDisplayComponent>;
  let component: TwPitchDisplayComponent;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwPitchDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwPitchDisplayComponent);
    component = fixture.componentInstance;
    internals = component;
    fixture.detectChanges();
  });

  it('should keep local edits instead of reverting them to the input', () => {
    vi.useFakeTimers();
    try {
      internals.onSemitonesUp();
      vi.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(internals.internalSemitones()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should resync internal state when the input changes', () => {
    internals.onSemitonesUp();
    fixture.componentRef.setInput('semitones', 5);
    fixture.detectChanges();

    expect(internals.internalSemitones()).toBe(5);
  });

  it('should report DJ pitch percentage as the playback-rate change', () => {
    fixture.componentRef.setInput('semitones', 12);
    fixture.detectChanges();
    expect(internals.pitchPercentage()).toBeCloseTo(100, 5);

    fixture.componentRef.setInput('semitones', -12);
    fixture.detectChanges();
    expect(internals.pitchPercentage()).toBeCloseTo(-50, 5);

    fixture.componentRef.setInput('semitones', 1);
    fixture.detectChanges();
    expect(internals.pitchPercentage()).toBeCloseTo(5.946, 2);
  });

  it('should adjust pitch bend from the keyboard', () => {
    const emitted: number[] = [];
    component.pitchBendChange.subscribe(v => emitted.push(v));

    internals.onPitchWheelKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    internals.onPitchWheelKeydown(new KeyboardEvent('keydown', { key: 'End' }));

    expect(emitted).toEqual([0.05, 1]);
  });

  it('should follow horizontal movement for the horizontal bend style', () => {
    fixture.componentRef.setInput('pitchBendStyle', 'horizontal');
    fixture.detectChanges();

    internals.onPitchWheelDragStart(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 100 }));

    expect(internals.internalPitchBend()).toBeCloseTo(0.5, 5);
    document.dispatchEvent(new MouseEvent('mouseup'));
  });
});

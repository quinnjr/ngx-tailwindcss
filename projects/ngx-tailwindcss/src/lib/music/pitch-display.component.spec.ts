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

  it('should stop touch drags on the pitch bend slider from scrolling the page', () => {
    fixture.componentRef.setInput('showPitchWheel', true);
    for (const style of ['vertical', 'horizontal'] as const) {
      fixture.componentRef.setInput('pitchBendStyle', style);
      fixture.detectChanges();
      const slider = fixture.nativeElement.querySelector('[role="slider"]') as HTMLElement;
      expect(slider.classList).toContain('touch-none');
    }
  });

  it('should draw the arc-style bend fill along the track from its top', () => {
    const endPoint = (): number[] =>
      (internals.pitchBendArcPath() as string).split(' ').slice(-2).map(Number);

    component.setPitchBend(1);
    expect(internals.pitchBendArcPath()).toMatch(/^M 50 5 A 40 40 0 0 1 /);
    // Full bend ends at the track's right end (90, 45)
    expect(endPoint()[0]).toBeCloseTo(90, 6);
    expect(endPoint()[1]).toBeCloseTo(45, 6);

    component.setPitchBend(-0.5);
    expect(internals.pitchBendArcPath()).toMatch(/^M 50 5 A 40 40 0 0 0 /);
    const [x, y] = endPoint();
    // On the track circle (centre 50,45; radius 40), left of centre
    expect(Math.hypot(x - 50, y - 45)).toBeCloseTo(40, 6);
    expect(x).toBeLessThan(50);
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

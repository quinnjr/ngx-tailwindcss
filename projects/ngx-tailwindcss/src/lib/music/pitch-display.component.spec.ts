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

  it('should apply the size and weight classes to the semitone value', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    const value = fixture.nativeElement.querySelector(
      '[title="Double-click to reset"]'
    ) as HTMLElement;
    expect(value.classList).toContain('text-4xl');
    expect(value.classList).toContain('font-bold');
    expect(value.classList).toContain('text-white');

    internals.internalSemitones.set(2);
    fixture.detectChanges();
    expect(value.classList).toContain('text-4xl');
    expect(value.classList).toContain('text-amber-400');
    expect(value.classList).not.toContain('text-white');
  });

  it('should render secondary labels at a readable contrast for the variant', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.text-slate-500, .text-slate-600')).toHaveLength(0);
    const label = [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === 'Cents')!;
    expect(label.classList).toContain('text-slate-400');

    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(label.classList).toContain('text-slate-600');
  });

  it('should keep sharp/flat readouts readable on the light variant', () => {
    fixture.componentRef.setInput('variant', 'light');
    fixture.componentRef.setInput('showNotePreview', true);
    component.setSemitones(3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // amber-400/blue-400/slate-400 are ~1.7-2.6:1 on the white panel
    expect(el.querySelectorAll('.text-amber-400, .text-blue-400, .text-slate-400')).toHaveLength(0);
    expect(el.querySelector('.text-amber-700')).not.toBeNull();

    component.setSemitones(-3);
    fixture.detectChanges();
    expect(el.querySelector('.text-blue-700')).not.toBeNull();
    expect(el.querySelectorAll('.text-blue-400')).toHaveLength(0);
  });

  it('should give the active quick preset white text on a replaced fill', () => {
    fixture.componentRef.setInput('showPresets', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const preset = (text: string): HTMLElement =>
      [...el.querySelectorAll<HTMLElement>('button')].find(b => b.textContent?.trim() === text)!;

    // '0' is active by default
    expect(preset('0').classList).toContain('bg-green-700');
    expect(preset('0').classList).toContain('text-white');
    expect(preset('0').classList).not.toContain('bg-slate-700');
    expect(preset('0').classList).not.toContain('text-slate-300');
    expect(preset('+5th').classList).toContain('text-slate-300');

    component.applyPreset({ semitones: 7, cents: 0 });
    fixture.detectChanges();
    expect(preset('+5th').classList).toContain('bg-amber-700');
    expect(preset('+5th').classList).toContain('text-white');
    expect(preset('+5th').classList).toContain('px-2');
  });

  it('should render the inactive key-lock label above 4.5:1 on its slate-700 fill', () => {
    const el = fixture.nativeElement as HTMLElement;
    const key = [...el.querySelectorAll<HTMLElement>('button')].find(b =>
      b.textContent?.includes('KEY')
    )!;
    expect(key.classList).toContain('bg-slate-700');
    expect(key.classList).toContain('text-slate-300');
  });
});

describe('TwPitchDisplayComponent drag listener cleanup', () => {
  it('should remove drag listeners through the injected DOCUMENT (SSR has no global document)', async () => {
    const removeEventListener = vi.fn();
    const globalRemove = vi.spyOn(globalThis.document, 'removeEventListener');
    await TestBed.configureTestingModule({
      imports: [TwPitchDisplayComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwPitchDisplayComponent);
    // Swap in a server-like document stub before destroy
    (fixture.componentInstance as any).document = { removeEventListener };

    fixture.destroy();

    expect(removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(globalRemove).not.toHaveBeenCalledWith('mousemove', expect.any(Function));
    globalRemove.mockRestore();
  });
});

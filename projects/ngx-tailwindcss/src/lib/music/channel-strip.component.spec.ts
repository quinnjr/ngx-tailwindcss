import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwChannelStripComponent } from './channel-strip.component';

describe('TwChannelStripComponent', () => {
  let fixture: ComponentFixture<TwChannelStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwChannelStripComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TwChannelStripComponent);
    fixture.detectChanges();
  });

  it('should disable its controls via setDisabledState (forms API)', () => {
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.disabled)).toBe(true);
  });

  it('should give each dial its own accessible name', () => {
    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="slider"]'),
    ].map(el => el.getAttribute('aria-label'));
    expect(labels).toEqual(['Volume', 'Pan']);
  });

  it('should report every configured aux send and mark the control touched', () => {
    const strip = fixture.componentInstance;
    let touched = false;
    let state: { auxSends: unknown[] } | undefined;
    strip.registerOnTouched(() => (touched = true));
    strip.registerOnChange(s => (state = s));
    // e.g. the mixer writes a state with no aux sends
    strip.writeValue({
      volume: 50,
      pan: 0,
      mute: false,
      solo: false,
      record: false,
      inputGain: 0,
      auxSends: [],
    });

    (strip as unknown as { toggleMute(): void }).toggleMute();

    expect(state?.auxSends).toHaveLength(2);
    expect(touched).toBe(true);
  });
  it('should place stereo peak markers from the meter top, not below the L/R labels', () => {
    fixture.componentRef.setInput('stereo', true);
    fixture.componentRef.setInput('meterPeak', 50);
    fixture.componentRef.setInput('meterPeakRight', 100);
    fixture.detectChanges();

    const left = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[title="Peak (L)"]'
    )!;
    const right = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[title="Peak (R)"]'
    )!;
    // md meter: 80px tall below a 1px border + 8px padding
    expect(left.style.top).toBe('48px');
    expect(right.style.top).toBe('8px');
    expect(left.style.bottom).toBe('');
  });
});

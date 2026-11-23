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
});

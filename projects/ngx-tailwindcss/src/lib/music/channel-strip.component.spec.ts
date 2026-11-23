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
  it('should keep strip text readable on the dark surface and on the page (minimal)', () => {
    fixture.componentRef.setInput('label', 'Kick');
    fixture.componentRef.setInput('showInputGain', true);
    fixture.componentRef.setInput('showRecord', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (t: string) =>
      [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === t)!;

    // slate-500/600 are below 4.5:1 on the slate-800 strip
    for (const t of ['GAIN', 'PAN', '1']) {
      expect(text(t).className).toContain('text-slate-400');
      expect(text(t).className).not.toMatch(/text-slate-[56]00/);
    }
    // Off-state M/S/R buttons sit on slate-700, where slate-400 is ~3.9:1
    for (const b of el.querySelectorAll('button')) {
      expect(b.className).toContain('text-slate-300');
    }

    // Minimal is transparent: white text would vanish on a light page
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(text('Kick').className).toContain('text-slate-900');
    expect(text('Kick').className).toContain('dark:text-white');
    expect(text('GAIN').className).toContain('text-slate-600');
  });

  it('should scope dark mode to the always-dark strips so nested dials and meters stay readable', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = () => el.firstElementChild as HTMLElement;
    // The volume readout (text-slate-700 dark:text-slate-300) and the meter's L/R
    // labels follow the page scheme: on a light page they were dark text on the strip
    expect(el.querySelector('tw-volume-dial')).not.toBeNull();
    for (const variant of ['default', 'compact', 'vintage']) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      expect(container().classList).toContain('dark');
    }

    // Minimal is transparent and must keep following the page
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(container().classList).not.toContain('dark');
  });
});

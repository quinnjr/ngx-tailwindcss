import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwTunerComponent } from './tuner.component';

describe('TwTunerComponent', () => {
  let fixture: ComponentFixture<TwTunerComponent>;
  let component: TwTunerComponent;

  const frequencyToNote = (frequency: number): { note: string; octave: number; cents: number } =>
    (component as any).frequencyToNote(frequency);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwTunerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwTunerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('frequencyToNote', () => {
    it.each([
      { frequency: 440, note: 'A', octave: 4, cents: 0 },
      { frequency: 261.63, note: 'C', octave: 4, cents: 0 },
      { frequency: 329.63, note: 'E', octave: 4, cents: 0 },
      { frequency: 466.16, note: 'A#', octave: 4, cents: 0 },
      { frequency: 82.41, note: 'E', octave: 2, cents: 0 },
      { frequency: 880, note: 'A', octave: 5, cents: 0 },
      { frequency: 220, note: 'A', octave: 3, cents: 0 },
    ])('should map $frequency Hz to $note$octave', ({ frequency, note, octave, cents }) => {
      const result = frequencyToNote(frequency);

      expect(result.note).toBe(note);
      expect(result.octave).toBe(octave);
      expect(Math.abs(result.cents - cents)).toBeLessThanOrEqual(1);
    });

    it('should report positive cents for a sharp pitch', () => {
      const result = frequencyToNote(445); // slightly sharp A4

      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.cents).toBeGreaterThan(0);
      expect(result.cents).toBeLessThan(50);
    });

    it('should report negative cents for a flat pitch', () => {
      const result = frequencyToNote(435); // slightly flat A4

      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.cents).toBeLessThan(0);
      expect(result.cents).toBeGreaterThan(-50);
    });

    it('should honor the referenceFrequency input', () => {
      fixture.componentRef.setInput('referenceFrequency', 442);
      fixture.detectChanges();

      const result = frequencyToNote(442);

      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.cents).toBe(0);
    });
  });
  describe('autoCorrelate', () => {
    const sine = (freq: number, sampleRate: number, size = 4096): Float32Array => {
      const buffer = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        buffer[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
      }
      return buffer;
    };

    it.each([41.2, 55, 82.41, 440])('should detect a %f Hz tone (incl. bass E1/A1)', freq => {
      const detected = (component as any).autoCorrelate(sine(freq, 48_000), 48_000);

      expect(Math.abs(1200 * Math.log2(detected / freq))).toBeLessThan(50);
    });

    // Whole-sample lags alone are ~16 cents apart at A4 (48 kHz), so e.g. an
    // A at 441.5 Hz (+5.9 cents) used to read as in tune (+1.5 cents)
    it.each([
      [441.5, 48_000],
      [445, 48_000],
      [329.63, 44_100],
      [659.25, 44_100],
      [659.25, 48_000],
      [392, 48_000],
    ])('should measure %f Hz at %i Hz to within 2 cents', (freq, sampleRate) => {
      const detected = (component as any).autoCorrelate(sine(freq, sampleRate), sampleRate);

      expect(Math.abs(1200 * Math.log2(detected / freq))).toBeLessThan(2);
    });

    it('should not report a +5.9 cent A4 as in tune', () => {
      const detected = (component as any).autoCorrelate(sine(441.5, 48_000), 48_000);

      expect(frequencyToNote(detected).cents).toBeGreaterThan(component.tolerance());
    });
  });

  describe('string selector', () => {
    it('should reset the selected string when the mode changes', () => {
      fixture.componentRef.setInput('mode', 'guitar');
      fixture.detectChanges();
      const buttons = () => [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll('button[aria-pressed]'),
      ];
      (buttons()[5] as HTMLButtonElement).click();
      fixture.detectChanges();

      fixture.componentRef.setInput('mode', 'bass');
      fixture.detectChanges();

      expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Target: 41.2 Hz');
    });
  });

  describe('microphone lifecycle', () => {
    const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

    afterEach(() => {
      if (originalMediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
      } else {
        delete (navigator as any).mediaDevices;
      }
    });

    it('should stop the stream if destroyed while getUserMedia is pending', async () => {
      const stop = vi.fn();
      let resolveStream!: (s: MediaStream) => void;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () =>
            new Promise<MediaStream>(resolve => {
              resolveStream = resolve;
            }),
        },
      });

      const pending = component.startListening();
      fixture.destroy();
      resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await pending;

      expect(stop).toHaveBeenCalled();
    });
  });

  it('should not render low-contrast slate-500/600 text on the dark panel', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.text-slate-500, .text-slate-600')
    ).toHaveLength(0);
  });

  it('should keep minimal-variant text readable on a light page background', () => {
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // slate-400 alone is ~2.6:1 on white; minimal pairs a darker shade with dark:
    const hint = el.querySelector('p') as HTMLElement;
    expect(hint.classList).toContain('text-slate-600');
    expect(hint.classList).toContain('dark:text-slate-400');
    expect(hint.classList).toContain('max-w-xs');

    (component as any).currentCents.set(20);
    expect((component as any).centsDisplayClasses()).toContain('text-red-700');
    (component as any).currentCents.set(-20);
    expect((component as any).centsDisplayClasses()).toContain('text-blue-700');

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(hint.classList).toContain('text-slate-400');
    expect(hint.classList).not.toContain('text-slate-600');
  });

  it('should render the start button label above 4.5:1 (white on green-700)', () => {
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(b =>
      b.textContent?.includes('Start Tuner')
    )!;
    expect(button.classList).toContain('bg-green-700');
    expect(button.classList).not.toContain('bg-green-600');
    expect(button.classList).toContain('text-white');
  });
});

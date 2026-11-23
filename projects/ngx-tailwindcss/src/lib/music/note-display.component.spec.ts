import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetectedNote, TwNoteDisplayComponent } from './note-display.component';

describe('TwNoteDisplayComponent', () => {
  let fixture: ComponentFixture<TwNoteDisplayComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [TwNoteDisplayComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwNoteDisplayComponent);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits noteChange only when the input changes (no polling)', () => {
    const changes: DetectedNote[] = [];
    fixture.componentInstance.noteChange.subscribe(n => changes.push(n));

    fixture.componentRef.setInput('frequency', 440);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ note: 'A', octave: 4, cents: 0 });

    fixture.componentRef.setInput('frequency', 261.63);
    fixture.detectChanges();
    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({ note: 'C', octave: 4 });
  });

  it('shows the detected note without waiting for a timer', () => {
    fixture.componentRef.setInput('frequency', 466.16);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A♯');
  });

  it('derives manual note frequencies from the referenceA4 tuning', () => {
    const changes: DetectedNote[] = [];
    fixture.componentInstance.noteChange.subscribe(n => changes.push(n));
    fixture.componentRef.setInput('referenceA4', 442);
    fixture.componentRef.setInput('noteName', 'A');
    fixture.componentRef.setInput('octave', 4);
    fixture.detectChanges();
    expect(changes.at(-1)?.frequency).toBeCloseTo(442);

    fixture.componentInstance.setNote('A', 5);
    expect(changes.at(-1)?.frequency).toBeCloseTo(884);
  });

  it('accepts flat note names for manual notes', () => {
    const changes: DetectedNote[] = [];
    fixture.componentInstance.noteChange.subscribe(n => changes.push(n));
    fixture.componentRef.setInput('noteName', 'Bb');
    fixture.componentRef.setInput('octave', 4);
    fixture.detectChanges();
    expect(changes.at(-1)?.frequency).toBeCloseTo(466.16, 1);
  });
  it('lights the LED bar consistently with the in-tune tolerance', () => {
    const segments = (): HTMLElement[] => [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('div.h-2.rounded-sm'),
    ];
    const lit = (): number[] =>
      segments()
        .map((el, idx) => (el.classList.contains('bg-slate-700') ? null : idx - 5))
        .filter((v): v is number => v !== null);
    const show = (cents: number): void => {
      fixture.componentRef.setInput('note', {
        note: 'A',
        octave: 4,
        frequency: 440,
        cents,
        timestamp: 0,
      });
      fixture.detectChanges();
    };

    // Exactly at the tolerance (10 cents): in tune, so only the green centre segment
    show(10);
    expect(segments()).toHaveLength(11);
    expect(lit()).toEqual([0]);
    show(-10);
    expect(lit()).toEqual([0]);
    // Just beyond it: out of tune, the centre goes dark and the first side segment lights
    show(11);
    expect(lit()).toEqual([1]);
    show(-23);
    expect(lit()).toEqual([-2, -1]);
  });

  it('uses readable (>= 4.5:1) text colours for secondary and status text', () => {
    const host = fixture.nativeElement as HTMLElement;
    const byText = (text: string): HTMLElement =>
      [...host.querySelectorAll<HTMLElement>('div, span')]
        .reverse()
        .find(el => el.textContent?.trim() === text)!;

    // Dark variants: no slate-500 / blue-500 on slate-800 or black
    fixture.detectChanges();
    expect(byText('Waiting for input...').classList).toContain('text-slate-400');
    fixture.componentRef.setInput('showFrequency', true);
    fixture.componentRef.setInput('frequency', 430);
    fixture.detectChanges();
    expect(byText('FLAT').classList).toContain('text-blue-400');
    expect(host.innerHTML).not.toMatch(/text-slate-500|text-blue-500/);

    // Minimal sits on the page: dark status colours in light mode, light ones in dark mode
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(byText('FLAT').classList).toContain('text-blue-700');
    expect(byText('FLAT').classList).toContain('dark:text-blue-400');
  });

  it('keeps the small octave numeral >= 4.5:1 on the led and lcd surfaces', () => {
    fixture.componentRef.setInput('size', 'sm');
    fixture.componentRef.setInput('noteName', 'A');
    fixture.componentRef.setInput('octave', 4);
    const host = fixture.nativeElement as HTMLElement;
    const octave = () =>
      [...host.querySelectorAll<HTMLElement>('span')].find(el => el.textContent?.trim() === '4')!;
    for (const [variant, cls] of [
      ['led', 'text-red-400/80'],
      ['lcd', 'text-lime-500/80'],
    ]) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      // /70 was ~4.0:1 (led) and ~4.4:1 (lcd) at the non-large sm size
      expect(octave().classList).toContain(cls);
    }
  });

  it('keeps older history entries visible and readable instead of fading them out', () => {
    fixture.componentRef.setInput('showHistory', true);
    fixture.componentRef.setInput('historyLength', 12);
    fixture.detectChanges();
    const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    for (let i = 0; i < 12; i++) {
      fixture.componentInstance.setNote(notes[i % 7], 3 + Math.floor(i / 7));
    }
    fixture.detectChanges();
    const chips = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.font-mono.rounded'),
    ].filter(el => el.style.opacity !== '');
    expect(chips).toHaveLength(12);
    // `1 - i * 0.1` was below 4.5:1 from the 4th entry and 0 (hidden) at the 11th
    for (const chip of chips) {
      expect(Number(chip.style.opacity)).toBeGreaterThanOrEqual(0.85);
    }
  });
});

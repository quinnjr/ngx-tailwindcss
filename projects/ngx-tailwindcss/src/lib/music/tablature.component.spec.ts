import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwTablatureComponent } from './tablature.component';
import { NoteName } from './note.component';

interface TabInternals {
  getNoteYOnStaff: (note: NoteName, octave: number) => number;
  getStaffLineY: (line: number) => number;
  getLedgerLinesForNote: (y: number) => number[];
  calculateNoteFromFret: (
    stringNum: number,
    fret: number
  ) => { note: NoteName; octave: number; accidental: 'sharp' | null } | null;
}

describe('TwTablatureComponent', () => {
  let fixture: ComponentFixture<TwTablatureComponent>;
  let tab: TabInternals;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwTablatureComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwTablatureComponent);
    tab = fixture.componentInstance as unknown as TabInternals;
  });

  it('places treble clef B4 on the middle line', () => {
    fixture.detectChanges();
    expect(tab.getNoteYOnStaff('B', 4)).toBe(tab.getStaffLineY(3));
  });

  it('places bass clef D3 on the middle line and G2 on the bottom line', () => {
    fixture.componentRef.setInput('clef', 'bass');
    fixture.detectChanges();
    expect(tab.getNoteYOnStaff('D', 3)).toBe(tab.getStaffLineY(3));
    expect(tab.getNoteYOnStaff('G', 2)).toBe(tab.getStaffLineY(5));
  });

  it('uses 5-string bass tuning when stringCount is 5', () => {
    fixture.componentRef.setInput('stringCount', 5);
    fixture.detectChanges();
    expect(tab.calculateNoteFromFret(5, 0)).toEqual({ note: 'B', octave: 0, accidental: null });
    expect(tab.calculateNoteFromFret(1, 0)).toEqual({ note: 'G', octave: 2, accidental: null });
  });

  it('draws ledger lines only up to the note, not one beyond it', () => {
    fixture.detectChanges();
    const ledger = (name: NoteName, octave: number): number =>
      tab.getLedgerLinesForNote(tab.getNoteYOnStaff(name, octave)).length;
    expect(ledger('C', 4)).toBe(1);
    expect(ledger('B', 3)).toBe(1);
    expect(ledger('A', 3)).toBe(2);
    expect(ledger('D', 4)).toBe(0);
    expect(ledger('A', 5)).toBe(1);
    expect(ledger('B', 5)).toBe(1);
    expect(ledger('C', 6)).toBe(2);
    expect(ledger('G', 5)).toBe(0);
  });

  it('cancels a sharp earlier in the measure with a natural on the staff', () => {
    // High E string: fret 2 = F#4, fret 1 = F4, fret 2 again = F#4; next measure F4 again
    fixture.componentRef.setInput('measures', [
      { notes: [[{ string: 1, fret: 2 }], [{ string: 1, fret: 1 }], [{ string: 1, fret: 2 }]] },
      { notes: [[{ string: 1, fret: 1 }]] },
    ]);
    fixture.detectChanges();
    const calculated = (
      fixture.componentInstance as unknown as {
        calculatedNotes: () => Array<Array<Array<{ accidental: string | null } | null>>>;
      }
    ).calculatedNotes();
    expect(calculated[0].map(beat => beat[0]?.accidental)).toEqual(['sharp', 'natural', 'sharp']);
    expect(calculated[1][0][0]?.accidental).toBeNull();
  });

  it('renders every note position of a measure, even beyond beatsPerMeasure', () => {
    const eighths = Array.from({ length: 8 }, (_, i) => [{ string: 1, fret: i }]);
    fixture.componentRef.setInput('measures', [{ notes: eighths }]);
    fixture.componentRef.setInput('beatsPerMeasure', 4);
    fixture.detectChanges();
    const frets = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('text[font-family="monospace"]'),
      t => t.textContent?.trim()
    ).filter(t => /^\d+$/.test(t ?? ''));
    expect(frets).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });

  it('keeps the TAB label, measure numbers and empty state readable (no 50-60% fades)', () => {
    const faded = () =>
      (fixture.nativeElement as HTMLElement).querySelectorAll('text.opacity-50, text.opacity-60');
    // opacity-50 slate-800 on white was ~3.1:1 for the 10px measure numbers
    fixture.componentRef.setInput('showMeasureNumbers', true);
    fixture.componentRef.setInput('measures', [{ notes: [[{ string: 1, fret: 3 }]] }]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const text = (t: string) =>
      [...host.querySelectorAll('text')].find(el => el.textContent?.trim() === t)!;
    expect(text('TAB').classList).toContain('opacity-80');
    expect(text('1').classList).toContain('opacity-80');
    expect(faded()).toHaveLength(0);

    fixture.componentRef.setInput('measures', []);
    fixture.detectChanges();
    expect(text('No tablature data').classList).toContain('opacity-80');
    expect(faded()).toHaveLength(0);
  });

  it('colours fret numbers and technique marks >= 4.5:1 for the dark and minimal variants', () => {
    fixture.componentRef.setInput('measures', [
      { notes: [[{ string: 1, fret: 3, technique: 'hammer' }]] },
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const text = (t: string) =>
      [...host.querySelectorAll('text')].find(el => el.textContent?.trim() === t)!;

    // blue-500 fret numbers were ~4.0:1 on slate-800
    fixture.componentRef.setInput('variant', 'dark');
    fixture.detectChanges();
    expect(text('3').getAttribute('fill')).toBe('#60A5FA');

    // indigo-500 technique marks were just under 4.5:1 on white
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(text('h').getAttribute('fill')).toBe('#4F46E5');
  });
});

describe('TwTablatureComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwTablatureComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwTablatureComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).not.toContain('bg-white');
  });
});

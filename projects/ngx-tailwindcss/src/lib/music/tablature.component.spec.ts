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
});

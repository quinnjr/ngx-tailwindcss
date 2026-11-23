import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwTablatureComponent } from './tablature.component';
import { NoteName } from './note.component';

interface TabInternals {
  getNoteYOnStaff: (note: NoteName, octave: number) => number;
  getStaffLineY: (line: number) => number;
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
});

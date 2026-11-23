import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NoteName, TwNoteComponent } from './note.component';
import { ClefType } from './staff.component';

describe('TwNoteComponent', () => {
  let fixture: ComponentFixture<TwNoteComponent>;

  // staffTop 40, lineSpacing 10 => top line y=40, bottom line y=80
  const render = (name: NoteName, octave: number, clef: ClefType = 'treble') => {
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('octave', octave);
    fixture.componentRef.setInput('clef', clef);
    fixture.componentRef.setInput('staffTop', 40);
    fixture.componentRef.setInput('lineSpacing', 10);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      yPosition: () => number;
      needsLedgerLines: () => number[];
    };
    return { y: cmp.yPosition(), ledger: cmp.needsLedgerLines() };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwNoteComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwNoteComponent);
  });

  it('places treble E4 on the bottom line and F5 on the top line', () => {
    expect(render('E', 4).y).toBe(80);
    expect(render('F', 5).y).toBe(40);
  });

  it('draws a ledger line for middle C (C4)', () => {
    expect(render('C', 4).ledger).toEqual([90]);
  });

  it('draws a ledger line for A5', () => {
    expect(render('A', 5).ledger).toEqual([30]);
  });

  it('draws no ledger lines for notes in the spaces just outside the staff', () => {
    expect(render('D', 4).ledger).toEqual([]);
    expect(render('G', 5).ledger).toEqual([]);
  });

  it('draws two ledger lines for A3 and C6', () => {
    expect(render('A', 3).ledger).toEqual([90, 100]);
    expect(render('C', 6).ledger).toEqual([30, 20]);
  });

  it('positions notes according to the clef', () => {
    // Bass clef: G2 bottom line, A3 top line
    expect(render('G', 2, 'bass').y).toBe(80);
    expect(render('A', 3, 'bass').y).toBe(40);
    // Alto clef: middle line is C4
    expect(render('C', 4, 'alto').y).toBe(60);
  });
});

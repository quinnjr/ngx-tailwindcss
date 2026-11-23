import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAccidentalContext,
  NoteName,
  spellMidiPitch,
  TwNoteComponent,
} from './note.component';
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

  it('draws two dots (not three) for a note that is both dotted and double-dotted', () => {
    fixture.componentRef.setInput('dotted', true);
    fixture.componentRef.setInput('doubleDotted', true);
    fixture.detectChanges();
    const dots = (fixture.nativeElement as HTMLElement).querySelectorAll('circle');
    expect(dots).toHaveLength(2);
  });

  it('can be hosted on an SVG group inside another SVG', () => {
    @Component({
      template: '<svg><g twNote name="C" [octave]="5"></g></svg>',
      imports: [TwNoteComponent],
    })
    class SvgHostComponent {}

    const host = TestBed.createComponent(SvgHostComponent);
    host.detectChanges();
    const g = (host.nativeElement as HTMLElement).querySelector('g');
    expect(g?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(g?.querySelector('ellipse')).not.toBeNull();
  });

  it('positions notes according to the clef', () => {
    // Bass clef: G2 bottom line, A3 top line
    expect(render('G', 2, 'bass').y).toBe(80);
    expect(render('A', 3, 'bass').y).toBe(40);
    // Alto clef: middle line is C4
    expect(render('C', 4, 'alto').y).toBe(60);
  });
});

describe('accidental helpers', () => {
  it('resolves unmarked notes from the key signature and earlier accidentals in the bar', () => {
    const context = createAccidentalContext('Bb');
    expect(context.resolve({ name: 'B', octave: 4 })).toBe(-1);
    expect(context.resolve({ name: 'B', octave: 4, accidental: 'natural' })).toBe(0);
    expect(context.resolve({ name: 'B', octave: 4 })).toBe(0);
    // Other octaves are not affected
    expect(context.resolve({ name: 'B', octave: 3 })).toBe(-1);
    context.nextMeasure();
    expect(context.resolve({ name: 'B', octave: 4 })).toBe(-1);
  });

  it('spells MIDI pitches with the key signature letters', () => {
    expect(spellMidiPitch(66, 'G')).toEqual({ name: 'F', octave: 4, alteration: 1 });
    expect(spellMidiPitch(70, 'F')).toEqual({ name: 'B', octave: 4, alteration: -1 });
    // Cb5 sounds as B4 in Gb major
    expect(spellMidiPitch(71, 'Gb')).toEqual({ name: 'C', octave: 5, alteration: -1 });
    expect(spellMidiPitch(61, 'C')).toEqual({ name: 'C', octave: 4, alteration: 1 });
    expect(spellMidiPitch(61, 'Eb')).toEqual({ name: 'D', octave: 4, alteration: -1 });
  });
});

describe('TwNoteComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwNoteComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwNoteComponent);
    fixture.componentRef.setInput('classOverride', 'absolute');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('absolute');
    expect(classes).not.toContain('relative');
  });
});

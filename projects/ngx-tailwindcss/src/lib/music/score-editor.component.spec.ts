import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { InstrumentPart, ScoreData, TwScoreEditorComponent } from './score-editor.component';
import { PlacedNote } from './note-input.component';

const placed = (id: string, overrides: Partial<PlacedNote> = {}): PlacedNote => ({
  id,
  name: 'C',
  octave: 4,
  duration: 'quarter',
  x: 150,
  measure: 0,
  beat: 0,
  voice: 1,
  ...overrides,
});

const part = (notes: PlacedNote[]): InstrumentPart => ({
  id: 'violin-1',
  name: 'Violin',
  abbreviation: 'Vln.',
  clef: 'treble',
  transposition: 0,
  muted: false,
  solo: false,
  volume: 1,
  color: '#000',
  notes,
  lyrics: [],
});

const score = (
  notes: PlacedNote[],
  timeSignature: ScoreData['timeSignature'] = '4/4'
): ScoreData => ({
  title: 'Loaded',
  composer: 'Tester',
  tempo: 100,
  keySignature: 'G',
  timeSignature,
  measures: 2,
  parts: [part(notes)],
});

@Component({
  template: '<tw-score-editor [initialScore]="initial()"></tw-score-editor>',
  standalone: true,
  imports: [TwScoreEditorComponent],
})
class HostComponent {
  initial = signal<ScoreData | null>(null);
}

interface EditorInternals {
  parts: () => InstrumentPart[];
  title: () => string;
  canUndo: () => boolean;
  undo: () => void;
  exportToABC: () => string;
  exportToMusicXML: () => string;
  exportToMidi: () => Uint8Array;
  onKeyDown: (event: KeyboardEvent) => void;
  updatePart: (id: string, updates: Partial<InstrumentPart>) => void;
  currentDuration: { set: (v: string) => void };
}

describe('TwScoreEditorComponent', () => {
  let fixture: ComponentFixture<TwScoreEditorComponent>;
  let editor: EditorInternals;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwScoreEditorComponent, HostComponent],
    }).compileComponents();
  });

  const createWith = (initial: ScoreData | null) => {
    fixture = TestBed.createComponent(TwScoreEditorComponent);
    fixture.componentRef.setInput('initialScore', initial);
    fixture.detectChanges();
    editor = fixture.componentInstance as unknown as EditorInternals;
  };

  it('loads the initialScore input', () => {
    createWith(score([placed('n1')]));
    expect(editor.title()).toBe('Loaded');
    expect(editor.parts().map(p => p.id)).toEqual(['violin-1']);
  });

  it('does not offer an undo that would remove the default part', () => {
    createWith(null);
    expect(editor.parts()).toHaveLength(1);
    expect(editor.canUndo()).toBe(false);
    editor.undo();
    expect(editor.parts()).toHaveLength(1);
  });

  it('exports dotted notes and full-measure rests correctly to ABC', () => {
    createWith(score([placed('n1', { dotted: true })], '3/4'));
    const abc = editor.exportToABC();
    // Dotted quarter = 3 eighths; empty 3/4 measure = 6 eighths
    expect(abc).toContain('C3|z6|');
  });

  it('exports integer MusicXML durations', () => {
    createWith(score([placed('n1', { duration: 'thirtysecond' })]));
    const xml = editor.exportToMusicXML();
    const durations = [...xml.matchAll(/<duration>([^<]+)<\/duration>/g)].map(m => m[1]);
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) {
      expect(Number.isInteger(Number(d))).toBe(true);
    }
  });

  it('keeps chord notes simultaneous in MIDI export', () => {
    createWith(score([placed('n1', { name: 'C' }), placed('n2', { name: 'E' })]));
    const midi = editor.exportToMidi();
    const bytes = [...midi];
    // Find the two note-on events (status 0x90) and check the delta before the second is 0
    const noteOnIndices = bytes.flatMap((b, i) => (b === 0x90 ? [i] : []));
    expect(noteOnIndices).toHaveLength(2);
    expect(bytes[noteOnIndices[1] - 1]).toBe(0);
  });

  it('ignores shortcuts that a child note input already handled', () => {
    createWith(score([placed('n1')]));
    editor.updatePart('violin-1', { name: 'Viola' });
    expect(editor.canUndo()).toBe(true);
    const before = editor.parts();

    const handled = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    handled.preventDefault();
    editor.onKeyDown(handled);
    expect(editor.parts()).toBe(before);

    editor.onKeyDown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true }));
    expect(editor.parts()[0].name).toBe('Violin');
  });

  it('pushes the toolbar duration to the note inputs', () => {
    createWith(null);
    editor.currentDuration.set('half');
    fixture.detectChanges();
    const noteInput = fixture.debugElement.query(el => el.name === 'tw-note-input');
    expect(
      (noteInput.componentInstance as { currentDuration: () => string }).currentDuration()
    ).toBe('half');
  });

  it('works when the initial score is bound from a parent template', () => {
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.componentInstance.initial.set(score([placed('n1')]));
    hostFixture.detectChanges();
    const child = hostFixture.debugElement.query(el => el.name === 'tw-score-editor')
      .componentInstance as EditorInternals;
    expect(child.title()).toBe('Loaded');
  });
});

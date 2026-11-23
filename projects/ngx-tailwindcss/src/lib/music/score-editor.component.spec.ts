import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  InstrumentPart,
  ScoreData,
  TransposeOptions,
  TwScoreEditorComponent,
} from './score-editor.component';
import { PlacedNote, TwNoteInputComponent } from './note-input.component';

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
  scoreData: () => ScoreData;
  transpose: (options: TransposeOptions) => void;
  importABC: (abc: string) => void;
  applyLyrics: (text: string) => void;
  addPart: (preset?: string) => void;
  removePart: (id: string) => void;
  addLyric: (partId: string, text: string, measure: number, beat: number) => void;
  editingLyrics: () => boolean;
  buildImagePdf: (
    jpeg: Uint8Array,
    pixelWidth: number,
    pixelHeight: number,
    pageWidth: number,
    pageHeight: number
  ) => Uint8Array;
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

  it('leaves Ctrl+Z in a text field to the field instead of undoing the score', () => {
    createWith(score([placed('n1')]));
    editor.updatePart('violin-1', { name: 'Viola' });
    const titleInput = fixture.nativeElement.querySelector('input.score-title') as HTMLElement;
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    titleInput.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(editor.parts()[0].name).toBe('Viola');
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

  it('uses the measure count of a loaded score', () => {
    createWith({ ...score([placed('n1')]), measures: 6 });
    expect(editor.scoreData().measures).toBe(6);
    expect(editor.exportToMusicXML().match(/<measure /g)).toHaveLength(6);
    fixture.detectChanges();
    const noteInput = fixture.debugElement.query(By.directive(TwNoteInputComponent));
    expect((noteInput.componentInstance as TwNoteInputComponent).measures()).toBe(6);
  });

  it('uses the measure count and rhythmic positions of an imported score', () => {
    createWith(null);
    editor.importABC(['X:1', 'L:1/8', 'K:C', 'C2 D2 E4|F8|G8|'].join('\n'));
    expect(editor.scoreData().measures).toBe(3);
    const notes = editor.parts()[0].notes;
    // quarter, quarter, half on an 8-per-measure grid
    expect(notes.slice(0, 3).map(n => n.beat)).toEqual([0, 2, 4]);
    expect(notes[1].x).toBeGreaterThan(notes[0].x);
    expect(notes.map(n => n.measure)).toEqual([0, 0, 0, 1, 2]);
  });

  it('restores the key, time signature and length when undoing an import', () => {
    createWith(score([placed('n1')], '3/4'));
    editor.importABC(['X:1', 'M:4/4', 'L:1/8', 'K:D', 'C8|D8|E8|'].join('\n'));
    expect(editor.scoreData().keySignature).toBe('D');
    expect(editor.scoreData().measures).toBe(3);

    editor.undo();
    const restored = editor.scoreData();
    expect(restored.keySignature).toBe('G');
    expect(restored.timeSignature).toBe('3/4');
    expect(restored.measures).toBe(2);
    expect(restored.title).toBe('Loaded');
    expect(restored.parts.map(p => p.id)).toEqual(['violin-1']);
  });

  it('keeps the opening key on import and re-spells notes after a key change', () => {
    createWith(null);
    // G major, then D major: the second c sounds C#
    editor.importABC(['X:1', 'L:1/8', 'K:G', 'c8|', 'K:D', 'c8|'].join('\n'));
    expect(editor.scoreData().keySignature).toBe('G');
    expect(editor.parts()[0].notes.map(n => n.accidental ?? null)).toEqual([null, 'sharp']);
  });

  it('keeps flat spellings when transposing with preserveEnharmonic', () => {
    const notes = [
      placed('n1', { name: 'E', accidental: 'flat' }),
      placed('n2', { name: 'B', accidental: 'flat' }),
    ];
    createWith(score(notes));
    editor.transpose({ semitones: 3, preserveEnharmonic: true });
    expect(editor.parts()[0].notes.map(n => [n.name, n.accidental, n.octave])).toEqual([
      ['G', 'flat', 4],
      ['D', 'flat', 5],
    ]);

    // The score is in G major: F# needs no written sharp there
    createWith(score(notes));
    editor.transpose({ semitones: 3 });
    expect(editor.parts()[0].notes.map(n => [n.name, n.accidental, n.octave])).toEqual([
      ['F', null, 4],
      ['C', 'sharp', 5],
    ]);
  });

  // Sounding MIDI pitches of the exported note-on events, in order
  const midiNoteOns = (): number[] => {
    const bytes = [...editor.exportToMidi()];
    return bytes.flatMap((b, i) => (b === 0x90 ? [bytes[i + 1]] : []));
  };

  it('resolves unmarked notes with the key signature and earlier accidentals in MIDI export', () => {
    // G major: F = F#; a natural lasts until the bar line
    createWith(
      score([
        placed('n1', { name: 'F', beat: 0 }),
        placed('n2', { name: 'F', beat: 2, accidental: 'natural' }),
        placed('n3', { name: 'F', beat: 4 }),
        placed('n4', { name: 'F', measure: 1, beat: 0 }),
      ])
    );
    expect(midiNoteOns()).toEqual([66, 65, 65, 66]);
  });

  it('writes sounding <alter> values but only written <accidental> signs to MusicXML', () => {
    createWith(
      score([
        placed('n1', { name: 'F', beat: 0, duration: 'sixteenth' }),
        placed('n2', { name: 'F', beat: 4, accidental: 'natural' }),
      ])
    );
    const xml = editor.exportToMusicXML();
    const notes = [...xml.matchAll(/<note>([\s\S]*?)<\/note>/g)].map(m => m[1]);
    expect(notes[0]).toContain('<alter>1</alter>');
    expect(notes[0]).not.toContain('<accidental>');
    expect(notes[0]).toContain('<type>16th</type>');
    expect(notes[1]).not.toContain('<alter>');
    expect(notes[1]).toContain('<accidental>natural</accidental>');
    // The gap between the 16th at beat 0 and the note at half-measure is a <forward>
    expect(xml).toContain('<forward><duration>28</duration></forward>');
  });

  it('exports notes sharing a beat as a MusicXML chord', () => {
    createWith(score([placed('n1', { name: 'C' }), placed('n2', { name: 'E' })]));
    const xml = editor.exportToMusicXML();
    expect(xml.match(/<chord\/>/g)).toHaveLength(1);
  });

  it('transposes using accidentals carried through the measure', () => {
    // C major: F# then an unmarked F in the same bar (also F#) -> G, G
    createWith({
      ...score([
        placed('n1', { name: 'F', accidental: 'sharp', beat: 0 }),
        placed('n2', { name: 'F', beat: 2 }),
      ]),
      keySignature: 'C',
    });
    editor.transpose({ semitones: 1 });
    expect(editor.parts()[0].notes.map(n => [n.name, n.accidental])).toEqual([
      ['G', null],
      ['G', null],
    ]);
  });

  it('adds a natural when transposition cancels an accidental earlier in the bar', () => {
    // C major: F#4 then F4 natural, an octave up: the second F needs its natural sign
    createWith({
      ...score([
        placed('n1', { name: 'F', accidental: 'sharp', beat: 0 }),
        placed('n2', { name: 'F', accidental: 'natural', beat: 2 }),
      ]),
      keySignature: 'C',
    });
    editor.transpose({ semitones: 12 });
    expect(editor.parts()[0].notes.map(n => [n.name, n.accidental, n.octave])).toEqual([
      ['F', 'sharp', 5],
      ['F', 'natural', 5],
    ]);
  });

  it('exports rests as rests', () => {
    createWith(score([placed('n1', { isRest: true }), placed('n2', { name: 'D', beat: 2 })]));
    expect(midiNoteOns()).toEqual([62]);
    expect(editor.exportToABC()).toContain('z2D2');
    expect(editor.exportToMusicXML()).toContain('<rest/>');
  });

  it('keeps rests when importing ABC so later notes stay in place', () => {
    createWith(null);
    editor.importABC(['X:1', 'L:1/8', 'K:C', 'z2 C2 D4|z8|E8|'].join('\n'));
    expect(editor.scoreData().measures).toBe(3);
    const sounding = editor.parts()[0].notes.filter(n => !n.isRest);
    expect(sounding.map(n => [n.name, n.measure, n.beat])).toEqual([
      ['C', 0, 2],
      ['D', 0, 4],
      ['E', 2, 0],
    ]);
  });

  it('opens the lyrics editor from the toolbar and applies syllables to notes', () => {
    createWith(
      score([
        placed('n1', { beat: 0 }),
        placed('n2', { beat: 2 }),
        placed('n3', { beat: 4 }),
        placed('n4', { measure: 1, beat: 0, voice: 2 }),
      ])
    );
    const button = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.toolbar-btn'),
    ].find(b => b.textContent?.includes('Lyrics'));
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
    expect(editor.editingLyrics()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.lyrics-editor-panel')
    ).not.toBeNull();

    editor.applyLyrics('Hel-lo world extra');
    const lyrics = editor.parts()[0].lyrics;
    expect(lyrics.map(l => [l.text, l.syllableType, l.measure, l.beat])).toEqual([
      ['Hel', 'begin', 0, 0],
      ['lo', 'end', 0, 2],
      ['world', 'single', 0, 4],
    ]);
  });

  it('builds a structurally valid PDF around the rendered image', () => {
    createWith(null);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = editor.buildImagePdf(jpeg, 200, 100, 75, 37.5);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Filter /DCTDecode /Length 4');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

    // Every xref entry points at the start of its object, and startxref at the xref table
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map(m =>
      Number(m[1])
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) => {
      expect(text.slice(offset, offset + 7)).toBe(`${i + 1} 0 obj`);
    });
  });
  it('does not reuse part or lyric ids of a loaded score', () => {
    const loaded = score([placed('n1')]);
    loaded.parts = [
      {
        ...loaded.parts[0],
        id: 'part-0',
        lyrics: [
          { id: 'lyric-0', text: 'la', measure: 0, beat: 0, syllableType: 'single', verse: 1 },
        ],
      },
    ];
    createWith(loaded);

    editor.addPart('flute');
    const ids = editor.parts().map(p => p.id);
    expect(new Set(ids).size).toBe(2);

    editor.addLyric('part-0', 'di', 0, 2);
    const lyricIds = editor.parts()[0].lyrics.map(l => l.id);
    expect(new Set(lyricIds).size).toBe(2);

    // Removing the new part keeps the loaded one
    editor.removePart(ids[1]);
    expect(editor.parts().map(p => p.id)).toEqual(['part-0']);
  });

  it('gives icon-only toolbar and part buttons a name and exposes toggle state', () => {
    createWith(score([placed('n1')]));
    const root = fixture.nativeElement as HTMLElement;
    const byLabel = (label: string) =>
      root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    // Their content ('.', '𝄽', 'M', 'S', '↩', ...) was the accessible name
    for (const label of ['Undo', 'Redo', 'Sharp', 'Dotted', 'Rest', 'Voice 1', 'Quarter']) {
      expect(byLabel(label), label).not.toBeNull();
    }
    expect(byLabel('Mute Violin')).not.toBeNull();
    expect(byLabel('Solo Violin')).not.toBeNull();
    expect(byLabel('Remove Violin')).not.toBeNull();

    expect(byLabel('Quarter')!.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Dotted')!.getAttribute('aria-pressed')).toBe('false');
    byLabel('Dotted')!.click();
    fixture.detectChanges();
    expect(byLabel('Dotted')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('exposes dialogs as named modal dialogs that take focus and close on Escape', async () => {
    createWith(score([placed('n1')]));
    document.body.append(fixture.nativeElement);
    const root = fixture.nativeElement as HTMLElement;
    const exportButton = root.querySelector<HTMLButtonElement>('.toolbar-btn[title="Export"]')!;
    exportButton.focus();
    exportButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-label')).toBe('Export score');
    // It rendered after every staff while focus stayed on the toolbar
    expect(dialog!.contains(document.activeElement)).toBe(true);

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(exportButton);
    root.remove();
  });

  it('selects a part when its staff receives keyboard focus', () => {
    createWith(score([placed('n1')]));
    editor.addPart('flute');
    fixture.detectChanges();
    const ids = editor.parts().map(p => p.id);
    const internals = editor as unknown as { selectedPartId: () => string | null };
    expect(internals.selectedPartId()).toBe(ids[1]);

    // Only mouse clicks selected a part, so keyboard users could never edit another part
    const staves = fixture.debugElement.queryAll(By.directive(TwNoteInputComponent));
    (staves[0].nativeElement as HTMLElement).dispatchEvent(
      new FocusEvent('focusin', { bubbles: true })
    );
    expect(internals.selectedPartId()).toBe(ids[0]);
  });

  it('disables the score-changing controls when not editable', () => {
    fixture = TestBed.createComponent(TwScoreEditorComponent);
    fixture.componentRef.setInput('initialScore', score([placed('n1')]));
    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const toolbarButton = (title: string) =>
      root.querySelector<HTMLButtonElement>(`.toolbar-btn[title^="${title}"]`)!;

    expect(toolbarButton('Undo').disabled).toBe(true);
    expect(toolbarButton('Redo').disabled).toBe(true);
    expect(toolbarButton('Transpose').disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.add-part-btn')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.part-btn.delete')!.disabled).toBe(true);
    expect(root.querySelector<HTMLSelectElement>('.part-presets select')!.disabled).toBe(true);
  });

  it('fills the active voice buttons with colours that keep white text >= 4.5:1', () => {
    createWith(score([placed('n1')]));
    const root = fixture.nativeElement as HTMLElement;
    const fill = (voice: number) =>
      root
        .querySelector<HTMLElement>(`.voice-btn[title="Voice ${voice}"]`)!
        .style.getPropertyValue('--voice-color')
        .toLowerCase();
    // White on emerald-600 (#059669) was ~3.8:1
    expect(fill(3)).toBe('#047857');
    expect([1, 2, 3, 4].map(fill)).not.toContain('#059669');
  });

  it('uses part colours that keep the staff labels >= 4.5:1 on light and selected rows', () => {
    createWith(score([placed('n1')]));
    for (let i = 0; i < 7; i++) {
      (fixture.componentInstance as unknown as { addPart(p?: string): void }).addPart();
    }
    fixture.detectChanges();
    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.staff-label'),
    ];
    expect(labels.length).toBeGreaterThanOrEqual(8);
    const toHex = (rgb: string) =>
      `#${(rgb.match(/\d+/g) ?? []).map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
    const colours = labels.map(l =>
      l.style.color.startsWith('rgb') ? toHex(l.style.color) : l.style.color.toLowerCase()
    );
    // The 600 shades (emerald, orange, cyan, ...) were ~3.6-4.4:1
    for (const weak of ['#059669', '#ea580c', '#0891b2', '#2563eb', '#dc2626']) {
      expect(colours).not.toContain(weak);
    }
  });
});

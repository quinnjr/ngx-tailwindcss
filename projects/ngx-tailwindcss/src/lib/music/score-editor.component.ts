import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ClefType, getStaffLayout, KeySignature, StaffTimeSignature } from './staff.component';
import {
  AccidentalContext,
  createAccidentalContext,
  NoteAccidental,
  NoteData,
  NoteDuration,
  NoteName,
  spellMidiPitch,
} from './note.component';
import { PlacedNote, TwNoteInputComponent } from './note-input.component';
import {
  getMeasureKeySignatures,
  MeasureData,
  parseABCNotation,
  parseMusicXML,
  respellNotesForKey,
  SheetMusicData,
} from './sheet-music.component';

// ==================== TYPES ====================

export type ScoreEditorVariant = 'default' | 'print' | 'minimal';
export type ExportFormat = 'musicxml' | 'midi' | 'pdf' | 'abc';

export interface InstrumentPart {
  id: string;
  name: string;
  abbreviation: string;
  clef: ClefType;
  transposition: number; // Semitones (0 = concert pitch)
  muted: boolean;
  solo: boolean;
  volume: number; // 0-1
  color: string;
  notes: PlacedNote[];
  lyrics: LyricEntry[];
}

export interface LyricEntry {
  id: string;
  text: string;
  measure: number;
  beat: number;
  syllableType: 'single' | 'begin' | 'middle' | 'end';
  verse: number;
}

export interface ScoreData {
  title: string;
  composer: string;
  arranger?: string;
  copyright?: string;
  tempo: number;
  keySignature: KeySignature;
  timeSignature: StaffTimeSignature;
  measures: number;
  parts: InstrumentPart[];
}

export interface HistoryEntry {
  parts: InstrumentPart[];
  timestamp: number;
  action: string;
  /** Score-level settings, recorded only by actions that replace them (import / load) */
  score?: Omit<ScoreData, 'parts'>;
}

export interface TransposeOptions {
  semitones: number;
  partIds?: string[]; // If not specified, transpose all parts
  /**
   * Keep each note's accidental spelling family: notes sounding flat (written with a flat or
   * flatted by the key signature) are respelled with flats, sharp ones with sharps
   * (Bb +1 -> B, Eb +3 -> Gb). When false (default), results are spelled with the key
   * signature's letters where possible, otherwise with sharps (flats in flat keys):
   * Eb +3 -> F# in C major.
   * Written accidentals of the result follow standard notation (see `NoteData.accidental`):
   * accidentals implied by the key signature or earlier in the measure are omitted.
   */
  preserveEnharmonic?: boolean;
}

// Common instrument presets
export const INSTRUMENT_PRESETS: Record<string, Partial<InstrumentPart>> = {
  'piano-treble': { name: 'Piano', abbreviation: 'Pno.', clef: 'treble', transposition: 0 },
  'piano-bass': { name: 'Piano', abbreviation: 'Pno.', clef: 'bass', transposition: 0 },
  violin: { name: 'Violin', abbreviation: 'Vln.', clef: 'treble', transposition: 0 },
  viola: { name: 'Viola', abbreviation: 'Vla.', clef: 'alto', transposition: 0 },
  cello: { name: 'Cello', abbreviation: 'Vc.', clef: 'bass', transposition: 0 },
  flute: { name: 'Flute', abbreviation: 'Fl.', clef: 'treble', transposition: 0 },
  'clarinet-bb': { name: 'Clarinet in Bb', abbreviation: 'Cl.', clef: 'treble', transposition: 2 },
  'trumpet-bb': { name: 'Trumpet in Bb', abbreviation: 'Tpt.', clef: 'treble', transposition: 2 },
  'horn-f': { name: 'Horn in F', abbreviation: 'Hn.', clef: 'treble', transposition: 7 },
  'voice-soprano': { name: 'Soprano', abbreviation: 'S.', clef: 'treble', transposition: 0 },
  'voice-alto': { name: 'Alto', abbreviation: 'A.', clef: 'treble', transposition: 0 },
  'voice-tenor': { name: 'Tenor', abbreviation: 'T.', clef: 'treble', transposition: 0 },
  'voice-bass': { name: 'Bass', abbreviation: 'B.', clef: 'bass', transposition: 0 },
  guitar: { name: 'Guitar', abbreviation: 'Gtr.', clef: 'treble', transposition: 12 },
  'bass-guitar': { name: 'Bass Guitar', abbreviation: 'Bass', clef: 'bass', transposition: 12 },
};

// tw-note-input's default grid: a note's `beat` is in eighths of a measure
const NOTE_INPUT_GRID_DIVISION = 8;

// Width the editor reserves next to each tw-note-input (part label + padding)
const STAFF_ROW_RESERVED_WIDTH = 120;

// MusicXML divisions per quarter note: 16 keeps dotted 32nd notes integral (3)
const MUSICXML_DIVISIONS = 16;

const NOTE_TO_CHROMATIC: Record<NoteName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

@Component({
  selector: 'tw-score-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TwNoteInputComponent],
  templateUrl: './score-editor.component.html',
  styleUrl: './score-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class TwScoreEditorComponent implements OnInit {
  private readonly elementRef = inject(ElementRef);

  // ==================== INPUTS ====================

  readonly variant = input<ScoreEditorVariant>('default');
  readonly width = input(900, { transform: numberAttribute });
  readonly staffHeight = input(100, { transform: numberAttribute });
  readonly measures = input(4, { transform: numberAttribute });
  readonly lineSpacing = input(10, { transform: numberAttribute });
  readonly editable = input(true);

  // Initial score data
  readonly initialScore = input<ScoreData | null>(null);

  // Features toggles
  readonly showToolbar = input(true);
  readonly showPartPanel = input(true);
  readonly showLyricsEditor = input(true);
  readonly enableMidiInput = input(false);
  readonly enableKeyboardShortcuts = input(true);
  readonly maxParts = input(16, { transform: numberAttribute });
  readonly maxUndoHistory = input(50, { transform: numberAttribute });

  // ==================== OUTPUTS ====================

  readonly scoreChanged = output<ScoreData>();
  readonly partAdded = output<InstrumentPart>();
  readonly partRemoved = output<string>();
  readonly exportRequested = output<{ format: ExportFormat; data: string | Blob }>();
  readonly parseError = output<string>();

  // ==================== INTERNAL STATE ====================

  protected readonly title = signal('Untitled Score');
  protected readonly composer = signal('');
  protected readonly tempo = signal(120);
  protected readonly keySignature = signal<KeySignature>('C');
  protected readonly timeSignature = signal<StaffTimeSignature>('4/4');

  // Number of measures in the score: follows the `measures` input, and is replaced by a
  // loaded/imported score's own length
  protected readonly measureCount = linkedSignal(() => this.measures());

  protected readonly parts = signal<InstrumentPart[]>([]);
  protected readonly selectedPartId = signal<string | null>(null);
  protected readonly editingLyrics = signal(false);
  protected readonly currentLyricText = signal('');

  // Editing state
  protected readonly currentDuration = signal<NoteDuration>('quarter');
  protected readonly currentAccidental = signal<NoteAccidental>(null);
  protected readonly isDotted = signal(false);
  protected readonly isRest = signal(false);
  protected readonly currentVoice = signal<1 | 2 | 3 | 4>(1);

  // History for undo/redo
  protected readonly undoStack = signal<HistoryEntry[]>([]);
  protected readonly redoStack = signal<HistoryEntry[]>([]);

  // UI state
  protected readonly showPartDialog = signal(false);
  protected readonly showTransposeDialog = signal(false);
  protected readonly showExportDialog = signal(false);
  protected readonly transposeAmount = signal(0);
  protected readonly exportFormat = signal<ExportFormat>('musicxml');

  private partIdCounter = 0;
  private lyricIdCounter = 0;

  private readonly noteInputs = viewChildren(TwNoteInputComponent);

  // ==================== COMPUTED ====================

  protected readonly selectedPart = computed(() => {
    const id = this.selectedPartId();
    return this.parts().find(p => p.id === id) ?? null;
  });

  protected readonly totalHeight = computed(() => {
    const partCount = this.parts().length;
    const staffH = this.staffHeight();
    const gap = 20;
    return Math.max(200, partCount * (staffH + gap) + 100);
  });

  protected readonly canUndo = computed(() => this.undoStack().length > 0);
  protected readonly canRedo = computed(() => this.redoStack().length > 0);

  protected readonly scoreData = computed<ScoreData>(() => ({
    title: this.title(),
    composer: this.composer(),
    tempo: this.tempo(),
    keySignature: this.keySignature(),
    timeSignature: this.timeSignature(),
    measures: this.measureCount(),
    parts: this.parts(),
  }));

  // Note x positions inside each tw-note-input (mirrors tw-staff / tw-note-input layout)
  private readonly noteInputLayout = computed(() =>
    getStaffLayout({
      width: this.width() - STAFF_ROW_RESERVED_WIDTH,
      measures: this.measureCount(),
      keySignature: this.keySignature(),
    })
  );

  // ==================== LIFECYCLE ====================

  constructor() {
    // Push the toolbar's entry settings down to every staff's note input
    effect(() => {
      const duration = this.currentDuration();
      const accidental = this.currentAccidental();
      const dotted = this.isDotted();
      const rest = this.isRest();
      const voice = this.currentVoice();
      for (const noteInput of this.noteInputs()) {
        noteInput.setDuration(duration);
        noteInput.setAccidental(accidental);
        noteInput.setDotted(dotted);
        noteInput.setRestMode(rest);
        noteInput.setVoice(voice);
      }
    });
  }

  ngOnInit(): void {
    // Inputs are only available from ngOnInit on (not in the constructor)
    const initial = this.initialScore();
    if (initial) {
      this.loadScore(initial);
    } else {
      // Add default piano part
      this.addPart('piano-treble');
    }
    // The initial state is the baseline, not an undoable action
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  // ==================== PART MANAGEMENT ====================

  addPart(preset?: string): void {
    if (this.parts().length >= this.maxParts()) return;

    const presetData = preset ? INSTRUMENT_PRESETS[preset] : {};
    const partId = this.nextPartId();

    const newPart: InstrumentPart = {
      id: partId,
      name: presetData.name || 'New Part',
      abbreviation: presetData.abbreviation || 'N.P.',
      clef: presetData.clef || 'treble',
      transposition: presetData.transposition || 0,
      muted: false,
      solo: false,
      volume: 1,
      color: this.getPartColor(this.parts().length),
      notes: [],
      lyrics: [],
    };

    this.saveHistory('Add Part');
    this.parts.update(parts => [...parts, newPart]);
    this.selectedPartId.set(partId);
    this.partAdded.emit(newPart);
    this.emitScoreChanged();
  }

  removePart(partId: string): void {
    if (this.parts().length <= 1) return; // Keep at least one part

    this.saveHistory('Remove Part');
    this.parts.update(parts => parts.filter(p => p.id !== partId));

    if (this.selectedPartId() === partId) {
      const remaining = this.parts();
      this.selectedPartId.set(remaining.length > 0 ? remaining[0].id : null);
    }

    this.partRemoved.emit(partId);
    this.emitScoreChanged();
  }

  updatePart(partId: string, updates: Partial<InstrumentPart>): void {
    this.saveHistory('Update Part');
    this.parts.update(parts => parts.map(p => (p.id === partId ? { ...p, ...updates } : p)));
    this.emitScoreChanged();
  }

  duplicatePart(partId: string): void {
    const part = this.parts().find(p => p.id === partId);
    if (!part || this.parts().length >= this.maxParts()) return;

    const newPartId = this.nextPartId();
    const duplicated: InstrumentPart = {
      ...part,
      id: newPartId,
      name: `${part.name} (Copy)`,
      notes: part.notes.map(n => ({ ...n, id: `note-${Date.now()}-${Math.random()}` })),
      lyrics: part.lyrics.map(l => ({ ...l, id: this.nextLyricId() })),
      color: this.getPartColor(this.parts().length),
    };

    this.saveHistory('Duplicate Part');
    this.parts.update(parts => [...parts, duplicated]);
    this.selectedPartId.set(newPartId);
    this.partAdded.emit(duplicated);
    this.emitScoreChanged();
  }

  selectPart(partId: string): void {
    this.selectedPartId.set(partId);
  }

  // Ids not used by any part / lyric yet: a loaded or imported score may already use
  // "part-<n>" / "lyric-<n>" ids, and a duplicate id would make edits hit both entries
  private nextPartId(): string {
    const used = new Set(this.parts().map(p => p.id));
    let id: string;
    do {
      id = `part-${this.partIdCounter++}`;
    } while (used.has(id));
    return id;
  }

  private nextLyricId(): string {
    const used = new Set(this.parts().flatMap(p => p.lyrics.map(l => l.id)));
    let id: string;
    do {
      id = `lyric-${this.lyricIdCounter++}`;
    } while (used.has(id));
    return id;
  }

  private getPartColor(index: number): string {
    const colors = [
      '#1E293B',
      '#2563EB',
      '#059669',
      '#DC2626',
      '#7C3AED',
      '#EA580C',
      '#0891B2',
      '#4F46E5',
    ];
    return colors[index % colors.length];
  }

  // ==================== PART EXTRACTION ====================

  extractPart(partId: string): SheetMusicData {
    const part = this.parts().find(p => p.id === partId);
    if (!part) {
      throw new Error(`Part ${partId} not found`);
    }

    // Group notes by measure
    const measureMap = new Map<number, NoteData[]>();
    for (const note of part.notes) {
      const measureNotes = measureMap.get(note.measure) || [];
      measureNotes.push({
        name: note.name,
        octave: note.octave,
        duration: note.duration,
        accidental: note.accidental,
        ...(note.isRest ? { isRest: true } : {}),
        dotted: note.dotted,
        doubleDotted: note.doubleDotted,
        tied: note.tied,
      });
      measureMap.set(note.measure, measureNotes);
    }

    const measures: MeasureData[] = [];
    for (let m = 0; m < this.measureCount(); m++) {
      measures.push({
        notes: measureMap.get(m) || [],
        timeSignature: m === 0 ? this.timeSignature() : undefined,
        keySignature: m === 0 ? this.keySignature() : undefined,
        tempo: m === 0 ? this.tempo() : undefined,
      });
    }

    return {
      title: `${this.title()} - ${part.name}`,
      composer: this.composer(),
      clef: part.clef,
      keySignature: this.keySignature(),
      timeSignature: this.timeSignature(),
      tempo: this.tempo(),
      measures,
    };
  }

  extractAllParts(): Map<string, SheetMusicData> {
    const extracted = new Map<string, SheetMusicData>();
    for (const part of this.parts()) {
      extracted.set(part.id, this.extractPart(part.id));
    }
    return extracted;
  }

  // ==================== TRANSPOSE ====================

  transpose(options: TransposeOptions): void {
    const { semitones, partIds, preserveEnharmonic = false } = options;
    if (semitones === 0) return;

    this.saveHistory(`Transpose ${semitones > 0 ? '+' : ''}${semitones}`);

    const key = this.keySignature();
    this.parts.update(parts =>
      parts.map(part => {
        if (partIds && !partIds.includes(part.id)) return part;
        return {
          ...part,
          notes: this.transposeNotes(part.notes, semitones, preserveEnharmonic, key),
        };
      })
    );

    this.emitScoreChanged();
  }

  // Transpose one staff's notes. Pitches are resolved with the key signature and earlier
  // accidentals in the measure, and the results are re-spelled the same way.
  private transposeNotes(
    notes: PlacedNote[],
    semitones: number,
    preserveEnharmonic: boolean,
    key: KeySignature
  ): PlacedNote[] {
    const source = createAccidentalContext(key);
    const target = createAccidentalContext(key);
    const result = [...notes];

    this.forEachInTimeOrder(notes, [source, target], (note, index) => {
      if (note.isRest) return;
      const alteration = source.resolve(note);
      const midi = (note.octave + 1) * 12 + NOTE_TO_CHROMATIC[note.name] + alteration + semitones;
      // preserveEnharmonic keeps the sharp/flat family of altered notes; otherwise prefer the
      // key's own letters (F# in G major, Bb in F major)
      const spelled =
        preserveEnharmonic && alteration !== 0
          ? spellMidiPitch(midi, 'C', alteration < 0)
          : spellMidiPitch(midi, key);
      result[index] = {
        ...note,
        name: spelled.name,
        octave: spelled.octave,
        accidental: target.spell(spelled.name, spelled.octave, spelled.alteration),
      };
    });

    return result;
  }

  /**
   * Visit one staff's notes in time order (measure, then beat), starting a new measure on the
   * given accidental contexts at every bar line. `index` is the note's index in `notes`.
   */
  private forEachInTimeOrder(
    notes: PlacedNote[],
    contexts: AccidentalContext[],
    visit: (note: PlacedNote, index: number) => void
  ): void {
    const order = notes
      .map((_, index) => index)
      .sort((a, b) => notes[a].measure - notes[b].measure || notes[a].beat - notes[b].beat);
    let measure: number | null = null;
    for (const index of order) {
      const note = notes[index];
      if (note.measure !== measure) {
        for (const context of contexts) context.nextMeasure();
        measure = note.measure;
      }
      visit(note, index);
    }
  }

  transposeSelectedPart(semitones: number): void {
    const partId = this.selectedPartId();
    if (!partId) return;
    this.transpose({ semitones, partIds: [partId] });
  }

  transposeAll(semitones: number): void {
    this.transpose({ semitones });
  }

  // ==================== LYRICS ====================

  addLyric(partId: string, text: string, measure: number, beat: number, verse = 1): void {
    const lyric: LyricEntry = {
      id: this.nextLyricId(),
      text,
      measure,
      beat,
      syllableType: 'single',
      verse,
    };

    this.saveHistory('Add Lyric');
    this.parts.update(parts =>
      parts.map(p => (p.id === partId ? { ...p, lyrics: [...p.lyrics, lyric] } : p))
    );
    this.emitScoreChanged();
  }

  updateLyric(partId: string, lyricId: string, updates: Partial<LyricEntry>): void {
    this.saveHistory('Update Lyric');
    this.parts.update(parts =>
      parts.map(p =>
        p.id === partId
          ? {
              ...p,
              lyrics: p.lyrics.map(l => (l.id === lyricId ? { ...l, ...updates } : l)),
            }
          : p
      )
    );
    this.emitScoreChanged();
  }

  removeLyric(partId: string, lyricId: string): void {
    this.saveHistory('Remove Lyric');
    this.parts.update(parts =>
      parts.map(p =>
        p.id === partId ? { ...p, lyrics: p.lyrics.filter(l => l.id !== lyricId) } : p
      )
    );
    this.emitScoreChanged();
  }

  getLyricsForPart(partId: string, verse = 1): LyricEntry[] {
    const part = this.parts().find(p => p.id === partId);
    return part?.lyrics.filter(l => l.verse === verse) || [];
  }

  /** Open the lyrics editor for the selected part, pre-filled with its verse 1 lyrics */
  openLyricsEditor(): void {
    const partId = this.selectedPartId();
    const lyrics = partId
      ? [...this.getLyricsForPart(partId)].sort((a, b) => a.measure - b.measure || a.beat - b.beat)
      : [];
    let text = '';
    for (const lyric of lyrics) {
      text += lyric.text;
      text += lyric.syllableType === 'begin' || lyric.syllableType === 'middle' ? '-' : ' ';
    }
    this.currentLyricText.set(text.trim());
    this.editingLyrics.set(true);
  }

  /**
   * Replace the selected part's lyrics for `verse` with `text`, one syllable per (voice 1)
   * note in time order. Words are separated by whitespace and syllables by hyphens
   * ("Hel-lo world"). Syllables beyond the last note are ignored.
   */
  applyLyrics(text: string = this.currentLyricText(), verse = 1): void {
    const partId = this.selectedPartId();
    const part = this.parts().find(p => p.id === partId);
    if (!part) return;

    const syllables: Array<Pick<LyricEntry, 'text' | 'syllableType'>> = [];
    for (const word of text.split(/\s+/)) {
      const pieces = word.split('-').filter(Boolean);
      pieces.forEach((syllable, i) => {
        let syllableType: LyricEntry['syllableType'] = 'middle';
        if (pieces.length === 1) syllableType = 'single';
        else if (i === 0) syllableType = 'begin';
        else if (i === pieces.length - 1) syllableType = 'end';
        syllables.push({ text: syllable, syllableType });
      });
    }

    const sounding = part.notes.filter(n => !n.isRest);
    const melody = sounding.some(n => n.voice === 1)
      ? sounding.filter(n => n.voice === 1)
      : sounding;
    const anchors = [...melody].sort((a, b) => a.measure - b.measure || a.beat - b.beat);

    const lyrics: LyricEntry[] = syllables.slice(0, anchors.length).map((syllable, i) => ({
      id: this.nextLyricId(),
      ...syllable,
      measure: anchors[i].measure,
      beat: anchors[i].beat,
      verse,
    }));

    this.saveHistory('Edit Lyrics');
    this.parts.update(parts =>
      parts.map(p =>
        p.id === part.id
          ? { ...p, lyrics: [...p.lyrics.filter(l => l.verse !== verse), ...lyrics] }
          : p
      )
    );
    this.emitScoreChanged();
  }

  // x of a lyric inside its staff row, aligned with the note at the same measure/beat
  protected lyricX(lyric: LyricEntry): number {
    const { contentStartX, measureWidth } = this.noteInputLayout();
    return (
      contentStartX +
      lyric.measure * measureWidth +
      (lyric.beat / NOTE_INPUT_GRID_DIVISION) * measureWidth
    );
  }

  // ==================== UNDO/REDO ====================

  private saveHistory(action: string, includeScore = false): void {
    const entry: HistoryEntry = {
      parts: JSON.parse(JSON.stringify(this.parts())),
      timestamp: Date.now(),
      action,
      ...(includeScore ? { score: this.scoreSettings() } : {}),
    };

    this.undoStack.update(stack => {
      const newStack = [...stack, entry];
      // Limit history size
      if (newStack.length > this.maxUndoHistory()) {
        return newStack.slice(-this.maxUndoHistory());
      }
      return newStack;
    });

    // Clear redo stack on new action
    this.redoStack.set([]);
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;

    const entry = stack.at(-1)!;
    this.undoStack.update(s => s.slice(0, -1));

    // Save current state to redo stack
    this.redoStack.update(s => [
      ...s,
      {
        parts: JSON.parse(JSON.stringify(this.parts())),
        timestamp: Date.now(),
        action: 'Redo',
        ...(entry.score ? { score: this.scoreSettings() } : {}),
      },
    ]);

    this.restoreHistoryEntry(entry);
  }

  redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;

    const entry = stack.at(-1)!;
    this.redoStack.update(s => s.slice(0, -1));

    // Save current state to undo stack
    this.undoStack.update(s => [
      ...s,
      {
        parts: JSON.parse(JSON.stringify(this.parts())),
        timestamp: Date.now(),
        action: 'Undo',
        ...(entry.score ? { score: this.scoreSettings() } : {}),
      },
    ]);

    this.restoreHistoryEntry(entry);
  }

  private scoreSettings(): Omit<ScoreData, 'parts'> {
    const { parts: _parts, ...settings } = this.scoreData();
    return settings;
  }

  // Undoing an import/load must also bring back the key, time signature and length the
  // restored notes were written for (their pitches and x positions depend on them)
  private restoreHistoryEntry(entry: HistoryEntry): void {
    if (entry.score) {
      this.title.set(entry.score.title);
      this.composer.set(entry.score.composer);
      this.tempo.set(entry.score.tempo);
      this.keySignature.set(entry.score.keySignature);
      this.timeSignature.set(entry.score.timeSignature);
      this.measureCount.set(entry.score.measures);
    }
    this.parts.set(entry.parts);
    if (!entry.parts.some(p => p.id === this.selectedPartId())) {
      this.selectedPartId.set(entry.parts[0]?.id ?? null);
    }
    this.emitScoreChanged();
  }

  // ==================== EXPORT ====================

  exportToMusicXML(): string {
    const score = this.scoreData();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml +=
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
    xml += '<score-partwise version="4.0">\n';

    // Work
    xml += '  <work>\n';
    xml += `    <work-title>${this.escapeXml(score.title)}</work-title>\n`;
    xml += '  </work>\n';

    // Identification
    xml += '  <identification>\n';
    if (score.composer) {
      xml += `    <creator type="composer">${this.escapeXml(score.composer)}</creator>\n`;
    }
    xml += '    <encoding>\n';
    xml += '      <software>ngx-tailwindcss Score Editor</software>\n';
    xml += `      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>\n`;
    xml += '    </encoding>\n';
    xml += '  </identification>\n';

    // Part list
    xml += '  <part-list>\n';
    for (const part of score.parts) {
      xml += `    <score-part id="${part.id}">\n`;
      xml += `      <part-name>${this.escapeXml(part.name)}</part-name>\n`;
      xml += `      <part-abbreviation>${this.escapeXml(part.abbreviation)}</part-abbreviation>\n`;
      xml += '    </score-part>\n';
    }
    xml += '  </part-list>\n';

    // Parts
    for (const part of score.parts) {
      xml += `  <part id="${part.id}">\n`;

      // Group notes by measure
      const measureNotes = new Map<number, PlacedNote[]>();
      for (const note of part.notes) {
        const notes = measureNotes.get(note.measure) || [];
        notes.push(note);
        measureNotes.set(note.measure, notes);
      }
      const accidentals = createAccidentalContext(score.keySignature);

      for (let m = 0; m < score.measures; m++) {
        xml += `    <measure number="${m + 1}">\n`;

        // Attributes (first measure)
        if (m === 0) {
          xml += '      <attributes>\n';
          xml += `        <divisions>${MUSICXML_DIVISIONS}</divisions>\n`;
          xml += this.keySignatureToXml(score.keySignature);
          xml += this.timeSignatureToXml(score.timeSignature);
          xml += this.clefToXml(part.clef);
          xml += '      </attributes>\n';

          // Direction (tempo)
          xml += '      <direction placement="above">\n';
          xml += '        <direction-type>\n';
          xml += `          <metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome>\n`;
          xml += '        </direction-type>\n';
          xml += `        <sound tempo="${score.tempo}"/>\n`;
          xml += '      </direction>\n';
        }

        // Notes (pitches resolved against the key signature and earlier accidentals)
        accidentals.nextMeasure();
        const notes = measureNotes.get(m) || [];
        if (notes.length === 0) {
          // Add whole rest
          xml += '      <note>\n';
          xml += '        <rest/>\n';
          const measureDivisions =
            this.getQuartersPerMeasure(score.timeSignature) * MUSICXML_DIVISIONS;
          xml += `        <duration>${measureDivisions}</duration>\n`;
          xml += '      </note>\n';
        } else {
          // Place each note at its beat: notes sharing a beat form a chord, and gaps or
          // overlapping voices move the cursor with <forward>/<backup>
          const measureDivisions =
            this.getQuartersPerMeasure(score.timeSignature) * MUSICXML_DIVISIONS;
          let cursor = 0;
          let previousStart: number | null = null;
          for (const note of notes.sort((a, b) => a.beat - b.beat)) {
            const start = Math.round((note.beat / NOTE_INPUT_GRID_DIVISION) * measureDivisions);
            const chord = start === previousStart && !note.isRest;
            if (!chord) {
              if (start > cursor) {
                xml += `      <forward><duration>${start - cursor}</duration></forward>\n`;
              } else if (start < cursor) {
                xml += `      <backup><duration>${cursor - start}</duration></backup>\n`;
              }
              cursor = start + this.musicXmlDuration(note);
              previousStart = start;
            }
            xml += this.noteToXml(note, accidentals, chord);
          }
        }

        xml += '    </measure>\n';
      }

      xml += '  </part>\n';
    }

    xml += '</score-partwise>\n';
    return xml;
  }

  private escapeXml(str: string): string {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  private keySignatureToXml(key: KeySignature): string {
    const fifths: Record<KeySignature, number> = {
      C: 0,
      G: 1,
      D: 2,
      A: 3,
      E: 4,
      B: 5,
      'F#': 6,
      'C#': 7,
      F: -1,
      Bb: -2,
      Eb: -3,
      Ab: -4,
      Db: -5,
      Gb: -6,
      Cb: -7,
    };
    return `        <key><fifths>${fifths[key]}</fifths></key>\n`;
  }

  private timeSignatureToXml(time: StaffTimeSignature): string {
    if (time === 'C')
      return '        <time symbol="common"><beats>4</beats><beat-type>4</beat-type></time>\n';
    if (time === 'C|')
      return '        <time symbol="cut"><beats>2</beats><beat-type>2</beat-type></time>\n';
    const [beats, beatType] = time.split('/');
    return `        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>\n`;
  }

  private clefToXml(clef: ClefType): string {
    const clefMap: Record<ClefType, { sign: string; line: number }> = {
      treble: { sign: 'G', line: 2 },
      bass: { sign: 'F', line: 4 },
      alto: { sign: 'C', line: 3 },
      tenor: { sign: 'C', line: 4 },
      percussion: { sign: 'percussion', line: 2 },
    };
    const c = clefMap[clef];
    return `        <clef><sign>${c.sign}</sign><line>${c.line}</line></clef>\n`;
  }

  // Note length in MusicXML divisions (MUSICXML_DIVISIONS per quarter, always an integer)
  private musicXmlDuration(note: PlacedNote): number {
    const quarterFractions: Record<NoteDuration, number> = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
      thirtysecond: 0.125,
    };
    let dur = (quarterFractions[note.duration] ?? 1) * MUSICXML_DIVISIONS;
    if (note.doubleDotted) dur *= 1.75;
    else if (note.dotted) dur *= 1.5;
    return dur;
  }

  private noteToXml(note: PlacedNote, accidentals: AccidentalContext, chord = false): string {
    let xml = '      <note>\n';
    if (chord) {
      xml += '        <chord/>\n';
    }

    if (note.isRest) {
      xml += '        <rest/>\n';
    } else {
      // Pitch: <alter> is the sounding alteration (key signature included); <accidental>
      // below is only the written sign
      const alteration = accidentals.resolve(note);
      xml += '        <pitch>\n';
      xml += `          <step>${note.name}</step>\n`;
      if (alteration !== 0) {
        xml += `          <alter>${alteration}</alter>\n`;
      }
      xml += `          <octave>${note.octave}</octave>\n`;
      xml += '        </pitch>\n';
    }

    xml += `        <duration>${this.musicXmlDuration(note)}</duration>\n`;

    // Type (MusicXML names: 16th, 32nd)
    const types: Record<NoteDuration, string> = {
      whole: 'whole',
      half: 'half',
      quarter: 'quarter',
      eighth: 'eighth',
      sixteenth: '16th',
      thirtysecond: '32nd',
    };
    xml += `        <type>${types[note.duration] ?? 'quarter'}</type>\n`;

    // Dots
    if (note.dotted || note.doubleDotted) {
      xml += '        <dot/>\n';
    }
    if (note.doubleDotted) {
      xml += '        <dot/>\n';
    }

    // Accidental (display)
    if (note.accidental && !note.isRest) {
      const accMap: Record<string, string> = {
        sharp: 'sharp',
        flat: 'flat',
        natural: 'natural',
        doubleSharp: 'double-sharp',
        doubleFlat: 'double-flat',
      };
      xml += `        <accidental>${accMap[note.accidental]}</accidental>\n`;
    }

    xml += '      </note>\n';
    return xml;
  }

  exportToMidi(): Uint8Array {
    // Basic MIDI file export
    const score = this.scoreData();
    const ticksPerQuarter = 480;
    const tracks: Uint8Array[] = [];

    // Track 0: Tempo track
    const tempoTrack = this.createMidiTempoTrack(score.tempo, ticksPerQuarter);
    tracks.push(tempoTrack);

    // Track per part
    for (const part of score.parts) {
      const noteTrack = this.createMidiNoteTrack(part, ticksPerQuarter);
      tracks.push(noteTrack);
    }

    // Assemble MIDI file
    return this.assembleMidiFile(tracks, ticksPerQuarter);
  }

  private createMidiTempoTrack(tempo: number, ticksPerQuarter: number): Uint8Array {
    const events: number[] = [];

    // Delta time 0
    events.push(0);
    // Tempo meta event
    const microsPerQuarter = Math.round(60_000_000 / tempo);
    events.push(0xff, 0x51, 0x03);
    events.push((microsPerQuarter >> 16) & 0xff);
    events.push((microsPerQuarter >> 8) & 0xff);
    events.push(microsPerQuarter & 0xff);

    // End of track
    events.push(0, 0xff, 0x2f, 0x00);

    return this.createMidiTrackChunk(new Uint8Array(events));
  }

  private createMidiNoteTrack(part: InstrumentPart, ticksPerQuarter: number): Uint8Array {
    const events: number[] = [];

    // Track name
    events.push(0); // Delta time
    events.push(0xff, 0x03); // Track name meta event
    const nameBytes = new TextEncoder().encode(part.name);
    events.push(...this.toVariableLength(nameBytes.length));
    events.push(...nameBytes);

    // Build absolute-time note on/off events so chords and overlapping voices keep their
    // positions (delta times must never be negative)
    const quartersPerMeasure = this.getQuartersPerMeasure(this.timeSignature());
    const gridDivision = NOTE_INPUT_GRID_DIVISION;
    const timed: Array<{ tick: number; isOn: boolean; midiNote: number }> = [];

    const accidentals = createAccidentalContext(this.keySignature());

    this.forEachInTimeOrder(part.notes, [accidentals], note => {
      if (note.isRest) return;
      const startQuarters =
        note.measure * quartersPerMeasure + (note.beat / gridDivision) * quartersPerMeasure;
      const tick = Math.round(startQuarters * ticksPerQuarter);
      const midiNote = this.noteToMidi(
        note.name,
        note.octave,
        accidentals.resolve(note),
        part.transposition
      );
      const durationTicks = this.durationToTicks(
        note.duration,
        note.doubleDotted ? 1.75 : note.dotted ? 1.5 : 1,
        ticksPerQuarter
      );
      timed.push(
        { tick, isOn: true, midiNote },
        { tick: tick + durationTicks, isOn: false, midiNote }
      );
    });

    // At equal ticks, emit note-offs before note-ons so repeated pitches retrigger
    timed.sort((a, b) => a.tick - b.tick || Number(a.isOn) - Number(b.isOn));

    const velocity = 80;
    let lastTick = 0;
    for (const event of timed) {
      events.push(...this.toVariableLength(event.tick - lastTick));
      if (event.isOn) {
        events.push(0x90, event.midiNote, velocity);
      } else {
        events.push(0x80, event.midiNote, 0);
      }
      lastTick = event.tick;
    }

    // End of track
    events.push(0, 0xff, 0x2f, 0x00);

    return this.createMidiTrackChunk(new Uint8Array(events));
  }

  // Length of one measure in quarter notes for the given time signature
  private getQuartersPerMeasure(time: StaffTimeSignature): number {
    if (time === 'C' || time === 'C|') return 4;
    const [beats, beatType] = time.split('/').map(Number);
    if (!beats || !beatType) return 4;
    return (beats * 4) / beatType;
  }

  // `alteration` is the resolved sounding alteration (see AccidentalContext.resolve)
  private noteToMidi(
    name: NoteName,
    octave: number,
    alteration: number,
    transposition: number
  ): number {
    const midi = NOTE_TO_CHROMATIC[name] + (octave + 1) * 12 + alteration;
    return Math.max(0, Math.min(127, midi - transposition));
  }

  private durationToTicks(
    duration: NoteDuration,
    dotFactor: number,
    ticksPerQuarter: number
  ): number {
    const durationMap: Record<NoteDuration, number> = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
      thirtysecond: 0.125,
    };
    return Math.round(durationMap[duration] * ticksPerQuarter * dotFactor);
  }

  private toVariableLength(value: number): number[] {
    if (value < 128) return [value];
    let remaining = value;
    const bytes: number[] = [];
    bytes.unshift(remaining & 0x7f);
    remaining >>= 7;
    while (remaining > 0) {
      bytes.unshift((remaining & 0x7f) | 0x80);
      remaining >>= 7;
    }
    return bytes;
  }

  private createMidiTrackChunk(data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(8 + data.length);
    // "MTrk"
    chunk[0] = 0x4d;
    chunk[1] = 0x54;
    chunk[2] = 0x72;
    chunk[3] = 0x6b;
    // Length (big-endian)
    const len = data.length;
    chunk[4] = (len >> 24) & 0xff;
    chunk[5] = (len >> 16) & 0xff;
    chunk[6] = (len >> 8) & 0xff;
    chunk[7] = len & 0xff;
    chunk.set(data, 8);
    return chunk;
  }

  private assembleMidiFile(tracks: Uint8Array[], ticksPerQuarter: number): Uint8Array {
    const totalLength = 14 + tracks.reduce((sum, t) => sum + t.length, 0);
    const file = new Uint8Array(totalLength);
    let offset = 0;

    // Header chunk "MThd"
    file[offset++] = 0x4d;
    file[offset++] = 0x54;
    file[offset++] = 0x68;
    file[offset++] = 0x64;
    // Header length (6)
    file[offset++] = 0;
    file[offset++] = 0;
    file[offset++] = 0;
    file[offset++] = 6;
    // Format (1 = multiple tracks)
    file[offset++] = 0;
    file[offset++] = 1;
    // Number of tracks
    const numTracks = tracks.length;
    file[offset++] = (numTracks >> 8) & 0xff;
    file[offset++] = numTracks & 0xff;
    // Ticks per quarter
    file[offset++] = (ticksPerQuarter >> 8) & 0xff;
    file[offset++] = ticksPerQuarter & 0xff;

    // Tracks
    for (const track of tracks) {
      file.set(track, offset);
      offset += track.length;
    }

    return file;
  }

  exportToABC(): string {
    const score = this.scoreData();
    let abc = '';

    // Header
    abc += `X:1\n`;
    abc += `T:${score.title}\n`;
    if (score.composer) abc += `C:${score.composer}\n`;
    abc += `M:${score.timeSignature === 'C' ? 'C' : score.timeSignature === 'C|' ? 'C|' : score.timeSignature}\n`;
    abc += `L:1/8\n`;
    abc += `Q:1/4=${score.tempo}\n`;
    abc += `K:${score.keySignature}\n`;

    // Notes (first part only for simplicity)
    const part = score.parts[0];
    if (part) {
      const measureGroups: string[] = [];

      for (let m = 0; m < score.measures; m++) {
        const measureNotes = part.notes
          .filter(n => n.measure === m)
          .sort((a, b) => a.beat - b.beat);

        if (measureNotes.length === 0) {
          // Full-measure rest, in units of L:1/8
          measureGroups.push(`z${this.getQuartersPerMeasure(score.timeSignature) * 2}`);
        } else {
          const noteStrings = measureNotes.map(n => this.noteToABC(n));
          measureGroups.push(noteStrings.join(''));
        }
      }

      abc += `${measureGroups.join('|')}|]\n`;
    }

    return abc;
  }

  private noteToABC(note: PlacedNote): string {
    let abc = '';

    // ABC applies the key signature and bar accidentals itself (same convention as
    // NoteData.accidental), so the written accidental is exported as is
    switch (note.isRest ? null : note.accidental) {
      case 'sharp': {
        abc += '^';
        break;
      }
      case 'flat': {
        abc += '_';
        break;
      }
      case 'natural': {
        abc += '=';
        break;
      }
      case 'doubleSharp': {
        abc += '^^';
        break;
      }
      case 'doubleFlat': {
        abc += '__';
        // No default
        break;
      }
    }

    if (note.isRest) {
      abc += 'z';
    } else {
      // Note name (lowercase for octave 5+)
      abc += note.octave >= 5 ? note.name.toLowerCase() : note.name;

      // Octave modifiers
      if (note.octave >= 6) {
        abc += "'".repeat(note.octave - 5);
      } else if (note.octave <= 3) {
        abc += ','.repeat(4 - note.octave);
      }
    }

    // Duration in units of L:1/8 (dotted notes are 1.5x)
    const eighths: Record<NoteDuration, number> = {
      whole: 8,
      half: 4,
      quarter: 2,
      eighth: 1,
      sixteenth: 0.5,
      thirtysecond: 0.25,
    };
    const length =
      (eighths[note.duration] ?? 2) * (note.doubleDotted ? 1.75 : note.dotted ? 1.5 : 1);
    abc += this.abcLength(length);

    return abc;
  }

  // Format a length (in L units) as an ABC duration suffix: 1 -> '', 3 -> '3', 0.5 -> '/2', 0.75 -> '3/4'
  private abcLength(length: number): string {
    if (length === 1) return '';
    if (Number.isInteger(length)) return String(length);
    let denominator = 1;
    while (!Number.isInteger(length * denominator) && denominator < 64) {
      denominator *= 2;
    }
    const numerator = Math.round(length * denominator);
    return numerator === 1 ? `/${denominator}` : `${numerator}/${denominator}`;
  }

  /**
   * Render the score's staves to a single-page PDF (the notation is embedded as an image).
   * Browser only: requires a DOM and canvas support.
   */
  async exportToPDF(): Promise<Blob> {
    const container: HTMLElement | null =
      this.elementRef.nativeElement.querySelector('.staves-container');
    // Top-level SVGs only (nested ones are drawn as part of their parent)
    const svgs: SVGSVGElement[] = [
      ...(container?.querySelectorAll<SVGSVGElement>('svg') ?? []),
    ].filter(svg => !svg.parentElement?.closest('svg'));
    if (!container || svgs.length === 0) {
      throw new Error('No SVG element found');
    }

    const containerRect = container.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.ceil(containerRect.width) || this.width());
    const cssHeight = Math.max(1, Math.ceil(containerRect.height) || this.totalHeight());
    const scale = 2;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas context');
    }
    canvas.width = cssWidth * scale;
    canvas.height = cssHeight * scale;

    // White background (JPEG has no transparency)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const svg of svgs) {
      const rect = svg.getBoundingClientRect();
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgUrl = URL.createObjectURL(
        new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      );
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.addEventListener('load', () => {
            resolve();
          });
          img.addEventListener('error', () => {
            reject(new Error('Failed to load SVG image for PDF export'));
          });
          img.src = svgUrl;
        });
        ctx.drawImage(
          img,
          (rect.left - containerRect.left) * scale,
          (rect.top - containerRect.top) * scale,
          rect.width * scale,
          rect.height * scale
        );
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    }

    // canvas.toBlob(..., 'application/pdf') is not supported (it silently yields a PNG), so
    // wrap a JPEG of the canvas in a minimal PDF document. 1 CSS px = 0.75 pt.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpeg = Uint8Array.from(
      atob(dataUrl.slice(dataUrl.indexOf(',') + 1)),
      c => c.codePointAt(0) ?? 0
    );
    const pdf = this.buildImagePdf(
      jpeg,
      canvas.width,
      canvas.height,
      cssWidth * 0.75,
      cssHeight * 0.75
    );
    return new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  // Minimal single-page PDF 1.4 document showing one JPEG image scaled to the page
  private buildImagePdf(
    jpeg: Uint8Array,
    pixelWidth: number,
    pixelHeight: number,
    pageWidth: number,
    pageHeight: number
  ): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;
    const write = (data: string | Uint8Array): void => {
      const bytes = typeof data === 'string' ? encoder.encode(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    };
    const startObject = (): void => {
      offsets.push(length);
    };

    const w = pageWidth.toFixed(2);
    const h = pageHeight.toFixed(2);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;

    write('%PDF-1.4\n');
    startObject();
    write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    startObject();
    write('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    startObject();
    write(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'
    );
    startObject();
    write(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    write(jpeg);
    write('\nendstream\nendobj\n');
    startObject();
    write(
      `5 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`
    );

    const xrefOffset = length;
    let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    write(xref);
    write(
      `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    );

    const pdf = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      pdf.set(chunk, position);
      position += chunk.length;
    }
    return pdf;
  }

  async export(format: ExportFormat): Promise<string | Blob | undefined> {
    let data: string | Blob;

    switch (format) {
      case 'musicxml': {
        data = this.exportToMusicXML();
        break;
      }
      case 'midi': {
        const midiData = this.exportToMidi();
        data = new Blob([midiData.buffer as ArrayBuffer], { type: 'audio/midi' });
        break;
      }
      case 'abc': {
        data = this.exportToABC();
        break;
      }
      case 'pdf': {
        data = await this.exportToPDF();
        break;
      }
      default: {
        return undefined;
      }
    }

    this.exportRequested.emit({ format, data });
    return data;
  }

  downloadExport(format: ExportFormat): void {
    const fileTypes: Record<ExportFormat, { mimeType: string; extension: string }> = {
      musicxml: { mimeType: 'application/vnd.recordare.musicxml+xml', extension: 'musicxml' },
      midi: { mimeType: 'audio/midi', extension: 'mid' },
      abc: { mimeType: 'text/plain', extension: 'abc' },
      pdf: { mimeType: 'application/pdf', extension: 'pdf' },
    };

    this.export(format)
      .then(content => {
        const fileType = fileTypes[format];
        if (content === undefined || !fileType) return;

        const filename = this.scoreData().title.replaceAll(/\s+/g, '_') || 'score';
        const blob =
          typeof content === 'string' ? new Blob([content], { type: fileType.mimeType }) : content;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${fileType.extension}`;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => {
        console.error(`Score export (${format}) failed:`, error);
      });
  }

  // ==================== IMPORT ====================

  importMusicXML(xmlString: string): void {
    const parsed = parseMusicXML(xmlString);
    if (!parsed) {
      this.parseError.emit('Failed to parse MusicXML');
      return;
    }

    this.loadFromSheetMusic(parsed);
  }

  importABC(abcString: string): void {
    const parsed = parseABCNotation(abcString);
    if (!parsed) {
      this.parseError.emit('Failed to parse ABC notation');
      return;
    }

    this.loadFromSheetMusic(parsed);
  }

  private loadFromSheetMusic(data: SheetMusicData): void {
    this.saveHistory('Import', true);

    this.title.set(data.title || 'Untitled');
    this.composer.set(data.composer || '');
    this.tempo.set(data.tempo || 120);
    this.keySignature.set(data.keySignature);
    this.timeSignature.set(data.timeSignature);

    this.measureCount.set(Math.max(1, data.measures.length));

    // Convert measures to notes, placing each at its rhythmic position on the editor's grid
    const notes: PlacedNote[] = [];
    let noteId = 0;
    const quartersPerMeasure = this.getQuartersPerMeasure(data.timeSignature);
    const { contentStartX, measureWidth } = this.noteInputLayout();
    const quarterLengths: Record<NoteDuration, number> = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
      thirtysecond: 0.125,
    };

    // The editor has a single key signature: notes after a key change are re-spelled for it
    const measureKeys = getMeasureKeySignatures(data);
    data.measures.forEach((measure, measureIndex) => {
      let offset = 0; // quarters from the start of the measure
      for (const note of respellNotesForKey(
        measure.notes,
        measureKeys[measureIndex],
        data.keySignature
      )) {
        const fraction = Math.min(offset / quartersPerMeasure, 1);
        const beat = Math.min(
          NOTE_INPUT_GRID_DIVISION - 1,
          Math.round(fraction * NOTE_INPUT_GRID_DIVISION)
        );
        const x =
          contentStartX +
          measureIndex * measureWidth +
          (beat / NOTE_INPUT_GRID_DIVISION) * measureWidth;

        notes.push({
          id: `note-${noteId++}`,
          ...note,
          x,
          measure: measureIndex,
          beat,
          voice: 1,
        });

        let length = quarterLengths[note.duration] ?? 1;
        if (note.doubleDotted) length *= 1.75;
        else if (note.dotted) length *= 1.5;
        offset += length;
      }
    });

    // Create single part
    const part: InstrumentPart = {
      id: 'part-0',
      name: 'Part 1',
      abbreviation: 'P1',
      clef: data.clef,
      transposition: 0,
      muted: false,
      solo: false,
      volume: 1,
      color: '#1E293B',
      notes,
      lyrics: [],
    };

    this.parts.set([part]);
    this.selectedPartId.set('part-0');
    this.emitScoreChanged();
  }

  loadScore(score: ScoreData): void {
    this.saveHistory('Load Score', true);

    this.title.set(score.title);
    this.composer.set(score.composer);
    this.tempo.set(score.tempo);
    this.keySignature.set(score.keySignature);
    this.timeSignature.set(score.timeSignature);
    if (Number.isFinite(score.measures) && score.measures > 0) {
      this.measureCount.set(score.measures);
    }
    this.parts.set(score.parts);

    if (score.parts.length > 0) {
      this.selectedPartId.set(score.parts[0].id);
    }

    this.emitScoreChanged();
  }

  // ==================== KEYBOARD SHORTCUTS ====================

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.enableKeyboardShortcuts() || !this.editable()) return;
    // A focused tw-note-input already handled this key (e.g. its own Ctrl+Z); handling it
    // again here would immediately revert that edit
    if (event.defaultPrevented) return;
    // Typing in the title, composer, lyrics or transpose fields: Ctrl+Z / Ctrl+S belong
    // to the text field (native text undo), not to the score
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

    const key = event.key.toLowerCase();

    // Undo/Redo
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    // Save/Export
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      this.showExportDialog.set(true);
    }
  }

  // ==================== HELPERS ====================

  private emitScoreChanged(): void {
    this.scoreChanged.emit(this.scoreData());
  }

  // Note handler from TwNoteInputComponent
  onPartNotesChanged(partId: string, notes: PlacedNote[]): void {
    this.saveHistory('Edit Notes');
    this.parts.update(parts => parts.map(p => (p.id === partId ? { ...p, notes } : p)));
    this.emitScoreChanged();
  }

  protected readonly Math = Math;
  protected readonly Object = Object;
  protected readonly INSTRUMENT_PRESETS = INSTRUMENT_PRESETS;
  protected readonly durationOptions: NoteDuration[] = [
    'whole',
    'half',
    'quarter',
    'eighth',
    'sixteenth',
  ];

  protected readonly voiceColors: Record<number, string> = {
    1: '#1E293B',
    2: '#2563EB',
    3: '#059669',
    4: '#DC2626',
  };

  protected toggleDotted(): void {
    this.isDotted.update(d => !d);
  }

  protected toggleRest(): void {
    this.isRest.update(r => !r);
  }

  protected setVoice(voice: number): void {
    this.currentVoice.set(voice as 1 | 2 | 3 | 4);
  }
}

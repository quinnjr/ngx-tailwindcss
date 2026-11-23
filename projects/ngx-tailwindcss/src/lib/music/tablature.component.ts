import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { createAccidentalContext, NoteAccidental, NoteDuration, NoteName } from './note.component';

export type TablatureVariant = 'default' | 'minimal' | 'printed' | 'dark';
export type TablatureTechnique =
  'hammer' | 'pull' | 'slide' | 'bend' | 'vibrato' | 'tap' | 'harmonic' | 'mute';

export interface TabNote {
  string: number; // 1-6 (1 = high E)
  fret: number | string; // Fret number or 'x' for muted
  duration?: number; // In beats (1 = quarter, 0.5 = eighth, etc.)
  technique?: TablatureTechnique;
  bendTarget?: number; // Target fret for bends
  slideTarget?: number; // Target fret for slides
  // Standard notation data (for combined view)
  noteName?: NoteName;
  octave?: number;
  accidental?: 'sharp' | 'flat' | 'natural' | null;
  noteDuration?: NoteDuration;
}

export interface TabMeasure {
  notes: TabNote[][]; // Array of simultaneous notes for each beat position
  timeSignature?: string;
}

// Guitar standard tuning note mapping (string -> open note)
const GUITAR_TUNING: Array<{ note: NoteName; octave: number }> = [
  { note: 'E', octave: 4 }, // String 1 (high E)
  { note: 'B', octave: 3 }, // String 2
  { note: 'G', octave: 3 }, // String 3
  { note: 'D', octave: 3 }, // String 4
  { note: 'A', octave: 2 }, // String 5
  { note: 'E', octave: 2 }, // String 6 (low E)
];

const BASS_TUNING: Array<{ note: NoteName; octave: number }> = [
  { note: 'G', octave: 2 }, // String 1
  { note: 'D', octave: 2 }, // String 2
  { note: 'A', octave: 1 }, // String 3
  { note: 'E', octave: 1 }, // String 4
];

const BASS_5_TUNING: Array<{ note: NoteName; octave: number }> = [
  { note: 'G', octave: 2 }, // String 1
  { note: 'D', octave: 2 }, // String 2
  { note: 'A', octave: 1 }, // String 3
  { note: 'E', octave: 1 }, // String 4
  { note: 'B', octave: 0 }, // String 5 (low B)
];

// Note names in chromatic order
const CHROMATIC_NOTES: NoteName[] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const CHROMATIC_ACCIDENTALS: Array<'sharp' | null> = [
  null,
  'sharp',
  null,
  'sharp',
  null,
  null,
  'sharp',
  null,
  'sharp',
  null,
  'sharp',
  null,
];

// All notes for position calculation
const NOTE_ORDER: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const TECHNIQUE_SYMBOLS: Record<TablatureTechnique, string> = {
  hammer: 'h',
  pull: 'p',
  slide: '/',
  bend: 'b',
  vibrato: '~',
  tap: 't',
  harmonic: '*',
  mute: 'x',
};

@Component({
  selector: 'tw-tablature',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tablature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class TwTablatureComponent {
  private readonly twClass = inject(TwClassService);

  readonly measures = input<TabMeasure[]>([]);
  readonly stringCount = input(6, { transform: numberAttribute }); // 6 for guitar, 4 for bass
  readonly width = input(800, { transform: numberAttribute });
  readonly variant = input<TablatureVariant>('default');
  readonly showMeasureNumbers = input(true);
  readonly showStringLabels = input(true);
  readonly showBarLines = input(true);
  readonly beatsPerMeasure = input(4, { transform: numberAttribute });
  readonly interactive = input(false);
  readonly classOverride = input('');

  // Combined standard notation + TAB view
  readonly showStandardNotation = input(false);
  readonly staffLineSpacing = input(8, { transform: numberAttribute });
  readonly showClef = input(true);
  readonly clef = input<'treble' | 'bass'>('treble');
  readonly autoCalculateNotes = input(true); // Auto-calculate note names from fret positions

  readonly noteClick = output<{ measure: number; beat: number; note: TabNote }>();
  readonly measureClick = output<number>();

  protected readonly stringSpacing = computed(() => {
    const variant = this.variant();
    return variant === 'minimal' ? 14 : 18;
  });

  protected readonly measureWidth = computed(() => {
    const totalWidth = this.width();
    const labelWidth = this.showStringLabels() ? 30 : 0;
    const measures = this.measures();
    if (measures.length === 0) return totalWidth - labelWidth;

    return (totalWidth - labelWidth - 20) / Math.max(1, measures.length);
  });

  protected readonly tabHeight = computed(() => {
    const strings = this.stringCount();
    const spacing = this.stringSpacing();
    const padding = 40;
    return (strings - 1) * spacing + padding;
  });

  protected readonly staffHeight = computed(() => {
    if (!this.showStandardNotation()) return 0;
    const spacing = this.staffLineSpacing();
    return spacing * 8; // 5 lines + ledger lines space
  });

  protected readonly height = computed(() => {
    return this.tabHeight() + this.staffHeight();
  });

  protected readonly staffTop = computed(() => {
    return 15; // Top padding for staff
  });

  protected readonly tabTop = computed(() => {
    if (!this.showStandardNotation()) return 20;
    return this.staffTop() + this.staffHeight() + 10;
  });

  protected readonly colors = computed(() => {
    const variant = this.variant();
    switch (variant) {
      case 'dark': {
        return {
          background: '#1E293B',
          // String / staff lines carry the fret numbers' string: slate-600 was ~1.9:1
          line: '#64748B',
          text: '#F1F5F9',
          // Fret numbers: blue-500 was ~4.0:1 on the slate-800 background
          note: '#60A5FA',
          technique: '#F59E0B',
          barLine: '#64748B',
        };
      }
      case 'minimal': {
        // Drawn on the page's own background: the text, notes and techniques use currentColor,
        // set by the container (notes) and minimalRoleClasses (text, techniques) to the former
        // fixed colours in light mode and lighter shades on a dark page, where the fixed dark
        // colours were unreadable
        return {
          background: 'transparent',
          line: '#CBD5E1',
          text: 'currentColor',
          note: 'currentColor',
          technique: 'currentColor',
          barLine: '#94A3B8',
        };
      }
      case 'printed': {
        return {
          background: '#FFFFF8',
          line: '#000000',
          text: '#000000',
          note: '#000000',
          technique: '#000000',
          barLine: '#000000',
        };
      }
      default: {
        return {
          background: '#FFFFFF',
          line: '#64748B',
          text: '#1E293B',
          note: '#1E293B',
          technique: '#7C3AED',
          barLine: '#334155',
        };
      }
    }
  });

  /** Colour classes for the minimal variant's text and technique marks (drawn in currentColor) */
  protected readonly minimalRoleClasses = computed(() =>
    this.variant() === 'minimal'
      ? {
          text: 'text-[#475569] dark:text-slate-400',
          // indigo-500 was ~4.5:1 (just under) on white at 10px
          technique: 'text-[#4F46E5] dark:text-indigo-400',
        }
      : { text: '', technique: '' }
  );

  protected readonly containerClasses = computed(() => {
    const base = 'rounded-lg overflow-x-auto';
    const variantClasses: Record<TablatureVariant, string> = {
      default: 'bg-white border border-slate-200 shadow-sm',
      dark: 'bg-slate-800 border border-slate-700',
      minimal: 'bg-transparent text-[#334155] dark:text-slate-200',
      printed: 'bg-[#FFFFF8] border border-slate-200',
    };
    return this.twClass.merge(base, variantClasses[this.variant()], this.classOverride());
  });

  protected readonly stringLabels = computed(() => {
    const count = this.stringCount();
    if (count === 6) return ['e', 'B', 'G', 'D', 'A', 'E'];
    if (count === 4) return ['G', 'D', 'A', 'E'];
    if (count === 5) return ['G', 'D', 'A', 'E', 'B'];
    return Array.from({ length: count }, (_, i) => `${i + 1}`);
  });

  protected readonly strings = computed(() => {
    return Array.from({ length: this.stringCount() }, (_, i) => i + 1);
  });

  protected getStringY(stringNum: number): number {
    const spacing = this.stringSpacing();
    return this.tabTop() + (stringNum - 1) * spacing;
  }

  protected getStaffLineY(lineNum: number): number {
    const spacing = this.staffLineSpacing();
    return this.staffTop() + spacing * 2 + (lineNum - 1) * spacing;
  }

  protected readonly staffLines = computed(() => [1, 2, 3, 4, 5]);

  protected getMeasureX(measureIndex: number): number {
    const labelWidth = this.showStringLabels() ? 30 : 0;
    const measureW = this.measureWidth();
    return labelWidth + measureIndex * measureW;
  }

  // Note positions in a measure: at least beatsPerMeasure, more if the measure supplies more
  // (e.g. eighth-note positions)
  protected getBeatPositions(measure: TabMeasure): number[] {
    const count = Math.max(this.beatsPerMeasure(), measure.notes?.length ?? 0);
    return Array.from({ length: count }, (_, i) => i);
  }

  protected getBeatX(measureIndex: number, beatIndex: number): number {
    const measureX = this.getMeasureX(measureIndex);
    const measureW = this.measureWidth();
    const measure = this.measures()[measureIndex];
    const beats = measure ? this.getBeatPositions(measure).length : this.beatsPerMeasure();
    const beatWidth = measureW / (beats + 1);
    return measureX + beatWidth * (beatIndex + 1);
  }

  protected getNoteAtBeat(measure: TabMeasure, beatIndex: number): TabNote[] {
    if (!measure.notes || beatIndex >= measure.notes.length) {
      return [];
    }
    return measure.notes[beatIndex] || [];
  }

  protected getTechniqueSymbol(technique?: TablatureTechnique): string {
    if (!technique) return '';
    return TECHNIQUE_SYMBOLS[technique] || '';
  }

  protected onNoteClick(measureIndex: number, beatIndex: number, note: TabNote): void {
    if (!this.interactive()) return;
    this.noteClick.emit({ measure: measureIndex, beat: beatIndex, note });
  }

  protected onMeasureClick(measureIndex: number): void {
    if (!this.interactive()) return;
    this.measureClick.emit(measureIndex);
  }

  // Enter/Space on a focused note or measure target: the keyboard equivalent of a click
  protected activateNote(
    event: Event,
    measureIndex: number,
    beatIndex: number,
    note: TabNote
  ): void {
    if (!this.interactive()) return;
    event.preventDefault();
    event.stopPropagation();
    this.onNoteClick(measureIndex, beatIndex, note);
  }

  protected activateMeasure(event: Event, measureIndex: number): void {
    if (!this.interactive()) return;
    event.preventDefault();
    this.onMeasureClick(measureIndex);
  }

  protected getNoteLabel(measureIndex: number, beatIndex: number, note: TabNote): string {
    const fret =
      typeof note.fret === 'string' && note.fret.toLowerCase() === 'x'
        ? 'muted'
        : `fret ${note.fret}`;
    const technique = note.technique ? `, ${note.technique}` : '';
    return `Measure ${measureIndex + 1}, beat ${beatIndex + 1}, string ${note.string}, ${fret}${technique}`;
  }

  /**
   * Staff notes for fretted tab notes, indexed [measure][beat][note]. The staff has no key
   * signature, so written accidentals follow standard notation in C major: a sharp carries
   * through the rest of the measure and a later unaltered note on that line gets a natural.
   */
  protected readonly calculatedNotes = computed(() =>
    this.measures().map(measure => {
      const accidentals = createAccidentalContext('C');
      return (measure.notes ?? []).map(beatNotes =>
        (beatNotes ?? []).map(
          (tabNote): { note: NoteName; octave: number; accidental: NoteAccidental } | null => {
            const calculated = this.calculateNoteFromFret(tabNote.string, tabNote.fret);
            if (!calculated) return null;
            const alteration = calculated.accidental === 'sharp' ? 1 : 0;
            return {
              ...calculated,
              accidental: accidentals.spell(calculated.note, calculated.octave, alteration),
            };
          }
        )
      );
    })
  );

  // Calculate note from fret position
  protected calculateNoteFromFret(
    stringNum: number,
    fret: number | string
  ): { note: NoteName; octave: number; accidental: 'sharp' | null } | null {
    if (typeof fret === 'string' || fret < 0) return null;

    const count = this.stringCount();
    const tuning = count === 4 ? BASS_TUNING : count === 5 ? BASS_5_TUNING : GUITAR_TUNING;
    if (stringNum < 1 || stringNum > tuning.length) return null;

    const openNote = tuning[stringNum - 1];

    // Calculate semitones from open string
    const openNoteIndex = this.getNoteIndex(openNote.note);
    const totalSemitones = openNoteIndex + fret;

    const noteIndex = totalSemitones % 12;
    const octaveOffset = Math.floor(totalSemitones / 12);

    return {
      note: CHROMATIC_NOTES[noteIndex],
      octave: openNote.octave + octaveOffset,
      accidental: CHROMATIC_ACCIDENTALS[noteIndex],
    };
  }

  private getNoteIndex(note: NoteName): number {
    const indices: Record<NoteName, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };
    return indices[note];
  }

  // Get note Y position on staff
  protected getNoteYOnStaff(note: NoteName, octave: number): number {
    const spacing = this.staffLineSpacing();
    const staffTop = this.staffTop() + spacing * 2;

    // Treble clef: E4 is on bottom line (line 5)
    // Each step (C, D, E, F, G, A, B) moves half a space
    const notePosition = NOTE_ORDER.indexOf(note);

    // Calculate position relative to middle of staff (line 3):
    // treble clef = B4, bass clef = D3
    const isBass = this.clef() === 'bass';
    const refPosition = NOTE_ORDER.indexOf(isBass ? 'D' : 'B');
    const refOctave = isBass ? 3 : 4;

    const octaveDiff = octave - refOctave;
    const noteDiff = notePosition - refPosition;
    const totalSteps = octaveDiff * 7 + noteDiff;

    // Line 3 is at staffTop + spacing * 2
    // Each step moves half a spacing
    return staffTop + spacing * 2 - (totalSteps * spacing) / 2;
  }

  // Check if note needs ledger lines
  protected getLedgerLinesForNote(y: number): number[] {
    const spacing = this.staffLineSpacing();
    const topLine = this.getStaffLineY(1);
    const bottomLine = this.getStaffLineY(5);
    const lines: number[] = [];
    // Tolerance for floating point drift; a note in the space beyond a ledger line must not
    // get an extra ledger line of its own
    const epsilon = spacing / 4;

    // Above staff
    for (let lineY = topLine - spacing; lineY >= y - epsilon; lineY -= spacing) {
      lines.push(lineY);
    }

    // Below staff
    for (let lineY = bottomLine + spacing; lineY <= y + epsilon; lineY += spacing) {
      lines.push(lineY);
    }

    return lines;
  }

  // Get note duration symbol
  protected getNoteDuration(note: TabNote): NoteDuration {
    if (note.noteDuration) return note.noteDuration;

    // Map beat duration to note type
    const duration = note.duration ?? 1;
    if (duration >= 4) return 'whole';
    if (duration >= 2) return 'half';
    if (duration >= 1) return 'quarter';
    if (duration >= 0.5) return 'eighth';
    return 'sixteenth';
  }

  // Check if note head should be filled
  protected isNoteHeadFilled(duration: NoteDuration): boolean {
    return duration !== 'whole' && duration !== 'half';
  }

  // Get flag count for note
  protected getFlagCount(duration: NoteDuration): number {
    if (duration === 'eighth') return 1;
    if (duration === 'sixteenth') return 2;
    return 0;
  }
}

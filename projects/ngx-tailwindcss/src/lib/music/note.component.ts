import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { type ClefType, getKeySignatureAlteration, type KeySignature } from './staff.component';

export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond';
export type NoteAccidental = 'sharp' | 'flat' | 'natural' | 'doubleSharp' | 'doubleFlat' | null;
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type StemDirection = 'up' | 'down' | 'auto';
export type BeamPosition = 'start' | 'middle' | 'end' | 'single' | null;
export type TupletPosition = 'start' | 'middle' | 'end' | null;

export interface TupletConfig {
  ratio: [number, number]; // e.g., [3, 2] for triplet (3 notes in time of 2)
  position: TupletPosition;
  showBracket?: boolean;
  showNumber?: boolean;
  bracketDirection?: 'up' | 'down' | 'auto';
}

export interface BeamConfig {
  position: BeamPosition;
  beamY: number; // Y position of the primary beam
  beamAngle?: number; // Angle in degrees for slanted beams
  beamLevels?: number; // Number of beam levels (1 for 8th, 2 for 16th, etc.)
  breakSecondary?: boolean; // Break secondary beams for rhythmic clarity
}

export interface NoteData {
  name: NoteName;
  octave: number;
  duration: NoteDuration;
  /**
   * The accidental *written* in front of the note, following standard notation: when absent
   * (null/undefined) the note takes its pitch from the key signature and from any accidental
   * written earlier in the same measure on the same staff position (letter + octave). E.g. in
   * G major an F with no accidental sounds F#; write `'natural'` for F natural.
   * Rendering, playback/export (MIDI, MusicXML `<alter>`) and transposition all resolve
   * pitches this way; use {@link createAccidentalContext} to do the same.
   */
  accidental?: NoteAccidental;
  /** A rest of `duration`; name/octave only set where it is drawn, accidental is ignored */
  isRest?: boolean;
  dotted?: boolean;
  doubleDotted?: boolean;
  tied?: boolean;
  stemDirection?: StemDirection;
  tuplet?: TupletConfig;
  beam?: BeamConfig;
}

/** Note name/octave on the middle staff line of each clef (where rests are drawn) */
export const CLEF_MIDDLE_LINE_NOTE: Record<ClefType, { name: NoteName; octave: number }> = {
  treble: { name: 'B', octave: 4 },
  bass: { name: 'D', octave: 3 },
  alto: { name: 'C', octave: 4 },
  tenor: { name: 'A', octave: 3 },
  percussion: { name: 'B', octave: 4 },
};

/** Semitone alteration of each written accidental */
export const ACCIDENTAL_ALTERATION: Record<Exclude<NoteAccidental, null>, number> = {
  sharp: 1,
  flat: -1,
  natural: 0,
  doubleSharp: 2,
  doubleFlat: -2,
};

/**
 * Resolves written accidentals (see {@link NoteData.accidental}) to sounding alterations for
 * one staff. Feed it the notes of each measure in time order and call `nextMeasure()` at
 * every bar line.
 */
export interface AccidentalContext {
  /**
   * Sounding alteration in semitones (-2..2) of a written note. An explicit accidental is
   * remembered for the rest of the measure. Rests resolve to 0 and change nothing.
   */
  resolve(note: Pick<NoteData, 'name' | 'octave' | 'accidental' | 'isRest'>): number;
  /**
   * The accidental to write for a note that should sound with `alteration`: null when the
   * key signature / earlier accidentals already imply it. The result is remembered like
   * `resolve()` does.
   */
  spell(name: NoteName, octave: number, alteration: number): NoteAccidental;
  /** Start a new measure (accidentals from the previous one no longer apply) */
  nextMeasure(): void;
}

/** Written accidental for a semitone alteration (-2..2) */
export const ACCIDENTAL_FOR_ALTERATION: Record<number, Exclude<NoteAccidental, null>> = {
  [-2]: 'doubleFlat',
  [-1]: 'flat',
  0: 'natural',
  1: 'sharp',
  2: 'doubleSharp',
};

export function createAccidentalContext(keySignature: KeySignature): AccidentalContext {
  const measureAccidentals = new Map<string, number>();
  const implied = (name: NoteName, octave: number): number =>
    measureAccidentals.get(`${name}${octave}`) ?? getKeySignatureAlteration(keySignature, name);

  return {
    resolve(note) {
      if (note.isRest) return 0;
      if (note.accidental) {
        const alteration = ACCIDENTAL_ALTERATION[note.accidental];
        measureAccidentals.set(`${note.name}${note.octave}`, alteration);
        return alteration;
      }
      return implied(note.name, note.octave);
    },
    spell(name, octave, alteration) {
      if (implied(name, octave) === alteration) return null;
      measureAccidentals.set(`${name}${octave}`, alteration);
      return ACCIDENTAL_FOR_ALTERATION[alteration] ?? null;
    },
    nextMeasure() {
      measureAccidentals.clear();
    },
  };
}

const NATURAL_PITCH_CLASS: Record<NoteName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const SHARP_SPELLINGS: Array<[NoteName, number]> = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
];
const FLAT_SPELLINGS: Array<[NoteName, number]> = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
];

/**
 * Spell a MIDI pitch as a letter, octave and sounding alteration. The key signature's own
 * letters are used when the pitch belongs to the key (F# in G major, Cb in Gb major);
 * otherwise `preferFlats` (default: whether the key has flats) chooses sharps or flats.
 */
export function spellMidiPitch(
  midi: number,
  keySignature: KeySignature = 'C',
  preferFlats?: boolean
): { name: NoteName; octave: number; alteration: number } {
  const pitchClass = ((midi % 12) + 12) % 12;
  const names = Object.keys(NATURAL_PITCH_CLASS) as NoteName[];
  const keyLetter = names.find(
    n =>
      (((NATURAL_PITCH_CLASS[n] + getKeySignatureAlteration(keySignature, n)) % 12) + 12) % 12 ===
      pitchClass
  );
  const useFlats = preferFlats ?? names.some(n => getKeySignatureAlteration(keySignature, n) < 0);
  const [name, alteration] = keyLetter
    ? [keyLetter, getKeySignatureAlteration(keySignature, keyLetter)]
    : (useFlats ? FLAT_SPELLINGS : SHARP_SPELLINGS)[pitchClass];
  // Octave of the written letter (Cb5 sounds as B4, B#3 as C4)
  const octave = Math.floor((midi - NATURAL_PITCH_CLASS[name] - alteration) / 12) - 1;
  return { name, octave, alteration };
}

// Unicode musical symbols
const NOTE_SYMBOLS = {
  whole: '𝅝',
  half: '𝅗𝅥',
  quarter: '𝅘𝅥',
  eighth: '𝅘𝅥𝅮',
  sixteenth: '𝅘𝅥𝅯',
  thirtysecond: '𝅘𝅥𝅰',
};

const REST_SYMBOLS = {
  whole: '𝄻',
  half: '𝄼',
  quarter: '𝄽',
  eighth: '𝄾',
  sixteenth: '𝄿',
  thirtysecond: '𝅀',
};

const ACCIDENTAL_SYMBOLS = {
  sharp: '♯',
  flat: '♭',
  natural: '♮',
  doubleSharp: '𝄪',
  doubleFlat: '𝄫',
};

// Staff line positions (0 = middle C on treble staff)
// Treble: E4=0, F4=0.5, G4=1, A4=1.5, B4=2, C5=2.5, D5=3, E5=3.5, F5=4
const NOTE_POSITIONS: Record<NoteName, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

// Diatonic steps to add so that the clef's bottom-line note lands on position 0
// (treble: E4, bass: G2, alto: F3, tenor: D3)
const CLEF_POSITION_OFFSETS: Record<ClefType, number> = {
  treble: 0,
  bass: 12,
  alto: 6,
  tenor: 8,
  percussion: 0,
};

@Component({
  // Inside an <svg> (e.g. projected into tw-staff) use the attribute form on an SVG group,
  // <svg:g twNote ...>: an unknown <tw-note> element there is not rendered by browsers.
  selector: 'tw-note, g[twNote]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './note.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
})
export class TwNoteComponent {
  private readonly twClass = inject(TwClassService);

  // Note properties
  readonly name = input<NoteName>('C');
  readonly octave = input(4, { transform: numberAttribute });
  readonly duration = input<NoteDuration>('quarter');
  readonly accidental = input<NoteAccidental>(null);
  readonly dotted = input(false);
  readonly doubleDotted = input(false);
  readonly isRest = input(false);
  readonly clef = input<ClefType>('treble');

  // Display options
  readonly stemDirection = input<StemDirection>('auto');
  readonly beamed = input(false); // Part of a beamed group
  readonly beamPosition = input<BeamPosition>(null);
  readonly beamConfig = input<BeamConfig | null>(null);
  readonly tied = input(false);
  readonly tieDirection = input<'start' | 'end' | null>(null);
  readonly highlighted = input(false);
  readonly color = input<string>('#1E293B');
  readonly highlightColor = input<string>('#3B82F6');
  /**
   * Draw a ring around the note while its host is keyboard-focused. For a host the parent
   * makes focusable (tabindex) and marks with the Tailwind `group/note` class.
   */
  readonly focusRing = input(false);
  readonly size = input(24, { transform: numberAttribute }); // Note head size
  readonly lineSpacing = input(10, { transform: numberAttribute });

  // Tuplet options
  readonly tuplet = input<TupletConfig | null>(null);
  readonly tupletNumber = input<number | null>(null); // Shorthand for simple tuplets (3 = triplet)

  // Position (usually set by parent staff/measure)
  readonly x = input(0, { transform: numberAttribute });
  readonly staffTop = input(40, { transform: numberAttribute }); // Y position of top staff line

  readonly classOverride = input('');

  protected readonly noteSymbol = computed(() => {
    if (this.isRest()) {
      return REST_SYMBOLS[this.duration()];
    }
    return NOTE_SYMBOLS[this.duration()];
  });

  protected readonly accidentalSymbol = computed(() => {
    const acc = this.accidental();
    if (!acc) return null;
    return ACCIDENTAL_SYMBOLS[acc];
  });

  // Calculate Y position based on note name and octave
  protected readonly yPosition = computed(() => {
    const name = this.name();
    const octave = this.octave();
    const staffTop = this.staffTop();
    const spacing = this.lineSpacing();

    // Middle C (C4) is at position -2 below the treble staff (ledger line)
    // E4 is on the bottom line of treble staff (position 0)
    const basePosition = NOTE_POSITIONS[name];
    const octaveOffset = (octave - 4) * 7; // 7 positions per octave

    // Position 0 = E4 (bottom line), positive = up, negative = down
    // Treble staff: E4=0, G4=2, B4=4 (lines), F4=1, A4=3, C5=5, D5=6, E5=7 (top line)
    const position = basePosition + octaveOffset - 2 + CLEF_POSITION_OFFSETS[this.clef()]; // Adjust so E4 = 0

    // Y increases downward, so higher positions = lower Y
    return staffTop + (4 - position / 2) * spacing;
  });

  protected readonly computedStemDirection = computed(() => {
    const direction = this.stemDirection();
    if (direction !== 'auto') return direction;

    // Auto: stem up if note is below middle line (B4), down if above
    const y = this.yPosition();
    const staffTop = this.staffTop();
    const spacing = this.lineSpacing();
    const middleLineY = staffTop + spacing * 2; // Middle line of staff

    return y > middleLineY ? 'up' : 'down';
  });

  protected readonly needsLedgerLines = computed(() => {
    const y = this.yPosition();
    const staffTop = this.staffTop();
    const spacing = this.lineSpacing();
    const bottomLine = staffTop + spacing * 4;

    const lines: number[] = [];
    // Tolerance for floating point drift when stepping by line spacing
    const epsilon = spacing / 4;

    // Lines above staff (A5 and higher in treble clef)
    for (let lineY = staffTop - spacing; lineY >= y - epsilon; lineY -= spacing) {
      lines.push(lineY);
    }

    // Lines below staff (C4 and lower in treble clef)
    for (let lineY = bottomLine + spacing; lineY <= y + epsilon; lineY += spacing) {
      lines.push(lineY);
    }

    return lines;
  });

  protected readonly stemLength = computed(() => {
    const duration = this.duration();
    const spacing = this.lineSpacing();

    // Whole notes have no stem
    if (duration === 'whole') return 0;

    return spacing * 3.5;
  });

  protected readonly stemX = computed(() => {
    const x = this.x();
    const size = this.size();
    const direction = this.computedStemDirection();

    // Stem is on right side for up, left side for down
    return direction === 'up' ? x + size * 0.4 : x - size * 0.4;
  });

  protected readonly stemY1 = computed(() => {
    const y = this.yPosition();
    return y;
  });

  protected readonly stemY2 = computed(() => {
    const y = this.yPosition();
    const length = this.stemLength();
    const direction = this.computedStemDirection();

    return direction === 'up' ? y - length : y + length;
  });

  protected readonly flagCount = computed(() => {
    const duration = this.duration();
    switch (duration) {
      case 'eighth': {
        return 1;
      }
      case 'sixteenth': {
        return 2;
      }
      case 'thirtysecond': {
        return 3;
      }
      default: {
        return 0;
      }
    }
  });

  protected readonly noteColor = computed(() => {
    return this.highlighted() ? this.highlightColor() : this.color();
  });

  protected readonly noteHeadFill = computed(() => {
    const duration = this.duration();
    // Whole and half notes have hollow note heads
    if (duration === 'whole' || duration === 'half') {
      return 'none';
    }
    return this.noteColor();
  });

  protected readonly containerClasses = computed(() => {
    const base = 'relative';
    return this.twClass.merge(base, this.classOverride());
  });

  // Helper to get dot positions
  protected readonly dotPositions = computed(() => {
    const dots: number[] = [];
    const x = this.x();
    const size = this.size();

    // A double-dotted note may also have `dotted` set; draw each dot only once
    if (this.dotted() || this.doubleDotted()) {
      dots.push(x + size * 0.7);
    }
    if (this.doubleDotted()) {
      dots.push(x + size);
    }
    return dots;
  });

  // Tuplet computed values
  protected readonly effectiveTuplet = computed((): TupletConfig | null => {
    const tupletConfig = this.tuplet();
    if (tupletConfig) return tupletConfig;

    // Handle shorthand tupletNumber
    const num = this.tupletNumber();
    if (num) {
      return {
        ratio: [num, num === 3 ? 2 : num - 1] as [number, number], // 3:2 for triplet, etc.
        position: 'middle',
        showBracket: true,
        showNumber: true,
        bracketDirection: 'auto',
      };
    }

    return null;
  });

  protected readonly tupletBracketDirection = computed(() => {
    const tuplet = this.effectiveTuplet();
    if (!tuplet) return 'up';

    if (tuplet.bracketDirection && tuplet.bracketDirection !== 'auto') {
      return tuplet.bracketDirection;
    }

    // Auto: opposite of stem direction
    return this.computedStemDirection() === 'up' ? 'down' : 'up';
  });

  protected readonly tupletBracketY = computed(() => {
    const direction = this.tupletBracketDirection();
    const stemY2 = this.stemY2();
    const y = this.yPosition();
    const size = this.size();

    if (direction === 'up') {
      return Math.min(stemY2, y) - size * 1.2;
    }
    return Math.max(stemY2, y) + size * 1.2;
  });

  // Beam computed values
  protected readonly effectiveBeamConfig = computed((): BeamConfig | null => {
    const config = this.beamConfig();
    if (config) return config;

    // Create default config from beamPosition
    const position = this.beamPosition();
    if (!position || !this.beamed()) return null;

    return {
      position,
      beamY: this.stemY2(),
      beamAngle: 0,
      beamLevels: this.getBeamLevels(),
      breakSecondary: false,
    };
  });

  protected readonly beamLevels = computed(() => {
    const config = this.effectiveBeamConfig();
    if (config?.beamLevels !== undefined) return config.beamLevels;
    return this.getBeamLevels();
  });

  private getBeamLevels(): number {
    const duration = this.duration();
    switch (duration) {
      case 'eighth': {
        return 1;
      }
      case 'sixteenth': {
        return 2;
      }
      case 'thirtysecond': {
        return 3;
      }
      default: {
        return 0;
      }
    }
  }

  protected readonly beamY = computed(() => {
    const config = this.effectiveBeamConfig();
    return config?.beamY ?? this.stemY2();
  });

  // Generate beam paths for this note
  protected readonly beamPaths = computed(() => {
    const config = this.effectiveBeamConfig();
    if (!config || !this.beamed()) return [];

    const paths: Array<{ d: string; level: number }> = [];
    const x = this.stemX();
    const beamY = this.beamY();
    const size = this.size();
    const levels = this.beamLevels();
    const direction = this.computedStemDirection();
    const { position } = config;

    // Beam thickness and spacing
    const beamThickness = size * 0.25;
    const beamSpacing = size * 0.35;

    for (let level = 0; level < levels; level++) {
      const yOffset = direction === 'up' ? level * beamSpacing : -level * beamSpacing;

      const y = beamY + yOffset;

      // Determine beam extension based on position
      let beamPath = '';
      const beamLength = size * 1.5; // Length to next note

      switch (position) {
        case 'start': {
          // Beam extends to the right
          beamPath = `M ${x} ${y} h ${beamLength} v ${beamThickness} h -${beamLength} Z`;
          break;
        }
        case 'middle': {
          // Beam extends both directions (connects to neighbors)
          beamPath = `M ${x - beamLength / 2} ${y} h ${beamLength} v ${beamThickness} h -${beamLength} Z`;
          break;
        }
        case 'end': {
          // Beam extends to the left
          beamPath = `M ${x - beamLength} ${y} h ${beamLength} v ${beamThickness} h -${beamLength} Z`;
          break;
        }
        case 'single': {
          // Partial beam (for single note in mixed group)
          const partialLength = size * 0.8;
          beamPath = `M ${x} ${y} h ${partialLength} v ${beamThickness} h -${partialLength} Z`;
          break;
        }
      }

      if (beamPath) {
        paths.push({ d: beamPath, level });
      }
    }

    return paths;
  });

  // Check if this note should show tuplet bracket start
  protected readonly showTupletBracketStart = computed(() => {
    const tuplet = this.effectiveTuplet();
    return tuplet?.position === 'start' && tuplet?.showBracket !== false;
  });

  // Check if this note should show tuplet number
  protected readonly showTupletNumber = computed(() => {
    const tuplet = this.effectiveTuplet();
    if (!tuplet || tuplet.showNumber === false) return false;

    // Show number at the middle of the tuplet group, or on single notes
    return tuplet.position === 'middle' || tuplet.position === 'start';
  });

  protected readonly tupletDisplayNumber = computed(() => {
    const tuplet = this.effectiveTuplet();
    return tuplet?.ratio[0] ?? 3;
  });
}

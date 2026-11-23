import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type PianoChordVariant = 'default' | 'minimal' | 'dark' | 'colorful';
export type PianoChordSize = 'sm' | 'md' | 'lg';

export interface PianoChordNote {
  note: string; // C, C#, D, etc.
  octave: number;
  finger?: number; // 1-5 (thumb to pinky)
  isRoot?: boolean; // Mark the root note
}

export interface PianoChordDefinition {
  name: string; // e.g., "C", "Am", "G7", "Dm/F"
  notes: PianoChordNote[];
  inversion?: number; // 0 = root, 1 = first, 2 = second
  type?:
    | 'major'
    | 'minor'
    | 'diminished'
    | 'augmented'
    | '7th'
    | 'maj7'
    | 'min7'
    | 'sus4'
    | 'sus2'
    | 'add9';
}

// Piano chord definitions
export const PIANO_CHORDS: Record<string, PianoChordDefinition> = {
  // Major chords
  C: {
    name: 'C',
    type: 'major',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'E', octave: 4, finger: 3 },
      { note: 'G', octave: 4, finger: 5 },
    ],
  },
  D: {
    name: 'D',
    type: 'major',
    notes: [
      { note: 'D', octave: 4, finger: 1, isRoot: true },
      { note: 'F#', octave: 4, finger: 3 },
      { note: 'A', octave: 4, finger: 5 },
    ],
  },
  E: {
    name: 'E',
    type: 'major',
    notes: [
      { note: 'E', octave: 4, finger: 1, isRoot: true },
      { note: 'G#', octave: 4, finger: 3 },
      { note: 'B', octave: 4, finger: 5 },
    ],
  },
  F: {
    name: 'F',
    type: 'major',
    notes: [
      { note: 'F', octave: 4, finger: 1, isRoot: true },
      { note: 'A', octave: 4, finger: 3 },
      { note: 'C', octave: 5, finger: 5 },
    ],
  },
  G: {
    name: 'G',
    type: 'major',
    notes: [
      { note: 'G', octave: 4, finger: 1, isRoot: true },
      { note: 'B', octave: 4, finger: 3 },
      { note: 'D', octave: 5, finger: 5 },
    ],
  },
  A: {
    name: 'A',
    type: 'major',
    notes: [
      { note: 'A', octave: 4, finger: 1, isRoot: true },
      { note: 'C#', octave: 5, finger: 3 },
      { note: 'E', octave: 5, finger: 5 },
    ],
  },
  B: {
    name: 'B',
    type: 'major',
    notes: [
      { note: 'B', octave: 4, finger: 1, isRoot: true },
      { note: 'D#', octave: 5, finger: 3 },
      { note: 'F#', octave: 5, finger: 5 },
    ],
  },
  // Minor chords
  Cm: {
    name: 'Cm',
    type: 'minor',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'Eb', octave: 4, finger: 3 },
      { note: 'G', octave: 4, finger: 5 },
    ],
  },
  Dm: {
    name: 'Dm',
    type: 'minor',
    notes: [
      { note: 'D', octave: 4, finger: 1, isRoot: true },
      { note: 'F', octave: 4, finger: 3 },
      { note: 'A', octave: 4, finger: 5 },
    ],
  },
  Em: {
    name: 'Em',
    type: 'minor',
    notes: [
      { note: 'E', octave: 4, finger: 1, isRoot: true },
      { note: 'G', octave: 4, finger: 3 },
      { note: 'B', octave: 4, finger: 5 },
    ],
  },
  Fm: {
    name: 'Fm',
    type: 'minor',
    notes: [
      { note: 'F', octave: 4, finger: 1, isRoot: true },
      { note: 'Ab', octave: 4, finger: 3 },
      { note: 'C', octave: 5, finger: 5 },
    ],
  },
  Gm: {
    name: 'Gm',
    type: 'minor',
    notes: [
      { note: 'G', octave: 4, finger: 1, isRoot: true },
      { note: 'Bb', octave: 4, finger: 3 },
      { note: 'D', octave: 5, finger: 5 },
    ],
  },
  Am: {
    name: 'Am',
    type: 'minor',
    notes: [
      { note: 'A', octave: 4, finger: 1, isRoot: true },
      { note: 'C', octave: 5, finger: 3 },
      { note: 'E', octave: 5, finger: 5 },
    ],
  },
  Bm: {
    name: 'Bm',
    type: 'minor',
    notes: [
      { note: 'B', octave: 4, finger: 1, isRoot: true },
      { note: 'D', octave: 5, finger: 3 },
      { note: 'F#', octave: 5, finger: 5 },
    ],
  },
  // Seventh chords
  C7: {
    name: 'C7',
    type: '7th',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'E', octave: 4, finger: 2 },
      { note: 'G', octave: 4, finger: 3 },
      { note: 'Bb', octave: 4, finger: 5 },
    ],
  },
  G7: {
    name: 'G7',
    type: '7th',
    notes: [
      { note: 'G', octave: 4, finger: 1, isRoot: true },
      { note: 'B', octave: 4, finger: 2 },
      { note: 'D', octave: 5, finger: 3 },
      { note: 'F', octave: 5, finger: 5 },
    ],
  },
  D7: {
    name: 'D7',
    type: '7th',
    notes: [
      { note: 'D', octave: 4, finger: 1, isRoot: true },
      { note: 'F#', octave: 4, finger: 2 },
      { note: 'A', octave: 4, finger: 3 },
      { note: 'C', octave: 5, finger: 5 },
    ],
  },
  // Major 7th
  Cmaj7: {
    name: 'Cmaj7',
    type: 'maj7',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'E', octave: 4, finger: 2 },
      { note: 'G', octave: 4, finger: 3 },
      { note: 'B', octave: 4, finger: 5 },
    ],
  },
  // Minor 7th
  Am7: {
    name: 'Am7',
    type: 'min7',
    notes: [
      { note: 'A', octave: 4, finger: 1, isRoot: true },
      { note: 'C', octave: 5, finger: 2 },
      { note: 'E', octave: 5, finger: 3 },
      { note: 'G', octave: 5, finger: 5 },
    ],
  },
  // Diminished
  Bdim: {
    name: 'B°',
    type: 'diminished',
    notes: [
      { note: 'B', octave: 4, finger: 1, isRoot: true },
      { note: 'D', octave: 5, finger: 3 },
      { note: 'F', octave: 5, finger: 5 },
    ],
  },
  // Augmented
  Caug: {
    name: 'C+',
    type: 'augmented',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'E', octave: 4, finger: 3 },
      { note: 'G#', octave: 4, finger: 5 },
    ],
  },
  // Sus chords
  Csus4: {
    name: 'Csus4',
    type: 'sus4',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'F', octave: 4, finger: 3 },
      { note: 'G', octave: 4, finger: 5 },
    ],
  },
  Csus2: {
    name: 'Csus2',
    type: 'sus2',
    notes: [
      { note: 'C', octave: 4, finger: 1, isRoot: true },
      { note: 'D', octave: 4, finger: 2 },
      { note: 'G', octave: 4, finger: 5 },
    ],
  },
};

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAL_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Map any spelling (C#, Db, E#, Cb, ...) to the keyboard key it is played on
function toKey(note: string, octave: number): { note: string; octave: number } {
  const match = /^([A-G])(#|b)?$/.exec(note);
  if (!match) return { note, octave };
  const shift = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const semitone = NATURAL_SEMITONES[match[1]] + shift;
  return {
    note: ALL_NOTES[(semitone + 12) % 12],
    octave: octave + Math.floor(semitone / 12),
  };
}

/**
 * Piano Chord Diagram component
 *
 * @example
 * ```html
 * <tw-piano-chord chord="C"></tw-piano-chord>
 * <tw-piano-chord chord="Am7" [showFingerNumbers]="true"></tw-piano-chord>
 * <tw-piano-chord [customChord]="myChord"></tw-piano-chord>
 * ```
 */
@Component({
  selector: 'tw-piano-chord',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './piano-chord.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
})
export class TwPianoChordComponent {
  readonly chord = input<string | null>(null);
  readonly customChord = input<PianoChordDefinition | null>(null);
  readonly variant = input<PianoChordVariant>('default');
  readonly size = input<PianoChordSize>('md');
  readonly octaveCount = input(2, { transform: numberAttribute }); // Number of octaves to show
  readonly startOctave = input(4, { transform: numberAttribute }); // Starting octave
  readonly showChordName = input(true);
  readonly showFingerNumbers = input(true);
  readonly showNoteNames = input(false);
  readonly showKeyLabels = input(false); // Show C, D, E, etc. on white keys
  readonly highlightRoot = input(true);
  readonly classOverride = input('');

  protected readonly chordData = computed((): PianoChordDefinition | null => {
    const custom = this.customChord();
    if (custom) return custom;

    const chordName = this.chord();
    if (!chordName) return null;

    return PIANO_CHORDS[chordName] || null;
  });

  protected readonly displayName = computed(() => {
    return this.chordData()?.name || this.chord() || '';
  });

  protected readonly dimensions = computed(() => {
    const size = this.size();
    const octaves = this.octaveCount();

    const whiteKeyWidth = size === 'sm' ? 18 : size === 'lg' ? 30 : 24;
    const whiteKeyHeight = size === 'sm' ? 60 : size === 'lg' ? 100 : 80;
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = whiteKeyHeight * 0.6;
    const fingerRadius = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
    const padding = 8;

    const keysPerOctave = 7;
    const totalWhiteKeys = octaves * keysPerOctave;

    return {
      whiteKeyWidth,
      whiteKeyHeight,
      blackKeyWidth,
      blackKeyHeight,
      fingerRadius,
      padding,
      totalWidth: totalWhiteKeys * whiteKeyWidth + padding * 2,
      totalHeight: whiteKeyHeight + padding * 2 + (this.showChordName() ? 28 : 0),
    };
  });

  protected readonly colors = computed(() => {
    const variant = this.variant();
    switch (variant) {
      case 'dark': {
        return {
          background: '#1E293B',
          whiteKey: '#F8FAFC',
          whiteKeyActive: '#60A5FA',
          blackKey: '#1E293B',
          blackKeyActive: '#3B82F6',
          border: '#64748B',
          // White finger numbers need >= 4.5:1 on the circles: red-500 was ~3.8:1 and
          // amber-500 ~2.1:1
          fingerCircle: '#DC2626',
          fingerText: '#FFFFFF',
          rootCircle: '#B45309',
          text: '#F8FAFC',
          noteLabel: '#64748B',
        };
      }
      case 'minimal': {
        return {
          background: 'transparent',
          whiteKey: '#FFFFFF',
          whiteKeyActive: '#BFDBFE',
          blackKey: '#334155',
          blackKeyActive: '#1E40AF',
          border: '#CBD5E1',
          fingerCircle: '#1E40AF',
          fingerText: '#FFFFFF',
          rootCircle: '#DC2626',
          text: '#334155',
          // slate-400 was ~2.6:1 on the white keys
          noteLabel: '#64748B',
        };
      }
      case 'colorful': {
        return {
          background: '#FEFCE8',
          whiteKey: '#FFFBEB',
          whiteKeyActive: '#86EFAC',
          blackKey: '#1F2937',
          blackKeyActive: '#22C55E',
          border: '#FCD34D',
          // White finger numbers: violet-500 (~4.2:1) and pink-500 (~3.5:1) were too light
          fingerCircle: '#7C3AED',
          fingerText: '#FFFFFF',
          rootCircle: '#DB2777',
          text: '#1F2937',
          noteLabel: '#78716C',
        };
      }
      default: {
        return {
          background: '#FFFFFF',
          whiteKey: '#FFFFFF',
          whiteKeyActive: '#93C5FD',
          blackKey: '#1F2937',
          blackKeyActive: '#3B82F6',
          border: '#E5E7EB',
          fingerCircle: '#2563EB',
          fingerText: '#FFFFFF',
          rootCircle: '#DC2626',
          text: '#1F2937',
          noteLabel: '#6B7280',
        };
      }
    }
  });

  protected readonly containerClasses = computed(() => {
    const base = 'rounded-lg p-2';
    const variantClasses: Record<PianoChordVariant, string> = {
      default: 'bg-white border border-slate-200 shadow-sm',
      dark: 'bg-slate-800 border border-slate-700',
      minimal: 'bg-transparent',
      colorful: 'bg-amber-50 border border-amber-200',
    };
    return [base, variantClasses[this.variant()], this.classOverride()].filter(Boolean).join(' ');
  });

  protected readonly whiteKeys = computed(() => {
    const octaves = this.octaveCount();
    const startOct = this.startOctave();
    const keys: Array<{ note: string; octave: number; index: number }> = [];

    let index = 0;
    for (let o = 0; o < octaves; o++) {
      for (const note of WHITE_NOTES) {
        keys.push({ note, octave: startOct + o, index });
        index++;
      }
    }

    return keys;
  });

  protected readonly blackKeys = computed(() => {
    const octaves = this.octaveCount();
    const startOct = this.startOctave();
    const { whiteKeyWidth } = this.dimensions();
    const keys: Array<{ note: string; octave: number; position: number }> = [];

    // Centre of each black key, in white-key widths from the octave's C (C#, D#, F#, G#, A#).
    // Keys are 0.6 wide, so each straddles the boundary between its neighbouring white keys.
    const blackKeyPositions = [0.95, 2.05, 3.9, 5, 6.1];

    for (let o = 0; o < octaves; o++) {
      const octaveOffset = o * 7 * whiteKeyWidth;
      BLACK_NOTES.forEach((note, i) => {
        keys.push({
          note,
          octave: startOct + o,
          position: octaveOffset + blackKeyPositions[i] * whiteKeyWidth,
        });
      });
    }

    return keys;
  });

  /** Chord notes that fall on a key inside the visible octave range (others have no key to mark) */
  protected readonly visibleNotes = computed((): PianoChordNote[] => {
    const chord = this.chordData();
    if (!chord) return [];
    const first = this.startOctave();
    const last = first + this.octaveCount() - 1;
    return chord.notes.filter(n => {
      const { octave } = toKey(n.note, n.octave);
      return octave >= first && octave <= last;
    });
  });

  protected isNoteActive(note: string, octave: number): boolean {
    const chord = this.chordData();
    if (!chord) return false;

    const target = toKey(note, octave);
    return chord.notes.some(n => {
      const key = toKey(n.note, n.octave);
      return key.note === target.note && key.octave === target.octave;
    });
  }

  protected getNoteInfo(note: string, octave: number): PianoChordNote | null {
    const chord = this.chordData();
    if (!chord) return null;

    const target = toKey(note, octave);
    return (
      chord.notes.find(n => {
        const key = toKey(n.note, n.octave);
        return key.note === target.note && key.octave === target.octave;
      }) || null
    );
  }

  protected isBlackKey(note: string): boolean {
    return BLACK_NOTES.includes(toKey(note, 0).note);
  }

  protected getWhiteKeyX(index: number): number {
    const { whiteKeyWidth, padding } = this.dimensions();
    return padding + index * whiteKeyWidth;
  }

  protected getBlackKeyX(position: number): number {
    const { padding, blackKeyWidth } = this.dimensions();
    return padding + position - blackKeyWidth / 2;
  }

  protected getFingerY(isBlack: boolean): number {
    // SVG coordinates: the chord name is rendered above the SVG, not inside it
    const { whiteKeyHeight, blackKeyHeight, padding, fingerRadius } = this.dimensions();

    if (isBlack) {
      return padding + blackKeyHeight - fingerRadius - 4;
    }
    return padding + whiteKeyHeight - fingerRadius - 8;
  }

  protected getFingerX(rawNote: string, rawOctave: number): number {
    const { whiteKeyWidth, padding } = this.dimensions();
    const startOct = this.startOctave();
    const { note, octave } = toKey(rawNote, rawOctave);

    if (this.isBlackKey(note)) {
      // Find the black key
      const blackKey = this.blackKeys().find(k => k.note === note && k.octave === octave);
      if (blackKey) {
        return padding + blackKey.position;
      }
    }

    // White key
    const octaveOffset = (octave - startOct) * 7;
    const noteIndex = WHITE_NOTES.indexOf(note);
    return padding + (octaveOffset + noteIndex) * whiteKeyWidth + whiteKeyWidth / 2;
  }
}

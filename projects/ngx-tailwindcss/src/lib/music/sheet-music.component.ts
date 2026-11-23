import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import {
  ClefType,
  getStaffLayout,
  KeySignature,
  StaffTimeSignature,
  TwStaffComponent,
} from './staff.component';
import {
  ACCIDENTAL_FOR_ALTERATION,
  CLEF_MIDDLE_LINE_NOTE,
  createAccidentalContext,
  NoteAccidental,
  NoteData,
  NoteDuration,
  NoteName,
  TwNoteComponent,
} from './note.component';

export type SheetMusicVariant = 'default' | 'printed' | 'handwritten' | 'minimal';
export type SheetMusicLayout = 'scroll' | 'pages' | 'single';

export interface MeasureData {
  notes: NoteData[];
  timeSignature?: StaffTimeSignature;
  keySignature?: KeySignature;
  tempo?: number;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  endingNumber?: number;
}

export interface SheetMusicData {
  title?: string;
  composer?: string;
  arranger?: string;
  tempo?: number;
  clef: ClefType;
  keySignature: KeySignature;
  timeSignature: StaffTimeSignature;
  measures: MeasureData[];
  grandStaff?: boolean;
}

// MusicXML to SheetMusicData converter
export function parseMusicXML(xmlString: string): SheetMusicData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('MusicXML parse error:', parseError.textContent);
      return null;
    }

    // Get score-partwise (most common format)
    const scorePartwise = doc.querySelector('score-partwise');
    if (!scorePartwise) {
      console.error('Unsupported MusicXML format - only score-partwise is supported');
      return null;
    }

    // Extract metadata
    const workTitle = doc.querySelector('work work-title')?.textContent || '';
    const movementTitle = doc.querySelector('movement-title')?.textContent || '';
    const creator = doc.querySelector('identification creator[type="composer"]')?.textContent || '';

    // Get the first part (for simplicity)
    const part = doc.querySelector('part');
    if (!part) return null;

    const measures: MeasureData[] = [];
    // The score-level clef/key/time/tempo are those at the start of the piece; later changes
    // are recorded on the measures where they happen
    let initial = null as Pick<
      SheetMusicData,
      'clef' | 'keySignature' | 'timeSignature' | 'tempo'
    > | null;
    let currentClef: ClefType = 'treble';
    let currentKey: KeySignature = 'C';
    let currentTime: StaffTimeSignature = '4/4';
    let currentTempo = 120;

    // Parse all measures
    const measureElements = part.querySelectorAll('measure');
    measureElements.forEach((measureEl, measureIndex) => {
      const notes: NoteData[] = [];
      let keyChanged = false;

      // Parse attributes (clef, key, time) - usually only in first measure
      const attributes = measureEl.querySelector('attributes');
      if (attributes) {
        // Clef
        const clef = attributes.querySelector('clef');
        if (clef) {
          const sign = clef.querySelector('sign')?.textContent || 'G';
          const line = clef.querySelector('line')?.textContent || '2';
          if (sign === 'G' && line === '2') currentClef = 'treble';
          else if (sign === 'F' && line === '4') currentClef = 'bass';
          else if (sign === 'C' && line === '3') currentClef = 'alto';
          else if (sign === 'C' && line === '4') currentClef = 'tenor';
        }

        // Key signature
        const key = attributes.querySelector('key');
        if (key) {
          const fifths = parseInt(key.querySelector('fifths')?.textContent || '0', 10);
          const mode = key.querySelector('mode')?.textContent || 'major';
          currentKey = fifthsToKeySignature(fifths, mode);
          keyChanged = true;
        }

        // Time signature
        const time = attributes.querySelector('time');
        if (time) {
          const beats = time.querySelector('beats')?.textContent || '4';
          const beatType = time.querySelector('beat-type')?.textContent || '4';
          currentTime = `${beats}/${beatType}` as StaffTimeSignature;
        }
      }

      // Parse direction (tempo)
      const direction = measureEl.querySelector('direction');
      if (direction) {
        const sound = direction.querySelector('sound');
        if (sound) {
          const tempo = sound.getAttribute('tempo');
          if (tempo) currentTempo = parseInt(tempo, 10);
        }
      }

      // Parse notes. <alter> is the sounding alteration; NoteData.accidental is the written
      // one, so accidentals implied by the key signature or earlier in the measure are dropped
      // (an explicit <accidental>, e.g. a courtesy one, is kept)
      const accidentals = createAccidentalContext(currentKey);
      const noteElements = measureEl.querySelectorAll('note');
      noteElements.forEach(noteEl => {
        // Chord notes are part of the previous note (simplified: only the first is kept)
        const isChord = noteEl.querySelector('chord') !== null;
        const type = noteEl.querySelector('type')?.textContent || 'quarter';
        const dotted = noteEl.querySelector('dot') !== null;

        if (noteEl.querySelector('rest') !== null) {
          if (!isChord) {
            notes.push({
              ...CLEF_MIDDLE_LINE_NOTE[currentClef],
              duration: musicXMLTypeToDuration(type),
              isRest: true,
              dotted,
            });
          }
          return;
        }

        // Pitch
        const pitch = noteEl.querySelector('pitch');
        if (!pitch) return;

        const step = (pitch.querySelector('step')?.textContent as NoteName) || 'C';
        const octave = parseInt(pitch.querySelector('octave')?.textContent || '4', 10);
        const alter = Math.max(
          -2,
          Math.min(2, Math.round(Number(pitch.querySelector('alter')?.textContent || '0') || 0))
        );
        const written = accidentals.spell(step, octave, alter);
        // Chord notes are skipped, but their accidentals still count for later notes
        if (isChord) return;

        const accidental =
          written ?? (noteEl.querySelector('accidental') ? ACCIDENTAL_FOR_ALTERATION[alter] : null);

        // Tied
        const tieStart = noteEl.querySelector('tie[type="start"]') !== null;

        notes.push({
          name: step,
          octave,
          duration: musicXMLTypeToDuration(type),
          accidental,
          dotted,
          tied: tieStart,
        });
      });

      initial ??= {
        clef: currentClef,
        keySignature: currentKey,
        timeSignature: currentTime,
        tempo: currentTempo,
      };
      measures.push({
        notes,
        timeSignature: measureIndex === 0 ? currentTime : undefined,
        keySignature: measureIndex === 0 || keyChanged ? currentKey : undefined,
        tempo: measureIndex === 0 ? currentTempo : undefined,
      });
    });

    return {
      title: workTitle || movementTitle || 'Untitled',
      composer: creator,
      clef: initial?.clef ?? currentClef,
      keySignature: initial?.keySignature ?? currentKey,
      timeSignature: initial?.timeSignature ?? currentTime,
      tempo: initial?.tempo ?? currentTempo,
      measures,
    };
  } catch (error) {
    console.error('Error parsing MusicXML:', error);
    return null;
  }
}

function fifthsToKeySignature(fifths: number, mode: string): KeySignature {
  // Key signatures based on circle of fifths
  // Positive = sharps, Negative = flats
  const majorKeys: Record<number, KeySignature> = {
    [-7]: 'Cb',
    [-6]: 'Gb',
    [-5]: 'Db',
    [-4]: 'Ab',
    [-3]: 'Eb',
    [-2]: 'Bb',
    [-1]: 'F',
    0: 'C',
    1: 'G',
    2: 'D',
    3: 'A',
    4: 'E',
    5: 'B',
    6: 'F#',
    7: 'C#',
  };
  // Minor keys - map to relative major's key signature
  const minorToMajor: Record<number, KeySignature> = {
    [-7]: 'Cb',
    [-6]: 'Gb',
    [-5]: 'Db',
    [-4]: 'Ab',
    [-3]: 'Eb',
    [-2]: 'Bb',
    [-1]: 'F',
    0: 'C',
    1: 'G',
    2: 'D',
    3: 'A',
    4: 'E',
    5: 'B',
    6: 'F#',
    7: 'C#',
  };

  // For minor keys, we use the same key signature as the relative major
  // Minor key = major key 3 half-steps up (or same fifths value uses same accidentals)
  const keyMap = mode === 'minor' ? minorToMajor : majorKeys;
  return keyMap[fifths] || 'C';
}

function musicXMLTypeToDuration(type: string): NoteDuration {
  const mapping: Record<string, NoteDuration> = {
    whole: 'whole',
    half: 'half',
    quarter: 'quarter',
    eighth: 'eighth',
    '16th': 'sixteenth',
    '32nd': 'thirtysecond',
  };
  return mapping[type] || 'quarter';
}

/**
 * ABC notation parser. ABC accidentals follow the same convention as NoteData.accidental
 * (unmarked notes take the K: key signature and earlier accidentals in the bar), so each
 * note keeps exactly the accidental written in the ABC source.
 */
export function parseABCNotation(abcString: string): SheetMusicData | null {
  try {
    const lines = abcString.split('\n').map(l => l.trim());
    let title = '';
    let composer = '';
    let tempo = 120;
    let timeSignature: StaffTimeSignature = '4/4';
    let keySignature: KeySignature = 'C';
    let defaultNoteLength = 1 / 8; // L:1/8 is the common default (fraction of a whole note)
    const measures: MeasureData[] = [];

    // Header fields end at the first K: line; K:/L: lines in the body change the key / unit
    // note length from that point on
    const headerEnd = lines.findIndex(line => line.startsWith('K:'));
    for (const line of headerEnd === -1 ? lines : lines.slice(0, headerEnd + 1)) {
      if (line.startsWith('T:')) {
        title = line.slice(2).trim();
      } else if (line.startsWith('C:')) {
        composer = line.slice(2).trim();
      } else if (line.startsWith('Q:')) {
        // Tempo: Q:1/4=120 or Q:120
        const tempoMatch = /(\d+)$/.exec(line);
        if (tempoMatch) tempo = parseInt(tempoMatch[1], 10);
      } else if (line.startsWith('M:')) {
        // Meter/time signature: M:4/4, M:C, M:C|
        const meter = line.slice(2).trim();
        if (meter === 'C') timeSignature = 'C';
        else if (meter === 'C|') timeSignature = 'C|';
        else timeSignature = meter as StaffTimeSignature;
      } else if (line.startsWith('K:')) {
        // Key: K:C, K:G, K:Dm, K:F#m
        keySignature = abcKeyToKeySignature(line.slice(2).trim());
      } else if (line.startsWith('L:')) {
        defaultNoteLength = parseABCUnitLength(line, defaultNoteLength);
      }
    }

    // Music body (after the header). Bar lines may come at the end of a line or later.
    let currentKey = keySignature;
    let pendingKey: KeySignature | undefined;
    let notes: NoteData[] = [];
    const endMeasure = (): void => {
      if (notes.length > 0) {
        measures.push({ notes, ...(pendingKey ? { keySignature: pendingKey } : {}) });
        pendingKey = undefined;
      }
      notes = [];
    };
    for (const line of headerEnd === -1 ? [] : lines.slice(headerEnd + 1)) {
      if (line.startsWith('K:')) {
        // Key change: applies from the next measure
        const key = abcKeyToKeySignature(line.slice(2).trim());
        pendingKey = key === currentKey ? undefined : key;
        currentKey = key;
        continue;
      }
      if (line.startsWith('L:')) {
        defaultNoteLength = parseABCUnitLength(line, defaultNoteLength);
        continue;
      }
      // Skip comments and other field lines such as lyrics (w:) or voice (V:)
      if (line.startsWith('%') || /^[A-Za-z]:/.test(line) || line.length === 0) continue;

      for (const [index, segment] of line.split('|').entries()) {
        if (index > 0) endMeasure();
        for (const token of tokenizeABC(segment.trim())) {
          const noteData = parseABCNote(token, defaultNoteLength);
          if (noteData) {
            notes.push(noteData);
          }
        }
      }
    }
    endMeasure();

    return {
      title: title || 'Untitled',
      composer,
      clef: 'treble',
      keySignature,
      timeSignature,
      tempo,
      measures,
    };
  } catch (error) {
    console.error('Error parsing ABC notation:', error);
    return null;
  }
}

// Circle-of-fifths position of each major-key tonic (sharps positive, flats negative)
const ABC_TONIC_FIFTHS: Record<string, number> = {
  Cb: -7,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
  'G#': 8,
  'D#': 9,
  'A#': 10,
  Fb: -8,
};

// Fifths offset of each mode relative to its major (ionian) tonic
const ABC_MODE_FIFTHS: Array<[RegExp, number]> = [
  [/^(m|min|minor|aeo|aeolian)$/i, -3],
  [/^(dor|dorian)$/i, -2],
  [/^(phr|phrygian)$/i, -4],
  [/^(lyd|lydian)$/i, 1],
  [/^(mix|mixolydian)$/i, -1],
  [/^(loc|locrian)$/i, -5],
];

function abcKeyToKeySignature(key: string): KeySignature {
  // Tonic (letter + optional #/b) followed by an optional mode such as m, min, dor, mix
  const keyMatch = /^([A-G])([#b]?)\s*([A-Za-z]*)/.exec(key);
  if (!keyMatch) return 'C';

  const tonicFifths = ABC_TONIC_FIFTHS[`${keyMatch[1]}${keyMatch[2]}`];
  if (tonicFifths === undefined) return 'C';

  const mode = keyMatch[3];
  const modeOffset = ABC_MODE_FIFTHS.find(([pattern]) => pattern.test(mode))?.[1] ?? 0;
  const fifths = tonicFifths + modeOffset;
  if (fifths < -7 || fifths > 7) return 'C';
  return fifthsToKeySignature(fifths, 'major');
}

function tokenizeABC(str: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Skip quoted chord symbols / annotations such as "Am7"
    if (char === '"') {
      const end = str.indexOf('"', i + 1);
      i = end === -1 ? str.length : end + 1;
      continue;
    }

    // Note: [A-Ga-g] with optional modifiers
    if (/[A-Ga-gz]/.test(char)) {
      let token = '';

      // Check for preceding accidental
      if (i > 0 && /[\^_=]/.test(str[i - 1])) {
        // Already captured
      }

      // Accidentals
      if (/[\^_=]/.test(char)) {
        token += char;
        i++;
        if (i < str.length && /[\^_]/.test(str[i])) {
          token += str[i];
          i++;
        }
      }

      // Note letter
      if (i < str.length && /[A-Ga-gz]/.test(str[i])) {
        token += str[i];
        i++;
      }

      // Octave modifiers (commas for lower, apostrophes for higher)
      while (i < str.length && /[',]/.test(str[i])) {
        token += str[i];
        i++;
      }

      // Duration modifier (number or fraction)
      while (i < str.length && /[\d/]/.test(str[i])) {
        token += str[i];
        i++;
      }

      if (token.length > 0) {
        tokens.push(token);
      }
    } else if (/[\^_=]/.test(char)) {
      // Accidental at start
      let token = char;
      i++;
      if (i < str.length && /[\^_]/.test(str[i])) {
        token += str[i];
        i++;
      }
      if (i < str.length && /[A-Ga-g]/.test(str[i])) {
        token += str[i];
        i++;
        while (i < str.length && /[',]/.test(str[i])) {
          token += str[i];
          i++;
        }
        while (i < str.length && /[\d/]/.test(str[i])) {
          token += str[i];
          i++;
        }
      }
      tokens.push(token);
    } else {
      i++;
    }
  }

  return tokens;
}

function parseABCNote(token: string, defaultLength: number): NoteData | null {
  // Rests (z) keep their length so following notes stay in place
  const restMatch = /^z([\d/]*)$/.exec(token);
  if (restMatch) {
    return {
      ...CLEF_MIDDLE_LINE_NOTE.treble,
      ...abcLengthToDuration(defaultLength * parseABCLengthMultiplier(restMatch[1])),
      isRest: true,
    };
  }
  if (token.includes('z') || token.includes('Z')) return null;

  let accidental: NoteAccidental = null;
  let noteLetter: string;
  let octaveModifier = 0;
  let durationMod = '';

  let i = 0;

  // Parse accidentals
  switch (token[i]) {
    case '^': {
      accidental = 'sharp';
      i++;
      if (token[i] === '^') {
        accidental = 'doubleSharp';
        i++;
      }

      break;
    }
    case '_': {
      accidental = 'flat';
      i++;
      if (token[i] === '_') {
        accidental = 'doubleFlat';
        i++;
      }

      break;
    }
    case '=': {
      accidental = 'natural';
      i++;

      break;
    }
    // No default
  }

  // Parse note letter
  if (i < token.length && /[A-Ga-g]/.test(token[i])) {
    noteLetter = token[i];
    i++;
  } else {
    return null;
  }

  // Parse octave modifiers
  while (i < token.length) {
    if (token[i] === "'") {
      octaveModifier++;
      i++;
    } else if (token[i] === ',') {
      octaveModifier--;
      i++;
    } else {
      break;
    }
  }

  // Parse duration
  while (i < token.length && /[\d/]/.test(token[i])) {
    durationMod += token[i];
    i++;
  }

  // Determine octave
  // ABC: C D E F G A B = C4 to B4
  // lowercase c d e f g a b = C5 to B5
  const isLowerCase = noteLetter === noteLetter.toLowerCase();
  const baseOctave = isLowerCase ? 5 : 4;
  const octave = baseOctave + octaveModifier;

  // Determine duration (default length scaled by the modifier, e.g. 3/2 = dotted)
  const { duration, dotted, doubleDotted } = abcLengthToDuration(
    defaultLength * parseABCLengthMultiplier(durationMod)
  );

  return {
    name: noteLetter.toUpperCase() as NoteName,
    octave,
    duration,
    accidental,
    dotted,
    ...(doubleDotted ? { doubleDotted } : {}),
  };
}

// L: field (unit note length), e.g. L:1/8; `fallback` when malformed
function parseABCUnitLength(line: string, fallback: number): number {
  const lengthMatch = /^(\d+)\/(\d+)$/.exec(line.slice(2).trim());
  return lengthMatch && Number(lengthMatch[2]) > 0
    ? Number(lengthMatch[1]) / Number(lengthMatch[2])
    : fallback;
}

// ABC length modifier: '2' = x2, '/2' or '/' = x1/2, '//' = x1/4, '3/2' or '3/' = x3/2
function parseABCLengthMultiplier(mod: string): number {
  const match = /^(\d*)(\/*)(\d*)$/.exec(mod);
  if (!match || mod === '') return 1;
  const numerator = match[1] ? Number(match[1]) : 1;
  const slashes = match[2].length;
  if (slashes === 0) return numerator;
  const denominator = match[3] ? Number(match[3]) : 2 ** slashes;
  return denominator > 0 ? numerator / denominator : 1;
}

const ABC_DURATIONS: Array<[NoteDuration, number]> = [
  ['whole', 1],
  ['half', 1 / 2],
  ['quarter', 1 / 4],
  ['eighth', 1 / 8],
  ['sixteenth', 1 / 16],
  ['thirtysecond', 1 / 32],
];

// Map a length (fraction of a whole note) to a note value, recognising (double-)dotted values
function abcLengthToDuration(length: number): {
  duration: NoteDuration;
  dotted: boolean;
  doubleDotted: boolean;
} {
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
  for (const [duration, value] of ABC_DURATIONS) {
    if (close(length, value)) return { duration, dotted: false, doubleDotted: false };
    if (close(length, value * 1.5)) return { duration, dotted: true, doubleDotted: false };
    if (close(length, value * 1.75)) return { duration, dotted: false, doubleDotted: true };
  }
  // Not representable: use the longest note value that fits (whole for anything longer)
  const fitting = ABC_DURATIONS.find(([, value]) => value <= length);
  return {
    duration: fitting ? fitting[0] : 'thirtysecond',
    dotted: false,
    doubleDotted: false,
  };
}

/** Key signature in effect in each measure (a measure's `keySignature` carries forward) */
export function getMeasureKeySignatures(music: SheetMusicData): KeySignature[] {
  let key = music.keySignature;
  return music.measures.map(measure => (key = measure.keySignature ?? key));
}

/**
 * Re-spell one measure's notes, written under `fromKey`, for display under `toKey` without
 * changing what they sound (see NoteData.accidental): accidentals are added where `toKey`
 * would otherwise alter a note and dropped where it implies them. Explicit accidentals are
 * kept. Returns `notes` itself when the keys are the same.
 */
export function respellNotesForKey(
  notes: NoteData[],
  fromKey: KeySignature,
  toKey: KeySignature
): NoteData[] {
  if (fromKey === toKey) return notes;
  const source = createAccidentalContext(fromKey);
  const target = createAccidentalContext(toKey);
  return notes.map(note => {
    if (note.isRest) return note;
    const written = target.spell(note.name, note.octave, source.resolve(note));
    if (note.accidental || written === null) return note;
    return { ...note, accidental: written };
  });
}

// Sample music for demo
export const SAMPLE_MUSIC: SheetMusicData = {
  title: 'Sample Melody',
  composer: 'Demo',
  clef: 'treble',
  keySignature: 'C',
  timeSignature: '4/4',
  tempo: 120,
  measures: [
    {
      notes: [
        { name: 'C', octave: 4, duration: 'quarter' },
        { name: 'E', octave: 4, duration: 'quarter' },
        { name: 'G', octave: 4, duration: 'quarter' },
        { name: 'C', octave: 5, duration: 'quarter' },
      ],
    },
    {
      notes: [
        { name: 'B', octave: 4, duration: 'half' },
        { name: 'G', octave: 4, duration: 'half' },
      ],
    },
    {
      notes: [
        { name: 'A', octave: 4, duration: 'quarter' },
        { name: 'F', octave: 4, duration: 'quarter' },
        { name: 'D', octave: 4, duration: 'quarter' },
        { name: 'B', octave: 3, duration: 'quarter' },
      ],
    },
    {
      notes: [{ name: 'C', octave: 4, duration: 'whole' }],
    },
  ],
};

@Component({
  selector: 'tw-sheet-music',
  standalone: true,
  imports: [CommonModule, TwStaffComponent, TwNoteComponent],
  templateUrl: './sheet-music.component.html',
  styleUrl: './sheet-music.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class TwSheetMusicComponent {
  private readonly twClass = inject(TwClassService);

  readonly music = input<SheetMusicData | null>(null);
  readonly variant = input<SheetMusicVariant>('default');
  readonly layout = input<SheetMusicLayout>('scroll');
  readonly width = input(800, { transform: numberAttribute });
  readonly staffHeight = input(120, { transform: numberAttribute });
  readonly measuresPerLine = input(4, { transform: numberAttribute });
  readonly lineSpacing = input(10, { transform: numberAttribute });
  readonly showTitle = input(true);
  readonly showComposer = input(true);
  readonly showTempo = input(true);
  readonly showMeasureNumbers = input(true);
  readonly interactive = input(false);
  readonly playbackPosition = input<number | null>(null); // Current playback measure.beat (e.g., 2.5 = measure 2, beat 3)
  readonly highlightedNotes = input<Array<{ measure: number; noteIndex: number }>>([]);
  readonly classOverride = input('');

  // Import inputs - MusicXML or ABC string
  readonly musicXml = input<string | null>(null);
  readonly abcNotation = input<string | null>(null);

  // Zoom controls
  readonly zoom = input(1, { transform: numberAttribute });
  readonly minZoom = input(0.5, { transform: numberAttribute });
  readonly maxZoom = input(2, { transform: numberAttribute });
  readonly zoomStep = input(0.1, { transform: numberAttribute });
  readonly showZoomControls = input(true);

  // Print styling
  readonly printFriendly = input(false);

  readonly noteClick = output<{ measure: number; noteIndex: number; note: NoteData }>();
  readonly measureClick = output<number>();
  readonly zoomChange = output<number>();
  readonly parseError = output<string>();

  // Page ('pages' layout): back to the first line when the music changes, and kept within
  // the lines there are (e.g. when measuresPerLine grows)
  protected readonly currentPage = linkedSignal<{ music: SheetMusicData; lines: number }, number>({
    source: () => ({ music: this.musicData(), lines: this.totalLines() }),
    computation: (source, previous) =>
      previous?.source.music === source.music
        ? Math.max(0, Math.min(previous.value, source.lines - 1))
        : 0,
  });
  protected readonly currentZoom = signal(1);

  // Parse imported notation (pure: the error is emitted from an effect, since outputs must not
  // be emitted from inside a computed)
  private readonly parseResult = computed((): { music: SheetMusicData | null; error?: string } => {
    const xmlInput = this.musicXml();
    const abcInput = this.abcNotation();

    if (xmlInput) {
      const music = parseMusicXML(xmlInput);
      return music ? { music } : { music: null, error: 'Failed to parse MusicXML' };
    }

    if (abcInput) {
      const music = parseABCNotation(abcInput);
      return music ? { music } : { music: null, error: 'Failed to parse ABC notation' };
    }

    return { music: null };
  });

  protected readonly parsedMusic = computed(() => this.parseResult().music);

  constructor() {
    // Sync zoom input to signal
    effect(() => {
      this.currentZoom.set(this.zoom());
    });

    effect(() => {
      const { error } = this.parseResult();
      if (error) {
        untracked(() => {
          this.parseError.emit(error);
        });
      }
    });
  }

  protected readonly musicData = computed(() => {
    // Priority: direct music input > parsed MusicXML > parsed ABC > sample
    const directMusic = this.music();
    if (directMusic) return directMusic;

    const parsed = this.parsedMusic();
    if (parsed) return parsed;

    return SAMPLE_MUSIC;
  });

  protected readonly effectiveWidth = computed(() => {
    return this.width() * this.currentZoom();
  });

  protected readonly effectiveStaffHeight = computed(() => {
    return this.staffHeight() * this.currentZoom();
  });

  protected readonly effectiveLineSpacing = computed(() => {
    return this.lineSpacing() * this.currentZoom();
  });

  // Y of the top staff line inside tw-staff (mirrors TwStaffComponent.staffTop)
  protected readonly noteStaffTop = computed(() => {
    return (this.staffHeight() - this.lineSpacing() * 4) / 2;
  });

  protected readonly totalLines = computed(() => {
    const measures = this.musicData().measures.length;
    const perLine = this.measuresPerLine();
    return Math.ceil(measures / perLine);
  });

  // Key signature drawn on each line: the one in effect at the line's first measure
  protected readonly lineKeys = computed(() => {
    const keys = getMeasureKeySignatures(this.musicData());
    const perLine = this.measuresPerLine();
    const lineKeys: KeySignature[] = [];
    for (let i = 0; i < keys.length; i += perLine) {
      lineKeys.push(keys[i]);
    }
    return lineKeys;
  });

  // Measures of each line. A key change inside a line is not drawn, so the notes of such
  // measures are re-spelled for the line's key signature (they sound the same)
  protected readonly lines = computed(() => {
    const music = this.musicData();
    const keys = getMeasureKeySignatures(music);
    const lineKeys = this.lineKeys();
    const perLine = this.measuresPerLine();
    const lines: MeasureData[][] = [];

    for (let i = 0; i < music.measures.length; i += perLine) {
      const lineKey = lineKeys[lines.length];
      lines.push(
        music.measures.slice(i, i + perLine).map((measure, j) => {
          const notes = respellNotesForKey(measure.notes, keys[i + j], lineKey);
          return notes === measure.notes ? measure : { ...measure, notes };
        })
      );
    }

    return lines;
  });

  protected readonly totalHeight = computed(() => {
    const lines = this.totalLines();
    const staffH = this.staffHeight();
    const titleHeight = this.showTitle() && this.musicData().title ? 50 : 0;
    const composerHeight = this.showComposer() && this.musicData().composer ? 24 : 0;
    const lineGap = 40;

    return titleHeight + composerHeight + lines * (staffH + lineGap);
  });

  protected readonly containerClasses = computed(() => {
    const layout = this.layout();
    const isPrint = this.printFriendly();
    const base = isPrint ? 'print-sheet-music' : 'rounded-lg overflow-hidden';

    const layoutClasses: Record<SheetMusicLayout, string> = {
      scroll: 'overflow-x-auto overflow-y-visible',
      pages: 'overflow-hidden',
      single: 'overflow-visible',
    };

    const variantClasses: Record<SheetMusicVariant, string> = {
      default: isPrint
        ? 'bg-white'
        : 'bg-white dark:bg-slate-100 shadow-sm border border-slate-200',
      printed: 'bg-[#FFFFF8] shadow-md print:shadow-none',
      handwritten: 'bg-[#FDF6E3] shadow-inner print:shadow-none',
      minimal: 'bg-transparent',
    };

    const printClasses = isPrint ? 'print:shadow-none print:border-none print:rounded-none' : '';

    return this.twClass.merge(
      base,
      layoutClasses[layout],
      variantClasses[this.variant()],
      printClasses,
      this.classOverride()
    );
  });

  protected readonly wrapperClasses = computed(() => {
    const isPrint = this.printFriendly();
    return isPrint ? 'sheet-music-wrapper print-mode' : 'sheet-music-wrapper';
  });

  protected readonly titleClasses = computed(() => {
    const variant = this.variant();
    const base = 'text-center font-serif font-bold';
    const size = 'text-2xl';
    const color = variant === 'minimal' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900';
    return [base, size, color].join(' ');
  });

  protected readonly subtitleClasses = computed(() => {
    const variant = this.variant();
    const base = 'text-center font-serif italic';
    const size = 'text-sm';
    const color = variant === 'minimal' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600';
    return [base, size, color].join(' ');
  });

  // Secondary text (tempo, measure numbers, page label, empty state). 'minimal' has a
  // transparent background, so its text must follow the page's dark mode; the other variants
  // keep a light (possibly tinted) background in dark mode, where slate-600 stays >= 4.5:1
  protected readonly mutedTextClasses = computed(() =>
    this.variant() === 'minimal' ? 'text-slate-600 dark:text-slate-400' : 'text-slate-600'
  );

  protected readonly pageLabelClasses = computed(() => `text-sm ${this.mutedTextClasses()}`);

  protected readonly staffVariant = computed(() => {
    const variant = this.variant();
    switch (variant) {
      case 'printed': {
        return 'printed';
      }
      case 'handwritten': {
        return 'handwritten';
      }
      case 'minimal': {
        return 'minimal';
      }
      default: {
        return 'default';
      }
    }
  });

  // Mirrors the tw-staff drawn for a line: every line repeats the key signature (unmarked
  // notes follow it, see NoteData.accidental), only the first shows the time signature, and
  // the last line may hold fewer measures than measuresPerLine
  private getLineLayout(lineIndex: number): { contentStartX: number; measureWidth: number } {
    const music = this.musicData();
    const measureCount = this.lines()[lineIndex]?.length ?? this.measuresPerLine();
    const showHeader = lineIndex === 0;
    return getStaffLayout({
      width: this.width(),
      measures: measureCount,
      keySignature: this.lineKeys()[lineIndex] ?? music.keySignature,
      showKeySignature: true,
      showTimeSignature: showHeader && !!music.timeSignature,
    });
  }

  protected getMeasureStartX(measureIndex: number, lineIndex: number): number {
    const measureInLine = measureIndex % this.measuresPerLine();
    const { contentStartX, measureWidth } = this.getLineLayout(lineIndex);
    return contentStartX + measureInLine * measureWidth;
  }

  protected getNoteX(
    measureIndex: number,
    noteIndex: number,
    totalNotes: number,
    lineIndex: number
  ): number {
    const measureX = this.getMeasureStartX(measureIndex, lineIndex);
    const { measureWidth } = this.getLineLayout(lineIndex);
    const noteSpacing = measureWidth / (totalNotes + 1);
    return measureX + noteSpacing * (noteIndex + 1);
  }

  protected isNoteHighlighted(measureIndex: number, noteIndex: number): boolean {
    return this.highlightedNotes().some(
      h => h.measure === measureIndex && h.noteIndex === noteIndex
    );
  }

  protected isPlaybackPosition(measureIndex: number): boolean {
    const pos = this.playbackPosition();
    return pos !== null && Math.floor(pos) === measureIndex;
  }

  protected onNoteClick(
    event: Event,
    measureIndex: number,
    noteIndex: number,
    note: NoteData
  ): void {
    if (!this.interactive()) return;
    // A note click is not also a click on its measure
    event.stopPropagation();
    // Emit the note as given in the input data (the displayed one may be re-spelled)
    const original = this.musicData().measures[measureIndex]?.notes[noteIndex] ?? note;
    this.noteClick.emit({ measure: measureIndex, noteIndex, note: original });
  }

  protected onMeasureClick(measureIndex: number): void {
    if (!this.interactive()) return;
    this.measureClick.emit(measureIndex);
  }

  // Click on a line's staff: emit measureClick for the measure under the pointer
  protected onStaffClick(event: MouseEvent, lineIndex: number): void {
    if (!this.interactive()) return;
    const svg = (event.currentTarget as Element | null)?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Staff coordinates (the container may be scaled by the zoom transform)
    const x = ((event.clientX - rect.left) * this.width()) / rect.width;
    const { contentStartX, measureWidth } = this.getLineLayout(lineIndex);
    const measureInLine = Math.floor((x - contentStartX) / measureWidth);
    const measureCount = this.lines()[lineIndex]?.length ?? 0;
    if (measureInLine < 0 || measureInLine >= measureCount) return;
    this.onMeasureClick(this.getMeasureGlobalIndex(lineIndex, measureInLine));
  }

  protected getLineY(lineIndex: number): number {
    const titleHeight = this.showTitle() && this.musicData().title ? 50 : 0;
    const composerHeight = this.showComposer() && this.musicData().composer ? 24 : 0;
    const staffH = this.staffHeight();
    const lineGap = 40;

    return titleHeight + composerHeight + lineIndex * (staffH + lineGap);
  }

  protected getMeasureGlobalIndex(lineIndex: number, measureInLineIndex: number): number {
    return lineIndex * this.measuresPerLine() + measureInLineIndex;
  }

  // Pagination for 'pages' layout
  protected nextPage(): void {
    const maxPage = this.totalLines() - 1;
    if (this.currentPage() < maxPage) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
    }
  }

  // Zoom methods
  protected zoomIn(): void {
    const newZoom = Math.min(this.currentZoom() + this.zoomStep(), this.maxZoom());
    this.currentZoom.set(newZoom);
    this.zoomChange.emit(newZoom);
  }

  protected zoomOut(): void {
    const newZoom = Math.max(this.currentZoom() - this.zoomStep(), this.minZoom());
    this.currentZoom.set(newZoom);
    this.zoomChange.emit(newZoom);
  }

  protected resetZoom(): void {
    this.currentZoom.set(1);
    this.zoomChange.emit(1);
  }

  protected setZoom(zoom: number): void {
    const clampedZoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom));
    this.currentZoom.set(clampedZoom);
    this.zoomChange.emit(clampedZoom);
  }

  // Enhanced playback position calculation
  protected getPlaybackCursorX(measureIndex: number, lineIndex: number): number {
    const pos = this.playbackPosition();
    if (pos === null) return 0;

    const measurePart = Math.floor(pos);
    const beatPart = pos - measurePart;

    if (measurePart !== measureIndex) return 0;

    // Calculate position within measure based on beat fraction
    // Unscaled coordinates: zoom is applied to the whole container via CSS transform
    const measureX = this.getMeasureStartX(measureIndex, lineIndex);
    const { measureWidth } = this.getLineLayout(lineIndex);

    return measureX + beatPart * measureWidth;
  }

  protected getPlaybackLineIndex(measureIndex: number): number {
    return Math.floor(measureIndex / this.measuresPerLine());
  }

  protected isPlaybackInLine(lineIndex: number): boolean {
    const pos = this.playbackPosition();
    if (pos === null) return false;

    const measureIndex = Math.floor(pos);
    const playbackLine = this.getPlaybackLineIndex(measureIndex);
    return playbackLine === lineIndex;
  }

  // Print functionality
  protected print(): void {
    window.print();
  }

  // Import methods for external use
  importMusicXML(xmlString: string): SheetMusicData | null {
    return parseMusicXML(xmlString);
  }

  importABC(abcString: string): SheetMusicData | null {
    return parseABCNotation(abcString);
  }

  // Re-export parsers for external use
  static parseMusicXML = parseMusicXML;
  static parseABCNotation = parseABCNotation;

  protected readonly Math = Math;
}

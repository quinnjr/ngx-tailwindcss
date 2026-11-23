import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type NoteDisplayVariant = 'default' | 'minimal' | 'led' | 'lcd' | 'meter';
export type NoteDisplaySize = 'sm' | 'md' | 'lg' | 'xl';

export interface DetectedNote {
  note: string; // C, C#, D, etc.
  octave: number;
  frequency: number; // Hz
  cents: number; // -50 to +50 deviation from perfect pitch
  confidence?: number; // 0-1 detection confidence
  timestamp: number;
}

export interface NoteHistoryEntry extends DetectedNote {
  id: number;
}

const NATURAL_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Frequency of a named note (C#, Db, ...) for the given A4 reference, or null if unparseable
function noteFrequency(note: string, octave: number, a4: number): number | null {
  const match = /^([A-G])(#|b|♯|♭)?$/.exec(note);
  if (!match || !Number.isFinite(octave)) return null;
  const shift = match[2] === '#' || match[2] === '♯' ? 1 : match[2] ? -1 : 0;
  const midi = (octave + 1) * 12 + NATURAL_SEMITONES[match[1]] + shift;
  return a4 * 2 ** ((midi - 69) / 12);
}

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Note Display component for showing detected/played notes
 *
 * @example
 * ```html
 * <tw-note-display [frequency]="440"></tw-note-display>
 * <tw-note-display [note]="detectedNote" [showHistory]="true"></tw-note-display>
 * ```
 */
@Component({
  selector: 'tw-note-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './note-display.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
})
export class TwNoteDisplayComponent {
  // Input modes - either provide frequency OR note object
  readonly frequency = input<number | null>(null);
  readonly note = input<DetectedNote | null>(null);

  // Manual note input (alternative to frequency/note)
  readonly noteName = input<string | null>(null);
  readonly octave = input<number | null>(null);

  // Display options
  readonly variant = input<NoteDisplayVariant>('default');
  readonly size = input<NoteDisplaySize>('md');
  readonly showFrequency = input(true);
  readonly showCents = input(true);
  readonly showOctave = input(true);
  readonly showIndicator = input(true); // Visual in-tune indicator
  readonly showHistory = input(false);
  readonly historyLength = input(8, { transform: numberAttribute });
  readonly referenceA4 = input(440, { transform: numberAttribute }); // Tuning reference
  readonly centsTolerance = input(10, { transform: numberAttribute }); // Cents range for "in tune"
  readonly classOverride = input('');

  // Outputs
  readonly noteChange = output<DetectedNote>();
  readonly inTune = output<boolean>();

  // Internal state
  protected readonly currentNote = signal<DetectedNote | null>(null);
  protected readonly noteHistory = signal<NoteHistoryEntry[]>([]);
  private historyIdCounter = 0;

  constructor() {
    // Re-derive the current note whenever an input changes (no polling, so outputs only
    // fire on actual changes and no timer keeps SSR / zone stability pending)
    effect(() => {
      const freq = this.frequency();
      const noteInput = this.note();
      const manualNote = this.noteName();
      const manualOctave = this.octave();
      this.referenceA4();
      untracked(() => {
        this.updateCurrentNote(freq, noteInput, manualNote, manualOctave);
      });
    });
  }

  private updateCurrentNote(
    freq: number | null,
    noteInput: DetectedNote | null,
    manualNote: string | null,
    manualOctave: number | null
  ): void {
    let detected: DetectedNote | null = null;

    if (noteInput) {
      detected = noteInput;
    } else if (freq && freq > 0) {
      detected = this.frequencyToNote(freq);
    } else if (manualNote && manualOctave !== null) {
      const noteFreq = noteFrequency(manualNote, manualOctave, this.referenceA4());
      if (noteFreq) {
        detected = {
          note: manualNote,
          octave: manualOctave,
          frequency: noteFreq,
          cents: 0,
          timestamp: Date.now(),
        };
      }
    }

    if (detected) {
      const current = this.currentNote();
      const isNewNote = current?.note !== detected.note || current.octave !== detected.octave;

      this.currentNote.set(detected);
      this.noteChange.emit(detected);

      // Check if in tune
      const isInTune = Math.abs(detected.cents) <= this.centsTolerance();
      this.inTune.emit(isInTune);

      // Add to history if new note
      if (isNewNote && this.showHistory()) {
        this.addToHistory(detected);
      }
    }
  }

  private frequencyToNote(freq: number): DetectedNote {
    const a4 = this.referenceA4();

    // Calculate semitones from A4
    const semitones = 12 * Math.log2(freq / a4);
    const roundedSemitones = Math.round(semitones);

    // Get note and octave
    const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12; // +9 because A is index 9
    const octave = Math.floor((roundedSemitones + 9) / 12) + 4;
    const note = ALL_NOTES[noteIndex];

    // Calculate cents deviation
    const exactFreq = a4 * 2 ** (roundedSemitones / 12);
    const cents = Math.round(1200 * Math.log2(freq / exactFreq));

    return {
      note,
      octave,
      frequency: freq,
      cents: Math.max(-50, Math.min(50, cents)),
      timestamp: Date.now(),
    };
  }

  private addToHistory(detected: DetectedNote): void {
    const entry: NoteHistoryEntry = {
      ...detected,
      id: this.historyIdCounter++,
    };

    this.noteHistory.update(history => {
      const newHistory = [entry, ...history];
      return newHistory.slice(0, this.historyLength());
    });
  }

  // Computed values
  protected readonly displayNote = computed(() => {
    const note = this.currentNote();
    if (!note) return '—';
    return note.note.replace('#', '♯');
  });

  protected readonly displayOctave = computed(() => {
    const note = this.currentNote();
    return note?.octave ?? '';
  });

  protected readonly displayFrequency = computed(() => {
    const note = this.currentNote();
    if (!note) return '— Hz';
    return `${note.frequency.toFixed(1)} Hz`;
  });

  protected readonly displayCents = computed(() => {
    const note = this.currentNote();
    if (!note) return '±0';
    const { cents } = note;
    if (cents === 0) return '±0';
    return cents > 0 ? `+${cents}` : `${cents}`;
  });

  protected readonly isInTune = computed(() => {
    const note = this.currentNote();
    if (!note) return false;
    return Math.abs(note.cents) <= this.centsTolerance();
  });

  protected readonly isSharp = computed(() => {
    const note = this.currentNote();
    return note ? note.cents > this.centsTolerance() : false;
  });

  protected readonly isFlat = computed(() => {
    const note = this.currentNote();
    return note ? note.cents < -this.centsTolerance() : false;
  });

  protected readonly centsPosition = computed(() => {
    // Position from 0-100 where 50 is center (in tune)
    const note = this.currentNote();
    if (!note) return 50;
    return 50 + note.cents;
  });

  /**
   * Whether LED segment `i` (-5..5, 10 cents per segment) is lit. The centre segment means
   * "in tune"; side segments only light when out of tune (beyond `centsTolerance`), with the
   * first one lit for any flat/sharp reading so the bar always agrees with the in-tune check.
   */
  protected isLedLit(i: number): boolean {
    if (i === 0) return this.isInTune();
    const cents = this.currentNote()?.cents ?? 0;
    if (i > 0) return this.isSharp() && (i === 1 || cents >= i * 10);
    return this.isFlat() && (i === -1 || cents <= i * 10);
  }

  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();

    const base = 'flex flex-col items-center rounded-lg transition-colors';

    const variantClasses: Record<NoteDisplayVariant, string> = {
      default: 'bg-slate-800 border border-slate-700 p-4',
      minimal: 'bg-transparent p-2',
      led: 'bg-black border border-slate-700 p-4',
      lcd: 'bg-lime-950 border-2 border-slate-600 p-4',
      meter: 'bg-slate-900 border border-slate-700 p-4',
    };

    const sizeClasses: Record<NoteDisplaySize, string> = {
      sm: 'gap-1 min-w-[100px]',
      md: 'gap-2 min-w-[140px]',
      lg: 'gap-3 min-w-[180px]',
      xl: 'gap-4 min-w-[220px]',
    };

    return [base, variantClasses[variant], sizeClasses[size], this.classOverride()]
      .filter(Boolean)
      .join(' ');
  });

  protected readonly noteClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();

    const sizeClasses: Record<NoteDisplaySize, string> = {
      sm: 'text-3xl',
      md: 'text-5xl',
      lg: 'text-6xl',
      xl: 'text-7xl',
    };

    const variantClasses: Record<NoteDisplayVariant, string> = {
      default: 'text-white font-bold',
      minimal: 'text-slate-800 dark:text-white font-bold',
      led: 'text-red-500 font-mono font-bold drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]',
      lcd: 'text-lime-400 font-mono font-bold',
      meter: 'text-amber-400 font-bold',
    };

    return [sizeClasses[size], variantClasses[variant]].join(' ');
  });

  protected readonly octaveClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();

    const sizeClasses: Record<NoteDisplaySize, string> = {
      sm: 'text-lg',
      md: 'text-2xl',
      lg: 'text-3xl',
      xl: 'text-4xl',
    };

    const variantClasses: Record<NoteDisplayVariant, string> = {
      default: 'text-slate-400',
      minimal: 'text-slate-500 dark:text-slate-400',
      // /70 was ~4.0-4.4:1 on the black / lime-950 surfaces at the small (non-large) size
      led: 'text-red-400/80',
      lcd: 'text-lime-500/80',
      meter: 'text-amber-500/70',
    };

    return [sizeClasses[size], variantClasses[variant], 'font-mono'].join(' ');
  });

  protected readonly frequencyClasses = computed(() => {
    const variant = this.variant();

    const variantClasses: Record<NoteDisplayVariant, string> = {
      default: 'text-slate-400',
      minimal: 'text-slate-600 dark:text-slate-400',
      led: 'text-red-400/80',
      lcd: 'text-lime-500/80',
      meter: 'text-slate-400',
    };

    return ['text-sm font-mono', variantClasses[variant]].join(' ');
  });

  // Secondary labels (meter scale, history heading, "waiting" text): the dark variants need a
  // light grey to stay >= 4.5:1; minimal sits on the page so it follows its colour scheme
  protected readonly mutedTextClasses = computed(() =>
    this.variant() === 'minimal' ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'
  );

  // Flat / sharp / in-tune text colours, readable on the dark variants and, for the
  // transparent minimal variant, on a light or dark page
  protected readonly statusTextClasses = computed(() => {
    const minimal = this.variant() === 'minimal';
    return {
      flat: minimal ? 'text-blue-700 dark:text-blue-400' : 'text-blue-400',
      sharp: minimal ? 'text-amber-700 dark:text-amber-400' : 'text-amber-500',
      inTune: minimal ? 'text-green-700 dark:text-green-400' : 'text-green-500',
    };
  });

  // Fade of older history entries. `1 - i * 0.1` dropped the text below 4.5:1 from the
  // fourth entry and hid entries entirely (opacity <= 0) beyond the tenth
  protected historyOpacity(index: number): number {
    return Math.max(0.85, 1 - index * 0.05);
  }

  protected readonly centsClasses = computed(() => {
    const status = this.statusTextClasses();
    if (this.isInTune()) return status.inTune;
    if (this.isSharp()) return status.sharp;
    if (this.isFlat()) return status.flat;
    return this.mutedTextClasses();
  });

  protected readonly indicatorColor = computed(() => {
    const inTune = this.isInTune();
    const sharp = this.isSharp();

    if (inTune) return 'bg-green-500';
    if (sharp) return 'bg-amber-500';
    return 'bg-blue-500';
  });

  // Public methods
  setFrequency(freq: number): void {
    const detected = this.frequencyToNote(freq);
    this.currentNote.set(detected);
    this.noteChange.emit(detected);

    if (this.showHistory()) {
      this.addToHistory(detected);
    }
  }

  setNote(note: string, octave: number): void {
    const freq = noteFrequency(note, octave, this.referenceA4());
    if (freq) {
      const detected: DetectedNote = {
        note,
        octave,
        frequency: freq,
        cents: 0,
        timestamp: Date.now(),
      };
      this.currentNote.set(detected);
      this.noteChange.emit(detected);

      if (this.showHistory()) {
        this.addToHistory(detected);
      }
    }
  }

  clearHistory(): void {
    this.noteHistory.set([]);
  }

  reset(): void {
    this.currentNote.set(null);
    this.noteHistory.set([]);
  }
}

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

export type ChordDiagramVariant = 'default' | 'minimal' | 'detailed' | 'dark';
export type ChordDiagramSize = 'sm' | 'md' | 'lg';

export interface ChordFingering {
  string: number; // 1-6 (1 = high E, 6 = low E)
  /**
   * Absolute fret number on the neck: 0 = open, -1 = muted, 1+ = fret. With a `baseFret`
   * above 1 the diagram shows frets baseFret..baseFret + fretCount - 1, so e.g. a barre
   * at the 5th fret is `fret: 5` with `baseFret: 5` (drawn on the diagram's first row).
   */
  fret: number;
  finger?: number; // 1-4 (index to pinky), 0 = thumb
  barre?: boolean; // Part of a barre chord
}

export interface ChordDefinition {
  name: string; // e.g., "C", "Am", "G7"
  fingerings: ChordFingering[];
  /** Fret shown in the diagram's first row (default 1 = nut); `fret` values stay absolute */
  baseFret?: number;
  barreFrom?: number; // String number where barre starts
  barreTo?: number; // String number where barre ends
}

// Common chord definitions
export const COMMON_CHORDS: Record<string, ChordDefinition> = {
  C: {
    name: 'C',
    fingerings: [
      { string: 1, fret: 0 },
      { string: 2, fret: 1, finger: 1 },
      { string: 3, fret: 0 },
      { string: 4, fret: 2, finger: 2 },
      { string: 5, fret: 3, finger: 3 },
      { string: 6, fret: -1 },
    ],
  },
  G: {
    name: 'G',
    fingerings: [
      { string: 1, fret: 3, finger: 4 },
      { string: 2, fret: 0 },
      { string: 3, fret: 0 },
      { string: 4, fret: 0 },
      { string: 5, fret: 2, finger: 1 },
      { string: 6, fret: 3, finger: 2 },
    ],
  },
  D: {
    name: 'D',
    fingerings: [
      { string: 1, fret: 2, finger: 2 },
      { string: 2, fret: 3, finger: 3 },
      { string: 3, fret: 2, finger: 1 },
      { string: 4, fret: 0 },
      { string: 5, fret: -1 },
      { string: 6, fret: -1 },
    ],
  },
  Am: {
    name: 'Am',
    fingerings: [
      { string: 1, fret: 0 },
      { string: 2, fret: 1, finger: 1 },
      { string: 3, fret: 2, finger: 2 },
      { string: 4, fret: 2, finger: 3 },
      { string: 5, fret: 0 },
      { string: 6, fret: -1 },
    ],
  },
  Em: {
    name: 'Em',
    fingerings: [
      { string: 1, fret: 0 },
      { string: 2, fret: 0 },
      { string: 3, fret: 0 },
      { string: 4, fret: 2, finger: 2 },
      { string: 5, fret: 2, finger: 1 },
      { string: 6, fret: 0 },
    ],
  },
  F: {
    name: 'F',
    fingerings: [
      { string: 1, fret: 1, finger: 1, barre: true },
      { string: 2, fret: 1, finger: 1, barre: true },
      { string: 3, fret: 2, finger: 2 },
      { string: 4, fret: 3, finger: 4 },
      { string: 5, fret: 3, finger: 3 },
      { string: 6, fret: 1, finger: 1, barre: true },
    ],
    barreFrom: 1,
    barreTo: 6,
  },
};

@Component({
  selector: 'tw-chord-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chord-diagram.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
})
export class TwChordDiagramComponent {
  private readonly twClass = inject(TwClassService);

  // Expose Math for template
  protected readonly Math = Math;

  readonly chord = input<ChordDefinition | string | null>(null);
  readonly customFingerings = input<ChordFingering[]>([]);
  readonly name = input<string>('');
  /**
   * Fret shown in the first row when the chord does not define `baseFret` (default 1 = nut).
   * Fingering `fret` numbers are absolute, see ChordFingering.fret.
   */
  readonly baseFret = input(1, { transform: numberAttribute });
  readonly fretCount = input(4, { transform: numberAttribute });
  readonly stringCount = input(6, { transform: numberAttribute }); // 6 for guitar, 4 for bass
  readonly variant = input<ChordDiagramVariant>('default');
  readonly size = input<ChordDiagramSize>('md');
  readonly showFingerNumbers = input(true);
  readonly showStringLabels = input(true);
  readonly showChordName = input(true);
  readonly showFretNumber = input(true);
  readonly leftHanded = input(false);
  readonly classOverride = input('');

  protected readonly chordData = computed((): ChordDefinition | null => {
    const chord = this.chord();
    if (!chord) return null;

    if (typeof chord === 'string') {
      return COMMON_CHORDS[chord] || null;
    }

    return chord;
  });

  protected readonly fingerings = computed((): ChordFingering[] => {
    const custom = this.customFingerings();
    if (custom.length > 0) return custom;

    const chordData = this.chordData();
    return chordData?.fingerings || [];
  });

  protected readonly displayName = computed(() => {
    const customName = this.name();
    if (customName) return customName;

    const chordData = this.chordData();
    return chordData?.name || '';
  });

  protected readonly displayBaseFret = computed(() => {
    const chordData = this.chordData();
    return Math.max(1, Math.floor(chordData?.baseFret || this.baseFret() || 1));
  });

  // Diagram row (1 = first row) of an absolute fret, or null when outside the window
  protected fretRow(fret: number): number | null {
    const row = fret - this.displayBaseFret() + 1;
    return row >= 1 && row <= this.fretCount() ? row : null;
  }

  protected readonly dimensions = computed(() => {
    const size = this.size();
    const frets = this.fretCount();
    const strings = this.stringCount();

    const stringSpacing = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
    const fretSpacing = size === 'sm' ? 16 : size === 'lg' ? 28 : 22;
    const padding = size === 'sm' ? 20 : size === 'lg' ? 35 : 28;
    const nutHeight = 4;
    const fingerRadius = size === 'sm' ? 5 : size === 'lg' ? 9 : 7;

    const width = (strings - 1) * stringSpacing + padding * 2;
    const height = frets * fretSpacing + padding * 2 + (this.showChordName() ? 24 : 0);

    return {
      width,
      height,
      stringSpacing,
      fretSpacing,
      padding,
      nutHeight,
      fingerRadius,
      gridLeft: padding,
      gridTop: padding + (this.showChordName() ? 24 : 0),
    };
  });

  protected readonly colors = computed(() => {
    const variant = this.variant();
    switch (variant) {
      case 'dark': {
        return {
          background: '#1E293B',
          string: '#94A3B8',
          fret: '#64748B',
          nut: '#F8FAFC',
          finger: '#3B82F6',
          fingerText: '#FFFFFF',
          text: '#F8FAFC',
          muted: '#EF4444',
          open: '#22C55E',
        };
      }
      case 'minimal': {
        // Drawn on the page's own background: the name, nut and finger dots use currentColor
        // (the container's slate-700, lightened on a dark page where it was unreadable) and the
        // finger numbers use fingerTextClasses, inverted against the dots
        return {
          background: 'transparent',
          string: '#94A3B8',
          fret: '#CBD5E1',
          nut: 'currentColor',
          finger: 'currentColor',
          fingerText: 'currentColor',
          text: 'currentColor',
          muted: '#EF4444',
          // Open-string ring: green-500 was ~2.3:1 on white, green-600 keeps >= 3:1
          open: '#16A34A',
        };
      }
      case 'detailed': {
        return {
          background: '#FEF3C7',
          string: '#92400E',
          fret: '#B45309',
          nut: '#1F2937',
          finger: '#1F2937',
          fingerText: '#FFFFFF',
          text: '#1F2937',
          muted: '#DC2626',
          open: '#059669',
        };
      }
      default: {
        return {
          background: '#FFFFFF',
          string: '#334155',
          fret: '#64748B',
          nut: '#1E293B',
          finger: '#1E293B',
          fingerText: '#FFFFFF',
          text: '#1E293B',
          muted: '#EF4444',
          // Open-string ring: green-500 was ~2.3:1 on white, green-600 keeps >= 3:1
          open: '#16A34A',
        };
      }
    }
  });

  /** Finger-number colour for the minimal variant, whose dots follow the page theme */
  protected readonly fingerTextClasses = computed(() =>
    this.variant() === 'minimal' ? 'text-white dark:text-slate-900' : ''
  );

  protected readonly containerClasses = computed(() => {
    const base = 'rounded-lg';
    const variantClasses: Record<ChordDiagramVariant, string> = {
      default: 'bg-white border border-slate-200 shadow-sm',
      dark: 'bg-slate-800 border border-slate-700',
      minimal: 'bg-transparent text-[#334155] dark:text-slate-200',
      detailed: 'bg-amber-50 border border-amber-200',
    };
    return this.twClass.merge(base, variantClasses[this.variant()], this.classOverride());
  });

  protected getStringX(stringNum: number): number {
    const { gridLeft, stringSpacing } = this.dimensions();
    const strings = this.stringCount();
    const leftHanded = this.leftHanded();

    // String 1 is high E (rightmost for right-handed)
    const adjustedString = leftHanded ? stringNum : strings - stringNum + 1;
    return gridLeft + (adjustedString - 1) * stringSpacing;
  }

  protected getFretY(fretNum: number): number {
    const { gridTop, fretSpacing, nutHeight } = this.dimensions();
    return gridTop + nutHeight + fretNum * fretSpacing;
  }

  protected getFingerPosition(fingering: ChordFingering): { x: number; y: number } | null {
    if (fingering.fret <= 0) return null;
    const row = this.fretRow(fingering.fret);
    if (row === null) return null;

    const x = this.getStringX(fingering.string);
    const y = this.getFretY(row) - this.dimensions().fretSpacing / 2;

    return { x, y };
  }

  protected getOpenMutedY(): number {
    return this.dimensions().gridTop - 8;
  }

  protected getBarreData(): { x1: number; x2: number; y: number } | null {
    const fingerings = this.fingerings();
    const barreFingerings = fingerings.filter(f => f.barre && f.fret > 0);
    if (barreFingerings.length === 0) return null;

    const barreRow = this.fretRow(barreFingerings[0].fret);
    if (barreRow === null) return null;

    // Prefer the explicit range from the chord definition (only when its fingerings are
    // the ones displayed); otherwise span the strings marked as barre.
    const chordData = this.chordData();
    const useChordRange =
      this.customFingerings().length === 0 && !!chordData?.barreFrom && !!chordData?.barreTo;
    const barreStrings = barreFingerings.map(f => f.string);
    const from = useChordRange ? chordData.barreFrom! : Math.min(...barreStrings);
    const to = useChordRange ? chordData.barreTo! : Math.max(...barreStrings);

    // Order left-to-right: string 1 is rightmost for right-handed diagrams, and the
    // template draws the barre rect from x1 with a positive width
    const xFrom = this.getStringX(from);
    const xTo = this.getStringX(to);
    return {
      x1: Math.min(xFrom, xTo),
      x2: Math.max(xFrom, xTo),
      y: this.getFretY(barreRow) - this.dimensions().fretSpacing / 2,
    };
  }

  protected readonly strings = computed(() => {
    return Array.from({ length: this.stringCount() }, (_, i) => i + 1);
  });

  protected readonly frets = computed(() => {
    return Array.from({ length: this.fretCount() }, (_, i) => i + 1);
  });

  protected readonly stringLabels = computed(() => {
    const count = this.stringCount();
    // Ordered by string number (string 1 = highest); getStringX() handles left/right handedness
    if (count === 6) {
      return ['E', 'B', 'G', 'D', 'A', 'E'];
    }
    if (count === 4) {
      return ['G', 'D', 'A', 'E'];
    }
    return [];
  });
}

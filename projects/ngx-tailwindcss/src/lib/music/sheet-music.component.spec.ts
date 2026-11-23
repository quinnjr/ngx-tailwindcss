import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseABCNotation,
  parseMusicXML,
  SAMPLE_MUSIC,
  SheetMusicData,
  TwSheetMusicComponent,
} from './sheet-music.component';
import { TwNoteComponent } from './note.component';
import { TwStaffComponent } from './staff.component';

describe('parseABCNotation', () => {
  it('ignores quoted chord symbols and lyric lines', () => {
    const parsed = parseABCNotation(
      ['X:1', 'T:Test', 'K:C', '"Am"A B "Dm"d e|', 'w:la la la la'].join('\n')
    );
    expect(parsed).not.toBeNull();
    const names = parsed!.measures.flatMap(m => m.notes.map(n => `${n.name}${n.octave}`));
    expect(names).toEqual(['A4', 'B4', 'D5', 'E5']);
  });

  it('maps minor and modal keys to their key signature', () => {
    const key = (k: string) => parseABCNotation(['X:1', `K:${k}`, 'C|'].join('\n'))!.keySignature;
    expect(key('Am')).toBe('C');
    expect(key('Dm')).toBe('F');
    expect(key('F#m')).toBe('A');
    expect(key('Bbmin')).toBe('Db');
    expect(key('D dorian')).toBe('C');
    expect(key('G')).toBe('G');
  });

  it('parses length modifiers relative to L:, including dotted values', () => {
    const parsed = parseABCNotation(['X:1', 'L:1/8', 'K:C', 'C3 D8 E/ F2 G// A7/2|'].join('\n'));
    const notes = parsed!.measures[0].notes.map(n => [n.duration, !!n.dotted]);
    expect(notes).toEqual([
      ['quarter', true],
      ['whole', false],
      ['sixteenth', false],
      ['quarter', false],
      ['thirtysecond', false],
      ['quarter', false], // 7/16 = double-dotted quarter
    ]);
    expect(parsed!.measures[0].notes[5].doubleDotted).toBe(true);

    const quarters = parseABCNotation(['X:1', 'L:1/4', 'K:C', 'C2 D|'].join('\n'));
    expect(quarters!.measures[0].notes.map(n => n.duration)).toEqual(['half', 'quarter']);
  });
});

describe('TwSheetMusicComponent', () => {
  let fixture: ComponentFixture<TwSheetMusicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwSheetMusicComponent);
  });

  it('aligns notes with the staff for non-default staff heights', () => {
    fixture.componentRef.setInput('staffHeight', 160);
    fixture.componentRef.setInput('lineSpacing', 12);
    fixture.detectChanges();
    // tw-staff places its top line at (height - 4 * spacing) / 2
    expect(
      (fixture.componentInstance as unknown as { noteStaffTop: () => number }).noteStaffTop()
    ).toBe((160 - 48) / 2);
  });

  it('draws the zoom percentage >= 4.5:1 on the light zoom controls', () => {
    const scss = readFileSync(
      join(process.cwd(), 'projects/ngx-tailwindcss/src/lib/music/sheet-music.component.scss'),
      'utf8'
    );
    // First (light) .zoom-display rule: slate-500 (#64748b) was ~4.3:1 on the slate-100 controls
    const rule = /\.zoom-display\s*\{([^}]*)\}/.exec(scss)?.[1] ?? '';
    expect(/color:\s*(#[0-9a-f]+)/i.exec(rule)?.[1]).toBe('#475569');
  });

  it('keeps the playback cursor in unscaled coordinates when zoomed', () => {
    fixture.componentRef.setInput('playbackPosition', 0.5);
    fixture.componentRef.setInput('zoom', 1);
    fixture.detectChanges();
    const cursorX = (): number =>
      (
        fixture.componentInstance as unknown as {
          getPlaybackCursorX: (m: number, l: number) => number;
        }
      ).getPlaybackCursorX(0, 0);
    const atZoom1 = cursorX();

    fixture.componentRef.setInput('zoom', 2);
    fixture.detectChanges();
    expect(cursorX()).toBe(atZoom1);
  });

  it('passes the clef to the rendered notes', () => {
    fixture.componentRef.setInput('music', {
      clef: 'bass',
      keySignature: 'C',
      timeSignature: '4/4',
      measures: [{ notes: [{ name: 'G', octave: 2, duration: 'quarter' }] }],
    });
    fixture.detectChanges();
    const note = fixture.debugElement.query(By.directive(TwNoteComponent));
    expect((note.componentInstance as { clef: () => string }).clef()).toBe('bass');
  });

  it('renders notes as SVG groups so browsers draw them inside the staff SVG', () => {
    fixture.detectChanges();
    const hosts = fixture.debugElement.queryAll(By.directive(TwNoteComponent));
    expect(hosts.length).toBeGreaterThan(0);
    for (const host of hosts) {
      const el = host.nativeElement as Element;
      expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(el.localName).toBe('g');
      expect(el.closest('svg')).not.toBeNull();
    }
  });

  const noteXs = (): number[] =>
    fixture.debugElement
      .queryAll(By.directive(TwNoteComponent))
      .map(d => (d.componentInstance as { x: () => number }).x());
  const barLineXs = (staffIndex: number): number[] => {
    const staff = (fixture.nativeElement as HTMLElement).querySelectorAll('tw-staff')[staffIndex];
    return [...staff.querySelectorAll('line')]
      .filter(l => l.getAttribute('x1') === l.getAttribute('x2'))
      .map(l => Number(l.getAttribute('x1')));
  };

  it('starts notes after a wide key signature', () => {
    const music: SheetMusicData = {
      clef: 'treble',
      keySignature: 'C#',
      timeSignature: '4/4',
      measures: [
        {
          notes: ['C', 'D', 'E', 'F'].map(name => ({
            name: name as 'C',
            octave: 5,
            duration: 'quarter' as const,
          })),
        },
      ],
    };
    fixture.componentRef.setInput('music', music);
    fixture.componentRef.setInput('width', 300);
    fixture.componentRef.setInput('measuresPerLine', 1);
    fixture.detectChanges();
    // tw-staff: 10 padding + 50 clef + (7 * 12 + 10) key + 30 time = 184
    expect(noteXs()[0]).toBeGreaterThan(184);
  });

  it('places notes inside the bar lines of a shorter last line', () => {
    const note = { name: 'C', octave: 5, duration: 'whole' } as const;
    fixture.componentRef.setInput('music', {
      clef: 'treble',
      keySignature: 'C',
      timeSignature: '4/4',
      measures: [{ notes: [note] }, { notes: [note] }, { notes: [note] }],
    } satisfies SheetMusicData);
    fixture.componentRef.setInput('measuresPerLine', 2);
    fixture.detectChanges();
    // The second line holds a single full-width measure (it starts at 10 padding + 50 clef +
    // 10 for the repeated C major key signature, no time signature), so its only note is
    // centred between 70 and the final bar line
    const lastBar = Math.max(...barLineXs(1));
    expect(noteXs()[2]).toBeCloseTo((70 + lastBar) / 2, 5);
  });

  it('repeats the key signature on every line', () => {
    const note = { name: 'C', octave: 5, duration: 'whole' } as const;
    fixture.componentRef.setInput('music', {
      clef: 'treble',
      keySignature: 'D',
      timeSignature: '4/4',
      measures: [{ notes: [note] }, { notes: [note] }],
    } satisfies SheetMusicData);
    fixture.componentRef.setInput('measuresPerLine', 1);
    fixture.detectChanges();
    const staves = (fixture.nativeElement as HTMLElement).querySelectorAll('tw-staff');
    expect(staves).toHaveLength(2);
    const sharps = (staff: Element): number =>
      [...staff.querySelectorAll('text')].filter(t => t.textContent?.includes('♯')).length;
    expect(sharps(staves[0])).toBe(2);
    expect(sharps(staves[1])).toBe(2);
  });

  it('keeps the pages layout on an existing line when the music changes', () => {
    const note = { name: 'C', octave: 5, duration: 'whole' } as const;
    const music = (measures: number): SheetMusicData => ({
      clef: 'treble',
      keySignature: 'C',
      timeSignature: '4/4',
      measures: Array.from({ length: measures }, () => ({ notes: [note] })),
    });
    const host = fixture.nativeElement as HTMLElement;
    const pageLabel = (): string =>
      [...host.querySelectorAll('span')]
        .map(s => s.textContent?.trim() ?? '')
        .find(t => t.startsWith('Line')) ?? '';
    fixture.componentRef.setInput('layout', 'pages');
    fixture.componentRef.setInput('measuresPerLine', 1);
    fixture.componentRef.setInput('music', music(4));
    fixture.detectChanges();
    const next = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Next'))!;
    next.click();
    next.click();
    next.click();
    fixture.detectChanges();
    expect(pageLabel()).toBe('Line 4 of 4');

    // Fewer lines (measuresPerLine grows): clamp to the last line
    fixture.componentRef.setInput('measuresPerLine', 2);
    fixture.detectChanges();
    expect(pageLabel()).toBe('Line 2 of 2');
    expect(host.querySelectorAll('tw-staff')).toHaveLength(1);

    // Another piece: start from its first line
    fixture.componentRef.setInput('music', music(2));
    fixture.detectChanges();
    expect(pageLabel()).toBe('Line 1 of 1');
    expect(host.querySelectorAll('tw-staff')).toHaveLength(1);
  });

  it('keeps the page navigation readable in dark mode on the transparent minimal variant', () => {
    fixture.componentRef.setInput('layout', 'pages');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const label = [...host.querySelectorAll('span')].find(s =>
      s.textContent?.trim().startsWith('Line')
    )!;
    expect(label.className).toContain('dark:text-slate-400');
    const buttons = [...host.querySelectorAll('button')].filter(b =>
      /Prev|Next/.test(b.textContent ?? '')
    );
    expect(buttons).toHaveLength(2);
    // Light buttons carry their own dark text rather than inheriting a dark-mode light colour
    for (const button of buttons) expect(button.classList).toContain('text-slate-800');
  });

  it('keeps tempo, measure numbers and the empty state readable (>= 4.5:1) in every variant', () => {
    const host = fixture.nativeElement as HTMLElement;
    const tempo = (): HTMLElement =>
      [...host.querySelectorAll('p')].find(p => p.textContent?.includes('♩ ='))!;
    const measureNumber = (): HTMLElement => host.querySelector('span.absolute')!;
    fixture.componentRef.setInput('showMeasureNumbers', true);
    fixture.componentRef.setInput('variant', 'handwritten');
    fixture.detectChanges();
    for (const el of [tempo(), measureNumber()]) {
      expect(el.classList).toContain('text-slate-600');
      expect(el.className).not.toMatch(/text-slate-[45]00/);
    }

    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('music', { ...SAMPLE_MUSIC, measures: [] });
    fixture.detectChanges();
    const empty = [...host.querySelectorAll('div')]
      .reverse()
      .find(d => d.textContent?.includes('No music to display'))!;
    expect(empty.classList).toContain('text-slate-600');
    expect(empty.classList).toContain('dark:text-slate-400');
  });

  it('emits parseError once per unparseable input', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const errors: string[] = [];
    fixture.componentInstance.parseError.subscribe(e => errors.push(e));
    fixture.componentRef.setInput('musicXml', '<not-a-score/>');
    fixture.detectChanges();
    fixture.detectChanges();
    expect(errors).toEqual(['Failed to parse MusicXML']);

    fixture.componentRef.setInput('musicXml', '<still-not-a-score/>');
    fixture.detectChanges();
    expect(errors).toEqual(['Failed to parse MusicXML', 'Failed to parse MusicXML']);
    errorSpy.mockRestore();
  });
});

describe('parseMusicXML accidentals', () => {
  const xml = (notes: string): string =>
    `<?xml version="1.0"?><score-partwise><part-list/><part id="P1"><measure number="1">
      <attributes><key><fifths>1</fifths></key></attributes>${notes}</measure>
      <measure number="2">${notes}</measure></part></score-partwise>`;
  const pitch = (step: string, alter: number, extra = ''): string =>
    `<note><pitch><step>${step}</step><alter>${alter}</alter><octave>4</octave></pitch>` +
    `<duration>1</duration><type>quarter</type>${extra}</note>`;

  it('stores written accidentals: implied ones are dropped, cancelled ones get a natural', () => {
    // G major: F# (implied), F natural (needs a natural), F natural again (implied in the bar)
    const parsed = parseMusicXML(xml(pitch('F', 1) + pitch('F', 0) + pitch('F', 0)))!;
    for (const measure of parsed.measures) {
      expect(measure.notes.map(n => n.accidental)).toEqual([null, 'natural', null]);
    }
  });

  it('keeps an explicit courtesy accidental', () => {
    const parsed = parseMusicXML(xml(pitch('F', 1, '<accidental>sharp</accidental>')))!;
    expect(parsed.measures[0].notes[0].accidental).toBe('sharp');
  });
});

describe('key changes', () => {
  it('parseMusicXML keeps the opening key/time/clef at score level and the change on its measure', () => {
    const parsed = parseMusicXML(
      `<?xml version="1.0"?><score-partwise><part-list/><part id="P1">
        <measure number="1"><attributes><key><fifths>1</fifths></key>
          <time><beats>3</beats><beat-type>4</beat-type></time></attributes>
          <note><pitch><step>C</step><octave>5</octave></pitch><type>quarter</type></note></measure>
        <measure number="2"><attributes><key><fifths>2</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
          <note><pitch><step>C</step><alter>1</alter><octave>5</octave></pitch><type>quarter</type></note></measure>
      </part></score-partwise>`
    )!;
    expect(parsed.keySignature).toBe('G');
    expect(parsed.timeSignature).toBe('3/4');
    expect(parsed.measures[1].keySignature).toBe('D');
    // C natural in G and C# in D: neither needs a written accidental
    expect(parsed.measures.map(m => m.notes[0].accidental)).toEqual([null, null]);
  });

  it('parseABCNotation applies a K: line in the body from the next measure on', () => {
    const parsed = parseABCNotation(
      ['X:1', 'L:1/4', 'K:G', 'c4|', 'K:D', 'L:1/8', 'c8|'].join('\n')
    )!;
    expect(parsed.keySignature).toBe('G');
    expect(parsed.measures.map(m => m.keySignature)).toEqual([undefined, 'D']);
    expect(parsed.measures.map(m => m.notes[0].duration)).toEqual(['whole', 'whole']);
  });

  it('re-spells notes after a key change inside a line and starts later lines in the new key', () => {
    const fixture = TestBed.createComponent(TwSheetMusicComponent);
    const c5 = { name: 'C', octave: 5, duration: 'whole' } as const;
    fixture.componentRef.setInput('music', {
      clef: 'treble',
      keySignature: 'G',
      timeSignature: '4/4',
      // Measure 2 changes to D major: its unmarked C sounds C#
      measures: [{ notes: [c5] }, { keySignature: 'D', notes: [c5] }, { notes: [c5] }],
    } satisfies SheetMusicData);
    fixture.componentRef.setInput('measuresPerLine', 2);
    fixture.detectChanges();
    const accidentals = fixture.debugElement
      .queryAll(By.directive(TwNoteComponent))
      .map(d => (d.componentInstance as { accidental: () => string | null }).accidental());
    // Line 1 is drawn in G: the C# needs a sharp. Line 2 is drawn in D: no accidental.
    expect(accidentals).toEqual([null, 'sharp', null]);
    const staffKeys = fixture.debugElement
      .queryAll(By.directive(TwStaffComponent))
      .map(d => (d.componentInstance as { keySignature: () => string }).keySignature());
    expect(staffKeys).toEqual(['G', 'D']);
  });
});

describe('TwSheetMusicComponent interaction', () => {
  let fixture: ComponentFixture<TwSheetMusicComponent>;
  const music: SheetMusicData = {
    clef: 'treble',
    keySignature: 'C',
    timeSignature: '4/4',
    measures: [
      { notes: [{ name: 'C', octave: 5, duration: 'whole', tied: true }] },
      { notes: [{ name: 'C', octave: 5, duration: 'whole' }] },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwSheetMusicComponent);
    fixture.componentRef.setInput('music', music);
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('measuresPerLine', 2);
  });

  it.each(['scroll', 'pages', 'single'] as const)(
    'emits measureClick and noteClick in the %s layout',
    layout => {
      fixture.componentRef.setInput('layout', layout);
      fixture.detectChanges();
      const measures: number[] = [];
      const notes: number[] = [];
      fixture.componentInstance.measureClick.subscribe(m => measures.push(m));
      fixture.componentInstance.noteClick.subscribe(e => notes.push(e.measure));

      const staff = fixture.debugElement.query(By.directive(TwStaffComponent));
      const svg = (staff.nativeElement as HTMLElement).querySelector('svg')!;
      const rect = new DOMRect(0, 0, 800, 120);
      svg.getBoundingClientRect = () => rect;
      // 800px wide, C major: measures start at x = 100 and are 345px wide
      staff.triggerEventHandler('click', { clientX: 600, currentTarget: staff.nativeElement });
      expect(measures).toEqual([1]);

      const noteEl = fixture.debugElement.queryAll(By.directive(TwNoteComponent))[0];
      (noteEl.nativeElement as Element).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(notes).toEqual([0]);
      // A note click is not also reported as a measure click
      expect(measures).toEqual([1]);
    }
  );

  it('draws ties for tied notes', () => {
    fixture.detectChanges();
    const tie = (fixture.nativeElement as HTMLElement).querySelectorAll('g[twNote] path');
    expect(tie.length).toBe(1);
  });
});

describe('TwSheetMusicComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwSheetMusicComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).not.toContain('bg-white');
  });
});

describe('TwSheetMusicComponent minimal variant notes', () => {
  it('draws the notes in the container text colour so they follow a dark page', async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwSheetMusicComponent);
    const heads = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('g[twNote] ellipse')].map(e =>
        e.getAttribute('stroke')
      );
    fixture.detectChanges();
    expect(heads().length).toBeGreaterThan(0);
    expect(new Set(heads())).toEqual(new Set(['#1E293B']));

    // Fixed slate-800 notes were ~1.2:1 on a dark page behind the transparent variant
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(new Set(heads())).toEqual(new Set(['currentColor']));
    const container = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(container).toEqual(expect.arrayContaining(['text-slate-800', 'dark:text-slate-200']));
  });
});

describe('TwSheetMusicComponent zoom controls', () => {
  it('names the symbol-only zoom buttons by their action', async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwSheetMusicComponent);
    fixture.componentRef.setInput('variant', 'printed');
    fixture.detectChanges();
    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.zoom-controls button'),
    ].map(b => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Zoom out', 'Zoom in', 'Reset zoom', 'Print']);
  });
});

describe('TwSheetMusicComponent keyboard interaction', () => {
  let fixture: ComponentFixture<TwSheetMusicComponent>;
  const music: SheetMusicData = {
    clef: 'treble',
    keySignature: 'C',
    timeSignature: '4/4',
    measures: [
      { notes: [{ name: 'F', octave: 4, accidental: 'sharp', duration: 'whole' }] },
      { notes: [{ name: 'C', octave: 5, duration: 'whole', isRest: true }] },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwSheetMusicComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwSheetMusicComponent);
    fixture.componentRef.setInput('music', music);
    fixture.componentRef.setInput('measuresPerLine', 2);
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('has no keyboard targets unless interactive', () => {
    fixture.detectChanges();
    expect(el().querySelectorAll('g[twNote][role="button"], g[twNote][tabindex]').length).toBe(0);
    expect(el().querySelectorAll('button[aria-label^="Measure"]').length).toBe(0);
    expect(el().querySelectorAll('.tw-note-focus-ring').length).toBe(0);
  });

  it.each(['scroll', 'pages', 'single'] as const)(
    'emits measureClick and noteClick from the keyboard in the %s layout',
    layout => {
      fixture.componentRef.setInput('interactive', true);
      fixture.componentRef.setInput('layout', layout);
      fixture.detectChanges();
      const measures: number[] = [];
      const notes: number[] = [];
      fixture.componentInstance.measureClick.subscribe(m => measures.push(m));
      fixture.componentInstance.noteClick.subscribe(e => notes.push(e.measure));

      const measureButtons = [
        ...el().querySelectorAll<HTMLButtonElement>('button[aria-label^="Measure"]'),
      ];
      expect(measureButtons.map(b => b.getAttribute('aria-label'))).toEqual([
        'Measure 1',
        'Measure 2',
      ]);
      // Keyboard-only: pointer clicks pass through to the staff and notes underneath
      expect(measureButtons[0].className).toContain('pointer-events-none');
      expect(measureButtons[0].className).toContain('focus-visible:outline-2');
      measureButtons[1].click();
      expect(measures).toEqual([1]);

      const noteEls = [...el().querySelectorAll('g[twNote][role="button"]')];
      expect(noteEls.map(n => n.getAttribute('aria-label'))).toEqual([
        'Measure 1, note 1: F sharp 4, whole',
        'Measure 2, note 1: whole rest',
      ]);
      expect(noteEls[0].getAttribute('tabindex')).toBe('0');
      expect(noteEls[0].querySelector('.tw-note-focus-ring')).not.toBeNull();
      for (const key of ['Enter', ' ']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        noteEls[1].dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      expect(notes).toEqual([1, 1]);
      expect(measures).toEqual([1]);
    }
  );
});

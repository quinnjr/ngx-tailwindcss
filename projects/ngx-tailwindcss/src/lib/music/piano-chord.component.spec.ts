import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwPianoChordComponent } from './piano-chord.component';

interface PianoChordInternals {
  blackKeys: () => Array<{ note: string; octave: number; position: number }>;
  dimensions: () => { whiteKeyWidth: number; blackKeyWidth: number; padding: number };
  getBlackKeyX: (position: number) => number;
  getFingerX: (note: string, octave: number) => number;
  isNoteActive: (note: string, octave: number) => boolean;
}

describe('TwPianoChordComponent', () => {
  let fixture: ComponentFixture<TwPianoChordComponent>;
  let cmp: PianoChordInternals;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwPianoChordComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwPianoChordComponent);
    cmp = fixture.componentInstance as unknown as PianoChordInternals;
  });

  it('draws each black key across the boundary between its white keys', () => {
    fixture.detectChanges();
    const { whiteKeyWidth: w, blackKeyWidth: bw, padding } = cmp.dimensions();
    const boundaries: Record<string, number> = { 'C#': 1, 'D#': 2, 'F#': 4, 'G#': 5, 'A#': 6 };
    for (const key of cmp.blackKeys()) {
      const boundary = padding + ((key.octave - 4) * 7 + boundaries[key.note]) * w;
      const left = cmp.getBlackKeyX(key.position);
      expect(left).toBeLessThan(boundary);
      expect(left + bw).toBeGreaterThan(boundary);
      // The finger marker is centred on the drawn key
      expect(cmp.getFingerX(key.note, key.octave)).toBeCloseTo(left + bw / 2);
    }
  });

  it('accepts flat note names in custom chords', () => {
    fixture.componentRef.setInput('customChord', {
      name: 'Bb',
      notes: [
        { note: 'Bb', octave: 4, isRoot: true },
        { note: 'D', octave: 5 },
        { note: 'F', octave: 5 },
      ],
    });
    fixture.detectChanges();
    expect(cmp.isNoteActive('A#', 4)).toBe(true);
    const aSharp = cmp.blackKeys().find(k => k.note === 'A#' && k.octave === 4)!;
    expect(cmp.getFingerX('Bb', 4)).toBeCloseTo(
      cmp.getBlackKeyX(aSharp.position) + cmp.dimensions().blackKeyWidth / 2
    );
  });

  it('draws finger markers on their keys inside the SVG when the chord name is shown', () => {
    fixture.componentRef.setInput('chord', 'Cm');
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    const svgHeight = Number(svg.getAttribute('height'));
    const { padding } = cmp.dimensions();
    const keyBottom = (rect: Element): number =>
      Number(rect.getAttribute('y')) + Number(rect.getAttribute('height'));
    const [whiteKey] = [...svg.querySelectorAll('rect')];
    const blackKey = [...svg.querySelectorAll('rect')].find(r => !r.hasAttribute('stroke'))!;
    const circles = [...svg.querySelectorAll('circle')];
    expect(circles).toHaveLength(3);
    for (const circle of circles) {
      const cy = Number(circle.getAttribute('cy'));
      const r = Number(circle.getAttribute('r'));
      expect(cy - r).toBeGreaterThanOrEqual(padding);
      expect(cy + r).toBeLessThanOrEqual(svgHeight);
    }
    // E flat (index 1) sits on the black key, C (index 0) on the white key
    const cyOf = (i: number): number => Number(circles[i].getAttribute('cy'));
    expect(cyOf(1)).toBeLessThan(keyBottom(blackKey));
    expect(cyOf(0)).toBeGreaterThan(keyBottom(blackKey));
    expect(cyOf(0)).toBeLessThan(keyBottom(whiteKey));
  });

  it('spells the built-in C minor chord with E flat', () => {
    fixture.componentRef.setInput('chord', 'Cm');
    fixture.componentRef.setInput('showNoteNames', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Eb4');
    expect(cmp.isNoteActive('D#', 4)).toBe(true);
  });
  it('does not draw finger markers for chord notes outside the visible octaves', () => {
    // G major: G4, B4, D5 — only octave 4 is shown, so D5 has no key on the keyboard
    fixture.componentRef.setInput('chord', 'G');
    fixture.componentRef.setInput('octaveCount', 1);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    const width = Number(svg.getAttribute('width'));
    const circles = [...svg.querySelectorAll('circle')];
    expect(circles).toHaveLength(2);
    for (const circle of circles) {
      expect(Number(circle.getAttribute('cx'))).toBeLessThan(width);
    }
  });

  it('draws the minimal variant key labels >= 4.5:1 on the white keys', () => {
    fixture.componentRef.setInput('chord', 'C');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('showKeyLabels', true);
    fixture.detectChanges();
    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<SVGTextElement>('svg text'),
    ].filter(t => /^C\d$/.test(t.textContent?.trim() ?? ''));
    expect(labels.length).toBeGreaterThan(0);
    // slate-400 (#94A3B8) was ~2.6:1 on white; C4 is in the chord (blue-200 key)
    const fill = (name: string) =>
      labels
        .find(t => t.textContent?.trim() === name)
        ?.getAttribute('fill')
        ?.toUpperCase();
    expect(fill('C5')).toBe('#64748B');
    expect(fill('C4')).toBe('#334155');
  });

  it('keeps key labels on chord (active) keys >= 4.5:1 in every variant', () => {
    fixture.componentRef.setInput('chord', 'C');
    fixture.componentRef.setInput('showKeyLabels', true);
    const c4Label = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<SVGTextElement>('svg text')]
        .find(t => t.textContent?.trim() === 'C4')
        ?.getAttribute('fill')
        ?.toUpperCase();
    // The grey labels were ~1.9-3.4:1 on the active key fills
    const expected: Record<string, string> = {
      default: '#374151',
      dark: '#1E293B',
      minimal: '#334155',
      colorful: '#44403C',
    };
    for (const [variant, color] of Object.entries(expected)) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      expect(c4Label()).toBe(color);
    }
  });

  it('keeps the white finger numbers >= 4.5:1 on the dark and colorful finger circles', () => {
    fixture.componentRef.setInput('chord', 'C');
    const fills = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('svg circle')].map(c =>
        c.getAttribute('fill')?.toUpperCase()
      );
    // Dark: red-500 (~3.8:1) and amber-500 (~2.1:1) circles behind white text
    fixture.componentRef.setInput('variant', 'dark');
    fixture.detectChanges();
    expect(fills()).toEqual(['#B45309', '#DC2626', '#DC2626']);
    // Colorful: pink-500 (~3.5:1) and violet-500 (~4.2:1)
    fixture.componentRef.setInput('variant', 'colorful');
    fixture.detectChanges();
    expect(fills()).toEqual(['#DB2777', '#7C3AED', '#7C3AED']);
  });
});

describe('TwPianoChordComponent minimal variant theme', () => {
  it('draws the chord name and note names in the container colour so they follow a dark page', async () => {
    await TestBed.configureTestingModule({ imports: [TwPianoChordComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwPianoChordComponent);
    fixture.componentRef.setInput('chord', 'C');
    fixture.componentRef.setInput('showNoteNames', true);
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const container = host.firstElementChild as HTMLElement;
    // Fixed slate-700 on the transparent background was ~1.5:1 on a dark page
    expect([...container.classList]).toEqual(
      expect.arrayContaining(['text-[#334155]', 'dark:text-slate-200'])
    );
    const spans = [...host.querySelectorAll<HTMLElement>('span')];
    expect(spans.length).toBeGreaterThan(1);
    for (const span of spans) expect(span.style.color).toBe('currentcolor');

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(host.querySelector<HTMLElement>('span')!.style.color).toBe('rgb(31, 41, 55)');
  });
});

describe('TwPianoChordComponent chord type contrast', () => {
  it('does not dim the chord type on the minimal variant (slate-700 at 70% is below 4.5:1)', async () => {
    await TestBed.configureTestingModule({ imports: [TwPianoChordComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwPianoChordComponent);
    fixture.componentRef.setInput('chord', 'C');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const typeSpan = () => host.querySelectorAll<HTMLElement>('span')[1];
    expect(typeSpan().textContent?.trim()).toBe('major');
    expect(typeSpan().classList).not.toContain('opacity-70');

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(typeSpan().classList).toContain('opacity-70');
  });
});

describe('TwPianoChordComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwPianoChordComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwPianoChordComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900 p-4');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).toContain('p-4');
    expect(classes).not.toContain('bg-white');
    expect(classes).not.toContain('p-2');
  });
});

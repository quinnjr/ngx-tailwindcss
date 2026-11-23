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
});

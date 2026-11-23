import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwStaffComponent } from './staff.component';

describe('TwStaffComponent', () => {
  let fixture: ComponentFixture<TwStaffComponent>;

  const accidentalYs = (): number[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<SVGTextElement>('text'),
      t => t
    )
      .filter(t => ['♯', '♭'].includes(t.textContent?.trim() ?? ''))
      .map(t => Number(t.getAttribute('y')));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwStaffComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwStaffComponent);
    // height 120, lineSpacing 10 => top line y=40
    fixture.componentRef.setInput('height', 120);
    fixture.componentRef.setInput('lineSpacing', 10);
  });

  it('places the 7th flat of Cb major (Fb) on F4, not F5', () => {
    fixture.componentRef.setInput('keySignature', 'Cb');
    fixture.detectChanges();
    const ys = accidentalYs();
    expect(ys).toHaveLength(7);
    // F4 is position 7 (half-spaces below the top line): 40 + 7 * 5 + 8 (glyph offset)
    expect(ys[6]).toBe(40 + 35 + 8);
  });

  it('shifts key signature accidentals for the bass clef', () => {
    fixture.componentRef.setInput('keySignature', 'G');
    fixture.componentRef.setInput('clef', 'treble');
    fixture.detectChanges();
    const trebleY = accidentalYs()[0];

    fixture.componentRef.setInput('clef', 'bass');
    fixture.detectChanges();
    const bassY = accidentalYs()[0];

    // F#5 on the treble top line vs F#3 on the bass 4th line: one line spacing lower
    expect(bassY - trebleY).toBe(10);
  });

  it('writes the tenor-clef G# inside the staff (G#3), not on a ledger position above it', () => {
    fixture.componentRef.setInput('keySignature', 'A');
    fixture.componentRef.setInput('clef', 'tenor');
    fixture.detectChanges();
    const ys = accidentalYs();
    expect(ys).toHaveLength(3);
    // Tenor top line is E4 (position 0): F#4 at -1, C#4 at 2, G#3 at 5 (+ 8 glyph offset)
    expect(ys).toEqual([40 - 5 + 8, 40 + 10 + 8, 40 + 25 + 8]);
  });

  it('names the drawn staff for assistive tech without hiding projected content', () => {
    fixture.componentRef.setInput('keySignature', 'A');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const img = host.querySelector('svg g[role="img"]');
    expect(img?.getAttribute('aria-label')).toBe('Treble staff, key of A major, 4/4 time');
    // The glyph texts (clef, accidentals, time) sit inside the named image
    expect(img?.querySelectorAll('text').length).toBeGreaterThan(0);
    // Notes are projected outside it so their own labels stay exposed
    expect(img?.querySelector('.staff-content')).toBeNull();

    fixture.componentRef.setInput('keySignature', 'Bb');
    fixture.componentRef.setInput('clef', 'bass');
    fixture.componentRef.setInput('timeSignature', 'C|');
    fixture.detectChanges();
    expect(img?.getAttribute('aria-label')).toBe('Bass staff, key of B flat major, cut time');

    fixture.componentRef.setInput('grandStaff', true);
    fixture.componentRef.setInput('timeSignature', null);
    fixture.detectChanges();
    expect(host.querySelector('svg g[role="img"]')?.getAttribute('aria-label')).toBe(
      'Grand staff, key of B flat major'
    );
    // The bass staff's glyphs are covered by that name
    expect(host.querySelector('g[aria-hidden="true"] text')).not.toBeNull();

    fixture.componentRef.setInput('ariaLabel', 'Exercise 1');
    fixture.detectChanges();
    expect(host.querySelector('svg g[role="img"]')?.getAttribute('aria-label')).toBe('Exercise 1');
  });
});

describe('TwStaffComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwStaffComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwStaffComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).not.toContain('bg-white');
  });
});

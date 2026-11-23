import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseABCNotation, TwSheetMusicComponent } from './sheet-music.component';

describe('parseABCNotation', () => {
  it('ignores quoted chord symbols and lyric lines', () => {
    const parsed = parseABCNotation(
      ['X:1', 'T:Test', 'K:C', '"Am"A B "Dm"d e|', 'w:la la la la'].join('\n')
    );
    expect(parsed).not.toBeNull();
    const names = parsed!.measures.flatMap(m => m.notes.map(n => `${n.name}${n.octave}`));
    expect(names).toEqual(['A4', 'B4', 'D5', 'E5']);
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
    const note = fixture.debugElement.query(el => el.name === 'tw-note');
    expect((note.componentInstance as { clef: () => string }).clef()).toBe('bass');
  });
});

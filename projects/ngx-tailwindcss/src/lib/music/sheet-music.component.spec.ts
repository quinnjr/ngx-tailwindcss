import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseABCNotation, SheetMusicData, TwSheetMusicComponent } from './sheet-music.component';
import { TwNoteComponent } from './note.component';

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
    // The second line holds a single full-width measure (it starts at 10 padding + 50 clef,
    // no key/time signature), so its only note is centred between 60 and the final bar line
    const lastBar = Math.max(...barLineXs(1));
    expect(noteXs()[2]).toBeCloseTo((60 + lastBar) / 2, 5);
  });
});

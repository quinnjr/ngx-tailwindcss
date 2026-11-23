import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LeadSheetStyle, TwLeadSheetComponent } from './lead-sheet.component';
import { ChordDefinition } from './chord-diagram.component';

describe('TwLeadSheetComponent', () => {
  let fixture: ComponentFixture<TwLeadSheetComponent>;

  const convert = (chord: string, style: LeadSheetStyle, key = 'C'): string => {
    fixture.componentRef.setInput('style', style);
    fixture.componentRef.setInput('data', { key, sections: [] });
    return (
      fixture.componentInstance as unknown as { convertChord: (c: string) => string }
    ).convertChord(chord);
  };

  const diagramFor = (chord: string): ChordDefinition | null =>
    (
      fixture.componentInstance as unknown as {
        getChordDiagram: (c: { chord: string }) => ChordDefinition | null;
      }
    ).getChordDiagram({ chord });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwLeadSheetComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwLeadSheetComponent);
  });

  it('converts minor and diminished chords to Nashville numbers', () => {
    expect(convert('Am', 'nashville')).toBe('6m');
    expect(convert('Am7', 'nashville')).toBe('6m7');
    expect(convert('Dm', 'nashville')).toBe('2m');
    expect(convert('Bdim', 'nashville')).toBe('7°');
    expect(convert('G7', 'nashville')).toBe('57');
    expect(convert('Fmaj7', 'nashville')).toBe('4maj7');
    expect(convert('F#m', 'nashville', 'D')).toBe('3m');
  });

  it('converts to roman numerals without doubling the diminished sign', () => {
    expect(convert('Am7', 'roman')).toBe('vi7');
    expect(convert('Bdim', 'roman')).toBe('vii°');
    expect(convert('G', 'roman')).toBe('V');
  });

  it('leaves non-diatonic chords unchanged', () => {
    expect(convert('D', 'nashville')).toBe('D');
  });

  it('looks up the diagram for the correct triad quality', () => {
    expect(diagramFor('Am7')?.name).toBe('Am');
    expect(diagramFor('G/B')?.name).toBe('G');
    // Dm has no built-in diagram; it must not fall back to D major
    expect(diagramFor('Dm')).toBeNull();
  });

  it('uses two beats per measure for cut time', () => {
    fixture.componentRef.setInput('data', { timeSignature: 'C|', sections: [] });
    const internals = fixture.componentInstance as unknown as {
      getBeatsPerMeasure: () => number;
      getDefaultSlashBeats: () => number[];
    };
    expect(internals.getBeatsPerMeasure()).toBe(2);
    expect(internals.getDefaultSlashBeats()).toEqual([1, 2]);
    fixture.componentRef.setInput('data', { timeSignature: 'C', sections: [] });
    expect(internals.getBeatsPerMeasure()).toBe(4);
  });

  it('makes clickable chord symbols keyboard accessible', () => {
    const clicks: unknown[] = [];
    fixture.componentInstance.chordClick.subscribe(c => clicks.push(c));
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('data', {
      sections: [{ measures: [{ chords: [{ chord: 'G' }] }] }],
    });
    fixture.detectChanges();
    const chord = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="button"]'
    );
    expect(chord).not.toBeNull();
    expect(chord!.tabIndex).toBe(0);
    chord!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clicks).toHaveLength(1);
  });
});

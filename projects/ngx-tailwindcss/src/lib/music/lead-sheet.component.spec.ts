import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders fakebook chord symbols bold (a static font-semibold would always win)', () => {
    fixture.componentRef.setInput('data', {
      sections: [{ measures: [{ chords: [{ chord: 'G' }] }] }],
    });
    const chord = (): HTMLElement =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('span')].find(
        s => s.textContent?.trim() === 'G'
      )!;
    fixture.componentRef.setInput('variant', 'fakebook');
    fixture.detectChanges();
    expect(chord().classList).toContain('font-bold');
    expect(chord().classList).not.toContain('font-semibold');

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(chord().classList).toContain('font-semibold');
    expect(chord().classList).not.toContain('font-bold');
  });

  it('keeps the minimal variant hover background dark in dark mode (light text on slate-50)', () => {
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('data', {
      sections: [{ measures: [{ chords: [{ chord: 'G' }] }] }],
    });
    fixture.detectChanges();
    const measure = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.flex-1.cursor-pointer'
    );
    expect(measure).not.toBeNull();
    expect(measure!.classList).toContain('hover:bg-slate-50');
    expect(measure!.classList).toContain('dark:hover:bg-slate-800');
  });

  it('gives each clickable measure its own focusable button, not wrapping the chords', () => {
    const measureClicks: unknown[] = [];
    fixture.componentInstance.measureClick.subscribe(m => measureClicks.push(m));
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('data', {
      sections: [{ measures: [{ chords: [{ chord: 'G' }] }, { chords: [{ chord: 'C' }] }] }],
    });
    fixture.detectChanges();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Measure"]'
      ),
    ];
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Measure 1', 'Measure 2']);
    for (const button of buttons) {
      expect(button.querySelector('[role="button"], button')).toBeNull();
    }
    buttons[1].click();
    expect(measureClicks).toEqual([{ section: 0, measure: 1 }]);
  });

  it('colours measure markers for the variant surface instead of inheriting the page colour', () => {
    fixture.componentRef.setInput('variant', 'dark');
    fixture.componentRef.setInput('showMeasureNumbers', true);
    fixture.componentRef.setInput('data', {
      sections: [{ measures: [{ chords: [], repeatEnd: true }] }],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const span = (text: string) =>
      [...host.querySelectorAll<HTMLElement>('span')].find(el => el.textContent?.trim() === text)!;

    // Black page text on the slate-950 surface was unreadable
    expect(span('𝄇').parentElement!.classList).toContain('text-slate-300');
    expect(span('1').closest('.text-slate-300')).not.toBeNull();
    expect(span('1').classList).not.toContain('opacity-50');
    expect(span('%').classList).toContain('text-slate-300');
    expect(span('%').classList).not.toContain('opacity-30');

    fixture.componentRef.setInput('variant', 'fakebook');
    fixture.detectChanges();
    expect(span('%').classList).toContain('text-amber-900');
  });

  it('draws rhythm slashes and rests >= 4.5:1 instead of faint greys', () => {
    fixture.componentRef.setInput('data', {
      sections: [
        {
          measures: [
            { chords: [{ chord: 'C' }], slashPattern: { beats: [1, 2, 3, 4], rests: [4] } },
          ],
        },
      ],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const rest = () =>
      [...host.querySelectorAll<HTMLElement>('span')].find(el => el.textContent?.trim() === '𝄽')!;
    // slate-400 on white was ~2.6:1, and the rest was faded a further 50%
    expect(rest().parentElement!.classList).toContain('text-slate-600');
    expect(rest().parentElement!.classList).toContain('dark:text-slate-400');
    expect(rest().classList).not.toContain('opacity-50');

    // slate-600 on slate-950 was ~2.7:1
    fixture.componentRef.setInput('variant', 'dark');
    fixture.detectChanges();
    expect(rest().parentElement!.classList).toContain('text-slate-400');
  });
});

describe('TwLeadSheetComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({ imports: [TwLeadSheetComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwLeadSheetComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900 p-2');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).toContain('p-2');
    expect(classes).not.toContain('bg-white');
    expect(classes).not.toContain('p-6');
  });

  it("warns once in dev mode that displayMode 'with-staff' is not yet supported", async () => {
    await TestBed.configureTestingModule({ imports: [TwLeadSheetComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwLeadSheetComponent);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      fixture.componentRef.setInput('data', { sections: [] });
      fixture.detectChanges();
      expect(warn).not.toHaveBeenCalled();

      fixture.componentRef.setInput('displayMode', 'with-staff');
      fixture.detectChanges();
      fixture.componentRef.setInput('displayMode', 'chords-only');
      fixture.detectChanges();
      fixture.componentRef.setInput('displayMode', 'with-staff');
      fixture.detectChanges();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("'with-staff' is not yet supported");
    } finally {
      warn.mockRestore();
    }
  });
});

describe('TwLeadSheetComponent accessible name', () => {
  it('names the lead sheet as a group (aria-label on a plain div is ignored)', async () => {
    await TestBed.configureTestingModule({ imports: [TwLeadSheetComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwLeadSheetComponent);
    fixture.detectChanges();
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Lead sheet');
  });
});

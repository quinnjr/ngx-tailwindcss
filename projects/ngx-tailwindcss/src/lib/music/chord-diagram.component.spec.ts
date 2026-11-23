import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwChordDiagramComponent } from './chord-diagram.component';

describe('TwChordDiagramComponent', () => {
  let fixture: ComponentFixture<TwChordDiagramComponent>;

  // String labels are the small 10px texts below the grid, read left to right
  const labelsLeftToRight = (): string[] =>
    [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<SVGTextElement>(
        'text[font-size="10"].opacity-80'
      ),
    ]
      .sort((a, b) => Number(a.getAttribute('x')) - Number(b.getAttribute('x')))
      .map(t => t.textContent?.trim() ?? '');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwChordDiagramComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TwChordDiagramComponent);
    fixture.componentRef.setInput('chord', 'C');
  });

  it('names the diagram after the chord and its frets, lowest string first', () => {
    fixture.detectChanges();
    const svg = () => (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('C chord diagram, frets x 3 2 0 1 0');

    fixture.componentRef.setInput('ariaLabel', 'Opening chord');
    fixture.detectChanges();
    expect(svg().getAttribute('aria-label')).toBe('Opening chord');
  });

  it('labels right-handed guitar strings E A D G B E from left to right', () => {
    fixture.detectChanges();
    expect(labelsLeftToRight()).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
  });

  it('mirrors the labels for left-handed players', () => {
    fixture.componentRef.setInput('leftHanded', true);
    fixture.detectChanges();
    expect(labelsLeftToRight()).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
  });

  it('labels a right-handed 4-string bass E A D G from left to right', () => {
    fixture.componentRef.setInput('stringCount', 4);
    fixture.detectChanges();
    expect(labelsLeftToRight()).toEqual(['E', 'A', 'D', 'G']);
  });

  it('draws a barre for custom fingerings marked as barre', () => {
    fixture.componentRef.setInput('chord', null);
    fixture.componentRef.setInput('customFingerings', [
      { string: 1, fret: 2, finger: 1, barre: true },
      { string: 2, fret: 2, finger: 1, barre: true },
      { string: 3, fret: 2, finger: 1, barre: true },
      { string: 4, fret: 4, finger: 3 },
      { string: 5, fret: 0 },
      { string: 6, fret: -1 },
    ]);
    fixture.detectChanges();
    const barre = (fixture.nativeElement as HTMLElement).querySelector('rect[rx="5"]');
    expect(barre).not.toBeNull();
  });

  it('closes the top of the grid when the diagram starts above the nut', () => {
    const host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(host.querySelector('line.grid-top')).toBeNull();

    fixture.componentRef.setInput('chord', {
      name: 'A (5fr)',
      baseFret: 5,
      fingerings: [{ string: 1, fret: 5, finger: 1 }],
    });
    fixture.detectChanges();
    const top = host.querySelector('line.grid-top')!;
    expect(top).not.toBeNull();
    // Same y as the strings' top end (md: grid top 52 + nut 4)
    const stringTop = host.querySelector('line[stroke-width="2"]')!.getAttribute('y1');
    expect(top.getAttribute('y1')).toBe(stringTop);
  });

  it('draws the F barre across the strings it covers (not off the right edge)', () => {
    fixture.componentRef.setInput('chord', 'F');
    fixture.detectChanges();
    const barre = (fixture.nativeElement as HTMLElement).querySelector('rect[rx="5"]')!;
    // md: strings span x = 28 (string 6) .. 108 (string 1), finger radius 7
    expect(Number(barre.getAttribute('x'))).toBe(21);
    expect(Number(barre.getAttribute('width'))).toBe(94);
  });

  it('treats fret numbers as absolute when the diagram starts above the nut', () => {
    // A-shape barre chord at the 5th fret (D major): frets 5 and 7, window starts at fret 5
    fixture.componentRef.setInput('chord', {
      name: 'D',
      baseFret: 5,
      fingerings: [
        { string: 1, fret: 5, finger: 1 },
        { string: 2, fret: 7, finger: 4 },
        { string: 3, fret: 7, finger: 3 },
        { string: 4, fret: 7, finger: 2 },
        { string: 5, fret: 5, finger: 1 },
        { string: 6, fret: -1 },
      ],
    });
    fixture.detectChanges();
    const internals = fixture.componentInstance as unknown as {
      getFretY: (row: number) => number;
      dimensions: () => { fretSpacing: number };
    };
    const rowCentre = (row: number): number =>
      internals.getFretY(row) - internals.dimensions().fretSpacing / 2;
    const dots = [...(fixture.nativeElement as HTMLElement).querySelectorAll('circle[r="7"]')].map(
      c => Number(c.getAttribute('cy'))
    );
    expect(dots).toHaveLength(5);
    // Fret 5 on the first row, fret 7 on the third
    expect(dots.filter(y => y === rowCentre(1))).toHaveLength(2);
    expect(dots.filter(y => y === rowCentre(3))).toHaveLength(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('5fr');
  });

  it('sizes the padded container so the diagram SVG fits inside it', () => {
    fixture.detectChanges();
    const container = (fixture.nativeElement as HTMLElement).firstElementChild as HTMLElement;
    const svgWidth = Number(container.querySelector('svg')!.getAttribute('width'));
    expect(container.style.boxSizing).toBe('border-box');
    expect(Number.parseFloat(container.style.width)).toBe(svgWidth + 16);
  });

  it('keeps the small string labels >= 4.5:1 (opacity-60 dark text was ~4.1:1 on white)', () => {
    fixture.componentRef.setInput('showStringLabels', true);
    fixture.detectChanges();
    expect(labelsLeftToRight()).toHaveLength(6);
    expect((fixture.nativeElement as HTMLElement).querySelector('text.opacity-60')).toBeNull();
  });

  it('draws the open-string ring >= 3:1 on the white diagram (green-500 was ~2.3:1)', () => {
    fixture.componentRef.setInput('chord', 'C');
    for (const variant of ['default', 'minimal']) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      const rings = [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll('circle[fill="none"]'),
      ];
      expect(rings.length).toBeGreaterThan(0);
      for (const ring of rings) {
        expect(ring.getAttribute('stroke')?.toUpperCase()).toBe('#16A34A');
      }
    }
  });
});

describe('TwChordDiagramComponent minimal variant theme', () => {
  it('draws the name, nut and finger dots in the container colour so they follow a dark page', async () => {
    await TestBed.configureTestingModule({
      imports: [TwChordDiagramComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwChordDiagramComponent);
    fixture.componentRef.setInput('chord', 'C');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const container = host.firstElementChild as HTMLElement;
    // Fixed slate-700 on the transparent background was ~1.5:1 on a dark page
    expect([...container.classList]).toEqual(
      expect.arrayContaining(['text-[#334155]', 'dark:text-slate-200'])
    );
    const name = [...host.querySelectorAll('text')].find(t => t.textContent?.trim() === 'C')!;
    expect(name.getAttribute('fill')).toBe('currentColor');
    const dots = [...host.querySelectorAll('circle:not([fill="none"])')];
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) expect(dot.getAttribute('fill')).toBe('currentColor');
    expect(host.querySelector('rect')?.getAttribute('fill')).toBe('currentColor');

    // Finger numbers stay readable on the dots: white in light mode, dark on the light dots
    fixture.componentRef.setInput('showFingerNumbers', true);
    fixture.detectChanges();
    const numbers = [...host.querySelectorAll('text.select-none')].filter(t =>
      /^[1-4]$/.test(t.textContent?.trim() ?? '')
    );
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) {
      expect([...n.classList]).toEqual(
        expect.arrayContaining(['text-white', 'dark:text-slate-900', 'select-none'])
      );
    }

    // The default variant keeps its fixed colours
    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    expect(name.getAttribute('fill')).toBe('#1E293B');
    for (const n of numbers) expect(n.getAttribute('class')).toBe('select-none');
  });
});

describe('TwChordDiagramComponent classOverride', () => {
  // Tailwind 4 emits same-property utilities in a fixed order, so an override that is
  // simply appended (e.g. bg-slate-900 after bg-white) may never take effect
  it('replaces conflicting default utilities instead of appending to them', async () => {
    await TestBed.configureTestingModule({
      imports: [TwChordDiagramComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwChordDiagramComponent);
    fixture.componentRef.setInput('classOverride', 'bg-slate-900');
    const classes = (fixture.componentInstance as unknown as { containerClasses: () => string })
      .containerClasses()
      .split(' ');
    expect(classes).toContain('bg-slate-900');
    expect(classes).not.toContain('bg-white');
  });
});

describe('TwChordDiagramComponent fret number', () => {
  it('keeps the "Nfr" label of a small diagram inside the drawable area', async () => {
    await TestBed.configureTestingModule({
      imports: [TwChordDiagramComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwChordDiagramComponent);
    fixture.componentRef.setInput('size', 'sm');
    fixture.componentRef.setInput('chord', {
      name: 'A',
      baseFret: 5,
      fingerings: [{ string: 1, fret: 5, finger: 1 }],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const label = host.querySelector<SVGTextElement>('text.fret-number')!;
    expect(label.textContent?.trim()).toBe('5fr');
    // sm: grid starts at x = 20 with 5px finger dots. The label used to end at x = 8 in 12px
    // text, so "5fr" (~14px wide) started left of the SVG and its number was clipped
    expect(Number(label.getAttribute('x'))).toBe(12);
    expect(label.getAttribute('font-size')).toBe('10');
    // Wider labels ("12fr") may extend into the container's padding instead of being cut off
    expect(host.querySelector('svg')!.getAttribute('overflow')).toBe('visible');
  });
});

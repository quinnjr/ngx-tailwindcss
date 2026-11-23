import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwChordDiagramComponent } from './chord-diagram.component';

describe('TwChordDiagramComponent', () => {
  let fixture: ComponentFixture<TwChordDiagramComponent>;

  // String labels are the small 10px texts below the grid, read left to right
  const labelsLeftToRight = (): string[] =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll<SVGTextElement>(
        'text[font-size="10"].opacity-60'
      )]
      .sort((a, b) => Number(a.getAttribute('x')) - Number(b.getAttribute('x')))
      .map(t => t.textContent?.trim() ?? '');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwChordDiagramComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TwChordDiagramComponent);
    fixture.componentRef.setInput('chord', 'C');
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
});

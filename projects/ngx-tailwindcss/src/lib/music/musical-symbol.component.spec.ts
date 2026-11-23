import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { OrnamentType, TwMusicalSymbolComponent } from './musical-symbol.component';

describe('TwMusicalSymbolComponent ornaments', () => {
  let fixture: ComponentFixture<TwMusicalSymbolComponent>;

  const render = (ornament: OrnamentType): HTMLElement => {
    fixture.componentRef.setInput('category', 'ornament');
    fixture.componentRef.setInput('ornament', ornament);
    fixture.componentRef.setInput('x', 20);
    fixture.componentRef.setInput('y', 20);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwMusicalSymbolComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TwMusicalSymbolComponent);
  });

  it('draws the vertical stroke on the (lower) mordent, not the inverted mordent', () => {
    expect(render('mordent').querySelectorAll('line')).toHaveLength(1);

    fixture = TestBed.createComponent(TwMusicalSymbolComponent);
    expect(render('invertedMordent').querySelectorAll('line')).toHaveLength(0);
  });

  it('draws the inverted (upper) mordent zigzag the same way up as the mordent', () => {
    const zigzag = (ornament: OrnamentType): string | null => {
      fixture = TestBed.createComponent(TwMusicalSymbolComponent);
      return render(ornament).querySelector('path')!.getAttribute('d');
    };
    expect(zigzag('invertedMordent')).toBe(zigzag('mordent'));
  });

  it('uses distinct fallback glyphs for turns and mordents', () => {
    const data = (ornament: OrnamentType): string => {
      fixture = TestBed.createComponent(TwMusicalSymbolComponent);
      render(ornament);
      return (
        fixture.componentInstance as unknown as { ornamentData: () => { symbol: string } }
      ).ornamentData().symbol;
    };
    const symbols = ['mordent', 'invertedMordent', 'turn', 'invertedTurn', 'trill'].map(o =>
      data(o as OrnamentType)
    );
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(data('turn')).toBe('\u{1D197}');
    expect(data('invertedTurn')).toBe('\u{1D198}');
  });
});

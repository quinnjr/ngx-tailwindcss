import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwGraphicEQComponent } from './graphic-eq.component';

describe('TwGraphicEQComponent', () => {
  let fixture: ComponentFixture<TwGraphicEQComponent>;
  let component: TwGraphicEQComponent;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwGraphicEQComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwGraphicEQComponent);
    component = fixture.componentInstance;
    internals = component;
    fixture.detectChanges();
  });

  it('should honor the forms disabled state', () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    internals.onBandKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }), 0);

    expect(internals.bands()[0].gain).toBe(0);
    const slider = fixture.nativeElement.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.getAttribute('tabindex')).toBe('-1');
  });

  it('should place the fill on the same linear scale as the thumb for asymmetric ranges', () => {
    fixture.componentRef.setInput('minGain', -24);
    fixture.componentRef.setInput('maxGain', 12);
    fixture.componentRef.setInput('sliderHeight', 360);
    fixture.detectChanges();

    // 0 dB sits 1/3 from the top; +12 dB at the top
    const px = (value: string): number => Number.parseFloat(value);
    expect(internals.zeroLineY()).toBeCloseTo(120, 6);
    expect(px(internals.getBandFillPosition(12))).toBeCloseTo(0, 6);
    expect(px(internals.getBandFillHeight(12))).toBeCloseTo(120, 6);
    expect(px(internals.getBandFillPosition(-24))).toBeCloseTo(120, 6);
    expect(px(internals.getBandFillHeight(-24))).toBeCloseTo(240, 6);
  });

  it('should emit bandChange when a band is reset', () => {
    const changes: unknown[] = [];
    component.bandChange.subscribe(c => changes.push(c));
    internals.onBandKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }), 1);

    internals.resetBand(1);

    expect(changes.at(-1)).toEqual({ frequency: 63, gain: 0 });
  });

  it('should anchor the response curve on the 0 dB line for asymmetric ranges', () => {
    fixture.componentRef.setInput('minGain', -24);
    fixture.componentRef.setInput('maxGain', 12);
    fixture.componentRef.setInput('sliderHeight', 360);
    fixture.detectChanges();

    const path: string = internals.curvePath();
    const start = /^M 0 ([\d.]+) L 5 ([\d.]+)/.exec(path)!;
    const end = / L 100 ([\d.]+)$/.exec(path)!;
    expect(Number(start[1])).toBeCloseTo(120, 6);
    // Flat bands lie on the 0 dB line too
    expect(Number(start[2])).toBeCloseTo(120, 6);
    expect(Number(end[1])).toBeCloseTo(120, 6);
  });
});

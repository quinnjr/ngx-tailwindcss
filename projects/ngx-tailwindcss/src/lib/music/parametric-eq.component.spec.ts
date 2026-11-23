import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwParametricEQComponent } from './parametric-eq.component';

describe('TwParametricEQComponent', () => {
  let fixture: ComponentFixture<TwParametricEQComponent>;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwParametricEQComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwParametricEQComponent);
    internals = fixture.componentInstance;
    fixture.componentRef.setInput('height', 300);
    fixture.detectChanges();
  });

  it('should map gain linearly between maxGain (top) and minGain (bottom)', () => {
    fixture.componentRef.setInput('minGain', -24);
    fixture.componentRef.setInput('maxGain', 6);
    fixture.detectChanges();

    expect(internals.gainToY(6)).toBe(0);
    expect(internals.gainToY(-24)).toBe(300);
    expect(internals.gainToY(0)).toBe(60);
    expect(internals.yToGain(60)).toBeCloseTo(0, 10);
  });

  it('should keep symmetric ranges centred on 0 dB', () => {
    expect(internals.gainToY(0)).toBe(150);
    expect(internals.yToGain(0)).toBe(24);
  });
});

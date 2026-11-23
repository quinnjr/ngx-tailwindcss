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

  it('should toggle a band with Enter/Space and expose the enabled state via aria-pressed', () => {
    const emitted: any[] = [];
    fixture.componentInstance.bandsChange.subscribe(b => emitted.push(b));
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('true');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    button.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(emitted.at(-1)[0].enabled).toBe(false);

    // Parent feeds the new bands back in
    fixture.componentRef.setInput('bands', emitted.at(-1));
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-current')).toBe('true');

    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(emitted.at(-1)[0].enabled).toBe(true);
  });

  it('should not toggle bands when not interactive', () => {
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    const emitted: any[] = [];
    fixture.componentInstance.bandsChange.subscribe(b => emitted.push(b));
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));

    expect(emitted.length).toBe(0);
  });
});

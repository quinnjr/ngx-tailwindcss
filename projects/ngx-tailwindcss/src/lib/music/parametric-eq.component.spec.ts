import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('should toggle a band via its switch and expose the state via aria-checked', () => {
    const emitted: any[] = [];
    fixture.componentInstance.bandsChange.subscribe(b => emitted.push(b));
    const toggle = fixture.nativeElement.querySelector('[role="switch"]') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toContain('Enable EQ band');

    // A click (what screen readers send in browse mode) toggles the switch
    toggle.click();
    expect(emitted.at(-1)[0].enabled).toBe(false);

    // Parent feeds the new bands back in
    fixture.componentRef.setInput('bands', emitted.at(-1));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    expect(emitted.at(-1)[0].enabled).toBe(true);
  });

  it('should select (not toggle) a band from its select button, by click or Enter', () => {
    const emitted: any[] = [];
    fixture.componentInstance.bandsChange.subscribe(b => emitted.push(b));
    const select = fixture.nativeElement.querySelector(
      'button:not([role="switch"])'
    ) as HTMLButtonElement;

    // No toggle semantics on the select button
    expect(select.hasAttribute('aria-pressed')).toBe(false);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    select.dispatchEvent(enter);
    // Enter keeps its native meaning (activate = click = select)
    expect(enter.defaultPrevented).toBe(false);

    select.click();
    fixture.detectChanges();
    expect(select.getAttribute('aria-current')).toBe('true');
    expect(emitted.length).toBe(0);
  });

  it('should not toggle bands when not interactive', () => {
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    const emitted: any[] = [];
    fixture.componentInstance.bandsChange.subscribe(b => emitted.push(b));
    const toggle = fixture.nativeElement.querySelector('[role="switch"]') as HTMLButtonElement;

    expect(toggle.disabled).toBe(true);
    internals.toggleBand(fixture.componentInstance.bands()[0]);

    expect(emitted.length).toBe(0);
  });

  it('should not touch the canvas during SSR', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TwParametricEQComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');

    const ssrFixture = TestBed.createComponent(TwParametricEQComponent);
    expect(() => {
      ssrFixture.detectChanges();
    }).not.toThrow();
    expect(getContext).not.toHaveBeenCalled();
    getContext.mockRestore();
  });
});

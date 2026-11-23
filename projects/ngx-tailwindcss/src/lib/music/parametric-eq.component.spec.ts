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

  it('should adjust Q from the keyboard (Shift+drag counterpart)', () => {
    const changes: any[] = [];
    fixture.componentInstance.bandChange.subscribe(c => changes.push(c));
    const select = fixture.nativeElement.querySelector(
      'button:not([role="switch"])'
    ) as HTMLButtonElement;
    const q = fixture.componentInstance.bands()[0].q;

    const up = new KeyboardEvent('keydown', { key: 'PageUp', cancelable: true });
    select.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(changes.at(-1).property).toBe('q');
    expect(changes.at(-1).band.q).toBeCloseTo(q * 1.25, 1);

    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true }));
    expect(changes.at(-1).band.q).toBeCloseTo(q / 1.25, 1);
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

  it('should round dragged (fractional) frequencies in the band button labels', () => {
    const bands = fixture.componentInstance.bands();
    fixture.componentRef.setInput('bands', [
      { ...bands[0], frequency: 247.3829104 },
      { ...bands[1], frequency: 1234.567 },
    ]);
    fixture.detectChanges();

    const labels = [
      ...fixture.nativeElement.querySelectorAll('button[aria-current], button:not([role])'),
    ].map((el: any) => el.textContent.trim());
    expect(labels).toEqual(['247Hz', '1.2kHz']);
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

  it('should draw canvas text that is readable on each variant background', () => {
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    // Hover/selected node labels were white on the white plot
    expect(internals.colors().nodeText).toBe('#0F172A');

    for (const variant of ['dark', 'vintage', 'neon'] as const) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      expect(internals.colors().nodeText).toBe('#FFFFFF');
      expect(['#64748B', '#78716C', '#666666']).not.toContain(internals.colors().gridText);
    }
  });

  it('should pick band chip text that contrasts with the band colour', () => {
    // white on orange-500 / yellow-500 / green-500 was ~1.9-2.8:1
    expect(internals.bandTextColor('#EAB308')).toBe('#0F172A');
    expect(internals.bandTextColor('#22C55E')).toBe('#0F172A');
    expect(internals.bandTextColor('#F97316')).toBe('#0F172A');
    expect(internals.bandTextColor('#1E3A8A')).toBe('#FFFFFF');
    expect(internals.bandTextColor('#000')).toBe('#FFFFFF');
    expect(internals.bandTextColor('rgb(0, 0, 0)')).toBe('#FFFFFF');
    expect(internals.bandTextColor(undefined)).toBe('#FFFFFF');

    const chip = fixture.nativeElement.querySelector('[role="switch"]')!
      .parentElement as HTMLElement;
    expect(chip.style.color).not.toBe('white');
    expect(chip.style.color).toBe('rgb(15, 23, 42)'); // first default band is red-500
  });

  it('should render the selected-band readout legibly on the light variant', () => {
    fixture.componentRef.setInput('variant', 'light');
    internals.selectBand(internals.bands()[0]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const label = [...el.querySelectorAll('label')].find(l => l.textContent?.trim() === 'Gain')!;

    expect(label.classList).toContain('text-slate-600');
    expect(label.classList).toContain('block');
    expect(label.nextElementSibling!.classList).toContain('text-slate-900');
    expect(label.closest('.rounded-lg.p-3')!.classList).toContain('bg-slate-100');
    expect(el.querySelectorAll('.text-white, .text-slate-400')).toHaveLength(0);
  });

  it('should show the selected band ring against the light variant background', () => {
    const chip = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[role="switch"]')!.parentElement!;
    internals.selectBand(internals.bands()[0]);
    fixture.detectChanges();
    expect(chip().classList).toContain('ring-white');

    // A white ring is invisible on the light page the light variant sits on
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(chip().classList).toContain('ring-2');
    expect(chip().classList).toContain('ring-slate-900');
    expect(chip().classList).not.toContain('ring-white');
  });
  it('should outline band nodes visibly on the light variant plot', () => {
    const strokes: unknown[] = [];
    const state: Record<string | symbol, unknown> = {};
    internals.ctx = new Proxy(state, {
      get: (target, prop) =>
        prop === 'stroke'
          ? () => strokes.push(target['strokeStyle'])
          : prop in target
            ? target[prop]
            : vi.fn(),
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });
    const node = (): unknown[] => strokes.filter((_s, i) => i % 2 === 1); // [Q line, node] per band

    internals.selectBand(internals.bands()[0]);
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    strokes.length = 0;
    internals.drawBandNodes();
    expect(node()[0]).toBe('#0F172A');
    expect(node()[1]).toBe('rgba(15,23,42,0.6)');

    fixture.componentRef.setInput('variant', 'default');
    fixture.detectChanges();
    strokes.length = 0;
    internals.drawBandNodes();
    expect(node()[0]).toBe('#FFFFFF');
    expect(node()[1]).toBe('rgba(255,255,255,0.5)');
    internals.ctx = null;
  });

  it('should keep axis and node labels inside the canvas at its edges', () => {
    const texts: Array<{ text: string; x: number; y: number; align: unknown }> = [];
    const state: Record<string | symbol, unknown> = {};
    internals.ctx = new Proxy(state, {
      get: (target, prop) =>
        prop === 'fillText'
          ? (text: string, x: number, y: number) =>
              texts.push({ text, x, y, align: target['textAlign'] })
          : prop in target
            ? target[prop]
            : () => {},
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });

    internals.drawGrid('#000', '#fff');
    // 20k sits on the right edge (x = 600): right-aligned inside, not centred half off
    const k20 = texts.find(t => t.text === '20k')!;
    expect(k20.align).toBe('right');
    expect(k20.x).toBeLessThanOrEqual(600);
    expect(texts.find(t => t.text === '1k')!.align).toBe('center');

    // A fully boosted node at the top-right: readout below it and right-aligned
    texts.length = 0;
    const band = { ...internals.bands()[0], frequency: 20_000, gain: 24 };
    fixture.componentRef.setInput('bands', [band]);
    internals.selectedBandId.set(band.id);
    internals.drawBandNodes();
    const readout = texts.filter(t => /Hz|dB/.test(t.text));
    expect(readout).toHaveLength(2);
    for (const t of readout) {
      expect(t.y).toBeGreaterThan(0);
      expect(t.align).toBe('right');
      expect(t.x).toBeLessThanOrEqual(600);
    }
    internals.ctx = null;
  });
});

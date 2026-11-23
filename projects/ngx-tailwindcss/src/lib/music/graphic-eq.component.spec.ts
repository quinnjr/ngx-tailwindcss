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

  it('should label the gain scale from the configured range', () => {
    const labels = (): string[] =>
      [...fixture.nativeElement.querySelectorAll('.-left-8 span')].map((el: Element) =>
        (el.textContent ?? '').trim()
      );
    expect(labels()).toEqual(['+12', '+6', '0', '-6', '-12']);

    fixture.componentRef.setInput('minGain', -24);
    fixture.componentRef.setInput('maxGain', 24);
    fixture.detectChanges();
    expect(labels()).toEqual(['+24', '+12', '0', '-12', '-24']);
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

  it('should expose the preset menu state and close it with Escape', () => {
    const el = fixture.nativeElement as HTMLElement;
    const toggle = [...el.querySelectorAll('button')].find(
      b => b.textContent?.trim() === 'Presets'
    )!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const search = el.querySelector<HTMLInputElement>('input[placeholder="Search presets..."]')!;
    search.focus();
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('input[placeholder="Search presets..."]')).toBeNull();
    expect(document.activeElement).toBe(toggle);
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

  it('should clamp preset gains to the configured range', () => {
    fixture.componentRef.setInput('minGain', -3);
    fixture.componentRef.setInput('maxGain', 3);
    fixture.detectChanges();

    component.applyPreset(component.getPresetById('podcast')!);

    const gains: number[] = internals.bands().map((b: { gain: number }) => b.gain);
    expect(gains[0]).toBe(-3); // preset: -6 dB at 31 Hz
    expect(Math.max(...gains)).toBeLessThanOrEqual(3);
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(-3);
  });

  it('should lay the band columns out in equal widths matching the curve points', () => {
    const track = fixture.nativeElement.querySelector('[role="slider"]') as HTMLElement;
    const column = track.parentElement!;
    expect(column.classList).toContain('flex-1');
    expect(column.parentElement!.classList).not.toContain('gap-1');
  });

  it('should keep studio-variant labels readable on the near-black panel', () => {
    fixture.componentRef.setInput('variant', 'studio');
    fixture.detectChanges();
    expect(internals.colors().label).toBe('text-slate-400');
  });

  it('should give the active quick preset text that contrasts with the variant fill', () => {
    fixture.componentRef.setInput('showPresetDropdown', false);
    component.applyPreset(component.getPresetById('rock')!);
    const activeButton = (): HTMLElement =>
      [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLElement) =>
        b.className.includes(internals.colors().fill)
      ) as HTMLElement;

    for (const [variant, text] of [
      ['studio', 'text-black'],
      ['neon', 'text-black'],
      ['highContrast', 'text-black'],
      ['light', 'text-white'],
    ] as const) {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      // white on green-500 / cyan-400 / yellow-400 was ~1.5-2.3:1
      expect(activeButton().classList).toContain(text);
      expect(activeButton().classList).not.toContain(
        text === 'text-black' ? 'text-white' : 'text-black'
      );
    }
  });

  it('should colour boosted/cut band values readably on the light variant', () => {
    fixture.componentRef.setInput('variant', 'light');
    fixture.componentRef.setInput('showValues', true);
    component.writeValue([
      { frequency: internals.bands()[0].frequency, gain: 6 },
      { frequency: internals.bands()[1].frequency, gain: -6 },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const value = (text: string): HTMLElement =>
      [...el.querySelectorAll<HTMLElement>('span.font-mono')].find(
        s => s.textContent?.trim() === text
      )!;

    // green-400 / red-400 were ~1.9 / 2.8:1 on white
    expect(value('+6.0').classList).toContain('text-green-700');
    expect(value('-6.0').classList).toContain('text-red-700');
    expect(value('+6.0').classList).toContain('min-w-[24px]');
    expect(el.querySelectorAll('.text-green-400, .text-red-400')).toHaveLength(0);
  });

  it('should show a focus indicator on the preset search field', () => {
    internals.togglePresetMenu();
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector(
      'input[placeholder="Search presets..."]'
    ) as HTMLInputElement;
    expect(search.classList).toContain('outline-none');
    expect(search.classList).toContain('focus-visible:ring-2');
  });

  it('should keep the gain scale inside the panel, at full contrast', () => {
    const el = fixture.nativeElement as HTMLElement;
    const scale = el.querySelector<HTMLElement>('.-left-8')!;
    // -left-8 (2rem) overflowed the panel's p-4 (1rem) without a matching gutter
    expect(scale.parentElement!.classList).toContain('ml-8');
    // opacity-50 on every other label was ~2.6:1
    expect(scale.querySelectorAll('.opacity-50')).toHaveLength(0);
  });

  it('should not label cuts with the thumb colour in the legend', () => {
    // Cuts are drawn with the fill colour (below the 0 dB line), like boosts
    fixture.componentRef.setInput('showCurve', true);
    fixture.detectChanges();
    const spans = [...(fixture.nativeElement as HTMLElement).querySelectorAll('span')].map(s =>
      s.textContent?.trim()
    );
    expect(spans).toContain('Boost / Cut');
    expect(spans).not.toContain('Cut');
  });

  it('should expose the active preset as pressed', () => {
    const el = fixture.nativeElement as HTMLElement;
    const quick = (name: string): HTMLButtonElement =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find(
        b => b.textContent?.trim() === name
      )!;

    fixture.componentRef.setInput('showPresetDropdown', false);
    fixture.detectChanges();
    expect(quick('Rock').getAttribute('aria-pressed')).toBe('false');
    quick('Flat').click();
    fixture.detectChanges();
    expect(quick('Flat').getAttribute('aria-pressed')).toBe('true');
    quick('Rock').click();
    fixture.detectChanges();
    expect(quick('Rock').getAttribute('aria-pressed')).toBe('true');
    expect(quick('Flat').getAttribute('aria-pressed')).toBe('false');
  });

  it('should keep slider thumbs at 3:1 against their track', () => {
    // slate-600 on the slate-700 track was ~1.4:1
    expect(internals.colors().slider).toBe('bg-slate-400');
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(internals.colors().slider).toBe('bg-slate-500');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(internals.colors().slider).toBe('bg-slate-500 dark:bg-slate-400');
    fixture.componentRef.setInput('variant', 'neon');
    fixture.detectChanges();
    expect(internals.colors().slider).toBe('bg-purple-500');
  });

  it('should keep preset descriptions in the menu readable', () => {
    internals.togglePresetMenu();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const description = [...el.querySelectorAll<HTMLElement>('div')].find(
      d => d.textContent?.trim() === 'No EQ applied'
    )!;
    // At 60% opacity the description was ~3.4:1 (minimal) / ~4:1 (light)
    expect(description.classList).toContain('opacity-80');
    expect(description.classList).not.toContain('opacity-60');
  });
});

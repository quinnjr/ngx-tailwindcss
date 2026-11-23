import { Component, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwVuMeterComponent } from './vu-meter.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-vu-meter
      [value]="value()"
      [leftValue]="left()"
      [rightValue]="right()"
      [stereo]="stereo()"
      [max]="100"
      label="Level"
    ></tw-vu-meter>
  `,
  standalone: true,
  imports: [TwVuMeterComponent],
})
class TestHostComponent {
  value = signal(0);
  left = signal(0);
  right = signal(0);
  stereo = signal(false);
}

describe('TwVuMeterComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  const meterEl = (): HTMLElement =>
    fixture.debugElement.query(By.css('[role="img"]')).nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render an idle meter with a zero-level text alternative', () => {
    expect(meterEl().getAttribute('aria-label')).toBe('Level: 0%');
  });

  it('should place each scale mark at its level', () => {
    const marks = [...meterEl().querySelectorAll<HTMLElement>('span[style*="bottom"]')];
    const minus3 = marks.find(m => m.textContent?.trim() === '-3')!;
    const minus40 = marks.find(m => m.textContent?.trim() === '-40')!;

    expect(minus3.style.bottom).toBe('90%');
    expect(minus40.style.bottom).toBe('25%');
  });

  it('should bridge the value input into the rendered level', () => {
    component.value.set(50);
    fixture.detectChanges();
    fixture.detectChanges(); // flush the input-bridging effect

    expect(meterEl().getAttribute('aria-label')).toBe('Level: 50%');
  });

  it('should bridge stereo left/right values into the rendered levels', () => {
    component.stereo.set(true);
    component.left.set(30);
    component.right.set(60);
    fixture.detectChanges();
    fixture.detectChanges(); // flush the input-bridging effect

    expect(meterEl().getAttribute('aria-label')).toBe('Level: left 30%, right 60%');
  });

  it('should track the peak hold for the right channel in stereo mode', () => {
    component.stereo.set(true);
    component.left.set(30);
    component.right.set(60);
    fixture.detectChanges();
    fixture.detectChanges();

    const meter = fixture.debugElement.query(By.directive(TwVuMeterComponent))
      .componentInstance as TwVuMeterComponent;
    expect(meter.getPeakValue(1)).toBe(60);
  });

  it('should clamp bound values into the min/max range', () => {
    component.value.set(250);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(meterEl().getAttribute('aria-label')).toBe('Level: 100%');
  });

  it('should render meter segments', () => {
    const segments = fixture.debugElement.queryAll(By.css('[role="img"] .rounded-sm'));
    expect(segments.length).toBeGreaterThan(0);
  });
});

@Component({
  template: `<tw-vu-meter
    [value]="value()"
    [min]="-60"
    [max]="0"
    [segmentCount]="10"
  ></tw-vu-meter>`,
  standalone: true,
  imports: [TwVuMeterComponent],
})
class DbRangeHostComponent {
  value = signal(-60);
}

describe('TwVuMeterComponent with a non-zero min', () => {
  let fixture: ComponentFixture<DbRangeHostComponent>;

  const meter = (): TwVuMeterComponent =>
    fixture.debugElement.query(By.directive(TwVuMeterComponent))
      .componentInstance as TwVuMeterComponent;
  const ariaLabel = (): string | null =>
    (fixture.debugElement.query(By.css('[role="img"]')).nativeElement as HTMLElement).getAttribute(
      'aria-label'
    );
  const activeSegments = (): number =>
    fixture.debugElement
      .queryAll(By.css('[role="img"] .rounded-sm'))
      .filter(el => (el.nativeElement as HTMLElement).className.includes('bg-emerald-500')).length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbRangeHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(DbRangeHostComponent);
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('should render the min value as an empty meter', () => {
    expect(ariaLabel()).toBe('Level meter: 0%');
    expect(activeSegments()).toBe(0);
    expect(fixture.debugElement.queryAll(By.css('.h-1.absolute')).length).toBe(0);
  });

  it('should map values relative to min..max', () => {
    fixture.componentInstance.value.set(-30);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(ariaLabel()).toBe('Level meter: 50%');
    expect(activeSegments()).toBe(5);
    expect(meter().getPeakValue()).toBe(-30);
    const peak = fixture.debugElement.query(By.css('.h-1.absolute')).nativeElement as HTMLElement;
    expect(peak.style.bottom).toBe('50%');
  });
});

@Component({
  template: `<tw-vu-meter [value]="value()" meterMode="rms"></tw-vu-meter>`,
  standalone: true,
  imports: [TwVuMeterComponent],
})
class RmsHostComponent {
  value = signal(0);
}

describe('TwVuMeterComponent in rms mode', () => {
  let fixture: ComponentFixture<RmsHostComponent>;

  const ariaLabel = (): string | null =>
    (fixture.debugElement.query(By.css('[role="img"]')).nativeElement as HTMLElement).getAttribute(
      'aria-label'
    );
  const setValue = (v: number): void => {
    fixture.componentInstance.value.set(v);
    fixture.detectChanges();
    fixture.detectChanges(); // flush the input-bridging effect
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RmsHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(RmsHostComponent);
    fixture.detectChanges();
  });

  it('should average only the samples received, not the empty window', () => {
    // The initial 0 is one sample; a steady 50 thereafter
    setValue(50);
    expect(ariaLabel()).toBe('Level meter: 35%'); // sqrt((0 + 0.25) / 2)

    const meter = fixture.debugElement.query(By.directive(TwVuMeterComponent))
      .componentInstance as TwVuMeterComponent;
    meter.reset();
    meter.setValue(60);
    fixture.detectChanges();
    expect(ariaLabel()).toBe('Level meter: 60%');
  });
});

describe('TwVuMeterComponent during SSR', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not start decay timers on the server', async () => {
    await TestBed.configureTestingModule({
      imports: [TwVuMeterComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const fixture = TestBed.createComponent(TwVuMeterComponent);
    fixture.componentRef.setInput('meterMode', 'both');
    fixture.detectChanges();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });
});

describe('TwVuMeterComponent horizontal scale colour', () => {
  it('should colour the scale for the meter surface it sits on', async () => {
    await TestBed.configureTestingModule({
      imports: [TwVuMeterComponent],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwVuMeterComponent);
    fixture.componentRef.setInput('orientation', 'horizontal');
    fixture.detectChanges();
    const scale = (): HTMLElement =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[role="img"] .h-3.font-mono'
      )!;

    // led (default) is always dark: slate-500 would be ~3.7:1
    expect(scale().className).toContain('text-slate-400');
    expect(scale().className).not.toContain('text-slate-500');

    // light is always white: no dark-mode light grey
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(scale().className).toContain('text-slate-500');
    expect(scale().className).not.toContain('dark:');
  });
});

describe('TwVuMeterComponent clip reset', () => {
  it('should let keyboard users reset a latched clip indicator', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const resetButton = (): HTMLButtonElement | null =>
      el.querySelector('button[aria-label="Reset clip indicator"]');
    const clipBars = (): number => el.querySelectorAll('[title="Click to reset"]').length;

    expect(resetButton()).toBeNull();
    fixture.componentInstance.value.set(100);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(clipBars()).toBe(1);
    // The click-only red bar sits inside the role="img" meter: the reset control is a
    // real button outside it
    const button = resetButton()!;
    expect(button).not.toBeNull();
    expect(button.closest('[role="img"]')).toBeNull();

    button.click();
    fixture.detectChanges();
    expect(clipBars()).toBe(0);
    expect(resetButton()).toBeNull();
    fixture.destroy();
  });
});

describe('TwVuMeterComponent lit-segment contrast', () => {
  it('should light segments in shades >= 3:1 against the unlit segments on light surfaces', async () => {
    await TestBed.configureTestingModule({
      imports: [TwVuMeterComponent],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwVuMeterComponent);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('value', 100);
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    const segmentClasses = (): string[] =>
      [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '[role="img"] .flex-col-reverse > .rounded-sm:not(.absolute)'
        ),
      ].map(segment => segment.className);
    const peakClass = (): string =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="img"] .h-1')!
        .className;

    // emerald-500 / amber-400 / red-500 were ~2.0 / 1.4 / 3.1:1 against slate-200
    const light = segmentClasses();
    expect(light[0]).toContain('bg-emerald-700');
    expect(light.some(c => c.includes('bg-amber-700'))).toBe(true);
    expect(light.at(-1)).toContain('bg-red-600');
    expect(light.join(' ')).not.toMatch(/bg-(emerald-500|amber-400|red-500)/);
    expect(peakClass()).toContain('bg-red-600');

    fixture.componentRef.setInput('variant', 'solid');
    fixture.detectChanges();
    expect(segmentClasses()[0]).toContain('bg-emerald-700');
    expect(segmentClasses()[0]).toContain('dark:bg-emerald-500');

    fixture.componentRef.setInput('variant', 'retro');
    fixture.detectChanges();
    // red-600 is ~2.7:1 against the dark retro unlit segments
    expect(segmentClasses().at(-1)).toContain('dark:bg-red-500');

    fixture.componentRef.setInput('variant', 'gradient');
    fixture.detectChanges();
    // amber-300..500 was ~1.4-1.7:1 against slate-200; red-500/600 < 3:1 against slate-700
    expect(segmentClasses().join(' ')).toContain('from-amber-800 to-amber-700');
    expect(segmentClasses().at(-1)).toContain('dark:from-red-400');
    expect(peakClass()).toContain('bg-red-600');

    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();
    expect(segmentClasses()[0]).toContain('bg-slate-200');
    fixture.destroy();
  });
});

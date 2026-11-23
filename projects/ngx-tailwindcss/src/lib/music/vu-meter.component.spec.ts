import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
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

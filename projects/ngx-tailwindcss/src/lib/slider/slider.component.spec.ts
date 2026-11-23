import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { SliderSize, SliderVariant, TwSliderComponent } from './slider.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-slider
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [label]="label()"
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled()"
      [showValue]="showValue()"
      [showMinMax]="showMinMax()"
      [showTicks]="showTicks()"
      [tickCount]="tickCount()"
      [classOverride]="classOverride()"
      (onChange)="onSliderChange($event)"
      (onInput)="onSliderInput($event)"
    ></tw-slider>
  `,
  standalone: true,
  imports: [TwSliderComponent],
})
class TestHostComponent {
  @ViewChild(TwSliderComponent) slider!: TwSliderComponent;
  min = signal(0);
  max = signal(100);
  step = signal(1);
  label = signal('');
  variant = signal<SliderVariant>('primary');
  size = signal<SliderSize>('md');
  disabled = signal(false);
  showValue = signal(false);
  showMinMax = signal(false);
  showTicks = signal(false);
  tickCount = signal(5);
  classOverride = signal('');

  changeValue: number | null = null;
  inputValue: number | null = null;

  onSliderChange(value: number) {
    this.changeValue = value;
  }
  onSliderInput(value: number) {
    this.inputValue = value;
  }
}

@Component({
  template: `<tw-slider [(ngModel)]="value"></tw-slider>`,
  standalone: true,
  imports: [TwSliderComponent, FormsModule],
})
class NgModelTestComponent {
  @ViewChild(TwSliderComponent) slider!: TwSliderComponent;
  value = 50;
}

@Component({
  template: `<tw-slider [formControl]="control"></tw-slider>`,
  standalone: true,
  imports: [TwSliderComponent, ReactiveFormsModule],
})
class FormControlTestComponent {
  @ViewChild(TwSliderComponent) slider!: TwSliderComponent;
  control = new FormControl(25);
}

describe('TwSliderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let sliderEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    sliderEl = fixture.debugElement.query(By.directive(TwSliderComponent)).nativeElement;
  });

  it('should create the slider', () => {
    expect(sliderEl).toBeTruthy();
    expect(component.slider).toBeTruthy();
  });

  it('should render input element', () => {
    const input = sliderEl.querySelector('input[type="range"]');
    expect(input).toBeTruthy();
  });

  describe('min/max/step', () => {
    it('should set min attribute', () => {
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.min).toBe('0');
    });

    it('should set max attribute', () => {
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.max).toBe('100');
    });

    it('should set step attribute', () => {
      component.step.set(5);
      fixture.detectChanges();
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.step).toBe('5');
    });

    it('should update min/max', () => {
      component.min.set(10);
      component.max.set(200);
      fixture.detectChanges();
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.min).toBe('10');
      expect(input.max).toBe('200');
    });
  });

  describe('label', () => {
    it('should not show label by default', () => {
      const label = sliderEl.querySelector('label');
      expect(label?.textContent?.trim() || '').toBe('');
    });

    it('should show label when provided', () => {
      component.label.set('Volume');
      fixture.detectChanges();
      expect(sliderEl.textContent).toContain('Volume');
    });

    it('should associate the label with the range input', () => {
      component.label.set('Volume');
      fixture.detectChanges();
      const label = sliderEl.querySelector('label')!;
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.id).toBeTruthy();
      expect(label.getAttribute('for')).toBe(input.id);
      expect(input.getAttribute('aria-label')).toBe('Volume');
    });

    it('should leave the range input unnamed when no label is provided', () => {
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.getAttribute('aria-label')).toBeNull();
    });
  });

  describe('ticks', () => {
    it('should render tickCount tick marks', () => {
      component.showTicks.set(true);
      fixture.detectChanges();
      const ticks = sliderEl.querySelectorAll('.mt-1 > .tabular-nums');
      expect(ticks.length).toBe(5);
      expect(ticks[0].textContent).toContain('0');
      expect(ticks[4].textContent).toContain('100');
    });

    it('should render a single min tick when tickCount is 1', () => {
      component.showTicks.set(true);
      component.tickCount.set(1);
      fixture.detectChanges();
      const ticks = sliderEl.querySelectorAll('.mt-1 > .tabular-nums');
      expect(ticks.length).toBe(1);
      expect(ticks[0].textContent?.trim()).toBe('0');
    });
  });

  describe('label contrast', () => {
    it('should render ticks and min/max labels with AA-contrast colours in light and dark mode', () => {
      component.showTicks.set(true);
      component.showMinMax.set(true);
      fixture.detectChanges();
      const labels = sliderEl.querySelectorAll('span.text-xs.tabular-nums');
      expect(labels.length).toBe(7);
      for (const label of labels) {
        expect(label.className).toContain('text-slate-500');
        expect(label.className).toContain('dark:text-slate-400');
        expect(label.className).not.toMatch(/(^|\s)text-slate-400/);
      }
    });
  });

  describe('variants', () => {
    it('should apply primary variant by default', () => {
      const fill = sliderEl.querySelector('[class*="bg-blue-600"]');
      expect(fill).toBeTruthy();
    });

    it('should apply success variant', () => {
      component.variant.set('success');
      fixture.detectChanges();
      const fill = sliderEl.querySelector('[class*="bg-emerald-600"]');
      expect(fill).toBeTruthy();
    });

    it('should apply warning variant', () => {
      component.variant.set('warning');
      fixture.detectChanges();
      const fill = sliderEl.querySelector('[class*="bg-amber-500"]');
      expect(fill).toBeTruthy();
    });

    it('should apply danger variant', () => {
      component.variant.set('danger');
      fixture.detectChanges();
      const fill = sliderEl.querySelector('[class*="bg-rose-600"]');
      expect(fill).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should apply sm size', () => {
      component.size.set('sm');
      fixture.detectChanges();
      const track = sliderEl.querySelector('[class*="h-1"]');
      expect(track).toBeTruthy();
    });

    it('should apply md size by default', () => {
      const track = sliderEl.querySelector('[class*="h-2"]');
      expect(track).toBeTruthy();
    });

    it('should apply lg size', () => {
      component.size.set('lg');
      fixture.detectChanges();
      const track = sliderEl.querySelector('[class*="h-3"]');
      expect(track).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('should set disabled attribute', () => {
      component.disabled.set(true);
      fixture.detectChanges();
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(input.disabled).toBe(true);
    });

    it('should apply disabled styling', () => {
      component.disabled.set(true);
      fixture.detectChanges();
      const track = sliderEl.querySelector('[class*="opacity-50"]');
      expect(track).toBeTruthy();
    });
  });

  describe('showValue', () => {
    it('should show value when enabled', () => {
      component.showValue.set(true);
      fixture.detectChanges();
      // Value should be visible (uses font-semibold)
      const valueDisplay = sliderEl.querySelector('[class*="font-semibold"]');
      expect(valueDisplay).toBeTruthy();
    });
  });

  describe('showMinMax', () => {
    it('should show min/max labels when enabled', () => {
      component.showMinMax.set(true);
      fixture.detectChanges();
      expect(sliderEl.textContent).toContain('0');
      expect(sliderEl.textContent).toContain('100');
    });
  });

  describe('events', () => {
    it('should emit onInput during drag', () => {
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      input.value = '50';
      input.dispatchEvent(new Event('input'));
      expect(component.inputValue).toBe(50);
    });

    it('should emit onChange on release', () => {
      const input = sliderEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      input.value = '75';
      input.dispatchEvent(new Event('change'));
      expect(component.changeValue).toBe(75);
    });
  });

  describe('class customization', () => {
    it('should apply classOverride', () => {
      component.classOverride.set('custom-slider');
      fixture.detectChanges();
      expect(sliderEl.querySelector('[class*="custom-slider"]')).toBeTruthy();
    });
  });
});

describe('TwSliderComponent with NgModel', () => {
  let fixture: ComponentFixture<NgModelTestComponent>;
  let component: NgModelTestComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgModelTestComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(NgModelTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should bind with ngModel', async () => {
    await fixture.whenStable();
    const input = fixture.debugElement.query(By.css('input[type="range"]'))
      .nativeElement as HTMLInputElement;
    expect(input.value).toBe('50');
  });

  it('should update ngModel on change', async () => {
    const input = fixture.debugElement.query(By.css('input[type="range"]'))
      .nativeElement as HTMLInputElement;
    input.value = '75';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.value).toBe(75);
  });
});

describe('TwSliderComponent with FormControl', () => {
  let fixture: ComponentFixture<FormControlTestComponent>;
  let component: FormControlTestComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormControlTestComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(FormControlTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should bind with FormControl', () => {
    const input = fixture.debugElement.query(By.css('input[type="range"]'))
      .nativeElement as HTMLInputElement;
    expect(input.value).toBe('25');
  });

  it('should update FormControl on change', () => {
    const input = fixture.debugElement.query(By.css('input[type="range"]'))
      .nativeElement as HTMLInputElement;
    input.value = '60';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.control.value).toBe(60);
  });

  it('should disable slider when FormControl is disabled', () => {
    component.control.disable();
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input[type="range"]'))
      .nativeElement as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});

@Component({
  template: `
    <tw-slider
      [min]="min"
      [max]="max"
      [step]="step"
      [showTicks]="true"
      [formControl]="control"
    ></tw-slider>
  `,
  standalone: true,
  imports: [TwSliderComponent, ReactiveFormsModule],
})
class SliderRegressionHostComponent {
  min = 0;
  max = 100;
  step = 1;
  control = new FormControl(150);
}

describe('TwSliderComponent (regressions)', () => {
  it('should clamp the fill and thumb to the track for out-of-range values', () => {
    const fixture = TestBed.createComponent(SliderRegressionHostComponent);
    fixture.detectChanges();
    const thumb = fixture.nativeElement.querySelector('.pointer-events-none') as HTMLElement;
    expect(thumb.style.left).toBe('100%');

    fixture.componentInstance.control.setValue(-20);
    fixture.detectChanges();
    expect(thumb.style.left).toBe('0%');
  });

  it('should render fractional tick values for fractional ranges', () => {
    const fixture = TestBed.createComponent(SliderRegressionHostComponent);
    fixture.componentInstance.max = 1;
    fixture.componentInstance.step = 0.25;
    fixture.componentInstance.control.setValue(0);
    fixture.detectChanges();
    const ticks = [
      ...(fixture.nativeElement.querySelectorAll(
        '.flex.justify-between.px-1 span'
      ) as NodeListOf<HTMLElement>),
    ].map(t => t.textContent?.trim());
    expect(ticks).toEqual(['0', '0.25', '0.5', '0.75', '1']);
  });
});

describe('TwSliderComponent (round 3)', () => {
  it('should expose the formatted value as aria-valuetext', () => {
    const fixture = TestBed.createComponent(SliderRegressionHostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input.getAttribute('aria-valuetext')).toBe('150');
  });

  it('should end the drag state on change even if the pointer is released elsewhere', () => {
    const fixture = TestBed.createComponent(SliderRegressionHostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    const thumb = () => fixture.nativeElement.querySelector('.pointer-events-none > div');
    expect(thumb().className).toContain('scale-110');
    input.value = '40';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(thumb().className).not.toContain('scale-110');
  });
});

@Component({
  template: `<tw-slider [min]="10" [max]="50" [showValue]="true"></tw-slider>`,
  standalone: true,
  imports: [TwSliderComponent],
})
class UnboundSliderHostComponent {}

describe('TwSliderComponent (round 7)', () => {
  it('should show the min value (like the native input) when no value has been set', () => {
    const fixture = TestBed.createComponent(UnboundSliderHostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input.value).toBe('10');
    expect(input.getAttribute('aria-valuetext')).toBe('10');
    expect(fixture.nativeElement.querySelector('.tabular-nums').textContent.trim()).toBe('10');
  });
});

describe('TwSliderComponent (round 10)', () => {
  it('should give the value readout a dark-mode text colour', () => {
    const fixture = TestBed.createComponent(UnboundSliderHostComponent);
    fixture.detectChanges();
    const readout = fixture.nativeElement.querySelector('.font-semibold') as HTMLElement;
    expect(readout.classList).toContain('text-slate-900');
    expect(readout.classList).toContain('dark:text-slate-100');
  });
});

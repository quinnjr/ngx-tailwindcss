import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RadioSize,
  RadioVariant,
  TwRadioButtonComponent,
  TwRadioGroupComponent,
} from './radio.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-radio-group
      [name]="name()"
      [orientation]="orientation()"
      [gap]="gap()"
      [disabled]="disabled()"
      (onChange)="onRadioChange($event)"
    >
      <tw-radio-button
        value="option1"
        label="Option 1"
        [variant]="variant()"
        [size]="size()"
      ></tw-radio-button>
      <tw-radio-button
        value="option2"
        label="Option 2"
        [variant]="variant()"
        [size]="size()"
      ></tw-radio-button>
      <tw-radio-button value="option3" label="Option 3" [disabled]="true"></tw-radio-button>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent],
})
class TestHostComponent {
  @ViewChild(TwRadioGroupComponent) radioGroup!: TwRadioGroupComponent;
  name = signal('test-radio-group');
  orientation = signal<'horizontal' | 'vertical'>('vertical');
  gap = signal<'sm' | 'md' | 'lg'>('md');
  disabled = signal(false);
  variant = signal<RadioVariant>('primary');
  size = signal<RadioSize>('md');

  changeValue: any = null;

  onRadioChange(value: any) {
    this.changeValue = value;
  }
}

@Component({
  template: `
    <tw-radio-group [(ngModel)]="selectedOption">
      <tw-radio-button value="a" label="Option A"></tw-radio-button>
      <tw-radio-button value="b" label="Option B"></tw-radio-button>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent, FormsModule],
})
class NgModelTestComponent {
  @ViewChild(TwRadioGroupComponent) radioGroup!: TwRadioGroupComponent;
  selectedOption = '';
}

@Component({
  template: `
    <tw-radio-group [formControl]="control">
      <tw-radio-button value="x" label="Option X"></tw-radio-button>
      <tw-radio-button value="y" label="Option Y"></tw-radio-button>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent, ReactiveFormsModule],
})
class FormControlTestComponent {
  @ViewChild(TwRadioGroupComponent) radioGroup!: TwRadioGroupComponent;
  control = new FormControl('');
}

describe('TwRadioGroupComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let groupEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    groupEl = fixture.debugElement.query(By.directive(TwRadioGroupComponent)).nativeElement;
  });

  it('should create the radio group', () => {
    expect(groupEl).toBeTruthy();
    expect(component.radioGroup).toBeTruthy();
  });

  it('should render all radio buttons', () => {
    const radios = fixture.debugElement.queryAll(By.directive(TwRadioButtonComponent));
    expect(radios.length).toBe(3);
  });

  describe('orientation', () => {
    it('should have vertical orientation by default', () => {
      expect(groupEl.querySelector('div')?.className).toContain('flex-col');
    });

    it('should switch to horizontal orientation', () => {
      component.orientation.set('horizontal');
      fixture.detectChanges();
      // tailwind-merge may optimize flex-row away since flex is default, check for flex-wrap instead
      expect(groupEl.querySelector('div')?.className).toContain('flex-wrap');
      expect(groupEl.querySelector('div')?.className).not.toContain('flex-col');
    });
  });

  describe('gap', () => {
    it('should apply md gap by default', () => {
      expect(groupEl.querySelector('div')?.className).toContain('gap-3');
    });

    it('should apply sm gap', () => {
      component.gap.set('sm');
      fixture.detectChanges();
      expect(groupEl.querySelector('div')?.className).toContain('gap-2');
    });

    it('should apply lg gap', () => {
      component.gap.set('lg');
      fixture.detectChanges();
      expect(groupEl.querySelector('div')?.className).toContain('gap-4');
    });
  });

  describe('selection', () => {
    it('should emit onChange when radio is selected', () => {
      const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
      radioInputs[0].nativeElement.click();
      fixture.detectChanges();
      expect(component.changeValue).toBe('option1');
    });

    it('should update selection when different radio is clicked', () => {
      const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
      radioInputs[0].nativeElement.click();
      fixture.detectChanges();
      radioInputs[1].nativeElement.click();
      fixture.detectChanges();
      expect(component.changeValue).toBe('option2');
    });
  });

  describe('touched state', () => {
    it('should invoke the registered onTouched callback after blur', () => {
      const spy = vi.fn();
      component.radioGroup.registerOnTouched(spy);
      const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
      radioInputs[0].nativeElement.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should disable all radios when group is disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();
      const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
      radioInputs.forEach(radio => {
        expect(radio.nativeElement.disabled).toBe(true);
      });
    });

    it('should respect individual radio disabled state', () => {
      const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
      expect(radioInputs[2].nativeElement.disabled).toBe(true);
    });
  });
});

describe('TwRadioButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('variants', () => {
    it('should apply primary variant by default', () => {
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('text-blue-600');
    });

    it('should apply success variant', () => {
      component.variant.set('success');
      fixture.detectChanges();
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('text-emerald-600');
    });

    it('should apply warning variant', () => {
      component.variant.set('warning');
      fixture.detectChanges();
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('text-amber-600');
    });

    it('should apply danger variant', () => {
      component.variant.set('danger');
      fixture.detectChanges();
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('text-rose-600');
    });

    it('should colour the native radio via accent-color for every variant', () => {
      // A native radio ignores `color`; only `accent-color` tints the selected dot
      const expected = {
        primary: 'accent-blue-600',
        secondary: 'accent-slate-600',
        success: 'accent-emerald-600',
        warning: 'accent-amber-600',
        danger: 'accent-rose-600',
      } as const;
      for (const [variant, cls] of Object.entries(expected)) {
        component.variant.set(variant as RadioVariant);
        fixture.detectChanges();
        const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
        expect(radioInput.nativeElement.className).toContain(cls);
      }
    });
  });

  describe('sizes', () => {
    it('should apply md size by default', () => {
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('w-5');
      expect(radioInput.nativeElement.className).toContain('h-5');
    });

    it('should apply sm size', () => {
      component.size.set('sm');
      fixture.detectChanges();
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('w-4');
      expect(radioInput.nativeElement.className).toContain('h-4');
    });

    it('should apply lg size', () => {
      component.size.set('lg');
      fixture.detectChanges();
      const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
      expect(radioInput.nativeElement.className).toContain('w-6');
      expect(radioInput.nativeElement.className).toContain('h-6');
    });
  });

  it('should render label text', () => {
    const labels = fixture.debugElement.queryAll(By.directive(TwRadioButtonComponent));
    expect(labels[0].nativeElement.textContent).toContain('Option 1');
    expect(labels[1].nativeElement.textContent).toContain('Option 2');
  });
});

describe('TwRadioGroupComponent with NgModel', () => {
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
    component.selectedOption = 'a';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    expect((radioInputs[0].nativeElement as HTMLInputElement).checked).toBe(true);
  });

  it('should update ngModel on selection', async () => {
    const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    radioInputs[1].nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedOption).toBe('b');
  });
});

describe('TwRadioGroupComponent with FormControl', () => {
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
    component.control.setValue('x');
    fixture.detectChanges();

    const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    expect((radioInputs[0].nativeElement as HTMLInputElement).checked).toBe(true);
  });

  it('should update FormControl on selection', () => {
    const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    radioInputs[1].nativeElement.click();
    fixture.detectChanges();

    expect(component.control.value).toBe('y');
  });

  it('should mark the FormControl as touched after blur', () => {
    expect(component.control.touched).toBe(false);
    const radioInput = fixture.debugElement.query(By.css('input[type="radio"]'));
    radioInput.nativeElement.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
    expect(component.control.touched).toBe(true);
  });

  it('should disable radios when FormControl is disabled', () => {
    component.control.disable();
    fixture.detectChanges();

    const radioInputs = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    radioInputs.forEach(radio => {
      expect(radio.nativeElement.disabled).toBe(true);
    });
  });
});

@Component({
  template: `
    <tw-radio-group [formControl]="control">
      <div><tw-radio-button value="a" label="A"></tw-radio-button></div>
      <div><tw-radio-button value="b" label="B"></tw-radio-button></div>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent, ReactiveFormsModule],
})
class WrappedRadioHostComponent {
  control = new FormControl('a');
}

describe('TwRadioGroupComponent (regressions)', () => {
  it('should manage radio buttons nested inside wrapper elements', () => {
    const fixture = TestBed.createComponent(WrappedRadioHostComponent);
    fixture.detectChanges();
    const inputs: HTMLInputElement[] = [
      ...fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    ];
    expect(inputs[0].checked).toBe(true);
    expect(inputs[0].name).toBeTruthy();
    expect(inputs[0].name).toBe(inputs[1].name);

    inputs[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('b');
  });
});

@Component({
  template: `
    <tw-radio-group [formControl]="outer">
      <tw-radio-button value="a" label="A"></tw-radio-button>
      <tw-radio-group [formControl]="inner">
        <tw-radio-button value="x" label="X"></tw-radio-button>
        <tw-radio-button value="y" label="Y"></tw-radio-button>
      </tw-radio-group>
      <tw-radio-button value="b" label="B"></tw-radio-button>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent, ReactiveFormsModule],
})
class NestedGroupsHostComponent {
  outer = new FormControl('a');
  inner = new FormControl('y');
}

describe('TwRadioGroupComponent (nested groups)', () => {
  it('should not take over radios that belong to a nested radio group', () => {
    const fixture = TestBed.createComponent(NestedGroupsHostComponent);
    fixture.detectChanges();
    const [a, x, y, b]: HTMLInputElement[] = [
      ...fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    ];
    expect(a.name).toBe(b.name);
    expect(x.name).toBe(y.name);
    expect(x.name).not.toBe(a.name);
    expect(a.checked).toBe(true);
    expect(y.checked).toBe(true);

    x.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.inner.value).toBe('x');
    expect(fixture.componentInstance.outer.value).toBe('a');

    b.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.outer.value).toBe('b');
    expect(fixture.componentInstance.inner.value).toBe('x');
  });

  it('should only mark the group whose own radio lost focus as touched', () => {
    const fixture = TestBed.createComponent(NestedGroupsHostComponent);
    fixture.detectChanges();
    const [a, x]: HTMLInputElement[] = [
      ...fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    ];
    const { outer, inner } = fixture.componentInstance;

    x.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(inner.touched).toBe(true);
    expect(outer.touched).toBe(false);

    a.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(outer.touched).toBe(true);
  });
});

@Component({
  template: `
    <h3 id="shipping-heading">Shipping</h3>
    <tw-radio-group ariaLabelledby="shipping-heading">
      <tw-radio-button value="a" label="A"></tw-radio-button>
    </tw-radio-group>
    <tw-radio-group ariaLabel="Payment">
      <tw-radio-button value="b" label="B"></tw-radio-button>
    </tw-radio-group>
  `,
  standalone: true,
  imports: [TwRadioGroupComponent, TwRadioButtonComponent],
})
class NamedGroupHostComponent {}

describe('TwRadioGroupComponent (round 21)', () => {
  it('should give the radiogroup an accessible name', () => {
    const fixture = TestBed.createComponent(NamedGroupHostComponent);
    fixture.detectChanges();
    const groups = [
      ...fixture.nativeElement.querySelectorAll('[role="radiogroup"]'),
    ] as HTMLElement[];
    expect(groups[0].getAttribute('aria-labelledby')).toBe('shipping-heading');
    expect(groups[0].getAttribute('aria-label')).toBeNull();
    expect(groups[1].getAttribute('aria-label')).toBe('Payment');
  });
});

import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  InputSize,
  InputVariant,
  TwErrorDirective,
  TwHintDirective,
  TwInputComponent,
  TwLabelDirective,
  TwTextareaComponent,
} from './input.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-input
      [type]="type()"
      [variant]="variant()"
      [size]="size()"
      [label]="label()"
      [placeholder]="placeholder()"
      [hint]="hint()"
      [error]="error()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [required]="required()"
      [clearable]="clearable()"
      [classOverride]="classOverride()"
      data-testid="test-input"
    >
    </tw-input>
  `,
  standalone: true,
  imports: [TwInputComponent, FormsModule],
})
class TestHostComponent {
  @ViewChild(TwInputComponent) input!: TwInputComponent;
  type = signal('text');
  variant = signal<InputVariant>('default');
  size = signal<InputSize>('md');
  label = signal('');
  placeholder = signal('');
  hint = signal('');
  error = signal('');
  disabled = signal(false);
  readonly = signal(false);
  required = signal(false);
  clearable = signal(false);
  classOverride = signal('');
}

describe('TwInputComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let inputEl: HTMLInputElement;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    hostEl = fixture.debugElement.query(By.directive(TwInputComponent)).nativeElement;
    inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
  });

  it('should create the input', () => {
    expect(inputEl).toBeTruthy();
    expect(component.input).toBeTruthy();
  });

  it('should have block class on host', () => {
    expect(hostEl.className).toContain('block');
  });

  describe('type', () => {
    it('should set input type', () => {
      component.type.set('email');
      fixture.detectChanges();
      expect(inputEl.type).toBe('email');
    });

    it('should support password type', () => {
      component.type.set('password');
      fixture.detectChanges();
      expect(inputEl.type).toBe('password');
    });
  });

  describe('variants', () => {
    it('should apply default variant classes', () => {
      expect(inputEl.className).toContain('border');
      expect(inputEl.className).toContain('rounded-lg');
    });
  });

  describe('sizes', () => {
    it('should apply default size classes', () => {
      expect(inputEl.className).toContain('text-sm');
    });
  });

  describe('label', () => {
    it('should not show label by default', () => {
      const label = fixture.debugElement.query(By.css('label'));
      expect(label).toBeNull();
    });

    it('should show label when provided', () => {
      component.label.set('Email Address');
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label).toBeTruthy();
      expect(label.nativeElement.textContent).toContain('Email Address');
    });

    it('should show required indicator', () => {
      component.label.set('Email');
      component.required.set(true);
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).toContain('*');
    });
  });

  describe('placeholder', () => {
    it('should set placeholder', () => {
      component.placeholder.set('Enter your email');
      fixture.detectChanges();
      expect(inputEl.placeholder).toBe('Enter your email');
    });
  });

  describe('hint', () => {
    it('should show hint when provided', () => {
      component.hint.set('This is a hint');
      fixture.detectChanges();

      const hint = fixture.debugElement.query(By.css('.text-slate-500'));
      expect(hint).toBeTruthy();
      expect(hint.nativeElement.textContent).toContain('This is a hint');
    });

    it('should not show hint when error is present', () => {
      component.hint.set('This is a hint');
      component.error.set('This is an error');
      fixture.detectChanges();

      const hint = fixture.debugElement.query(By.css('.text-slate-500'));
      expect(hint).toBeNull();
    });
  });

  describe('error', () => {
    it('should show error when provided', () => {
      component.error.set('This field is required');
      fixture.detectChanges();

      const error = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(error).toBeTruthy();
      expect(error.nativeElement.textContent).toContain('This field is required');
    });

    it('should set aria-invalid when error is present', () => {
      component.error.set('Error');
      fixture.detectChanges();
      expect(inputEl.getAttribute('aria-invalid')).toBe('true');
    });

    it('should apply error border classes when error is set after init', () => {
      expect(inputEl.className).not.toContain('border-rose-500');

      component.error.set('Required');
      fixture.detectChanges();

      expect(inputEl.className).toContain('border-rose-500');
    });

    it('should keep the error border in dark mode for every variant', () => {
      component.error.set('Required');
      for (const variant of ['default', 'filled', 'outlined', 'underlined'] as const) {
        component.variant.set(variant);
        fixture.detectChanges();
        expect(inputEl.className).toContain('dark:border-rose-500');
        expect(inputEl.className).not.toContain('dark:border-slate-600');
      }
    });

    it('should keep the error border (not blue) when focused in dark mode', () => {
      component.error.set('Required');
      for (const variant of ['default', 'outlined', 'underlined'] as const) {
        component.variant.set(variant);
        fixture.detectChanges();
        expect(inputEl.className).toContain('dark:focus:border-rose-500');
        expect(inputEl.className).not.toContain('dark:focus:border-blue-500');
      }
    });
  });

  describe('dark mode focus indicator', () => {
    it('should show the focus border in dark mode for bordered variants', () => {
      // `dark:border-slate-600` is emitted after `focus:border-blue-500` and would win
      for (const variant of ['default', 'outlined', 'underlined'] as const) {
        component.variant.set(variant);
        fixture.detectChanges();
        expect(inputEl.className).toContain('dark:border-slate-600');
        expect(inputEl.className).toContain('dark:focus:border-blue-500');
      }
    });
  });

  describe('native validation attributes', () => {
    it('should not render pattern/min/max/step/autocomplete/inputmode by default', () => {
      expect(inputEl.hasAttribute('pattern')).toBe(false);
      expect(inputEl.hasAttribute('min')).toBe(false);
      expect(inputEl.hasAttribute('max')).toBe(false);
      expect(inputEl.hasAttribute('step')).toBe(false);
      expect(inputEl.hasAttribute('autocomplete')).toBe(false);
      expect(inputEl.hasAttribute('inputmode')).toBe(false);
    });
  });

  describe('disabled', () => {
    it('should disable input', () => {
      component.disabled.set(true);
      fixture.detectChanges();
      expect(inputEl.disabled).toBe(true);
    });
  });

  describe('readonly', () => {
    it('should make input readonly', () => {
      component.readonly.set(true);
      fixture.detectChanges();
      expect(inputEl.readOnly).toBe(true);
    });
  });

  describe('clearable', () => {
    it('should not show clear button by default', () => {
      const clearBtn = fixture.debugElement.query(By.css('button[aria-label="Clear input"]'));
      expect(clearBtn).toBeNull();
    });

    it('should render the clear icon with a >=3:1 contrast colour', () => {
      component.clearable.set(true);
      component.input.writeValue('abc');
      fixture.detectChanges();
      const clearBtn = fixture.debugElement.query(By.css('button[aria-label="Clear input"]'));
      const cls = (clearBtn.nativeElement as HTMLElement).className;
      expect(cls).toContain('text-slate-500');
      expect(cls).toContain('dark:text-slate-400');
      expect(cls).not.toMatch(/(^|\s)text-slate-400/);
    });
  });
});

@Component({
  template: ` <tw-input [formControl]="control"></tw-input> `,
  standalone: true,
  imports: [TwInputComponent, ReactiveFormsModule],
})
class ReactiveHostComponent {
  control = new FormControl('');
}

describe('TwInputComponent with reactive forms', () => {
  let fixture: ComponentFixture<ReactiveHostComponent>;
  let component: ReactiveHostComponent;
  let inputEl: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactiveHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
  });

  it('should reflect a programmatic setValue in the DOM', async () => {
    await Promise.resolve();
    component.control.setValue('hello');
    fixture.detectChanges();

    expect(inputEl.value).toBe('hello');
  });

  it('should reflect a programmatic disable in the DOM', async () => {
    await Promise.resolve();
    component.control.disable();
    fixture.detectChanges();

    expect(inputEl.disabled).toBe(true);

    component.control.enable();
    fixture.detectChanges();

    expect(inputEl.disabled).toBe(false);
  });
});

@Component({
  template: `
    <tw-textarea
      [variant]="variant()"
      [label]="label()"
      [rows]="rows()"
      [maxlength]="maxlength()"
      [showCount]="showCount()"
      [autoResize]="autoResize()"
      [error]="error()"
      data-testid="test-textarea"
    >
    </tw-textarea>
  `,
  standalone: true,
  imports: [TwTextareaComponent, FormsModule],
})
class TextareaHostComponent {
  @ViewChild(TwTextareaComponent) textarea!: TwTextareaComponent;
  variant = signal<InputVariant>('default');
  label = signal('');
  rows = signal(4);
  maxlength = signal<number | null>(null);
  showCount = signal(false);
  autoResize = signal(false);
  error = signal('');
}

describe('TwTextareaComponent', () => {
  let fixture: ComponentFixture<TextareaHostComponent>;
  let component: TextareaHostComponent;
  let textareaEl: HTMLTextAreaElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextareaHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TextareaHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    textareaEl = fixture.debugElement.query(By.css('textarea')).nativeElement;
  });

  it('should create the textarea', () => {
    expect(textareaEl).toBeTruthy();
    expect(component.textarea).toBeTruthy();
  });

  it('should set rows', () => {
    component.rows.set(6);
    fixture.detectChanges();
    expect(textareaEl.rows).toBe(6);
  });

  it('should apply resize classes by default', () => {
    expect(textareaEl.className).toContain('resize-y');
  });

  it('should apply error border classes when error is set after init', () => {
    expect(textareaEl.className).not.toContain('border-rose-500');

    component.error.set('Required');
    fixture.detectChanges();

    expect(textareaEl.className).toContain('border-rose-500');
  });

  it('should keep the error border in dark mode', () => {
    component.error.set('Required');
    fixture.detectChanges();
    expect(textareaEl.className).toContain('dark:border-rose-500');
    expect(textareaEl.className).not.toContain('dark:border-slate-600');
  });

  describe('showCount', () => {
    it('should show count with maxlength', () => {
      component.showCount.set(true);
      component.maxlength.set(100);
      fixture.detectChanges();

      const count = fixture.debugElement.query(By.css('.text-right'));
      expect(count).toBeTruthy();
      expect(count.nativeElement.textContent).toContain('0 / 100');
      expect(count.nativeElement.className).toContain('text-slate-500');
      expect(count.nativeElement.className).toContain('dark:text-slate-400');
    });

    it('should show bare count without maxlength', () => {
      component.showCount.set(true);
      fixture.detectChanges();

      const count = fixture.debugElement.query(By.css('.text-right'));
      expect(count).toBeTruthy();
      expect(count.nativeElement.textContent.trim()).toBe('0');
    });

    it('should update count on input', () => {
      component.showCount.set(true);
      fixture.detectChanges();

      textareaEl.value = 'abc';
      textareaEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const count = fixture.debugElement.query(By.css('.text-right'));
      expect(count.nativeElement.textContent.trim()).toBe('3');
    });
  });
});

@Component({
  template: `
    <tw-label [required]="required()" [class]="labelClass()">Label Text</tw-label>
    <tw-hint [class]="hintClass()">Hint text</tw-hint>
    <tw-error [class]="errorClass()">Error text</tw-error>
  `,
  standalone: true,
  imports: [TwLabelDirective, TwHintDirective, TwErrorDirective],
})
class DirectivesHostComponent {
  required = signal(false);
  labelClass = signal('');
  hintClass = signal('');
  errorClass = signal('');
}

describe('Input directives', () => {
  let fixture: ComponentFixture<DirectivesHostComponent>;
  let component: DirectivesHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectivesHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectivesHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('TwLabelDirective', () => {
    it('should apply label classes', () => {
      const label = fixture.debugElement.query(By.directive(TwLabelDirective)).nativeElement;
      expect(label.className).toContain('text-sm');
      expect(label.className).toContain('font-medium');
    });

    it('should merge custom class', () => {
      component.labelClass.set('custom-label');
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.directive(TwLabelDirective)).nativeElement;
      expect(label.className).toContain('custom-label');
    });

    it('should not mark as required by default', () => {
      const label = fixture.debugElement.query(By.directive(TwLabelDirective)).nativeElement;
      expect(label.hasAttribute('aria-required')).toBe(false);
      expect(label.className).not.toContain("after:content-['*']");
    });

    it('should render required indicator and aria-required when required', () => {
      component.required.set(true);
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.directive(TwLabelDirective)).nativeElement;
      expect(label.getAttribute('aria-required')).toBe('true');
      expect(label.className).toContain("after:content-['*']");
    });
  });

  describe('TwHintDirective', () => {
    it('should apply hint classes', () => {
      const hint = fixture.debugElement.query(By.directive(TwHintDirective)).nativeElement;
      expect(hint.className).toContain('text-xs');
      expect(hint.className).toContain('text-slate-500');
    });
  });

  describe('TwErrorDirective', () => {
    it('should apply error classes', () => {
      const error = fixture.debugElement.query(By.directive(TwErrorDirective)).nativeElement;
      expect(error.className).toContain('text-xs');
      expect(error.className).toContain('text-rose-600');
    });

    it('should have role alert', () => {
      const error = fixture.debugElement.query(By.directive(TwErrorDirective)).nativeElement;
      expect(error.getAttribute('role')).toBe('alert');
    });
  });
});

@Component({
  template: `
    <tw-input [formControl]="inputControl"></tw-input>
    <tw-textarea [formControl]="textareaControl"></tw-textarea>
  `,
  standalone: true,
  imports: [TwInputComponent, TwTextareaComponent, ReactiveFormsModule],
})
class DisabledReactiveHostComponent {
  inputControl = new FormControl({ value: '', disabled: true });
  textareaControl = new FormControl({ value: '', disabled: true });
}

describe('TwInputComponent / TwTextareaComponent (regressions)', () => {
  it('should honor FormControls that start disabled', () => {
    const fixture = TestBed.createComponent(DisabledReactiveHostComponent);
    fixture.detectChanges();
    const inputEl: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const textareaEl: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(inputEl.disabled).toBe(true);
    expect(textareaEl.disabled).toBe(true);

    fixture.componentInstance.inputControl.enable();
    fixture.componentInstance.textareaControl.enable();
    fixture.detectChanges();
    expect(inputEl.disabled).toBe(false);
    expect(textareaEl.disabled).toBe(false);
  });
});

@Component({
  template: `<tw-input describedBy="external" error="Oops"></tw-input>`,
  standalone: true,
  imports: [TwInputComponent],
})
class DescribedByHostComponent {}

describe('TwInputComponent / TwTextareaComponent aria-describedby', () => {
  it('should describe the input by its hint, then by its error', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.hint.set('Helpful hint');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${hintId}`).textContent).toContain('Helpful hint');

    fixture.componentInstance.error.set('Bad value');
    fixture.detectChanges();
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).not.toBe(hintId);
    expect(fixture.nativeElement.querySelector(`#${errorId}`).textContent).toContain('Bad value');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.error.set('');
    fixture.componentInstance.hint.set('');
    fixture.detectChanges();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('should keep an explicit describedBy alongside the error id', () => {
    const fixture = TestBed.createComponent(DescribedByHostComponent);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('external');
    expect(ids.length).toBe(2);
    expect(fixture.nativeElement.querySelector(`#${ids[1]}`).textContent).toContain('Oops');
  });

  it('should describe the textarea by its error', () => {
    const fixture = TestBed.createComponent(TextareaHostComponent);
    fixture.componentInstance.error.set('Too short');
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    const errorId = textarea.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${errorId}`).textContent).toContain('Too short');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });
});

@Component({
  template: `
    <tw-input [variant]="variant()" [error]="error()">
      <span twInputPrefix>@</span>
    </tw-input>
    <tw-input clearable></tw-input>
  `,
  standalone: true,
  imports: [TwInputComponent],
})
class WrappedInputHostComponent {
  variant = signal<InputVariant>('default');
  error = signal('');
}

describe('TwInputComponent wrapper focus indicator', () => {
  const variants: InputVariant[] = ['default', 'filled', 'outlined', 'underlined'];

  for (const variant of variants) {
    it(`should show the ${variant} focus border on the wrapper via focus-within`, () => {
      const fixture = TestBed.createComponent(WrappedInputHostComponent);
      fixture.componentInstance.variant.set(variant);
      fixture.detectChanges();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
      const wrapper = input.parentElement!;
      expect(wrapper.className).toContain('focus-within:border-blue-500');
      expect(wrapper.className).not.toMatch(/(^|\s)focus:/);
    });
  }

  it('should use focus-within error styles on the wrapper', () => {
    const fixture = TestBed.createComponent(WrappedInputHostComponent);
    fixture.componentInstance.error.set('Bad');
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('input').parentElement as HTMLElement;
    expect(wrapper.className).toContain('focus-within:border-rose-500');
    expect(wrapper.className).not.toMatch(/(^|\s)focus:/);
  });

  it('should keep the wrapper error border in dark mode', () => {
    const fixture = TestBed.createComponent(WrappedInputHostComponent);
    fixture.componentInstance.error.set('Bad');
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('input').parentElement as HTMLElement;
    expect(wrapper.className).toContain('dark:border-rose-500');
    expect(wrapper.className).not.toContain('dark:border-slate-600');
  });

  it('should show the wrapper focus border in dark mode', () => {
    for (const variant of ['default', 'outlined', 'underlined'] as const) {
      const fixture = TestBed.createComponent(WrappedInputHostComponent);
      fixture.componentInstance.variant.set(variant);
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('input').parentElement as HTMLElement;
      expect(wrapper.className).toContain('dark:focus-within:border-blue-500');
    }
  });

  it('should use focus-within on the wrapper of a clearable input', () => {
    const fixture = TestBed.createComponent(WrappedInputHostComponent);
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect(inputs[1].parentElement.className).toContain('focus-within:ring-2');
  });
});

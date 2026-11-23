import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TwClassService } from '../core/tw-class.service';

export type SliderVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
export type SliderSize = 'sm' | 'md' | 'lg';

const SLIDER_VARIANTS: Record<SliderVariant, { fill: string; thumb: string }> = {
  primary: { fill: 'bg-blue-600', thumb: 'border-blue-600' },
  secondary: { fill: 'bg-slate-600', thumb: 'border-slate-600' },
  success: { fill: 'bg-emerald-600', thumb: 'border-emerald-600' },
  warning: { fill: 'bg-amber-600', thumb: 'border-amber-600' },
  danger: { fill: 'bg-rose-600', thumb: 'border-rose-600' },
};

const SLIDER_SIZES: Record<SliderSize, { track: string; thumb: string }> = {
  sm: { track: 'h-1', thumb: 'w-4 h-4' },
  md: { track: 'h-2', thumb: 'w-5 h-5' },
  lg: { track: 'h-3', thumb: 'w-6 h-6' },
};

/**
 * Slider/Range component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-slider [(ngModel)]="value" [min]="0" [max]="100"></tw-slider>
 * <tw-slider [showValue]="true" [showMinMax]="true" label="Volume"></tw-slider>
 * ```
 */
@Component({
  selector: 'tw-slider',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TwSliderComponent),
      multi: true,
    },
  ],
  templateUrl: './slider.component.html',
})
export class TwSliderComponent implements ControlValueAccessor {
  private readonly twClass = inject(TwClassService);

  /** Minimum value */
  readonly min = input(0, { transform: numberAttribute });

  /** Maximum value */
  readonly max = input(100, { transform: numberAttribute });

  /** Step increment */
  readonly step = input(1, { transform: numberAttribute });

  /** Label text */
  readonly label = input('');

  /** Visual variant */
  readonly variant = input<SliderVariant>('primary');

  /** Size of the slider */
  readonly size = input<SliderSize>('md');

  /** Whether the slider is disabled */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Whether to show the current value */
  readonly showValue = input(false, { transform: booleanAttribute });

  /** Whether to show min/max labels */
  readonly showMinMax = input(false, { transform: booleanAttribute });

  /** Whether to show tick marks */
  readonly showTicks = input(false, { transform: booleanAttribute });

  /** Number of tick marks to show */
  readonly tickCount = input(5, { transform: numberAttribute });

  /** Whether to show value bubble while dragging */
  readonly showValueBubble = input(false, { transform: booleanAttribute });

  /** Format function for display value */
  readonly valueFormat = input<(value: number) => string>(v => v.toString());

  /** ID applied to the range input and referenced by the label */
  readonly inputId = input(`tw-slider-${Math.random().toString(36).slice(2)}`);

  /** Additional classes */
  readonly classOverride = input('');

  /** Change event (fires on mouseup/touchend) */
  readonly onChange = output<number>();

  /** Input event (fires continuously while dragging) */
  readonly onInput = output<number>();

  /** Focus event */
  readonly onFocus = output<FocusEvent>();

  /** Blur event */
  readonly onBlur = output<FocusEvent>();

  /** Value written by the forms API or the user (null = not set yet: shown at min, like the native input) */
  private readonly rawValue = signal<number | null>(null);
  protected value = computed(() => this.rawValue() ?? this.min());
  protected isDragging = signal(false);
  private readonly _disabled = signal(false);

  private onChangeFn: (value: number) => void = () => {};
  private onTouchedFn: () => void = () => {};

  protected isDisabled = computed(() => this.disabled() || this._disabled());

  /** A value from `input` events that has not yet been committed by a `change` event */
  private pendingValue: number | null = null;

  constructor() {
    // Disabling the native input mid-drag swallows the release (no mouseup/change), so end
    // the drag here and commit the value the user dragged to instead of leaving the form
    // model behind the view and the drag state (and value bubble) stuck on.
    effect(() => {
      if (!this.isDisabled()) return;
      untracked(() => {
        this.isDragging.set(false);
        const pending = this.pendingValue;
        if (pending === null) return;
        this.pendingValue = null;
        this.onChangeFn(pending);
        this.onChange.emit(pending);
      });
    });
  }

  protected fillPercentage = computed(() => {
    const range = this.max() - this.min();
    if (range <= 0) return 0;
    const percentage = ((this.value() - this.min()) / range) * 100;
    // Keep the fill/thumb on the track when the value is outside [min, max]
    return Math.min(100, Math.max(0, percentage));
  });

  protected displayValue = computed(() => {
    return this.valueFormat()(this.value());
  });

  protected ticks = computed(() => {
    const count = this.tickCount();
    if (count <= 0) return [];
    if (count === 1) return [this.min()];
    const ticks: number[] = [];
    const step = (this.max() - this.min()) / (count - 1);
    // Round to the precision of the slider step so fractional ranges keep their ticks
    const decimals = (this.step().toString().split('.')[1] ?? '').length;
    for (let i = 0; i < count; i++) {
      ticks.push(Number((this.min() + step * i).toFixed(decimals)));
    }
    return ticks;
  });

  protected containerClasses = computed(() => {
    return this.twClass.merge('w-full', this.classOverride());
  });

  protected labelClasses = computed(() => {
    return 'text-sm font-medium text-slate-700 dark:text-slate-300';
  });

  protected sliderContainerClasses = computed(() => {
    return 'flex items-center';
  });

  protected trackClasses = computed(() => {
    const sizeClasses = SLIDER_SIZES[this.size()].track;
    return this.twClass.merge(
      'w-full rounded-full bg-slate-200 dark:bg-slate-700',
      sizeClasses,
      this.isDisabled() ? 'opacity-50' : ''
    );
  });

  protected fillClasses = computed(() => {
    const variant = SLIDER_VARIANTS[this.variant()];
    const sizeClasses = SLIDER_SIZES[this.size()].track;
    return this.twClass.merge(
      'rounded-full transition-all duration-100',
      variant.fill,
      sizeClasses
    );
  });

  protected inputClasses = computed(() => {
    return this.twClass.merge(
      'absolute inset-0 w-full opacity-0 cursor-pointer',
      this.isDisabled() ? 'cursor-not-allowed' : ''
    );
  });

  protected thumbClasses = computed(() => {
    const variant = SLIDER_VARIANTS[this.variant()];
    const sizeClasses = SLIDER_SIZES[this.size()].thumb;
    return this.twClass.merge(
      'rounded-full bg-white border-2 shadow-md transition-transform',
      variant.thumb,
      sizeClasses,
      this.isDragging() ? 'scale-110' : '',
      // The native input is invisible, so show its keyboard focus on the thumb
      'group-has-[input:focus-visible]:ring-2 group-has-[input:focus-visible]:ring-blue-500 group-has-[input:focus-visible]:ring-offset-2',
      this.isDisabled() ? 'opacity-50' : ''
    );
  });

  onSliderInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const newValue = Number.parseFloat(inputEl.value);
    this.rawValue.set(newValue);
    this.pendingValue = newValue;
    this.onInput.emit(newValue);
  }

  onSliderChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const newValue = Number.parseFloat(inputEl.value);
    this.rawValue.set(newValue);
    this.pendingValue = null;
    // `change` fires on release even when the pointer is released off the input
    this.isDragging.set(false);
    this.onChangeFn(newValue);
    this.onChange.emit(newValue);
  }

  onInputBlur(event: FocusEvent): void {
    this.onTouchedFn();
    this.onBlur.emit(event);
  }

  onDragStart(): void {
    this.isDragging.set(true);
  }

  onDragEnd(): void {
    this.isDragging.set(false);
  }

  // ControlValueAccessor implementation
  writeValue(value: number | null | undefined): void {
    this.pendingValue = null;
    this.rawValue.set(value ?? null);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }
}

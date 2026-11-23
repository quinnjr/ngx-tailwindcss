import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TwClassService } from '../core/tw-class.service';
import { MusicAccessibilityService } from './accessibility.service';
import { MobileSupportService } from './mobile-support.service';

export type DialVariant = 'modern' | 'vintage' | 'minimal' | 'led' | 'light' | 'highContrast';
export type DialSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const DIAL_SIZES: Record<
  DialSize,
  { size: number; strokeWidth: number; tickLength: number; fontSize: string }
> = {
  xs: { size: 32, strokeWidth: 3, tickLength: 3, fontSize: 'text-[8px]' },
  sm: { size: 48, strokeWidth: 4, tickLength: 4, fontSize: 'text-[10px]' },
  md: { size: 72, strokeWidth: 5, tickLength: 6, fontSize: 'text-xs' },
  lg: { size: 96, strokeWidth: 6, tickLength: 8, fontSize: 'text-sm' },
  xl: { size: 128, strokeWidth: 8, tickLength: 10, fontSize: 'text-base' },
};

const DIAL_VARIANTS: Record<
  DialVariant,
  { track: string; fill: string; knob: string; indicator: string }
> = {
  modern: {
    track: 'stroke-slate-200 dark:stroke-slate-700',
    fill: 'stroke-blue-500',
    knob: 'fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600',
    indicator: 'stroke-blue-500',
  },
  vintage: {
    track: 'stroke-amber-100 dark:stroke-amber-900/30',
    fill: 'stroke-amber-500',
    knob: 'fill-amber-50 dark:fill-amber-950 stroke-amber-300 dark:stroke-amber-700',
    indicator: 'stroke-amber-600',
  },
  minimal: {
    track: 'stroke-slate-100 dark:stroke-slate-800',
    fill: 'stroke-slate-600 dark:stroke-slate-400',
    knob: 'fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700',
    indicator: 'stroke-slate-800 dark:stroke-slate-200',
  },
  led: {
    track: 'stroke-slate-800 dark:stroke-slate-900',
    fill: 'stroke-emerald-500',
    knob: 'fill-slate-900 dark:fill-black stroke-slate-700 dark:stroke-slate-800',
    indicator: 'stroke-emerald-400',
  },
  light: {
    track: 'stroke-slate-200',
    fill: 'stroke-blue-600',
    knob: 'fill-white stroke-slate-300 shadow-md',
    indicator: 'stroke-blue-600',
  },
  highContrast: {
    track: 'stroke-white',
    fill: 'stroke-yellow-400',
    knob: 'fill-black stroke-white stroke-2',
    indicator: 'stroke-yellow-400',
  },
};

/**
 * Volume Dial (Rotary Knob) component for audio controls
 *
 * @example
 * ```html
 * <tw-volume-dial [(ngModel)]="volume" [min]="0" [max]="100"></tw-volume-dial>
 * <tw-volume-dial [value]="gain" variant="vintage" size="lg" [showValue]="true"></tw-volume-dial>
 * ```
 */
@Component({
  selector: 'tw-volume-dial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './volume-dial.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TwVolumeDialComponent),
      multi: true,
    },
  ],
  host: {
    class: 'inline-block',
  },
})
export class TwVolumeDialComponent implements ControlValueAccessor, OnDestroy {
  private readonly twClass = inject(TwClassService);
  private readonly a11y = inject(MusicAccessibilityService);
  private readonly mobileSupport = inject(MobileSupportService);
  private readonly dialSvg = viewChild<ElementRef<SVGElement>>('dialSvg');

  ngOnDestroy(): void {
    this.dragController?.abort();
    this.dragController = null;
  }

  // Inputs
  /** Initial/bound value - supports two-way binding with [(value)] */
  readonly value = model(0);
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly variant = input<DialVariant>('modern');
  readonly size = input<DialSize>('md');
  readonly disabled = input(false);
  readonly showValue = input(true);
  readonly showTicks = input(true);
  readonly showLabel = input(false);
  readonly showLedRing = input(true);
  readonly label = input<string>('');
  readonly unit = input<string>('');
  readonly centerDetent = input(false);
  readonly detentValue = input(50);
  readonly classOverride = input('');

  // Custom sizing via CSS variables (overrides size prop)
  readonly customSize = input<number | null>(null); // Override dial size in pixels
  readonly customStrokeWidth = input<number | null>(null); // Override stroke width

  // Mobile / Touch options
  readonly hapticFeedback = input(true); // Enable haptic feedback on value changes
  readonly touchGuard = input(false); // Prevent accidental touches
  readonly minTouchDuration = input(0); // Minimum touch duration (ms) before interaction

  // Accessibility options
  readonly announceChanges = input(true); // Announce value changes to screen readers
  readonly reducedMotion = input<boolean | 'auto'>('auto'); // Respect reduced motion preference

  // Outputs
  // Note: valueChange is automatically created by the model() signal
  readonly hapticTrigger = output<'change' | 'detent' | 'boundary'>(); // Haptic feedback trigger points
  private isDragging = false;
  private lastAngle = 0;
  private accumulatedAngle = 0;
  private startValue = 0;

  // Disabled state set imperatively via setDisabledState (forms API)
  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  private dragController: AbortController | null = null;
  private lastHapticTime = 0;

  // Effective reduced-motion preference ('auto' follows the OS setting)
  protected readonly effectiveReducedMotion = computed(() => {
    const pref = this.reducedMotion();
    return pref === 'auto' ? this.a11y.prefersReducedMotion() : pref;
  });

  // CVA callbacks
  private onChangeFn: (value: number) => void = () => {};
  private onTouchedFn: () => void = () => {};

  // Computed values
  protected readonly sizeConfig = computed(() => {
    const baseConfig = DIAL_SIZES[this.size()];
    const customSize = this.customSize();
    const customStroke = this.customStrokeWidth();

    // Allow custom overrides
    return {
      size: customSize ?? baseConfig.size,
      strokeWidth: customStroke ?? baseConfig.strokeWidth,
      tickLength: baseConfig.tickLength,
      fontSize: baseConfig.fontSize,
    };
  });
  protected readonly variantConfig = computed(() => DIAL_VARIANTS[this.variant()]);
  protected readonly center = computed(() => this.sizeConfig().size / 2);
  protected readonly radius = computed(() => this.center() - this.sizeConfig().strokeWidth - 4);
  protected readonly knobRadius = computed(() => this.radius() * 0.55);

  // CSS variable style bindings for custom sizing
  protected readonly cssVarStyles = computed(() => {
    const customSize = this.customSize();
    const customStroke = this.customStrokeWidth();
    const styles: Record<string, string> = {};

    if (customSize) {
      styles['--tw-music-dial-size'] = `${customSize}px`;
    }
    if (customStroke) {
      styles['--tw-music-dial-stroke-width'] = `${customStroke}px`;
    }

    return styles;
  });

  // Arc angles (in degrees, 0 = top, clockwise)
  private readonly startAngleDeg = -135;
  private readonly endAngleDeg = 135;
  private readonly totalAngle = 270;

  protected readonly containerClasses = computed(() => {
    return this.twClass.merge('relative inline-flex flex-col items-center', this.classOverride());
  });

  protected readonly valueClasses = computed(() => {
    return this.twClass.merge(
      'mt-1 font-mono font-medium text-slate-700 dark:text-slate-300',
      this.sizeConfig().fontSize
    );
  });

  protected readonly displayValue = computed(() => {
    const val = this.value();
    return Number.isInteger(val) ? val : val.toFixed(1);
  });

  // Value position within min..max as 0..1 (clamped; safe for an empty range)
  protected readonly percentage = computed(() => {
    const range = this.max() - this.min();
    if (!(range > 0)) return 0;
    const pct = (this.value() - this.min()) / range;
    return Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  });

  // Calculate SVG arc path
  protected readonly trackPath = computed(() => {
    return this.describeArc(
      this.center(),
      this.center(),
      this.radius(),
      this.startAngleDeg,
      this.endAngleDeg
    );
  });

  protected readonly fillPath = computed(() => {
    const fillAngle = this.startAngleDeg + this.percentage() * this.totalAngle;
    return this.describeArc(
      this.center(),
      this.center(),
      this.radius(),
      this.startAngleDeg,
      fillAngle
    );
  });

  protected readonly indicatorEnd = computed(() => {
    const angle = this.startAngleDeg + this.percentage() * this.totalAngle;
    const radians = (angle - 90) * (Math.PI / 180);
    const length = this.knobRadius() * 0.7;
    return {
      x: this.center() + length * Math.cos(radians),
      y: this.center() + length * Math.sin(radians),
    };
  });

  protected readonly tickMarks = computed(() => {
    const ticks: Array<{
      angle: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isMajor: boolean;
    }> = [];
    const tickCount = 11;
    const majorEvery = 2;

    for (let i = 0; i < tickCount; i++) {
      const percentage = i / (tickCount - 1);
      const angle = this.startAngleDeg + percentage * this.totalAngle;
      const radians = (angle - 90) * (Math.PI / 180);
      const isMajor = i % majorEvery === 0;
      const outerRadius = this.radius() + this.sizeConfig().strokeWidth + 2;
      const innerRadius =
        outerRadius - (isMajor ? this.sizeConfig().tickLength : this.sizeConfig().tickLength * 0.6);

      ticks.push({
        angle,
        x1: this.center() + outerRadius * Math.cos(radians),
        y1: this.center() + outerRadius * Math.sin(radians),
        x2: this.center() + innerRadius * Math.cos(radians),
        y2: this.center() + innerRadius * Math.sin(radians),
        isMajor,
      });
    }
    return ticks;
  });

  protected readonly ledSegments = computed(() => {
    const segments: Array<{ index: number; x: number; y: number; active: boolean }> = [];
    const ledCount = 12;
    const ledRadius = this.radius() + this.sizeConfig().strokeWidth + 6;
    const percentage = this.percentage();

    for (let i = 0; i < ledCount; i++) {
      const segmentPercentage = i / (ledCount - 1);
      const angle = this.startAngleDeg + segmentPercentage * this.totalAngle;
      const radians = (angle - 90) * (Math.PI / 180);

      segments.push({
        index: i,
        x: this.center() + ledRadius * Math.cos(radians),
        y: this.center() + ledRadius * Math.sin(radians),
        active: segmentPercentage <= percentage,
      });
    }
    return segments;
  });

  // SVG arc helper
  private describeArc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string {
    const start = this.polarToCartesian(x, y, radius, endAngle);
    const end = this.polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  private polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ): { x: number; y: number } {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }

  // Event handlers
  onMouseDown(event: MouseEvent): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY);

    const onMouseMove = (e: MouseEvent): void => {
      this.handleDrag(e.clientX, e.clientY);
    };
    const onMouseUp = (): void => {
      this.endDrag();
    };

    this.dragController?.abort();
    this.dragController = new AbortController();
    const { signal: abortSignal } = this.dragController;
    document.addEventListener('mousemove', onMouseMove, { signal: abortSignal });
    document.addEventListener('mouseup', onMouseUp, { signal: abortSignal });
  }

  onTouchStart(event: TouchEvent): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    const touch = event.touches[0];
    const guarded = this.touchGuard();
    if (guarded) {
      this.mobileSupport.startTouchTracking(event);
    }
    this.startDrag(touch.clientX, touch.clientY);

    const onTouchMove = (e: TouchEvent): void => {
      // Touch guard: ignore movement until the minimum touch duration has elapsed
      if (guarded && !this.mobileSupport.validateTouchDuration(this.minTouchDuration())) return;
      const t = e.touches[0];
      this.handleDrag(t.clientX, t.clientY);
    };
    const onTouchEnd = (): void => {
      this.endDrag();
    };

    this.dragController?.abort();
    this.dragController = new AbortController();
    const { signal: abortSignal } = this.dragController;
    document.addEventListener('touchmove', onTouchMove, { passive: false, signal: abortSignal });
    document.addEventListener('touchend', onTouchEnd, { signal: abortSignal });
    document.addEventListener('touchcancel', onTouchEnd, { signal: abortSignal });
  }

  private startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.lastAngle = this.getAngleFromPoint(clientX, clientY);
    this.accumulatedAngle = 0;
    this.startValue = this.value();
  }

  private handleDrag(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    // Accumulate the per-move angle delta so a gesture can sweep the whole
    // 270° arc (a single start→current diff wraps at ±180°).
    const currentAngle = this.getAngleFromPoint(clientX, clientY);
    let angleDiff = currentAngle - this.lastAngle;
    this.lastAngle = currentAngle;

    // Handle wrap-around
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    // Keep the accumulated rotation within what the value range can absorb
    const range = this.max() - this.min();
    // An empty range would divide by zero and write NaN
    if (!(range > 0)) return;
    const minAngle = ((this.min() - this.startValue) / range) * this.totalAngle;
    const maxAngle = ((this.max() - this.startValue) / range) * this.totalAngle;
    this.accumulatedAngle = Math.max(
      minAngle,
      Math.min(maxAngle, this.accumulatedAngle + angleDiff)
    );

    const valueDiff = (this.accumulatedAngle / this.totalAngle) * range;
    let newValue = this.snapToStep(this.startValue + valueDiff);

    // Center detent
    if (this.centerDetent()) {
      const detent = this.detentValue();
      const tolerance = (this.max() - this.min()) * 0.02;
      if (Math.abs(newValue - detent) < tolerance) {
        newValue = detent;
      }
    }

    this.setValue(newValue);
  }

  private endDrag(): void {
    this.isDragging = false;
    this.onTouchedFn();
    this.dragController?.abort();
    this.dragController = null;
  }

  private getAngleFromPoint(clientX: number, clientY: number): number {
    const svg = this.dialSvg()?.nativeElement;
    if (!svg) return 0;

    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;

    let newValue = this.value();
    const largeStep = (this.max() - this.min()) * 0.1;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight': {
        newValue += this.step();
        break;
      }
      case 'ArrowDown':
      case 'ArrowLeft': {
        newValue -= this.step();
        break;
      }
      case 'PageUp': {
        newValue += largeStep;
        break;
      }
      case 'PageDown': {
        newValue -= largeStep;
        break;
      }
      case 'Home': {
        newValue = this.min();
        break;
      }
      case 'End': {
        newValue = this.max();
        break;
      }
      default: {
        return;
      }
    }

    event.preventDefault();
    this.setValue(this.snapToStep(newValue));
    this.onTouchedFn();
  }

  // Round to the step grid (anchored at min), clamp, and strip float noise
  private snapToStep(value: number): number {
    const min = this.min();
    const max = this.max();
    const step = this.step();
    let snapped = value;
    if (step > 0) {
      snapped = min + Math.round((value - min) / step) * step;
      const decimals = Math.max(
        step.toString().split('.')[1]?.length ?? 0,
        min.toString().split('.')[1]?.length ?? 0
      );
      snapped = Number(snapped.toFixed(Math.min(decimals, 20)));
    }
    return Math.max(min, Math.min(max, snapped));
  }

  private setValue(newValue: number): void {
    if (newValue !== this.value()) {
      const previous = this.value();
      this.value.set(newValue);
      this.onChangeFn(newValue);
      this.triggerHaptics(newValue, previous);

      // Announce to screen readers (debounced)
      if (this.announceChanges()) {
        this.a11y.announceValueChange(this.label() || 'Volume', this.displayValue(), this.unit());
      }
    }
  }

  private triggerHaptics(value: number, previous: number): void {
    if (!this.hapticFeedback()) return;

    // Center detent hit
    if (this.centerDetent() && value === this.detentValue() && previous !== this.detentValue()) {
      this.mobileSupport.triggerSnapHaptic();
      this.hapticTrigger.emit('detent');
      return;
    }

    // Boundary hit
    const atBoundary =
      (value === this.min() && previous !== this.min()) ||
      (value === this.max() && previous !== this.max());
    if (atBoundary) {
      this.mobileSupport.triggerBoundaryHaptic();
      this.hapticTrigger.emit('boundary');
      return;
    }

    // Regular change (throttled)
    const now = Date.now();
    if (now - this.lastHapticTime >= 50) {
      this.lastHapticTime = now;
      this.mobileSupport.triggerHaptic('light');
      this.hapticTrigger.emit('change');
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: number): void {
    this.value.set(value ?? this.min());
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }
}

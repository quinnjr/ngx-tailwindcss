import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { twClassValue } from '../core/class-value';

/**
 * Center component for centering content horizontally and/or vertically.
 *
 * @example
 * ```html
 * <!-- Center both horizontally and vertically -->
 * <tw-center class="h-screen">
 *   <div>Centered content</div>
 * </tw-center>
 *
 * <!-- Inline center that sits within a line of text -->
 * <p>Status: <tw-center [inline]="true" class="w-6 h-6 rounded-full bg-green-500"><span>✓</span></tw-center></p>
 * ```
 */
@Component({
  selector: 'tw-center',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './center.component.html',
  host: {
    // The host is the styled box itself: a static `class` attribute lands here once
    '[class]': 'centerClasses()',
  },
})
export class TwCenterComponent {
  private readonly twClass = inject(TwClassService);

  /** Use inline-flex instead of flex */
  readonly inline = input(false, { transform: booleanAttribute });

  /** Apply horizontal centering (justify-center); combines with `vertical` */
  readonly horizontal = input(true, { transform: booleanAttribute });

  /** Apply vertical centering (items-center); combines with `horizontal` */
  readonly vertical = input(true, { transform: booleanAttribute });

  /** Additional CSS classes */
  readonly class = input('', { transform: twClassValue });

  protected readonly centerClasses = computed(() => {
    const classes: string[] = [this.inline() ? 'inline-flex' : 'flex'];

    if (this.horizontal()) {
      classes.push('justify-center');
    }

    if (this.vertical()) {
      classes.push('items-center');
    }

    return this.twClass.merge(...classes, this.class());
  });
}

/**
 * Square component for creating square-shaped containers.
 * The width determines the height (1:1 aspect ratio).
 *
 * @example
 * ```html
 * <tw-square size="64px" class="bg-blue-500 rounded-lg">
 *   <span>Icon</span>
 * </tw-square>
 * ```
 */
@Component({
  selector: 'tw-square',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './square.component.html',
  host: {
    // The host is the styled box itself: a static `class` attribute lands here once
    '[class]': 'squareClasses()',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
  },
})
export class TwSquareComponent {
  private readonly twClass = inject(TwClassService);

  /** Size of the square (e.g., '64px', '4rem') */
  readonly size = input('48px');

  /** Whether to center the content */
  readonly centerContent = input(true, { transform: booleanAttribute });

  /** Additional CSS classes */
  readonly class = input('', { transform: twClassValue });

  protected readonly squareClasses = computed(() => {
    return this.twClass.merge(
      // A fixed-size box: don't let a flex parent squeeze it below `size`
      'shrink-0',
      this.centerContent() ? 'inline-flex items-center justify-center' : 'inline-block',
      this.class()
    );
  });
}

/**
 * Circle component for creating circular containers.
 *
 * @example
 * ```html
 * <tw-circle size="48px" class="bg-gradient-to-br from-blue-500 to-purple-500">
 *   <span class="text-white">AB</span>
 * </tw-circle>
 * ```
 */
@Component({
  selector: 'tw-circle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './circle.component.html',
  host: {
    // The host is the styled box itself: a static `class` attribute lands here once
    '[class]': 'circleClasses()',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
  },
})
export class TwCircleComponent {
  private readonly twClass = inject(TwClassService);

  /** Size of the circle (e.g., '64px', '4rem') */
  readonly size = input('48px');

  /** Whether to center the content */
  readonly centerContent = input(true, { transform: booleanAttribute });

  /** Additional CSS classes */
  readonly class = input('', { transform: twClassValue });

  protected readonly circleClasses = computed(() => {
    return this.twClass.merge(
      'rounded-full shrink-0',
      this.centerContent() ? 'inline-flex items-center justify-center' : 'inline-block',
      this.class()
    );
  });
}

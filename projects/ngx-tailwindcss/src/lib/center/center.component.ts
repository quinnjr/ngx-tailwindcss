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
    // An inline center must sit in the surrounding line, not on a block of its own
    '[style.display]': "inline() ? 'inline-block' : null",
  },
  styles: [
    `
      :host {
        display: block;
        /* A static class attribute also stays on the host: paint it once, on the inner element */
        padding: 0;
        border: 0;
        background: none;
        box-shadow: none;
        opacity: 1;
        filter: none;
        transform: none;
        translate: none;
        rotate: none;
        scale: none;
      }
      /* The host may be sized from outside (flex/grid stretch, flex-grow): fill it */
      :host > div {
        height: 100%;
        /* Margins and widths (mx-4, w-1/2, ...) already apply to the host: don't apply them twice */
        margin: 0;
        /* 100% rather than auto so an inline-flex inner element still fills an inline host */
        width: 100%;
        max-width: none;
        /* An inline-flex inner element leaves no line-box gap below it in an inline host */
        vertical-align: top;
      }
    `,
  ],
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
  readonly class = input('');

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
  styles: [
    `
      :host {
        display: inline-block;
        /* A static class attribute also stays on the host: paint it once, on the inner element */
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        box-shadow: none;
        opacity: 1;
        filter: none;
        transform: none;
        translate: none;
        rotate: none;
        scale: none;
        /* Don't clip the inner element's shadow/ring; it clips its own content */
        overflow: visible;
      }
    `,
  ],
})
export class TwSquareComponent {
  private readonly twClass = inject(TwClassService);

  /** Size of the square (e.g., '64px', '4rem') */
  readonly size = input('48px');

  /** Whether to center the content */
  readonly centerContent = input(true, { transform: booleanAttribute });

  /** Additional CSS classes */
  readonly class = input('');

  protected readonly squareClasses = computed(() => {
    return this.twClass.merge(
      this.centerContent() ? 'flex items-center justify-center' : '',
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
  styles: [
    `
      :host {
        display: inline-block;
        /* A static class attribute also stays on the host: paint it once, on the inner element */
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        box-shadow: none;
        opacity: 1;
        filter: none;
        transform: none;
        translate: none;
        rotate: none;
        scale: none;
        /* Don't clip the inner element's shadow/ring; it clips its own content */
        overflow: visible;
      }
    `,
  ],
})
export class TwCircleComponent {
  private readonly twClass = inject(TwClassService);

  /** Size of the circle (e.g., '64px', '4rem') */
  readonly size = input('48px');

  /** Whether to center the content */
  readonly centerContent = input(true, { transform: booleanAttribute });

  /** Additional CSS classes */
  readonly class = input('');

  protected readonly circleClasses = computed(() => {
    return this.twClass.merge(
      'rounded-full',
      this.centerContent() ? 'flex items-center justify-center' : '',
      this.class()
    );
  });
}

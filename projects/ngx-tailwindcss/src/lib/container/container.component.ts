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

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'prose';

/**
 * Container size classes.
 * Tailwind v4 removed `max-w-screen-*`; the breakpoint values are exposed as
 * CSS variables instead (`--breakpoint-*`), referenced via arbitrary values.
 */
const CONTAINER_SIZES: Record<ContainerSize, string> = {
  sm: 'max-w-(--breakpoint-sm)',
  md: 'max-w-(--breakpoint-md)',
  lg: 'max-w-(--breakpoint-lg)',
  xl: 'max-w-(--breakpoint-xl)',
  '2xl': 'max-w-(--breakpoint-2xl)',
  full: 'max-w-full',
  prose: 'max-w-prose',
};

const CONTAINER_PADDING: Record<string, string> = {
  none: '',
  sm: 'px-2 sm:px-4',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-6 sm:px-8 lg:px-12',
};

/**
 * Container component for creating centered, max-width layouts.
 *
 * @example
 * ```html
 * <tw-container size="lg" [centered]="true">
 *   <h1>Page Content</h1>
 * </tw-container>
 * ```
 */
@Component({
  selector: 'tw-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './container.component.html',
  host: {
    // The host is the styled box itself: a static `class` attribute lands here once
    '[class]': 'containerClasses()',
  },
})
export class TwContainerComponent {
  private readonly twClass = inject(TwClassService);

  /** Maximum width of the container */
  readonly size = input<ContainerSize>('xl');

  /** Whether to center the container horizontally */
  readonly centered = input(true, { transform: booleanAttribute });

  /** Horizontal padding */
  readonly padding = input<'none' | 'sm' | 'md' | 'lg'>('md');

  /**
   * Additional CSS classes. Signal input so a bound `[class]` survives Angular's
   * special class-binding handling and re-renders the host classes on change.
   */
  readonly class = input('', { transform: twClassValue });

  protected readonly containerClasses = computed(() => {
    return this.twClass.merge(
      'block w-full',
      CONTAINER_SIZES[this.size()],
      this.centered() ? 'mx-auto' : '',
      CONTAINER_PADDING[this.padding()],
      this.class()
    );
  });
}

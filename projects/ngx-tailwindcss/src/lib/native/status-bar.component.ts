import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBarItem } from './native.types';

/**
 * Application status bar component
 * Displays status information at the bottom of the window
 *
 * @example
 * ```html
 * <tw-status-bar [items]="statusItems" (itemClick)="onStatusClick($event)"></tw-status-bar>
 * ```
 */
@Component({
  selector: 'tw-status-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-status-bar block',
  },
})
export class TwStatusBarComponent {
  // Inputs
  public readonly items = input<StatusBarItem[]>([]);
  /**
   * Visual style: `default` is the accent-coloured (blue) bar; `minimal` is a
   * neutral gray bar with a top border that blends into the surrounding chrome.
   */
  public readonly variant = input<'default' | 'minimal'>('default');

  // Outputs
  public readonly itemClick = output<StatusBarItem>();

  protected readonly containerClasses = computed(() => {
    const base = 'flex items-center justify-between h-6 px-2 text-xs select-none';
    return this.variant() === 'minimal'
      ? `${base} bg-gray-100 text-gray-700 border-t border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700`
      : `${base} bg-blue-600 text-white`;
  });

  protected readonly buttonHoverClass = computed(() =>
    this.variant() === 'minimal' ? 'hover:bg-gray-200 dark:hover:bg-gray-700' : 'hover:bg-white/20'
  );

  // Computed - sort items by position and priority
  protected readonly leftItems = computed(() =>
    this.items()
      .filter(i => i.position === 'left')
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  );

  protected readonly centerItems = computed(() =>
    this.items()
      .filter(i => i.position === 'center')
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  );

  protected readonly rightItems = computed(() =>
    this.items()
      .filter(i => i.position === 'right')
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  );

  protected onItemClick(item: StatusBarItem): void {
    if (item.action) {
      item.action();
    }
    this.itemClick.emit(item);
  }
}

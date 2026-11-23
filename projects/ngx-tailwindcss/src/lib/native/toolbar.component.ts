import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarItem, ToolbarPosition, ToolbarVariant } from './native.types';

/**
 * Toolbar / Action bar component
 * Displays action buttons with icons and tooltips
 *
 * @example
 * ```html
 * <tw-toolbar [items]="toolbarItems" (itemClick)="onToolbarAction($event)"></tw-toolbar>
 * ```
 */
@Component({
  selector: 'tw-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-toolbar block',
  },
})
export class TwToolbarComponent {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  // Inputs
  public readonly items = input<ToolbarItem[]>([]);
  public readonly variant = input<ToolbarVariant>('default');
  public readonly position = input<ToolbarPosition>('top');
  public readonly showLabels = input(false);

  // Outputs
  public readonly itemClick = output<ToolbarItem>();

  // State
  protected readonly openDropdownId = signal<string | null>(null);

  /** Close an open dropdown when clicking anywhere outside the toolbar. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.openDropdownId() !== null &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.openDropdownId.set(null);
    }
  }

  /** Escape closes an open dropdown, returning focus to its trigger if it was inside. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.openDropdownId() === null) return;
    const host = this.elementRef.nativeElement;
    const dropdown = host.querySelector('[data-toolbar-dropdown]');
    const hadFocus = dropdown?.contains(host.ownerDocument.activeElement) ?? false;
    this.openDropdownId.set(null);
    if (hadFocus) {
      host.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
    }
  }

  // Computed classes
  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const position = this.position();

    const base = 'flex items-center gap-1 p-1';

    const variantClasses: Record<ToolbarVariant, string> = {
      default: 'bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
      compact: 'bg-gray-50 dark:bg-gray-900',
      large: 'bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2',
    };

    const positionClasses: Record<ToolbarPosition, string> = {
      top: 'border-b',
      bottom: 'border-t',
      left: 'flex-col border-r',
      right: 'flex-col border-l',
    };

    return `${base} ${variantClasses[variant]} ${positionClasses[position]}`;
  });

  protected readonly separatorClasses = computed(() => {
    const position = this.position();

    if (position === 'left' || position === 'right') {
      return 'w-full h-px my-1 bg-gray-300 dark:bg-gray-600';
    }
    return 'w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600';
  });

  protected getButtonClasses(item: ToolbarItem): string {
    const variant = this.variant();
    const base = 'flex items-center gap-1.5 rounded transition-colors';

    const sizeClasses: Record<ToolbarVariant, string> = {
      default: 'p-1.5',
      compact: 'p-1',
      large: 'p-2',
    };

    // An active toggle gets its blue text from the template bindings; a static
    // grey text class here would win the cascade and hide the active state
    const textClasses =
      item.type === 'toggle' && item.active ? '' : ' text-gray-700 dark:text-gray-300';
    const stateClasses = item.disabled
      ? 'opacity-50 cursor-not-allowed'
      : `hover:bg-gray-200 dark:hover:bg-gray-700${textClasses}`;

    return `${base} ${sizeClasses[variant]} ${stateClasses}`;
  }

  protected toggleDropdown(item: ToolbarItem): void {
    this.openDropdownId.set(this.openDropdownId() === item.id ? null : item.id);
  }

  protected onItemClick(item: ToolbarItem): void {
    if (item.disabled) return;

    if (item.action) {
      item.action();
    }

    this.itemClick.emit(item);
    this.openDropdownId.set(null);
  }
}

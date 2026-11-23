import { Component, computed, Input, signal, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

/**
 * Icon rendered before a breadcrumb label:
 * - `TemplateRef`: rendered as-is (recommended for inline SVG icons)
 * - `SafeHtml`: trusted markup the consumer produced with
 *   `DomSanitizer.bypassSecurityTrustHtml` (e.g. an inline SVG string)
 * - `string`: plain HTML that goes through Angular's HTML sanitizer, which
 *   strips `<svg>` and other unsafe markup
 */
export type BreadcrumbIcon = string | SafeHtml | TemplateRef<unknown>;

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Optional icon rendered before the label. See {@link BreadcrumbIcon}. */
  icon?: BreadcrumbIcon;
}

export type BreadcrumbSeparator = 'slash' | 'chevron' | 'arrow' | 'dot';

@Component({
  selector: 'tw-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.component.html',
})
export class TwBreadcrumbComponent {
  @Input() set items(value: BreadcrumbItem[]) {
    this._items.set(value);
  }
  @Input() set separator(value: BreadcrumbSeparator) {
    this._separator.set(value);
  }
  @Input() set size(value: 'sm' | 'md' | 'lg') {
    this._size.set(value);
  }

  protected _items = signal<BreadcrumbItem[]>([]);
  protected _separator = signal<BreadcrumbSeparator>('chevron');
  protected _size = signal<'sm' | 'md' | 'lg'>('md');

  protected itemsValue = computed(() => this._items());
  protected separatorValue = computed(() => this._separator());

  protected navClasses = computed(() => {
    const size = this._size();

    const sizeClasses: Record<string, string> = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return sizeClasses[size];
  });

  protected separatorClasses = computed(
    () => 'mx-2 text-slate-400 dark:text-slate-500 flex items-center'
  );

  protected linkClasses = computed(
    () =>
      'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors'
  );

  protected iconTemplate(icon: BreadcrumbIcon): TemplateRef<unknown> | null {
    return icon instanceof TemplateRef ? icon : null;
  }

  protected currentClasses = computed(() => 'font-medium text-slate-900 dark:text-slate-100');
}

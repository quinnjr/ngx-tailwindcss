import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import {
  pushEscapeLayer,
  removeEscapeLayer,
  shouldHandleEscape,
} from '../overlay/escape-layer-stack';

export interface MenuItem {
  id?: string | number;
  label?: string;
  icon?: TemplateRef<any>;
  command?: (event: { item: MenuItem }) => void;
  url?: string;
  /**
   * @deprecated The library does not depend on `@angular/router`; this value is
   * rendered as a plain `href` (array segments joined with `/`). Prefer `url`.
   */
  routerLink?: string | any[];
  disabled?: boolean;
  visible?: boolean;
  separator?: boolean;
  items?: MenuItem[];
  shortcut?: string;
  badge?: string;
  styleClass?: string;
}

export type MenuVariant = 'default' | 'bordered' | 'elevated';

const MENU_POPUP_CLASSES =
  'rounded-lg shadow-lg dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700';

/**
 * Menu component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-menu [items]="menuItems" (onSelect)="handleSelect($event)"></tw-menu>
 * ```
 */
@Component({
  selector: 'tw-menu',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu.component.html',
})
export class TwMenuComponent {
  private readonly twClass = inject(TwClassService);
  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Menu items */
  readonly items = input<MenuItem[]>([]);

  /** Visual variant */
  readonly variant = input<MenuVariant>('default');

  /** Whether menu is popup style */
  readonly popup = input(false, { transform: booleanAttribute });

  /** Additional classes */
  readonly classOverride = input('');

  /** Item select event */
  readonly onSelect = output<MenuItem>();

  protected openSubmenu = signal<MenuItem | null>(null);

  protected containerClasses = computed(() => {
    const variantClasses = {
      default: 'bg-white dark:bg-slate-800',
      bordered:
        'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg',
      elevated:
        'bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700',
    };

    return this.twClass.merge(
      'py-1 min-w-48',
      variantClasses[this.variant()],
      this.popup() ? MENU_POPUP_CLASSES : '',
      this.classOverride()
    );
  });

  protected itemClasses(item: MenuItem) {
    return this.twClass.merge(
      // `group` lets the shortcut keep 4.5:1 on the dark hover/focus background (slate-700)
      'group w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
      'focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
      item.disabled
        ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer',
      item.styleClass || ''
    );
  }

  protected separatorClasses() {
    return 'my-1 border-t border-slate-200 dark:border-slate-700';
  }

  protected submenuClasses() {
    return this.twClass.merge(
      'absolute left-full top-0 ml-1 py-1 min-w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700',
      'animate-in fade-in-0 zoom-in-95 duration-100'
    );
  }

  protected badgeClasses() {
    return 'ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
  }

  /** Href for link items: `url` wins; `routerLink` renders as a plain href fallback */
  protected itemHref(item: MenuItem): string | null {
    if (item.url) return item.url;
    if (item.routerLink) {
      return Array.isArray(item.routerLink) ? item.routerLink.join('/') : item.routerLink;
    }
    return null;
  }

  onSubmenuEnter(item: MenuItem): void {
    // The hover wrapper still receives mouseenter when its trigger button is disabled
    if (item.disabled) return;
    this.openSubmenu.set(item);
  }

  onSubmenuLeave(): void {
    this.openSubmenu.set(null);
  }

  /**
   * ArrowRight / Enter / Space on a submenu trigger: open the submenu and move
   * focus to its first enabled item (WAI-ARIA menu pattern).
   */
  protected openSubmenuFromKeyboard(item: MenuItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (item.disabled) return;
    const trigger = event.currentTarget as HTMLElement;
    this.openSubmenu.set(item);
    afterNextRender(
      () => {
        const submenu = trigger.parentElement?.querySelector<HTMLElement>(':scope > [role="menu"]');
        if (submenu) this.menuItemsOf(submenu)[0]?.focus();
      },
      { injector: this.injector }
    );
  }

  /** ArrowLeft / Escape inside a submenu: close it and return focus to its trigger */
  protected closeSubmenuToTrigger(trigger: HTMLElement, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.onSubmenuLeave();
    trigger.focus();
  }

  /** Enabled items that belong directly to `menu` (not to a nested submenu) */
  private menuItemsOf(menu: HTMLElement): HTMLElement[] {
    return [
      ...menu.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      ),
    ].filter(el => el.parentElement?.closest('[role="menu"]') === menu);
  }

  onItemClick(item: MenuItem): void {
    if (item.disabled) return;

    if (item.command) {
      item.command({ item });
    }

    this.onSelect.emit(item);
  }

  protected onLinkClick(item: MenuItem, event: Event): void {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    this.onItemClick(item);
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const { key } = event;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;

    // Navigate within the (sub)menu the key was pressed in, not across all levels
    const host = this.elementRef.nativeElement as HTMLElement;
    const menu =
      (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="menu"]') ??
      host.querySelector<HTMLElement>('[role="menu"]');
    if (!menu || !host.contains(menu)) return;
    const menuItems = this.menuItemsOf(menu);
    if (menuItems.length === 0) return;

    event.preventDefault();
    const activeIndex = menuItems.indexOf(this.document.activeElement as HTMLElement);
    let nextIndex: number;

    switch (key) {
      case 'ArrowDown': {
        nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % menuItems.length;
        break;
      }
      case 'ArrowUp': {
        nextIndex =
          activeIndex < 0
            ? menuItems.length - 1
            : (activeIndex - 1 + menuItems.length) % menuItems.length;
        break;
      }
      case 'Home': {
        nextIndex = 0;
        break;
      }
      default: {
        // End
        nextIndex = menuItems.length - 1;
        break;
      }
    }

    menuItems[nextIndex].focus();
  }
}

/**
 * Context menu component
 */
@Component({
  selector: 'tw-context-menu',
  standalone: true,
  imports: [CommonModule, TwMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './context-menu.component.html',
  host: {
    '(document:click)': 'onDocumentDismiss($event)',
    '(document:contextmenu)': 'onDocumentDismiss($event)',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class TwContextMenuComponent implements OnDestroy {
  readonly items = input<MenuItem[]>([]);
  readonly onSelect = output<MenuItem>();
  readonly onHide = output();

  protected visible = signal(false);
  protected x = signal(0);
  protected y = signal(0);

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** The (contextmenu or click) event that opened the menu; it still bubbles to the document. */
  private openingEvent: Event | null = null;

  /** Element focused before the menu opened, refocused when the menu closes with focus inside */
  private returnFocusTo: HTMLElement | null = null;

  show(event: MouseEvent): void {
    event.preventDefault();
    this.openingEvent = event;
    if (!this.visible()) {
      const active = this.document.activeElement;
      this.returnFocusTo =
        active instanceof HTMLElement && active !== this.document.body ? active : null;
    }
    this.x.set(event.clientX);
    this.y.set(event.clientY);
    this.visible.set(true);
    // Join the shared Escape stack so Escape closes only this menu, not an enclosing modal
    pushEscapeLayer(this);
    // Move focus into the menu (WAI-ARIA menu pattern) so a keyboard-opened menu
    // (Shift+F10 / Menu key) can be navigated with the arrow keys
    afterNextRender(
      () => {
        this.elementRef.nativeElement
          .querySelector<HTMLElement>(
            '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
          )
          ?.focus();
      },
      { injector: this.injector }
    );
  }

  protected onEscape(event: Event): void {
    if (!this.visible() || !shouldHandleEscape(this, event)) return;
    event.preventDefault();
    this.hide();
  }

  ngOnDestroy(): void {
    removeEscapeLayer(this);
  }

  protected onDocumentDismiss(event: Event): void {
    // Ignore the same event that just opened the menu, otherwise it closes immediately
    if (event === this.openingEvent) {
      this.openingEvent = null;
      return;
    }
    this.hide();
  }

  hide(): void {
    removeEscapeLayer(this);
    if (this.visible()) {
      // Focus inside the menu would be lost when it is removed: return it to the opener
      const focusInside = this.elementRef.nativeElement.contains(this.document.activeElement);
      this.visible.set(false);
      this.onHide.emit();
      if (focusInside) this.returnFocusTo?.focus();
    }
    this.returnFocusTo = null;
  }

  onItemSelect(item: MenuItem): void {
    this.onSelect.emit(item);
    this.hide();
  }
}

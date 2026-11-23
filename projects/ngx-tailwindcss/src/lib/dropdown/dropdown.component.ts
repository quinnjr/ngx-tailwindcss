import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  effect,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  OnDestroy,
  Output,
  PLATFORM_ID,
  Renderer2,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import {
  pushEscapeLayer,
  removeEscapeLayer,
  shouldHandleEscape,
} from '../overlay/escape-layer-stack';
import { handlePortalTab } from '../overlay/portal-tab';

export type DropdownPosition =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'left' | 'right';

/**
 * Dropdown item directive
 */
@Directive({
  selector: '[twDropdownItem]',
  standalone: true,
  host: {
    class:
      'block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 focus:text-slate-900 dark:focus:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer',
    role: 'menuitem',
    '[attr.tabindex]': 'disabled ? -1 : 0',
    '[attr.aria-disabled]': 'disabled || null',
    // The `disabled` input shadows the native property, so reflect it explicitly:
    // a disabled <button> item must not fire its click handler (or close the menu)
    '[attr.disabled]': 'disabled ? "" : null',
    // Non-button items (e.g. links) cannot match `:disabled`
    '[class.opacity-50]': 'disabled',
    '[class.pointer-events-none]': 'disabled',
  },
})
export class TwDropdownItemDirective {
  @Input({ transform: booleanAttribute }) disabled = false;
}

/**
 * Dropdown divider
 */
@Component({
  selector: 'tw-dropdown-divider',
  standalone: true,
  host: {
    class: 'block my-1 border-t border-slate-200 dark:border-slate-700',
    role: 'separator',
  },
  templateUrl: './dropdown-divider.component.html',
})
export class TwDropdownDividerComponent {}

/**
 * Dropdown header/label
 */
@Component({
  selector: 'tw-dropdown-header',
  standalone: true,
  host: {
    class:
      'block px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider',
  },
  templateUrl: './dropdown-header.component.html',
})
export class TwDropdownHeaderComponent {}

/**
 * Dropdown menu component
 *
 * @example
 * ```html
 * <tw-dropdown>
 *   <button twDropdownTrigger>Open Menu</button>
 *   <tw-dropdown-menu>
 *     <tw-dropdown-header>Actions</tw-dropdown-header>
 *     <button twDropdownItem (click)="edit()">Edit</button>
 *     <button twDropdownItem (click)="duplicate()">Duplicate</button>
 *     <tw-dropdown-divider></tw-dropdown-divider>
 *     <button twDropdownItem (click)="delete()" class="text-rose-600 hover:text-rose-700 hover:bg-rose-50">Delete</button>
 *   </tw-dropdown-menu>
 * </tw-dropdown>
 * ```
 */
@Component({
  selector: 'tw-dropdown',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dropdown.component.html',
  host: {
    class: 'inline-block text-left',
  },
})
export class TwDropdownComponent implements OnDestroy {
  private readonly twClass = inject(TwClassService);
  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('triggerContainer') triggerContainer!: ElementRef<HTMLElement>;

  /** Position of the dropdown menu */
  @Input() position: DropdownPosition = 'bottom-start';

  /** Width of the dropdown menu */
  @Input() width: 'auto' | 'trigger' | string = 'auto';

  /** Maximum height of the dropdown menu */
  @Input() maxHeight = '300px';

  /** Whether the dropdown is disabled */
  @Input({ transform: booleanAttribute }) disabled = false;

  /** Close on item click */
  @Input({ transform: booleanAttribute }) closeOnSelect = true;

  /** Additional menu classes */
  @Input() menuClass = '';

  /** Event emitted when the dropdown opens */
  @Output() opened = new EventEmitter<void>();

  /** Event emitted when the dropdown closes */
  @Output() closed = new EventEmitter<void>();

  protected isOpen = signal(false);

  private readonly triggerDirective = contentChild<TwDropdownTriggerDirective>(
    forwardRef(() => TwDropdownTriggerDirective)
  );

  // Portal elements
  private portalHost: HTMLElement | null = null;
  private portalElement: HTMLElement | null = null;
  private menuContentElement: HTMLElement | null = null;
  /** Original (hidden) parent of the menu content, restored on close */
  private menuContentParent: HTMLElement | null = null;
  private clickOutsideListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private keydownListener: (() => void) | null = null;
  private escapeListener: ((event: KeyboardEvent) => void) | null = null;
  private menuClickListener: (() => void) | null = null;
  private portalTabListener: (() => void) | null = null;

  /** A method, not a computed: `width`/`menuClass` are plain @Inputs a computed can't track */
  protected menuClasses(): string {
    const widthClass = this.width === 'auto' ? 'min-w-[10rem]' : '';

    return this.twClass.merge(
      'rounded-lg bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5 dark:ring-slate-700 overflow-auto py-1',
      widthClass,
      this.menuClass
    );
  }

  constructor() {
    // Create portal when open state changes
    effect(() => {
      if (this.isOpen()) {
        this.createPortal();
      } else {
        this.destroyPortal();
      }
    });

    // Reflect open state on the trigger's aria-expanded
    effect(() => {
      this.triggerDirective()?.expanded.set(this.isOpen());
    });
  }

  ngOnDestroy(): void {
    this.destroyPortal();
  }

  toggle(): void {
    if (this.disabled) return;

    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.disabled) return;
    this.isOpen.set(true);
    this.opened.emit();
  }

  close(): void {
    // Nothing to close (e.g. the deferred close after an item click already ran)
    if (!this.isOpen()) return;

    // Restore trigger focus only when focus currently sits inside the menu,
    // so outside clicks don't have their focus stolen
    const shouldRestoreFocus = !!this.portalElement?.contains(this.document.activeElement);

    // Leave the Escape stack right away (the portal itself is torn down by the effect)
    removeEscapeLayer(this);
    this.isOpen.set(false);
    this.closed.emit();

    if (shouldRestoreFocus) {
      this.getTriggerElement()?.focus();
    }
  }

  private getTriggerElement(): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector('[twdropdowntrigger]') as HTMLElement | null;
  }

  private getMenuItems(): HTMLElement[] {
    if (!this.portalElement) return [];
    const items = this.portalElement.querySelectorAll<HTMLElement>(
      '[twdropdownitem]:not([disabled]):not([aria-disabled="true"])'
    );
    return [...items];
  }

  /** Arrow/Home/End navigation applies only while focus is on the trigger or in the menu. */
  private isFocusWithinDropdown(): boolean {
    const active = this.document.activeElement;
    if (!active || active === this.document.body) return true;
    return !!this.portalElement?.contains(active) || this.elementRef.nativeElement.contains(active);
  }

  private moveItemFocus(key: string): void {
    const items = this.getMenuItems();
    if (items.length === 0) return;

    const activeIndex = items.indexOf(this.document.activeElement as HTMLElement);
    let nextIndex: number;

    switch (key) {
      case 'ArrowDown': {
        nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
        break;
      }
      case 'ArrowUp': {
        nextIndex =
          activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
        break;
      }
      case 'Home': {
        nextIndex = 0;
        break;
      }
      default: {
        // End
        nextIndex = items.length - 1;
        break;
      }
    }

    items[nextIndex].focus();
  }

  private createPortal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // close() + open() within one tick leaves the effect seeing only `true`: rebuild the
    // existing portal (restoring its content and listeners) instead of stacking a second one
    if (this.portalHost) this.destroyPortal();

    // Create portal host at body level
    this.portalHost = this.renderer.createElement('div');
    this.renderer.setStyle(this.portalHost, 'position', 'fixed');
    this.renderer.setStyle(this.portalHost, 'z-index', '9999');
    this.renderer.setStyle(this.portalHost, 'top', '0');
    this.renderer.setStyle(this.portalHost, 'left', '0');
    this.renderer.setStyle(this.portalHost, 'pointer-events', 'none');
    this.renderer.appendChild(this.document.body, this.portalHost);

    // Create the dropdown element
    this.portalElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.portalElement, 'position', 'absolute');
    this.renderer.setStyle(this.portalElement, 'pointer-events', 'auto');
    this.renderer.setStyle(this.portalElement, 'max-height', this.maxHeight);

    // Apply classes
    const classes = this.menuClasses().split(' ');
    classes.forEach(cls => {
      if (cls) this.renderer.addClass(this.portalElement, cls);
    });

    // Add animation classes
    this.renderer.setStyle(this.portalElement, 'opacity', '0');
    this.renderer.setStyle(this.portalElement, 'transform', 'scale(0.95)');
    this.renderer.setStyle(
      this.portalElement,
      'transition',
      'opacity 100ms ease-out, transform 100ms ease-out'
    );

    // Set ARIA attributes
    this.renderer.setAttribute(this.portalElement, 'role', 'menu');
    this.renderer.setAttribute(this.portalElement, 'aria-orientation', 'vertical');

    this.renderer.appendChild(this.portalHost, this.portalElement);

    // Move menu content to portal (not clone, to preserve Angular bindings)
    this.menuContentElement = this.elementRef.nativeElement.querySelector('tw-dropdown-menu');
    if (this.menuContentElement) {
      this.menuContentParent = this.menuContentElement.parentElement;
      this.renderer.appendChild(this.portalElement, this.menuContentElement);
    }

    // Position the dropdown
    this.updatePosition();

    // Animate in and focus the first menu item
    requestAnimationFrame(() => {
      if (this.portalElement) {
        this.renderer.setStyle(this.portalElement, 'opacity', '1');
        this.renderer.setStyle(this.portalElement, 'transform', 'scale(1)');
        this.getMenuItems()[0]?.focus();
      }
    });

    // Add event listeners
    this.clickOutsideListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = this.elementRef.nativeElement.contains(target);
      const isInsidePortal = this.portalElement?.contains(target);

      if (!isInsideTrigger && !isInsidePortal) {
        this.close();
      }
    });

    // Capture phase: also follow the trigger when an enclosing container (e.g. a
    // scrollable modal) scrolls, not only the window
    const onScroll = (): void => {
      this.updatePosition();
    };
    this.document.addEventListener('scroll', onScroll, true);
    this.scrollListener = () => {
      this.document.removeEventListener('scroll', onScroll, true);
    };

    // Tab out of the portaled panel continues from the trigger (and is kept away from
    // an enclosing modal's focus trap while inside)
    const panel = this.portalElement;
    if (panel) {
      this.portalTabListener = this.renderer.listen(panel, 'keydown', (event: KeyboardEvent) => {
        handlePortalTab(panel, event, () => {
          this.close();
        });
      });
    }

    this.resizeListener = this.renderer.listen('window', 'resize', () => {
      this.updatePosition();
    });

    // Escape closes only the topmost layer (via the shared layer stack) and is left to
    // handlers inside the menu that already claimed it; marking it handled keeps an
    // enclosing modal/sidebar open without suppressing other listeners
    pushEscapeLayer(this);
    this.escapeListener = (event: KeyboardEvent) => {
      if (shouldHandleEscape(this, event)) {
        event.preventDefault();
        this.close();
      }
    };
    this.document.addEventListener('keydown', this.escapeListener);

    this.keydownListener = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (
        ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
        this.isFocusWithinDropdown()
      ) {
        event.preventDefault();
        this.moveItemFocus(event.key);
      }
    });

    // Handle clicks on dropdown items
    if (this.closeOnSelect && this.portalElement) {
      const portal = this.portalElement;
      // Capture phase: runs before the item's own click handlers
      const onMenuClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        if (target.hasAttribute('twdropdownitem') || target.closest('[twdropdownitem]')) {
          // Hand focus back to the trigger before the item's handler runs: a dialog it
          // opens records the focused element to restore on close, and the item is
          // about to be hidden (the handler can still move focus elsewhere)
          if (portal.contains(this.document.activeElement)) {
            this.getTriggerElement()?.focus();
          }
          // Close after the item's Angular click handler has fired
          setTimeout(() => {
            this.close();
          }, 0);
        }
      };
      portal.addEventListener('click', onMenuClick, true);
      this.menuClickListener = () => {
        portal.removeEventListener('click', onMenuClick, true);
      };
    }
  }

  private destroyPortal(): void {
    // Move menu content back to its original (hidden) container before destroying
    // the portal; appending to the host would leave the menu items visible inline
    if (this.menuContentElement) {
      this.renderer.appendChild(
        this.menuContentParent ?? this.elementRef.nativeElement,
        this.menuContentElement
      );
    }
    this.menuContentElement = null;
    this.menuContentParent = null;

    if (this.portalHost && this.document.body.contains(this.portalHost)) {
      this.renderer.removeChild(this.document.body, this.portalHost);
    }
    this.portalHost = null;
    this.portalElement = null;

    if (this.clickOutsideListener) {
      this.clickOutsideListener();
      this.clickOutsideListener = null;
    }
    if (this.scrollListener) {
      this.scrollListener();
      this.scrollListener = null;
    }
    if (this.resizeListener) {
      this.resizeListener();
      this.resizeListener = null;
    }
    if (this.keydownListener) {
      this.keydownListener();
      this.keydownListener = null;
    }
    if (this.escapeListener) {
      this.document.removeEventListener('keydown', this.escapeListener);
      this.escapeListener = null;
    }
    removeEscapeLayer(this);
    if (this.menuClickListener) {
      this.menuClickListener();
      this.menuClickListener = null;
    }
    if (this.portalTabListener) {
      this.portalTabListener();
      this.portalTabListener = null;
    }
  }

  private updatePosition(): void {
    if (!this.portalElement || !isPlatformBrowser(this.platformId)) return;

    const triggerEl = this.triggerContainer?.nativeElement || this.elementRef.nativeElement;
    const rect = triggerEl.getBoundingClientRect();
    const portalRect = this.portalElement.getBoundingClientRect();

    let top = 0;
    let left = 0;

    // Set width if trigger width
    if (this.width === 'trigger') {
      this.renderer.setStyle(this.portalElement, 'width', `${rect.width}px`);
    } else if (this.width !== 'auto') {
      this.renderer.setStyle(this.portalElement, 'width', this.width);
    }

    const gap = 4; // margin between trigger and dropdown

    switch (this.position) {
      case 'bottom-start': {
        top = rect.bottom + gap;
        left = rect.left;
        break;
      }
      case 'bottom-end': {
        top = rect.bottom + gap;
        left = rect.right - portalRect.width;
        break;
      }
      case 'top-start': {
        top = rect.top - portalRect.height - gap;
        left = rect.left;
        break;
      }
      case 'top-end': {
        top = rect.top - portalRect.height - gap;
        left = rect.right - portalRect.width;
        break;
      }
      case 'left': {
        top = rect.top;
        left = rect.left - portalRect.width - gap;
        break;
      }
      case 'right': {
        top = rect.top;
        left = rect.right + gap;
        break;
      }
    }

    // Ensure dropdown stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 0) left = gap;
    if (left + portalRect.width > viewportWidth) {
      left = viewportWidth - portalRect.width - gap;
    }
    if (top < 0) top = gap;
    if (top + portalRect.height > viewportHeight) {
      top = viewportHeight - portalRect.height - gap;
    }

    this.renderer.setStyle(this.portalElement, 'top', `${top}px`);
    this.renderer.setStyle(this.portalElement, 'left', `${left}px`);
  }
}

/**
 * Dropdown menu container
 */
@Component({
  selector: 'tw-dropdown-menu',
  standalone: true,
  templateUrl: './dropdown-menu.component.html',
})
export class TwDropdownMenuComponent {}

/**
 * Trigger directive for dropdown
 */
@Directive({
  selector: '[twDropdownTrigger]',
  standalone: true,
  host: {
    '[attr.aria-haspopup]': '"menu"',
    '[attr.aria-expanded]': 'expanded()',
  },
})
export class TwDropdownTriggerDirective {
  readonly expanded = signal(false);
}

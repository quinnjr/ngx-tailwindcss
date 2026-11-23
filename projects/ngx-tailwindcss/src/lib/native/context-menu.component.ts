import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { claimNativeEscape, trackNativeEscapeLayer } from './native-escape-layer.util';
import { NativeAppPlatformService } from './platform.service';
import { NativeContextMenuEvent, NativeContextMenuPosition, NativeMenuItem } from './native.types';

/**
 * Context menu component (right-click menu)
 *
 * @example
 * ```html
 * <tw-context-menu [items]="menuItems" [trigger]="targetElement" (itemSelect)="onSelect($event)"></tw-context-menu>
 * ```
 */
@Component({
  selector: 'tw-native-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-native-context-menu',
  },
})
export class TwNativeContextMenuComponent implements OnDestroy {
  private readonly platformService = inject(NativeAppPlatformService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  // Inputs
  public readonly items = input<NativeMenuItem[]>([]);
  public readonly trigger = input<HTMLElement | null>(null);

  // Outputs
  public readonly itemSelect = output<NativeContextMenuEvent>();
  public readonly opened = output<NativeContextMenuPosition>();
  public readonly closed = output();

  // State
  protected readonly isOpen = signal(false);
  protected readonly position = signal<NativeContextMenuPosition>({ x: 0, y: 0 });
  protected readonly hoveredItemId = signal<string | null>(null);

  // View
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');

  private readonly contextMenuHandler = (e: Event) => {
    this.onContextMenu(e as MouseEvent);
  };
  /** The exact node the contextmenu listener is currently attached to */
  private listenerTarget: HTMLElement | Document | null = null;
  /** Element that had focus when the menu opened, restored on close */
  private previousFocus: HTMLElement | null = null;

  constructor() {
    // Inside a dialog, Escape closes the open menu first, not the dialog too
    trackNativeEscapeLayer(this, this.isOpen);

    // Attach to the trigger element (or document), re-binding whenever it changes
    effect(() => {
      const triggerEl = this.trigger();
      this.detachContextMenuListener();
      const target = triggerEl ?? this.document;
      target.addEventListener('contextmenu', this.contextMenuHandler);
      this.listenerTarget = target;
    });
  }

  public ngOnDestroy(): void {
    this.detachContextMenuListener();
  }

  private detachContextMenuListener(): void {
    if (this.listenerTarget) {
      this.listenerTarget.removeEventListener('contextmenu', this.contextMenuHandler);
      this.listenerTarget = null;
    }
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.isOpen() && claimNativeEscape(this, event)) this.close();
  }

  @HostListener('document:scroll')
  protected onScroll(): void {
    this.close();
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();

    this.open(event.clientX, event.clientY);
  }

  /** Enabled items that belong directly to `menu` (not to a nested submenu). */
  private getMenuItems(menu: Element | null | undefined): HTMLElement[] {
    if (!menu) return [];
    return [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')].filter(
      el => el.parentElement?.closest('[role="menu"]') === menu
    );
  }

  /** Focus the first enabled item of a menu once it has rendered. */
  private focusFirstItem(getMenu: () => Element | null | undefined): void {
    afterNextRender(
      () => {
        this.getMenuItems(getMenu())[0]?.focus();
      },
      { injector: this.injector }
    );
  }

  /** Keyboard navigation inside the open menu (WAI-ARIA menu pattern). */
  protected onMenuKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const menu = target.closest('[role="menu"]');
    const items = this.getMenuItems(menu);
    const current = items.indexOf(target);

    switch (event.key) {
      case 'ArrowDown': {
        items[(current + 1) % items.length]?.focus();
        break;
      }
      case 'ArrowUp': {
        items[(current - 1 + items.length) % items.length]?.focus();
        break;
      }
      case 'Home': {
        items[0]?.focus();
        break;
      }
      case 'End': {
        items.at(-1)?.focus();
        break;
      }
      case 'ArrowRight': {
        const item = this.items().find(i => i.id === target.dataset['menuItemId']);
        if (item?.type !== 'submenu' || !item.submenu?.length) return;
        const wrapper = target.parentElement;
        this.hoveredItemId.set(item.id);
        this.focusFirstItem(() => wrapper?.querySelector('[role="menu"]'));
        break;
      }
      case 'ArrowLeft': {
        if (!menu || menu === this.menuRef()?.nativeElement) return;
        const parentButton = menu.parentElement?.querySelector<HTMLElement>(
          ':scope > [role="menuitem"]'
        );
        this.hoveredItemId.set(null);
        parentButton?.focus();
        break;
      }
      case 'Tab': {
        // Let focus move on naturally, but don't leave the menu open behind it
        this.close();
        return;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** Adjust position after a tick (once the menu is rendered) so it stays within the viewport */
  private clampToViewport(x: number, y: number): void {
    setTimeout(() => {
      const menuEl = this.menuRef()?.nativeElement;
      if (menuEl) {
        const rect = menuEl.getBoundingClientRect();

        let clampedX = x;
        let clampedY = y;
        if (clampedX + rect.width > window.innerWidth) {
          clampedX = window.innerWidth - rect.width - 8;
        }
        if (clampedY + rect.height > window.innerHeight) {
          clampedY = window.innerHeight - rect.height - 8;
        }

        this.position.set({ x: Math.max(8, clampedX), y: Math.max(8, clampedY) });
      }
    }, 0);
  }

  protected selectItem(item: NativeMenuItem, event: MouseEvent): void {
    if (item.disabled) return;

    // Clicking a submenu parent opens its submenu rather than selecting it
    if (item.type === 'submenu' && item.submenu?.length) {
      event.stopPropagation();
      this.hoveredItemId.set(item.id);
      return;
    }

    // Handle checkbox toggle
    if (item.type === 'checkbox') {
      item.checked = !item.checked;
    }

    // Close (returning focus) before the action, so an action that moves
    // focus (e.g. opening a dialog) isn't overridden afterwards
    this.close();

    // Execute action
    if (item.action) {
      item.action();
    }

    this.itemSelect.emit({ item, originalEvent: event });
  }

  protected formatShortcut(shortcut: string): string {
    return this.platformService.formatShortcut(shortcut);
  }

  // Public methods
  public open(x: number, y: number): void {
    if (!this.isOpen()) {
      const active = this.document.activeElement;
      this.previousFocus = active instanceof HTMLElement ? active : null;
    }
    this.position.set({ x, y });
    this.isOpen.set(true);
    this.hoveredItemId.set(null);
    this.opened.emit({ x, y });
    this.clampToViewport(x, y);
    // Move focus into the menu so it can be operated from the keyboard
    this.focusFirstItem(() => this.menuRef()?.nativeElement);
  }

  public close(): void {
    if (this.isOpen()) {
      // Hand focus back only if it is still in the menu (an action may have moved it)
      const menuHadFocus =
        this.menuRef()?.nativeElement.contains(this.document.activeElement) ?? false;
      this.isOpen.set(false);
      this.hoveredItemId.set(null);
      this.closed.emit();
      if (menuHadFocus) {
        this.previousFocus?.focus();
      }
      this.previousFocus = null;
    }
  }
}

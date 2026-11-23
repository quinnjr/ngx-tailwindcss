import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NativeAppPlatformService } from './platform.service';
import { NativeMenuBarItem, NativeMenuItem } from './native.types';

/**
 * Application menu bar component
 * Provides a native-style menu bar with dropdown menus
 *
 * @example
 * ```html
 * <tw-menu-bar [items]="menuItems" (itemSelect)="onMenuSelect($event)"></tw-menu-bar>
 * ```
 */
@Component({
  selector: 'tw-menu-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-menu-bar block',
  },
})
export class TwMenuBarComponent {
  private readonly platformService = inject(NativeAppPlatformService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // Inputs
  public readonly items = input<NativeMenuBarItem[]>([]);

  // Outputs
  public readonly itemSelect = output<NativeMenuItem>();
  public readonly menuOpen = output<string>();
  public readonly menuClose = output();

  // State
  protected readonly openMenuId = signal<string | null>(null);
  protected readonly hoveredItemId = signal<string | null>(null);
  /** Index of the top-level item that holds the roving tabindex. */
  protected readonly focusedMenuIndex = signal(0);

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu();
  }

  /** Keyboard handling for a top-level menubar item (WAI-ARIA menubar pattern). */
  protected onTriggerKeydown(event: KeyboardEvent, index: number): void {
    const count = this.items().length;
    switch (event.key) {
      case 'ArrowRight': {
        this.moveToMenu((index + 1) % count, this.openMenuId() !== null);
        break;
      }
      case 'ArrowLeft': {
        this.moveToMenu((index - 1 + count) % count, this.openMenuId() !== null);
        break;
      }
      case 'Home': {
        this.moveToMenu(0, false);
        break;
      }
      case 'End': {
        this.moveToMenu(count - 1, false);
        break;
      }
      case 'ArrowDown':
      case 'Enter':
      case ' ': {
        this.openMenuAt(index, 'first');
        break;
      }
      case 'ArrowUp': {
        this.openMenuAt(index, 'last');
        break;
      }
      case 'Escape': {
        this.closeMenu();
        break;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** Keyboard handling inside an open dropdown menu. */
  protected onMenuKeydown(event: KeyboardEvent, index: number): void {
    const items = this.getMenuItemElements();
    const current = items.indexOf(event.target as HTMLElement);
    const count = this.items().length;

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
        this.moveToMenu((index + 1) % count, true);
        break;
      }
      case 'ArrowLeft': {
        this.moveToMenu((index - 1 + count) % count, true);
        break;
      }
      case 'Escape': {
        this.focusTrigger(index);
        break;
      }
      case 'Tab': {
        // Let focus move on naturally, but don't leave the menu open behind it
        this.closeMenu();
        return;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private moveToMenu(index: number, open: boolean): void {
    if (index < 0 || index >= this.items().length) return;
    if (open) {
      this.openMenuAt(index, 'first');
    } else {
      this.focusTrigger(index);
    }
  }

  private openMenuAt(index: number, focus: 'first' | 'last'): void {
    const menu = this.items()[index];
    if (!menu) return;
    this.focusedMenuIndex.set(index);
    if (this.openMenuId() !== menu.id) {
      this.openMenuId.set(menu.id);
      this.menuOpen.emit(menu.id);
    }
    afterNextRender(
      () => {
        const items = this.getMenuItemElements();
        const target = focus === 'first' ? items[0] : items.at(-1);
        // A menu with no enabled items keeps focus on its trigger
        (target ?? this.getTriggerElements()[index])?.focus();
      },
      { injector: this.injector }
    );
  }

  private focusTrigger(index: number): void {
    this.focusedMenuIndex.set(index);
    this.closeMenu();
    this.getTriggerElements()[index]?.focus();
  }

  private getTriggerElements(): HTMLElement[] {
    return [
      ...this.elementRef.nativeElement.querySelectorAll<HTMLElement>('[data-menubar-trigger]'),
    ];
  }

  private getMenuItemElements(): HTMLElement[] {
    return [
      ...this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
        '[role="menu"] [role^="menuitem"]:not([disabled])'
      ),
    ];
  }

  protected toggleMenu(menuId: string): void {
    const index = this.items().findIndex(menu => menu.id === menuId);
    if (index >= 0) this.focusedMenuIndex.set(index);
    if (this.openMenuId() === menuId) {
      this.closeMenu();
    } else {
      this.openMenuId.set(menuId);
      this.menuOpen.emit(menuId);
    }
  }

  protected onMenuHover(menuId: string): void {
    // Only switch menus on hover if a menu is already open
    if (this.openMenuId() !== null && this.openMenuId() !== menuId) {
      this.openMenuId.set(menuId);
      this.menuOpen.emit(menuId);
    }
  }

  protected closeMenu(): void {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
      this.menuClose.emit();
    }
  }

  protected selectItem(item: NativeMenuItem): void {
    if (item.disabled) return;

    // Return focus to the menubar before running the action, so an action
    // that moves focus (e.g. opening a dialog) isn't overridden afterwards
    const menuHadFocus =
      typeof document !== 'undefined' &&
      this.elementRef.nativeElement.contains(document.activeElement);
    this.closeMenu();
    if (menuHadFocus) {
      this.getTriggerElements()[this.focusedMenuIndex()]?.focus();
    }

    // Handle checkbox toggle
    if (item.type === 'checkbox') {
      item.checked = !item.checked;
    }

    // Execute action
    if (item.action) {
      item.action();
    }

    this.itemSelect.emit(item);
  }

  protected formatShortcut(shortcut: string): string {
    return this.platformService.formatShortcut(shortcut);
  }
}

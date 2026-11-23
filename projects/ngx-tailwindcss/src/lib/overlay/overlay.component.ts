import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { pushEscapeLayer, removeEscapeLayer, shouldHandleEscape } from './escape-layer-stack';
import { lockBodyScroll, unlockBodyScroll } from './scroll-lock';

export type OverlayBlur = 'none' | 'sm' | 'md' | 'lg';
export type OverlayOpacity = 'light' | 'medium' | 'dark' | 'solid';

const BLUR_CLASSES: Record<OverlayBlur, string> = {
  none: '',
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
};

const OPACITY_CLASSES: Record<OverlayOpacity, string> = {
  light: 'bg-black/25',
  medium: 'bg-black/50',
  dark: 'bg-black/75',
  solid: 'bg-black',
};

/**
 * Overlay component for creating backdrop overlays.
 * Useful as backgrounds for modals, drawers, and lightboxes.
 *
 * @example
 * ```html
 * <!-- Simple overlay -->
 * <tw-overlay [visible]="isOpen" (close)="isOpen = false">
 *   <div class="bg-white p-6 rounded-lg">
 *     Modal content here
 *   </div>
 * </tw-overlay>
 *
 * <!-- Overlay with blur effect -->
 * <tw-overlay [visible]="showDrawer" blur="md" opacity="light" (close)="closeDrawer()">
 *   <aside class="fixed right-0 top-0 h-full w-80 bg-white">
 *     Drawer content
 *   </aside>
 * </tw-overlay>
 * ```
 */
@Component({
  selector: 'tw-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overlay.component.html',
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class TwOverlayComponent implements OnDestroy {
  private readonly twClass = inject(TwClassService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  /** Whether the overlay is visible */
  readonly visible = input(false);

  /** Whether clicking the overlay closes it */
  readonly closeOnClick = input(true);

  /** Whether pressing Escape closes the overlay */
  readonly closeOnEscape = input(true);

  /** Blur intensity */
  readonly blur = input<OverlayBlur>('none');

  /** Opacity level */
  readonly opacity = input<OverlayOpacity>('medium');

  /** Whether to center content */
  readonly centered = input(true);

  /** Whether to lock body scroll when visible */
  readonly lockScroll = input(true);

  /** Whether to animate transitions */
  readonly animate = input(true);

  /** Z-index of the overlay */
  readonly zIndex = input(50);

  /** Additional CSS classes */
  readonly class = input('');

  /** Emits when overlay should close */
  readonly close = output();

  constructor() {
    // Visible overlays join the shared layer stack; only the topmost reacts to Escape
    effect(() => {
      if (this.visible()) {
        pushEscapeLayer(this);
      } else {
        removeEscapeLayer(this);
      }
    });

    // Lock/unlock body scroll while visible when lockScroll is enabled
    effect(() => {
      const shouldLock = this.visible() && this.lockScroll();

      if (!isPlatformBrowser(this.platformId)) return;

      // Shared with other modal layers: the page unlocks once the last of them closes
      if (shouldLock) {
        lockBodyScroll(this.document, this);
      } else {
        unlockBodyScroll(this.document, this);
      }
    });
  }

  ngOnDestroy(): void {
    removeEscapeLayer(this);
    if (isPlatformBrowser(this.platformId)) {
      unlockBodyScroll(this.document, this);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event?: Event): void {
    if (!this.visible() || !this.closeOnEscape()) return;
    // Only the topmost open layer closes, and not when content inside already handled it
    if (event && !shouldHandleEscape(this, event)) return;
    event?.preventDefault();
    this.close.emit();
  }

  protected readonly overlayClasses = computed(() => {
    return this.twClass.merge(
      'fixed inset-0',
      BLUR_CLASSES[this.blur()],
      OPACITY_CLASSES[this.opacity()],
      this.centered() ? 'flex items-center justify-center' : '',
      this.animate() ? 'transition-opacity duration-200' : '',
      this.class()
    );
  });

  /** Whether the current pointer press started on the overlay itself (not its content) */
  private pointerDownOnOverlay = false;

  protected onOverlayPointerDown(event: Event): void {
    this.pointerDownOnOverlay = event.target === event.currentTarget;
  }

  protected onOverlayClick(event: MouseEvent): void {
    const startedOnOverlay = this.pointerDownOnOverlay;
    this.pointerDownOnOverlay = false;
    // A press inside the content released over the overlay dispatches its click on
    // the overlay (the common ancestor): only close when both ends hit the overlay
    if (this.closeOnClick() && startedOnOverlay && event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}

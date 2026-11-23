import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { TwFocusTrapDirective } from '../directives/focus-trap.directive';
import {
  pushEscapeLayer,
  removeEscapeLayer,
  shouldHandleEscape,
} from '../overlay/escape-layer-stack';
import { lockBodyScroll, unlockBodyScroll } from '../overlay/scroll-lock';

export type ImageFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
export type ImageBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

/**
 * Image component with preview, zoom, and rotation
 *
 * @example
 * ```html
 * <tw-image [src]="imageUrl" alt="Description" [preview]="true"></tw-image>
 * <tw-image [src]="imageUrl" [zoomable]="true" [rotatable]="true"></tw-image>
 * ```
 */
@Component({
  selector: 'tw-image',
  standalone: true,
  imports: [CommonModule, TwFocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image.component.html',
})
export class TwImageComponent {
  private readonly twClass = inject(TwClassService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  /** Image source URL */
  readonly src = input.required<string>();

  /** Alternative text */
  readonly alt = input('');

  /** Preview source (larger image for preview) */
  readonly previewSrc = input('');

  /** Width of the image */
  readonly width = input('');

  /** Height of the image */
  readonly height = input('');

  /** Object fit */
  readonly fit = input<ImageFit>('cover');

  /** Border radius */
  readonly borderRadius = input<ImageBorderRadius>('none');

  /** Whether to enable preview on click */
  readonly preview = input(false, { transform: booleanAttribute });

  /** Whether zoom is enabled in preview */
  readonly zoomable = input(true, { transform: booleanAttribute });

  /** Whether rotation is enabled in preview */
  readonly rotatable = input(true, { transform: booleanAttribute });

  /** Additional classes */
  readonly classOverride = input('');

  /** Preview show event */
  readonly onShow = output();

  /** Preview hide event */
  readonly onHide = output();

  /** Image load event */
  readonly onLoad = output();

  /** Image error event */
  readonly onError = output();

  protected loading = signal(true);
  protected previewVisible = signal(false);
  protected zoomLevel = signal(1);
  protected rotation = signal(0);

  private readonly thumbnail = viewChild<ElementRef<HTMLImageElement>>('thumbnail');

  // Expose Math to template
  protected Math = Math;

  constructor() {
    // Reset the loading state whenever the source changes
    effect(() => {
      this.src();
      this.loading.set(true);
    });

    // With SSR hydration the server-rendered <img> may finish loading (or fail) before
    // the (load)/(error) listeners are attached; pick up that state instead of showing
    // the placeholder (and keeping the image hidden) forever.
    afterNextRender(() => {
      const img = this.thumbnail()?.nativeElement;
      if (!img?.complete || !this.loading()) return;
      if (img.naturalWidth > 0) {
        this.onImageLoad();
        return;
      }
      const src = this.src();
      // naturalWidth is 0 both for broken images and for some SVGs: let decode() decide
      img.decode?.().then(
        () => {
          if (this.src() === src) this.onImageLoad();
        },
        () => {
          if (this.src() === src) this.onImageError();
        }
      );
    });

    // Restore body scrolling if the component is destroyed while the preview is open
    inject(DestroyRef).onDestroy(() => {
      removeEscapeLayer(this);
      if (isPlatformBrowser(this.platformId)) {
        unlockBodyScroll(this.document, this);
      }
    });
  }

  protected containerClasses = computed(() => {
    const radiusClasses: Record<ImageBorderRadius, string> = {
      none: 'rounded-none',
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
      full: 'rounded-full',
    };

    return this.twClass.merge(
      'relative overflow-hidden inline-block',
      radiusClasses[this.borderRadius()],
      this.preview() ? 'cursor-zoom-in' : '',
      this.classOverride()
    );
  });

  protected containerStyles = computed(() => {
    const styles: Record<string, string> = {};
    // Bare numbers are pixels; anything else (`10rem`, `50%`, `auto`) is a CSS length as-is
    const toLength = (value: string) => (/^\d*\.?\d+$/.test(value.trim()) ? `${value}px` : value);
    const w = this.width();
    const h = this.height();
    if (w) {
      styles['width'] = toLength(w);
    }
    if (h) {
      styles['height'] = toLength(h);
    }
    return styles;
  });

  protected imageClasses = computed(() => {
    const fitClasses: Record<ImageFit, string> = {
      contain: 'object-contain',
      cover: 'object-cover',
      fill: 'object-fill',
      none: 'object-none',
      'scale-down': 'object-scale-down',
    };

    return this.twClass.merge('w-full h-full', fitClasses[this.fit()]);
  });

  protected placeholderClasses = computed(() => {
    return 'absolute inset-0 flex items-center justify-center bg-slate-100';
  });

  protected previewIconClasses = computed(() => {
    return this.twClass.merge(
      'absolute inset-0 flex items-center justify-center',
      'bg-black/0 hover:bg-black/40 transition-colors',
      'text-white opacity-0 hover:opacity-100'
    );
  });

  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(event?: Event): void {
    // The preview joins the shared overlay layer stack, so Escape closes only the
    // topmost layer (e.g. the preview, not an enclosing modal as well)
    if (!this.previewVisible()) return;
    if (event && !shouldHandleEscape(this, event)) return;
    event?.preventDefault();
    this.closePreview();
  }

  onImageLoad(): void {
    // Already settled (e.g. picked up after hydration): don't emit twice
    if (!this.loading()) return;
    this.loading.set(false);
    this.onLoad.emit();
  }

  onImageError(): void {
    if (!this.loading()) return;
    this.loading.set(false);
    this.onError.emit();
  }

  onImageClick(): void {
    if (this.preview()) {
      this.openPreview();
    }
  }

  protected onThumbnailKeydown(event: KeyboardEvent): void {
    if (!this.preview()) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPreview();
    }
  }

  openPreview(): void {
    if (this.previewVisible()) return;
    this.previewVisible.set(true);
    this.zoomLevel.set(1);
    this.rotation.set(0);
    pushEscapeLayer(this);
    this.onShow.emit();
    if (isPlatformBrowser(this.platformId)) {
      // Shared, ref-counted lock: stays correct when stacked with a modal/sidebar
      // that closes in a different order
      lockBodyScroll(this.document, this);
    }
  }

  closePreview(): void {
    if (!this.previewVisible()) return;
    this.previewVisible.set(false);
    removeEscapeLayer(this);
    this.onHide.emit();
    if (isPlatformBrowser(this.platformId)) {
      unlockBodyScroll(this.document, this);
    }
  }

  zoomIn(): void {
    if (this.zoomLevel() < 3) {
      this.zoomLevel.set(Math.min(3, this.zoomLevel() + 0.25));
    }
  }

  zoomOut(): void {
    if (this.zoomLevel() > 0.5) {
      this.zoomLevel.set(Math.max(0.5, this.zoomLevel() - 0.25));
    }
  }

  rotateLeft(): void {
    this.rotation.set(this.rotation() - 90);
  }

  rotateRight(): void {
    this.rotation.set(this.rotation() + 90);
  }
}

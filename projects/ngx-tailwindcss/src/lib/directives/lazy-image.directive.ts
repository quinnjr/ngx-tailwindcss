import {
  booleanAttribute,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

export interface LazyImageEvent {
  loaded: boolean;
  src: string;
  error?: Error;
}

/**
 * Directive to lazy load images when they enter the viewport
 *
 * @example
 * ```html
 * <img twLazyImage="/image.jpg" [lazyPlaceholder]="'/placeholder.jpg'" (lazyLoaded)="onLoaded($event)" />
 * <img twLazyImage="/large-image.jpg" lazyLoadingClass="opacity-0" lazyLoadedClass="opacity-100 transition-opacity" />
 * ```
 */
@Directive({
  selector: 'img[twLazyImage]',
  standalone: true,
})
export class TwLazyImageDirective implements OnInit, OnChanges, OnDestroy {
  private readonly el: ElementRef<HTMLImageElement>;
  private readonly renderer: Renderer2;
  private readonly ngZone: NgZone;

  constructor() {
    this.el = inject(ElementRef);
    this.renderer = inject(Renderer2);
    this.ngZone = inject(NgZone);
  }

  private observer: IntersectionObserver | null = null;
  private removeNativeListeners: () => void = () => {};
  /** Incremented per load so a superseded preload can't apply its (stale) result */
  private loadGeneration = 0;
  private initialized = false;

  /** The image source to lazy load */
  @Input({ required: true })
  twLazyImage = '';

  /** Placeholder image to show before loading */
  @Input()
  lazyPlaceholder = '';

  /** CSS class to add while loading */
  @Input()
  lazyLoadingClass = '';

  /** CSS class to add after loaded */
  @Input()
  lazyLoadedClass = '';

  /** Root margin for intersection observer */
  @Input()
  lazyRootMargin = '100px';

  /** Disable lazy loading (load immediately) */
  @Input({ transform: booleanAttribute })
  lazyDisabled = false;

  /** Use native loading="lazy" attribute */
  @Input({ transform: booleanAttribute })
  lazyNative = false;

  /** Emits when image loads or errors */
  @Output()
  lazyLoaded = new EventEmitter<LazyImageEvent>();

  ngOnInit(): void {
    this.initialized = true;
    this.start();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // A new source (e.g. a reused component bound to different data) restarts loading
    if (!this.initialized || !changes['twLazyImage']) return;

    this.stop();
    this.toggleClasses(this.lazyLoadedClass, false);
    this.start();
  }

  private start(): void {
    const img = this.el.nativeElement;

    // Set placeholder if provided
    if (this.lazyPlaceholder) {
      this.renderer.setAttribute(img, 'src', this.lazyPlaceholder);
    }

    // Add loading class
    this.toggleClasses(this.lazyLoadingClass, true);

    // Use native lazy loading if requested; the browser defers the fetch itself
    if (this.lazyNative) {
      this.renderer.setAttribute(img, 'loading', 'lazy');
      this.loadImageNatively();
      return;
    }

    // Load immediately when lazy loading is disabled
    if (this.lazyDisabled) {
      this.loadImage();
      return;
    }

    // Use IntersectionObserver for lazy loading
    if (typeof IntersectionObserver === 'undefined') {
      this.loadImage();
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        // IntersectionObserver callbacks are not zone-patched; load (and register the
        // preload listeners) inside the zone so `lazyLoaded` triggers change detection
        this.ngZone.run(() => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadImage();
              this.observer?.disconnect();
              this.observer = null;
            }
          });
        });
      },
      {
        rootMargin: this.lazyRootMargin,
      }
    );

    this.observer.observe(img);
  }

  private loadImage(): void {
    const img = this.el.nativeElement;

    // No Image constructor on the server (SSR): render the real source directly
    if (typeof Image === 'undefined') {
      this.renderer.setAttribute(img, 'src', this.twLazyImage);
      return;
    }

    // Create a new image to preload
    const tempImg = new Image();
    const generation = ++this.loadGeneration;

    tempImg.addEventListener('load', () => {
      if (generation !== this.loadGeneration) return;
      this.renderer.setAttribute(img, 'src', this.twLazyImage);
      this.applyLoadedClasses();
      this.lazyLoaded.emit({ loaded: true, src: this.twLazyImage });
    });

    tempImg.addEventListener('error', () => {
      if (generation !== this.loadGeneration) return;
      this.lazyLoaded.emit({
        loaded: false,
        src: this.twLazyImage,
        error: new Error(`Failed to load image: ${this.twLazyImage}`),
      });
    });

    tempImg.src = this.twLazyImage;
  }

  private loadImageNatively(): void {
    const img = this.el.nativeElement;

    const onLoad = (): void => {
      this.removeNativeListeners();
      this.applyLoadedClasses();
      this.lazyLoaded.emit({ loaded: true, src: this.twLazyImage });
    };

    const onError = (): void => {
      this.removeNativeListeners();
      this.lazyLoaded.emit({
        loaded: false,
        src: this.twLazyImage,
        error: new Error(`Failed to load image: ${this.twLazyImage}`),
      });
    };

    this.removeNativeListeners = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      this.removeNativeListeners = () => {};
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    // Assign the source directly to the host image so the browser's
    // native lazy loading controls when the fetch happens
    this.renderer.setAttribute(img, 'src', this.twLazyImage);
  }

  private applyLoadedClasses(): void {
    // Remove loading class, add loaded class
    this.toggleClasses(this.lazyLoadingClass, false);
    this.toggleClasses(this.lazyLoadedClass, true);
  }

  private toggleClasses(classes: string, add: boolean): void {
    const img = this.el.nativeElement;
    for (const cls of classes.split(/\s+/)) {
      if (!cls) continue;
      if (add) this.renderer.addClass(img, cls);
      else this.renderer.removeClass(img, cls);
    }
  }

  /** Cancels the pending observer, preload and native load listeners */
  private stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.loadGeneration++;
    this.removeNativeListeners();
  }

  ngOnDestroy(): void {
    this.stop();
  }
}

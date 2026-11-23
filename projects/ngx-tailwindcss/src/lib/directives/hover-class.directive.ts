import {
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';
import { TwClassService } from '../core/tw-class.service';

/**
 * Directive to dynamically add/remove classes on hover
 * Useful for complex hover states that can't be achieved with CSS alone
 *
 * @example
 * ```html
 * <div twHoverClass="scale-105 shadow-lg">Hover me</div>
 * <div twHoverClass="bg-blue-500 text-white" [hoverClassBase]="'bg-white text-black'">Toggle colors</div>
 * <div twHoverClass="ring-2 ring-blue-500" [hoverDelay]="200">Delayed hover effect</div>
 * ```
 */
@Directive({
  selector: '[twHoverClass]',
  standalone: true,
})
export class TwHoverClassDirective implements OnInit, OnDestroy {
  private readonly el: ElementRef<HTMLElement>;
  private readonly renderer: Renderer2;
  private readonly ngZone: NgZone;
  private readonly twClassService: TwClassService;

  constructor() {
    this.el = inject(ElementRef);
    this.renderer = inject(Renderer2);
    this.ngZone = inject(NgZone);
    this.twClassService = inject(TwClassService);
  }

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private isHovered = false;
  private applied: { added: string[]; removed: string[] } | null = null;

  /** Classes to add on hover */
  @Input({ required: true })
  twHoverClass = '';

  /**
   * Base classes to remove on hover (and restore on leave). Classes on the element
   * that conflict with the hover classes (e.g. `bg-blue-500` vs `bg-blue-600`) are
   * removed and restored automatically.
   */
  @Input()
  hoverClassBase = '';

  /** Delay before applying hover classes (ms) */
  @Input()
  hoverDelay = 0;

  /** Delay before removing hover classes (ms) */
  @Input()
  hoverLeaveDelay = 0;

  /** Disable hover effects */
  @Input({ transform: booleanAttribute })
  hoverDisabled = false;

  private readonly onMouseEnter = (): void => {
    if (this.hoverDisabled) return;

    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    const apply = () => {
      this.isHovered = true;
      this.applyHoverClasses();
    };

    if (this.hoverDelay > 0) {
      this.hoverTimeout = setTimeout(apply, this.hoverDelay);
    } else {
      apply();
    }
  };

  private readonly onMouseLeave = (): void => {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    // Always undo applied hover classes, even if the directive was disabled
    // while hovered; otherwise the hover state would stick
    if (!this.isHovered) return;

    const remove = () => {
      this.isHovered = false;
      this.removeHoverClasses();
    };

    if (this.hoverLeaveDelay > 0 && !this.hoverDisabled) {
      this.hoverTimeout = setTimeout(remove, this.hoverLeaveDelay);
    } else {
      remove();
    }
  };

  private applyHoverClasses(): void {
    if (this.applied) return;
    const element = this.el.nativeElement;
    const hoverClasses = this.twHoverClass.split(/\s+/).filter(Boolean);
    const hoverString = hoverClasses.join(' ');
    const removed: string[] = [];

    // Remove base classes
    for (const cls of this.hoverClassBase.split(/\s+/).filter(Boolean)) {
      if (element.classList.contains(cls)) removed.push(cls);
      this.renderer.removeClass(element, cls);
    }

    // Tailwind 4 emits same-property utilities in a fixed order (sorted by
    // class name, numeric-aware: bg-blue-50 < bg-blue-500 < bg-blue-600 <
    // bg-white), not in class-attribute order, so a hover class only takes
    // effect if conflicting classes already on the element are removed
    if (hoverString) {
      for (const cls of (element.getAttribute('class') ?? '').split(/\s+/)) {
        if (!cls || hoverClasses.includes(cls) || removed.includes(cls)) continue;
        if (!this.twClassService.merge(cls, hoverString).split(' ').includes(cls)) {
          removed.push(cls);
          this.renderer.removeClass(element, cls);
        }
      }
    }

    // Add hover classes, remembering only those not already present so that
    // leaving doesn't strip the element's own classes
    const added: string[] = [];
    for (const cls of hoverClasses) {
      if (!element.classList.contains(cls)) added.push(cls);
      this.renderer.addClass(element, cls);
    }

    this.applied = { added, removed };
  }

  private removeHoverClasses(): void {
    const element = this.el.nativeElement;
    const applied = this.applied;
    this.applied = null;

    // Remove hover classes
    for (const cls of applied?.added ?? []) {
      this.renderer.removeClass(element, cls);
    }

    // Restore base and conflicting classes
    const restore = new Set([...this.hoverClassBase.split(/\s+/), ...(applied?.removed ?? [])]);
    for (const cls of restore) {
      if (cls) this.renderer.addClass(element, cls);
    }
  }

  ngOnInit(): void {
    const element = this.el.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      element.addEventListener('mouseenter', this.onMouseEnter);
      element.addEventListener('mouseleave', this.onMouseLeave);
    });
  }

  ngOnDestroy(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    const element = this.el.nativeElement;
    element.removeEventListener('mouseenter', this.onMouseEnter);
    element.removeEventListener('mouseleave', this.onMouseLeave);
  }
}

import {
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';

/** Sub-pixel slack when checking whether the element is scrolled to an edge */
const SCROLL_EDGE_TOLERANCE = 1;

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

/** Whether the element has overflowing content it lets the user scroll (on either axis) */
function isScrollContainer(element: Element): boolean {
  const style = getComputedStyle(element);
  return (
    (SCROLLABLE_OVERFLOW.has(style.overflowY) && element.scrollHeight > element.clientHeight) ||
    (SCROLLABLE_OVERFLOW.has(style.overflowX) && element.scrollWidth > element.clientWidth)
  );
}

/**
 * Whether the element can still scroll by `delta` along the given axis.
 * `checkOverflow` requires a scrollable overflow style (used for descendants;
 * the host itself is trusted to be the scroll container).
 */
function canScroll(
  element: Element,
  vertical: boolean,
  delta: number,
  checkOverflow: boolean
): boolean {
  if (checkOverflow) {
    const style = getComputedStyle(element);
    if (!SCROLLABLE_OVERFLOW.has(vertical ? style.overflowY : style.overflowX)) return false;
  }

  if (vertical) {
    const { scrollTop, scrollHeight, clientHeight } = element;
    // scrollTop can be fractional on zoomed / high-DPI displays
    return delta < 0
      ? scrollTop > SCROLL_EDGE_TOLERANCE
      : scrollTop + clientHeight < scrollHeight - SCROLL_EDGE_TOLERANCE;
  }

  // In RTL, scrollLeft runs from 0 (right edge) to -(scrollWidth - clientWidth)
  const { scrollLeft, scrollWidth, clientWidth } = element;
  const maxScroll = scrollWidth - clientWidth;
  const isRtl = getComputedStyle(element).direction === 'rtl';
  const minLeft = isRtl ? -maxScroll : 0;
  const maxLeft = isRtl ? 0 : maxScroll;
  return delta < 0
    ? scrollLeft > minLeft + SCROLL_EDGE_TOLERANCE
    : scrollLeft < maxLeft - SCROLL_EDGE_TOLERANCE;
}

/**
 * Directive to trap scroll within an element, preventing scroll propagation to parent
 * Useful for dropdowns, modals, and scrollable panels
 *
 * @example
 * ```html
 * <div twTrapScroll class="h-64 overflow-auto">
 *   <!-- Scrolling here won't affect parent -->
 *   <div class="h-[1000px]">Long content</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[twTrapScroll]',
  standalone: true,
})
export class TwTrapScrollDirective implements OnInit, OnDestroy {
  private readonly el: ElementRef<HTMLElement>;
  private readonly ngZone: NgZone;

  constructor() {
    this.el = inject(ElementRef);
    this.ngZone = inject(NgZone);
  }

  /** Disable scroll trapping */
  @Input({ transform: booleanAttribute })
  trapScrollDisabled = false;

  /** Allow horizontal scroll to propagate */
  @Input({ transform: booleanAttribute })
  trapScrollAllowHorizontal = false;

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.trapScrollDisabled) return;

    const element = this.el.nativeElement;
    const isVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);

    if (!isVertical && this.trapScrollAllowHorizontal) {
      return;
    }

    const delta = isVertical ? event.deltaY : event.deltaX;
    if (delta === 0) return;

    // A scrollable descendant (e.g. a code block or list) under the pointer scrolls
    // first; only block the wheel once nothing inside the host can take it
    for (
      let node = event.target instanceof Element ? event.target : null;
      node && node !== element && element.contains(node);
      node = node.parentElement
    ) {
      if (canScroll(node, isVertical, delta, true)) return;
    }

    if (!canScroll(element, isVertical, delta, false)) {
      event.preventDefault();
    }
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.trapScrollDisabled) return;

    const element = this.el.nativeElement;

    // If element is not scrollable, prevent all touch scroll, unless the touch
    // is on a scrollable descendant
    if (
      element.scrollHeight <= element.clientHeight &&
      element.scrollWidth <= element.clientWidth
    ) {
      for (
        let node = event.target instanceof Element ? event.target : null;
        node && node !== element && element.contains(node);
        node = node.parentElement
      ) {
        if (isScrollContainer(node)) return;
      }
      event.preventDefault();
    }
  };

  ngOnInit(): void {
    const element = this.el.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      element.addEventListener('wheel', this.onWheel, { passive: false });
      element.addEventListener('touchmove', this.onTouchMove, { passive: false });
    });
  }

  ngOnDestroy(): void {
    const element = this.el.nativeElement;
    element.removeEventListener('wheel', this.onWheel);
    element.removeEventListener('touchmove', this.onTouchMove);
  }
}

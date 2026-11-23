import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  numberAttribute,
  OnDestroy,
  Output,
  PLATFORM_ID,
  Renderer2,
  signal,
  TemplateRef,
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

let nextPopoverId = 0;

const POPOVER_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';
export type PopoverTrigger = 'click' | 'hover' | 'focus' | 'manual';

/**
 * Popover component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-popover header="Settings">
 *   <button twPopoverTrigger>Open</button>
 *   <p>Popover content here</p>
 * </tw-popover>
 * ```
 */
@Component({
  selector: 'tw-popover',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './popover.component.html',
  host: {
    class: 'inline-block',
  },
})
export class TwPopoverComponent implements AfterViewInit, OnDestroy {
  private readonly twClass = inject(TwClassService);
  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('triggerContainer') triggerContainer!: ElementRef<HTMLElement>;

  /** Position relative to trigger */
  @Input() position: PopoverPosition = 'bottom';

  /** How the popover is triggered */
  @Input() trigger: PopoverTrigger = 'click';

  /** Header text */
  @Input() header = '';

  /** Accessible name of the popover dialog when no `header` is shown */
  @Input() ariaLabel = '';

  /** Id of an element (e.g. a heading in the projected content) that names the popover dialog */
  @Input() ariaLabelledBy = '';

  /** Whether to show arrow */
  @Input({ transform: booleanAttribute }) showArrow = true;

  /** Whether clicking outside closes the popover */
  @Input({ transform: booleanAttribute }) dismissible = true;

  /** Close on escape key */
  @Input({ transform: booleanAttribute }) closeOnEscape = true;

  /** Hover delay in milliseconds */
  @Input({ transform: numberAttribute }) hoverDelay = 200;

  /** Additional classes */
  @Input() classOverride = '';

  /** Show event */
  @Output() onShow = new EventEmitter<void>();

  /** Hide event */
  @Output() onHide = new EventEmitter<void>();

  @ContentChild('twPopoverFooter') footerTemplate!: TemplateRef<any>;

  protected visible = signal(false);
  private hoverTimeout: any = null;

  /** Id of the popover panel, referenced from the trigger while open */
  protected readonly popoverId = `tw-popover-${nextPopoverId++}`;
  private readonly headerId = `${this.popoverId}-header`;

  // Portal elements
  private portalHost: HTMLElement | null = null;
  private portalElement: HTMLElement | null = null;
  // Projected elements moved into the portal (with their original parents) so
  // they can be restored on destroy
  private movedElements: Array<{ element: HTMLElement; parent: HTMLElement | null }> = [];
  private clickOutsideListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private portalMouseEnterListener: (() => void) | null = null;
  private portalMouseLeaveListener: (() => void) | null = null;
  private portalTabListener: (() => void) | null = null;

  protected get hasFooter(): boolean {
    return !!this.footerTemplate;
  }

  /** A method, not a computed: `classOverride` is a plain @Input a computed can't track */
  protected popoverClasses(): string {
    return this.twClass.merge(
      'min-w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700',
      this.classOverride
    );
  }

  constructor() {
    // Create portal when visible state changes
    effect(() => {
      if (this.visible()) {
        this.createPortal();
      } else {
        this.destroyPortal();
      }
    });
  }

  ngAfterViewInit(): void {
    this.syncTriggerAria();
  }

  ngOnDestroy(): void {
    this.clearHoverTimeout();
    this.destroyPortal();
  }

  /**
   * Hover/focus popovers are non-interactive descriptions (tooltip semantics);
   * click/manual popovers can hold interactive content and are exposed as dialogs.
   */
  private get isTooltip(): boolean {
    return this.trigger === 'hover' || this.trigger === 'focus';
  }

  /** The projected trigger element, which carries the ARIA relationship to the panel. */
  private getTriggerElement(): HTMLElement | null {
    const container: HTMLElement | undefined = this.triggerContainer?.nativeElement;
    return container?.querySelector<HTMLElement>('[twPopoverTrigger]') ?? null;
  }

  private syncTriggerAria(): void {
    const trigger = this.getTriggerElement();
    if (!trigger) return;
    const open = !!this.portalElement;

    // The trigger mode may change at runtime, so each branch clears the other's attributes
    const tooltip = this.isTooltip;
    this.setOrRemoveAttribute(trigger, 'aria-describedby', tooltip && open ? this.popoverId : null);
    this.setOrRemoveAttribute(trigger, 'aria-haspopup', tooltip ? null : 'dialog');
    this.setOrRemoveAttribute(trigger, 'aria-expanded', tooltip ? null : String(open));
    this.setOrRemoveAttribute(trigger, 'aria-controls', !tooltip && open ? this.popoverId : null);
  }

  private setOrRemoveAttribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
      this.renderer.removeAttribute(element, name);
    } else {
      this.renderer.setAttribute(element, name, value);
    }
  }

  onTriggerClick(): void {
    if (this.trigger === 'click') {
      this.toggle();
    }
  }

  onTriggerEnter(): void {
    if (this.trigger === 'hover') {
      this.clearHoverTimeout();
      this.hoverTimeout = setTimeout(() => {
        this.show();
      }, this.hoverDelay);
    }
  }

  onTriggerLeave(): void {
    if (this.trigger === 'hover') {
      this.clearHoverTimeout();
      this.hoverTimeout = setTimeout(() => {
        this.hide();
      }, this.hoverDelay);
    }
  }

  onTriggerFocusIn(): void {
    // Keyboard equivalence: focus opens for both focus and hover triggers
    if (this.trigger === 'focus' || this.trigger === 'hover') {
      this.clearHoverTimeout();
      this.show();
    }
  }

  onTriggerFocusOut(): void {
    // Hover popovers also open on focus, so they must close when focus leaves
    if (this.trigger === 'focus' || this.trigger === 'hover') {
      this.clearHoverTimeout();
      this.hide();
    }
  }

  private onPopoverEnter(): void {
    if (this.trigger === 'hover') {
      this.clearHoverTimeout();
    }
  }

  private onPopoverLeave(): void {
    if (this.trigger === 'hover') {
      this.clearHoverTimeout();
      this.hoverTimeout = setTimeout(() => {
        this.hide();
      }, this.hoverDelay);
    }
  }

  private clearHoverTimeout(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  show(): void {
    // Emit only on an actual transition (focus + hover can both request a show)
    if (this.visible()) return;
    this.visible.set(true);
    this.onShow.emit();
  }

  hide(): void {
    // Leave the Escape stack right away (the portal itself is torn down by the effect)
    removeEscapeLayer(this);
    // Hover-leave timers and focusout fire even if the popover never opened
    if (!this.visible()) return;
    // Focus inside the portal would be lost when it is removed: return it to the trigger
    const focusInside = !!this.portalElement?.contains(this.document.activeElement);
    this.visible.set(false);
    this.onHide.emit();
    if (focusInside) this.getTriggerElement()?.focus();
  }

  toggle(): void {
    if (this.visible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  private createPortal(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Create portal host at body level
    this.portalHost = this.renderer.createElement('div');
    this.renderer.setStyle(this.portalHost, 'position', 'fixed');
    this.renderer.setStyle(this.portalHost, 'z-index', '9999');
    this.renderer.setStyle(this.portalHost, 'top', '0');
    this.renderer.setStyle(this.portalHost, 'left', '0');
    this.renderer.setStyle(this.portalHost, 'pointer-events', 'none');
    this.renderer.appendChild(this.document.body, this.portalHost);

    // Create the popover element
    this.portalElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.portalElement, 'position', 'absolute');
    this.renderer.setStyle(this.portalElement, 'pointer-events', 'auto');

    // Apply classes
    const classes = this.popoverClasses().split(' ');
    classes.forEach(cls => {
      if (cls) this.renderer.addClass(this.portalElement, cls);
    });

    // Add animation styles
    this.renderer.setStyle(this.portalElement, 'opacity', '0');
    this.renderer.setStyle(this.portalElement, 'transform', 'scale(0.95)');
    this.renderer.setStyle(
      this.portalElement,
      'transition',
      'opacity 150ms ease-out, transform 150ms ease-out'
    );

    // Set ARIA attributes
    this.renderer.setAttribute(this.portalElement, 'id', this.popoverId);
    this.renderer.setAttribute(this.portalElement, 'role', this.isTooltip ? 'tooltip' : 'dialog');
    if (!this.isTooltip) {
      if (this.header) {
        this.renderer.setAttribute(this.portalElement, 'aria-labelledby', this.headerId);
      } else if (this.ariaLabelledBy) {
        this.renderer.setAttribute(this.portalElement, 'aria-labelledby', this.ariaLabelledBy);
      } else if (this.ariaLabel) {
        this.renderer.setAttribute(this.portalElement, 'aria-label', this.ariaLabel);
      }
    }

    // Build popover content
    this.buildPopoverContent();

    this.renderer.appendChild(this.portalHost, this.portalElement);
    this.syncTriggerAria();

    // Position the popover
    this.updatePosition();

    // Animate in. A click popover is a (non-modal) dialog appended to <body>, out of
    // the trigger's Tab sequence: move focus to its first focusable element so
    // keyboard users can reach its content
    requestAnimationFrame(() => {
      if (this.portalElement) {
        this.renderer.setStyle(this.portalElement, 'opacity', '1');
        this.renderer.setStyle(this.portalElement, 'transform', 'scale(1)');
        if (this.trigger === 'click') {
          this.portalElement.querySelector<HTMLElement>(POPOVER_FOCUSABLE_SELECTOR)?.focus();
        }
      }
    });

    // Add event listeners
    if (this.dismissible && this.trigger === 'click') {
      this.clickOutsideListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
        const target = event.target as Node;
        const isInsideTrigger = this.elementRef.nativeElement.contains(target);
        const isInsidePortal = this.portalElement?.contains(target);

        if (!isInsideTrigger && !isInsidePortal) {
          this.hide();
        }
      });
    }

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
          this.hide();
        });
      });
    }

    this.resizeListener = this.renderer.listen('window', 'resize', () => {
      this.updatePosition();
    });

    if (this.closeOnEscape) {
      // Escape closes only the topmost layer (via the shared layer stack) and is left to
      // handlers inside the popover that already claimed it; marking it handled keeps an
      // enclosing modal/sidebar open without suppressing other listeners
      pushEscapeLayer(this);
      this.keydownListener = (event: KeyboardEvent) => {
        if (shouldHandleEscape(this, event)) {
          event.preventDefault();
          this.hide();
        }
      };
      this.document.addEventListener('keydown', this.keydownListener);
    }

    // Hover listeners for portal
    if (this.trigger === 'hover' && this.portalElement) {
      this.portalMouseEnterListener = this.renderer.listen(this.portalElement, 'mouseenter', () => {
        this.onPopoverEnter();
      });
      this.portalMouseLeaveListener = this.renderer.listen(this.portalElement, 'mouseleave', () => {
        this.onPopoverLeave();
      });
    }
  }

  private buildPopoverContent(): void {
    if (!this.portalElement) return;

    // Arrow
    if (this.showArrow) {
      const arrow = this.renderer.createElement('div');
      const arrowClasses = this.getArrowClasses();
      arrowClasses.split(' ').forEach(cls => {
        if (cls) this.renderer.addClass(arrow, cls);
      });
      this.renderer.appendChild(this.portalElement, arrow);
    }

    // Header
    if (this.header) {
      const headerEl = this.renderer.createElement('div');
      this.renderer.setAttribute(headerEl, 'id', this.headerId);
      this.renderer.addClass(headerEl, 'px-4');
      this.renderer.addClass(headerEl, 'py-2');
      this.renderer.addClass(headerEl, 'border-b');
      this.renderer.addClass(headerEl, 'border-slate-200');
      this.renderer.addClass(headerEl, 'dark:border-slate-700');
      this.renderer.addClass(headerEl, 'font-semibold');
      this.renderer.addClass(headerEl, 'text-slate-900');
      this.renderer.addClass(headerEl, 'dark:text-slate-100');
      const headerText = this.renderer.createText(this.header);
      this.renderer.appendChild(headerEl, headerText);
      this.renderer.appendChild(this.portalElement, headerEl);
    }

    // Footer element is captured before the content source moves, since it is
    // projected inside it
    const footerSource = this.elementRef.nativeElement.querySelector(
      '[twPopoverFooter]'
    ) as HTMLElement | null;

    // Content
    const contentWrapper = this.renderer.createElement('div');
    this.renderer.addClass(contentWrapper, 'px-4');
    this.renderer.addClass(contentWrapper, 'py-3');

    // Move (not clone) the live projected content into the portal so Angular
    // bindings and event handlers keep working
    const contentSource = this.elementRef.nativeElement.querySelector(
      '.popover-content-source'
    ) as HTMLElement | null;
    if (contentSource) {
      this.movedElements.push({ element: contentSource, parent: contentSource.parentElement });
      this.renderer.setStyle(contentSource, 'display', 'block');
      this.renderer.appendChild(contentWrapper, contentSource);
    }
    this.renderer.appendChild(this.portalElement, contentWrapper);

    // Footer
    if (footerSource) {
      const footerWrapper = this.renderer.createElement('div');
      this.renderer.addClass(footerWrapper, 'px-4');
      this.renderer.addClass(footerWrapper, 'py-2');
      this.renderer.addClass(footerWrapper, 'border-t');
      this.renderer.addClass(footerWrapper, 'border-slate-200');
      this.renderer.addClass(footerWrapper, 'dark:border-slate-700');
      this.renderer.addClass(footerWrapper, 'bg-slate-50');
      this.renderer.addClass(footerWrapper, 'dark:bg-slate-900');
      this.movedElements.push({ element: footerSource, parent: footerSource.parentElement });
      this.renderer.appendChild(footerWrapper, footerSource);
      this.renderer.appendChild(this.portalElement, footerWrapper);
    }
  }

  private getArrowClasses(): string {
    const baseClasses = 'absolute w-2.5 h-2.5 bg-white dark:bg-slate-800 rotate-45 shadow-sm';
    const positionClasses: Record<PopoverPosition, string> = {
      top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r border-slate-200 dark:border-slate-700',
      bottom:
        'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l border-slate-200 dark:border-slate-700',
      left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t border-r border-slate-200 dark:border-slate-700',
      right:
        'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-b border-l border-slate-200 dark:border-slate-700',
    };
    return this.twClass.merge(baseClasses, positionClasses[this.position]);
  }

  private destroyPortal(): void {
    // Restore moved projected content to its original location (content source
    // first, then the footer back inside it)
    for (const { element, parent } of this.movedElements) {
      if (parent) {
        this.renderer.appendChild(parent, element);
      }
    }
    this.movedElements = [];

    const contentSource = this.elementRef.nativeElement.querySelector(
      '.popover-content-source'
    ) as HTMLElement | null;
    if (contentSource) {
      this.renderer.setStyle(contentSource, 'display', 'none');
    }

    if (this.portalHost && this.document.body.contains(this.portalHost)) {
      this.renderer.removeChild(this.document.body, this.portalHost);
    }
    this.portalHost = null;
    this.portalElement = null;
    this.syncTriggerAria();

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
      this.document.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    removeEscapeLayer(this);
    if (this.portalMouseEnterListener) {
      this.portalMouseEnterListener();
      this.portalMouseEnterListener = null;
    }
    if (this.portalMouseLeaveListener) {
      this.portalMouseLeaveListener();
      this.portalMouseLeaveListener = null;
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
    const gap = 8; // margin between trigger and popover

    switch (this.position) {
      case 'top': {
        top = rect.top - portalRect.height - gap;
        left = rect.left + rect.width / 2 - portalRect.width / 2;
        break;
      }
      case 'bottom': {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - portalRect.width / 2;
        break;
      }
      case 'left': {
        top = rect.top + rect.height / 2 - portalRect.height / 2;
        left = rect.left - portalRect.width - gap;
        break;
      }
      case 'right': {
        top = rect.top + rect.height / 2 - portalRect.height / 2;
        left = rect.right + gap;
        break;
      }
    }

    // Ensure popover stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < gap) left = gap;
    if (left + portalRect.width > viewportWidth - gap) {
      left = viewportWidth - portalRect.width - gap;
    }
    if (top < gap) top = gap;
    if (top + portalRect.height > viewportHeight - gap) {
      top = viewportHeight - portalRect.height - gap;
    }

    this.renderer.setStyle(this.portalElement, 'top', `${top}px`);
    this.renderer.setStyle(this.portalElement, 'left', `${left}px`);
  }
}

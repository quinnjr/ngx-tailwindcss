import {
  AfterViewInit,
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  Input,
  numberAttribute,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Directive to automatically focus an element when it's rendered
 *
 * @example
 * ```html
 * <input twAutoFocus />
 * <input twAutoFocus [autoFocusDelay]="100" />
 * <input [twAutoFocus]="shouldFocus" />
 * ```
 */
@Directive({
  selector: '[twAutoFocus]',
  standalone: true,
})
export class TwAutoFocusDirective implements AfterViewInit, OnChanges, OnDestroy {
  private readonly el: ElementRef<HTMLElement>;
  private readonly platformId = inject(PLATFORM_ID);
  private viewInitialized = false;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private focusFrame: number | null = null;

  constructor() {
    this.el = inject(ElementRef);
  }

  /** Whether auto-focus is enabled */
  @Input({ alias: 'twAutoFocus', transform: booleanAttribute })
  autoFocusEnabled = true;

  /** Delay in milliseconds before focusing */
  @Input({ transform: numberAttribute })
  autoFocusDelay = 0;

  /** Whether to select text content (for inputs) */
  @Input({ transform: booleanAttribute })
  autoFocusSelect = false;

  /** Whether to scroll element into view */
  @Input({ transform: booleanAttribute })
  autoFocusScroll = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (!this.autoFocusEnabled) return;

    this.scheduleFocus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const enabledChange = changes['autoFocusEnabled'];
    if (!this.viewInitialized || !enabledChange) return;

    // Focus when the input flips from false to true after initialization
    if (enabledChange.currentValue && !enabledChange.previousValue) {
      this.scheduleFocus();
    }
  }

  private scheduleFocus(): void {
    // No DOM focus (or requestAnimationFrame / HTMLInputElement) on the server
    if (!isPlatformBrowser(this.platformId)) return;
    this.cancelScheduledFocus();

    const focus = () => {
      this.focusTimer = null;
      this.focusFrame = null;
      const element = this.el.nativeElement;

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        if (this.autoFocusSelect) {
          element.select();
        }
      } else if ('focus' in element && typeof element.focus === 'function') {
        element.focus();
      }

      if (this.autoFocusScroll) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (this.autoFocusDelay > 0) {
      this.focusTimer = setTimeout(focus, this.autoFocusDelay);
    } else {
      // Use requestAnimationFrame for immediate but safe focus
      this.focusFrame = requestAnimationFrame(focus);
    }
  }

  private cancelScheduledFocus(): void {
    if (this.focusTimer !== null) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    if (this.focusFrame !== null) {
      cancelAnimationFrame(this.focusFrame);
      this.focusFrame = null;
    }
  }

  ngOnDestroy(): void {
    this.cancelScheduledFocus();
  }
}

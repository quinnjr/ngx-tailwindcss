import {
  booleanAttribute,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { splitShortcut } from '../native/shortcut-keys.util';

export interface KeyboardShortcutEvent {
  key: string;
  event: KeyboardEvent;
  shortcut: string;
}

/**
 * Directive to handle keyboard shortcuts
 *
 * @example
 * ```html
 * <div twKeyboardShortcut="ctrl+s" (shortcutPressed)="onSave($event)">Press Ctrl+S to save</div>
 * <div twKeyboardShortcut="ctrl+shift+p" (shortcutPressed)="openPalette()">Command Palette</div>
 * <div twKeyboardShortcut="escape" (shortcutPressed)="onEscape()">Press ESC</div>
 * ```
 *
 * Supported modifiers: ctrl, alt, shift, meta (cmd on Mac)
 * Key names: Any KeyboardEvent.key value (a-z, 0-9, enter, escape, space, etc.)
 */
@Directive({
  selector: '[twKeyboardShortcut]',
  standalone: true,
})
export class TwKeyboardShortcutDirective implements OnInit, OnDestroy {
  private readonly ngZone: NgZone;
  private readonly platformId: object;
  private readonly el: ElementRef<HTMLElement>;
  private listenTarget: Document | HTMLElement | null = null;

  constructor() {
    this.ngZone = inject(NgZone);
    this.platformId = inject(PLATFORM_ID);
    this.el = inject(ElementRef);
  }

  /** Keyboard shortcut string (e.g., "ctrl+s", "ctrl+shift+p", "escape") */
  @Input({ required: true })
  twKeyboardShortcut = '';

  /** Listen globally (document) instead of element-only */
  @Input({ transform: booleanAttribute })
  shortcutGlobal = true;

  /** Prevent default browser behavior */
  @Input({ transform: booleanAttribute })
  shortcutPreventDefault = true;

  /** Stop event propagation */
  @Input({ transform: booleanAttribute })
  shortcutStopPropagation = false;

  /** Disable the shortcut */
  @Input({ transform: booleanAttribute })
  shortcutDisabled = false;

  /** Emits when the shortcut is pressed */
  @Output()
  shortcutPressed = new EventEmitter<KeyboardShortcutEvent>();

  private readonly keydownHandler = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (this.shortcutDisabled) return;

    const shortcut = this.twKeyboardShortcut.toLowerCase();
    // `ctrl++` binds the plus key (a plain split on '+' would yield an empty key)
    const parts = splitShortcut(shortcut);

    const lastPart = parts.at(-1);
    const key = lastPart === 'plus' ? '+' : lastPart;
    const modifiers = new Set(parts.slice(0, -1));

    const metaRequired = modifiers.has('meta') || modifiers.has('cmd');
    const ctrlRequired = modifiers.has('ctrl') || modifiers.has('control') || metaRequired;
    const altRequired = modifiers.has('alt');
    const shiftRequired = modifiers.has('shift');

    const ctrlPressed = keyEvent.ctrlKey || keyEvent.metaKey; // Treat meta as ctrl for cross-platform
    const altPressed = keyEvent.altKey;
    const shiftPressed = keyEvent.shiftKey;
    const metaPressed = keyEvent.metaKey;

    // Synthetic keydown events (e.g. Chrome autofill) carry no key/code
    const eventKey = keyEvent.key ?? '';
    // Option (macOS), AltGr and non-Latin layouts change `event.key` (Option+S types
    // 'ß', a Cyrillic layout 'ы'), so fall back to the physical key for letters and
    // digits. A layout typing a different ASCII character there (AZERTY 'a' at KeyQ)
    // means a different shortcut.
    const physicalMatches =
      !!key &&
      /^[\da-z]$/.test(key) &&
      !/^[ -~]$/.test(eventKey) &&
      keyEvent.code?.toLowerCase() === (/\d/.test(key) ? `digit${key}` : `key${key}`);
    const keyMatches =
      eventKey.toLowerCase() === key || keyEvent.code?.toLowerCase() === key || physicalMatches;

    // A shifted symbol such as '?' or '+' already encodes Shift in `event.key`
    // (e.g. '?' is Shift+/ on US layouts), so an unrequested Shift is allowed there
    const shiftEncodedInKey = key?.length === 1 && !/^[\da-z ]$/.test(key);

    const modifiersMatch =
      ctrlRequired === ctrlPressed &&
      altRequired === altPressed &&
      (shiftRequired === shiftPressed || (shiftEncodedInKey && !shiftRequired)) &&
      (metaRequired ? metaPressed : true);

    if (keyMatches && modifiersMatch) {
      if (this.shortcutPreventDefault) {
        keyEvent.preventDefault();
      }
      if (this.shortcutStopPropagation) {
        keyEvent.stopPropagation();
      }

      this.ngZone.run(() => {
        this.shortcutPressed.emit({
          key: keyEvent.key,
          event: keyEvent,
          shortcut: this.twKeyboardShortcut,
        });
      });
    }
  };

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.ngZone.runOutsideAngular(() => {
      this.listenTarget = this.shortcutGlobal ? document : this.el.nativeElement;
      this.listenTarget.addEventListener('keydown', this.keydownHandler);
    });
  }

  ngOnDestroy(): void {
    if (this.listenTarget) {
      this.listenTarget.removeEventListener('keydown', this.keydownHandler);
      this.listenTarget = null;
    }
  }
}

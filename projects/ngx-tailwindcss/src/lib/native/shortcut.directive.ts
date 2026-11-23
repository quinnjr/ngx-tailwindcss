import {
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NativeAppPlatformService } from './platform.service';
import { KeyboardShortcut } from './native.types';
import { splitShortcut } from './shortcut-keys.util';

/**
 * Directive for binding keyboard shortcuts to actions
 *
 * @example
 * ```html
 * <button twShortcut="ctrl+s" (shortcutTriggered)="onSave()">Save</button>
 * <div twShortcut="ctrl+shift+p" [shortcutGlobal]="true" (shortcutTriggered)="openPalette()"></div>
 * ```
 */
@Directive({
  selector: '[twShortcut]',
  standalone: true,
})
export class TwShortcutDirective implements OnInit, OnDestroy {
  private readonly platformService = inject(NativeAppPlatformService);
  private readonly ngZone = inject(NgZone);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);

  // Inputs
  public readonly twShortcut = input.required<string>();
  public readonly shortcutGlobal = input(false);
  public readonly shortcutPreventDefault = input(true);
  public readonly shortcutEnabled = input(true);

  // Outputs
  public readonly shortcutTriggered = output<KeyboardEvent>();

  // Parse once per twShortcut() change instead of on every keydown
  private readonly parsedShortcut = computed(() => this.parseShortcut(this.twShortcut()));

  private readonly keydownHandler = (event: Event) => {
    this.handleKeydown(event as KeyboardEvent);
  };
  /** The exact node the keydown listener is attached to */
  private listenerTarget: HTMLElement | Document | null = null;

  public ngOnInit(): void {
    const target: HTMLElement | Document = this.shortcutGlobal()
      ? this.document
      : this.elementRef.nativeElement;
    this.listenerTarget = target;
    this.ngZone.runOutsideAngular(() => {
      target.addEventListener('keydown', this.keydownHandler);
    });
  }

  public ngOnDestroy(): void {
    this.listenerTarget?.removeEventListener('keydown', this.keydownHandler);
    this.listenerTarget = null;
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.shortcutEnabled()) return;

    const shortcut = this.parsedShortcut();
    if (!shortcut) return;

    if (this.matchesShortcut(event, shortcut)) {
      if (this.shortcutPreventDefault()) {
        event.preventDefault();
      }

      this.ngZone.run(() => {
        this.shortcutTriggered.emit(event);
      });
    }
  }

  private parseShortcut(shortcutStr: string): KeyboardShortcut | null {
    // `ctrl++` / `ctrl+plus` both bind the plus key
    const parts = splitShortcut(shortcutStr.toLowerCase());

    if (parts.length === 0) return null;

    const shortcut: KeyboardShortcut = {
      key: '',
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      action: () => {},
    };

    for (const part of parts) {
      switch (part) {
        case 'ctrl':
        case 'control': {
          shortcut.ctrl = true;
          break;
        }
        case 'alt':
        case 'option': {
          shortcut.alt = true;
          break;
        }
        case 'shift': {
          shortcut.shift = true;
          break;
        }
        case 'meta':
        case 'cmd':
        case 'command':
        case 'win':
        case 'windows': {
          shortcut.meta = true;
          break;
        }
        case 'cmdorctrl':
        case 'commandorcontrol': {
          // Use Cmd on macOS, Ctrl elsewhere
          if (this.platformService.platform() === 'macos') {
            shortcut.meta = true;
          } else {
            shortcut.ctrl = true;
          }
          break;
        }
        default: {
          // This is the key
          shortcut.key = this.normalizeKey(part);
        }
      }
    }

    return shortcut.key ? shortcut : null;
  }

  private normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
      space: ' ',
      spacebar: ' ',
      esc: 'Escape',
      escape: 'Escape',
      enter: 'Enter',
      return: 'Enter',
      tab: 'Tab',
      backspace: 'Backspace',
      delete: 'Delete',
      del: 'Delete',
      insert: 'Insert',
      ins: 'Insert',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      pagedown: 'PageDown',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      arrowup: 'ArrowUp',
      arrowdown: 'ArrowDown',
      arrowleft: 'ArrowLeft',
      arrowright: 'ArrowRight',
      plus: '+',
      minus: '-',
      equal: '=',
      comma: ',',
      period: '.',
      dot: '.',
      slash: '/',
      backslash: '\\',
      semicolon: ';',
      quote: "'",
      bracketleft: '[',
      bracketright: ']',
    };

    return keyMap[key.toLowerCase()] || key.toUpperCase();
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    // Check modifiers
    if (shortcut.ctrl && !event.ctrlKey) return false;
    if (shortcut.alt && !event.altKey) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.meta && !event.metaKey) return false;

    // Check that we don't have extra modifiers
    if (!shortcut.ctrl && event.ctrlKey) return false;
    if (!shortcut.alt && event.altKey) return false;
    // A shifted symbol such as '+', '?' or '!' already encodes Shift in
    // `event.key` (e.g. '+' is Shift+= on US layouts), so an unrequested Shift
    // is only "extra" for letters, digits, Space and named keys.
    const shiftEncodedInKey = shortcut.key.length === 1 && !/^[A-Z0-9 ]$/.test(shortcut.key);
    if (!shortcut.shift && event.shiftKey && !shiftEncodedInKey) return false;
    if (!shortcut.meta && event.metaKey) return false;

    // Check key
    const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (eventKey === shortcut.key) return true;

    // Modifiers such as Option (macOS) or AltGr change `event.key` (e.g. Option+S
    // yields 'ß'), so fall back to the physical key code for letters and digits.
    if (/^[A-Z]$/.test(shortcut.key)) return event.code === `Key${shortcut.key}`;
    if (/^\d$/.test(shortcut.key)) return event.code === `Digit${shortcut.key}`;
    return false;
  }
}

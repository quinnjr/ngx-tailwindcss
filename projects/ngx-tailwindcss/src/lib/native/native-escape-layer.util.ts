import { DestroyRef, effect, inject } from '@angular/core';
import {
  pushEscapeLayer,
  removeEscapeLayer,
  shouldHandleEscape,
} from '../overlay/escape-layer-stack';

/**
 * Registers a native dialog or popup menu in the library's Escape layer stack
 * while it is open, so stacked layers (a native dialog over another one, or over
 * a tw-modal/sidebar, a menu open inside a dialog, or vice versa) close one at a
 * time on Escape.
 * Must be called in an injection context (field initializer or constructor).
 *
 * Not part of the public API.
 */
export function trackNativeEscapeLayer(owner: object, isOpen: () => boolean): void {
  effect(() => {
    if (isOpen()) {
      pushEscapeLayer(owner);
    } else {
      removeEscapeLayer(owner);
    }
  });
  inject(DestroyRef).onDestroy(() => {
    removeEscapeLayer(owner);
  });
}

/**
 * Whether an open native dialog or popup should react to this Escape: it is the topmost
 * layer and nothing has claimed the key yet. Claims the key when it does.
 */
export function claimNativeEscape(owner: object, event: Event): boolean {
  if (!shouldHandleEscape(owner, event)) return false;
  event.preventDefault();
  return true;
}

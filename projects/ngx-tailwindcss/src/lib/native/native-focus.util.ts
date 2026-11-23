import { afterNextRender, Injector } from '@angular/core';

/**
 * After the next render, focus the element `find` returns, but only if focus
 * has fallen back to the document body (i.e. the focused control was removed
 * by the state change and focus was not moved anywhere else). Keeps keyboard
 * and screen-reader users in place when a control swaps itself out of the DOM.
 *
 * Not part of the public API.
 */
export function refocusIfLost(
  injector: Injector,
  find: () => HTMLElement | null | undefined
): void {
  afterNextRender(
    () => {
      const target = find();
      if (!target) return;
      const active = target.ownerDocument.activeElement;
      if (active && active !== target.ownerDocument.body) return;
      target.focus();
    },
    { injector }
  );
}

import { afterNextRender, Injector } from '@angular/core';

/**
 * Call from a button's click handler (with its `$event`) before the action runs. A focused
 * button that its own action disables (Undo at the bottom of the history, Zoom out at the
 * minimum, Next on the last page) or removes (Remove part, closing a panel) drops keyboard
 * focus to the page body. Once the view has re-rendered, focus moves to the first enabled
 * button left in the button's group, else to `fallback()`.
 */
export function retainFocusAfterAction(
  event: Event,
  injector: Injector,
  fallback?: () => HTMLElement | null | undefined
): void {
  const from = event.currentTarget as HTMLButtonElement | null;
  const group = from?.parentElement;
  if (!from || !group) return;
  const doc = from.ownerDocument;
  if (doc.activeElement !== from) return;

  afterNextRender(
    {
      write: () => {
        if (from.isConnected && !from.disabled) return;
        const active = doc.activeElement;
        if (active && active !== from && active !== doc.body) return;
        const target =
          (group.isConnected ? group.querySelector<HTMLElement>('button:not([disabled])') : null) ??
          fallback?.();
        target?.focus();
      },
    },
    { injector }
  );
}

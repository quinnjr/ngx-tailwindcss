/**
 * Tab handling for panels portaled to the end of <body> (dropdown menu, popover),
 * which sit outside their trigger's place in the Tab sequence.
 *
 * Not part of the public API.
 */
const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Call from a keydown listener on the portaled panel.
 *
 * - Tab within the panel keeps its default behaviour, but does not propagate: a
 *   focus trap of an enclosing modal/sidebar (which listens on the document and sees
 *   focus outside itself) would otherwise pull focus back into the modal.
 * - Tab past the last (or Shift+Tab before the first) element leaves the panel:
 *   `exit` closes it and returns focus to the trigger, so Tab continues from the
 *   trigger instead of falling off the end of the document.
 */
export function handlePortalTab(panel: HTMLElement, event: KeyboardEvent, exit: () => void): void {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;

  const active = panel.ownerDocument.activeElement;
  if (!active || !panel.contains(active)) return;

  const tabbables = [...panel.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)];
  const edge = event.shiftKey ? tabbables[0] : tabbables.at(-1);
  if (edge && active !== edge) {
    event.stopPropagation();
    return;
  }

  exit();
  if (event.shiftKey) {
    // Stop on the trigger itself (the default action would move on to the element before it)
    event.preventDefault();
    event.stopPropagation();
  }
  // Forward Tab: the default action now moves on from the trigger
}

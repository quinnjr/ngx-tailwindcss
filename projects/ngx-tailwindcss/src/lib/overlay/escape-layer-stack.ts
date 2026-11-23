/**
 * Internal registry of open, Escape-dismissible layers (modal, sidebar, overlay,
 * popover, dropdown), in opening order. Only the topmost layer reacts to Escape,
 * so nested overlays close one at a time from the inside out.
 *
 * Layers listen for Escape in the bubble phase and ignore events whose default
 * was already prevented, so handlers inside the layer's content (e.g. a select
 * closing its listbox) can claim the key without the enclosing layer closing.
 *
 * Not part of the public API.
 */
const layers: object[] = [];

/** Registers (or moves to the top) an open layer. */
export function pushEscapeLayer(owner: object): void {
  removeEscapeLayer(owner);
  layers.push(owner);
}

/** Unregisters a layer; safe to call for layers that are not registered. */
export function removeEscapeLayer(owner: object): void {
  const index = layers.indexOf(owner);
  if (index !== -1) {
    layers.splice(index, 1);
  }
}

/** Whether the given layer is the topmost registered layer. */
export function isTopEscapeLayer(owner: object): boolean {
  return layers.at(-1) === owner;
}

/**
 * Whether the given layer should handle this keydown as its Escape: the key is
 * Escape, nothing inside has claimed it yet, and the layer is topmost.
 */
export function shouldHandleEscape(owner: object, event: Event): boolean {
  return (
    (event as KeyboardEvent).key === 'Escape' && !event.defaultPrevented && isTopEscapeLayer(owner)
  );
}

/**
 * Shared, reference-counted body scroll lock for modal layers (modal, sidebar,
 * overlay). The page stays locked while any layer holds the lock, and the
 * original `overflow` is restored only when the last one releases it, whatever
 * order the layers close in.
 *
 * Not part of the public API.
 */
interface LockState {
  owners: Set<object>;
  previousOverflow: string;
}

const locks = new WeakMap<Document, LockState>();

/** Locks body scrolling for `owner`; a no-op if `owner` already holds the lock. */
export function lockBodyScroll(document: Document, owner: object): void {
  let state = locks.get(document);
  if (!state) {
    state = { owners: new Set(), previousOverflow: '' };
    locks.set(document, state);
  }
  if (state.owners.has(owner)) return;
  if (state.owners.size === 0) {
    state.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  state.owners.add(owner);
}

/** Releases `owner`'s lock; safe to call for owners that do not hold it. */
export function unlockBodyScroll(document: Document, owner: object): void {
  const state = locks.get(document);
  if (!state?.owners.delete(owner)) return;
  if (state.owners.size === 0) {
    document.body.style.overflow = state.previousOverflow;
  }
}

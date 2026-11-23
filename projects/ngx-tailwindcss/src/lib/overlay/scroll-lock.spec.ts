import { afterEach, describe, expect, it } from 'vitest';
import { lockBodyScroll, unlockBodyScroll } from './scroll-lock';

describe('body scroll lock', () => {
  const a = {};
  const b = {};

  afterEach(() => {
    unlockBodyScroll(document, a);
    unlockBodyScroll(document, b);
    document.body.style.overflow = '';
  });

  it('restores the original overflow once the last owner releases, in any order', () => {
    document.body.style.overflow = 'auto';
    lockBodyScroll(document, a);
    lockBodyScroll(document, b);
    expect(document.body.style.overflow).toBe('hidden');

    unlockBodyScroll(document, a);
    expect(document.body.style.overflow).toBe('hidden');

    unlockBodyScroll(document, b);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('ignores repeated locks and releases by the same owner', () => {
    lockBodyScroll(document, a);
    lockBodyScroll(document, a);
    lockBodyScroll(document, b);
    unlockBodyScroll(document, a);
    unlockBodyScroll(document, a);
    expect(document.body.style.overflow).toBe('hidden');

    unlockBodyScroll(document, b);
    expect(document.body.style.overflow).toBe('');
  });
});

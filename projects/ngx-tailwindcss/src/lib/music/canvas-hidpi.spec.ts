import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDevicePixelRatio, prepareHiDpiCanvas, watchDevicePixelRatio } from './canvas-hidpi';

describe('prepareHiDpiCanvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setDpr(value: number): void {
    Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });
  }

  it('sizes the backing store by devicePixelRatio and scales the context', () => {
    setDpr(2);
    const canvas = document.createElement('canvas');
    const setTransform = vi.fn();
    const ctx = { setTransform } as unknown as CanvasRenderingContext2D;

    const dpr = prepareHiDpiCanvas(canvas, ctx, 300, 80);

    expect(dpr).toBe(2);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(160);
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('does not reassign an unchanged backing store (which would clear it)', () => {
    setDpr(1);
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 40;
    const widthSetter = vi.spyOn(canvas, 'width', 'set');
    const ctx = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;

    prepareHiDpiCanvas(canvas, ctx, 120, 40);

    expect(widthSetter).not.toHaveBeenCalled();
  });

  it('falls back to 1 for invalid ratios', () => {
    setDpr(0);
    expect(getDevicePixelRatio()).toBe(1);
    setDpr(Number.NaN);
    expect(getDevicePixelRatio()).toBe(1);
    setDpr(1);
  });
});

describe('watchDevicePixelRatio', () => {
  // The test setup defines window.matchMedia as writable but not configurable
  const originalMatchMedia = window.matchMedia;
  const setMatchMedia = (value: unknown): void => {
    (window as { matchMedia: unknown }).matchMedia = value;
  };

  afterEach(() => {
    setMatchMedia(originalMatchMedia);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('notifies on ratio changes, re-arms for the new ratio, and stops when disposed', () => {
    const queries: Array<{ media: string; listeners: Set<() => void> }> = [];
    setMatchMedia((media: string) => {
      const entry = { media, listeners: new Set<() => void>() };
      queries.push(entry);
      return {
        media,
        addEventListener: (_: string, l: () => void) => entry.listeners.add(l),
        removeEventListener: (_: string, l: () => void) => entry.listeners.delete(l),
      };
    });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    const onChange = vi.fn();

    const stop = watchDevicePixelRatio(onChange);
    expect(queries[0].media).toBe('(resolution: 1dppx)');

    // Browser zoom to 200%
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    [...queries[0].listeners].forEach(l => {
      l();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(queries[0].listeners.size).toBe(0);
    expect(queries[1].media).toBe('(resolution: 2dppx)');
    expect(queries[1].listeners.size).toBe(1);

    stop();
    expect(queries[1].listeners.size).toBe(0);
  });

  it('is a no-op without matchMedia', () => {
    setMatchMedia(undefined);
    expect(() => {
      watchDevicePixelRatio(() => {})();
    }).not.toThrow();
  });
});

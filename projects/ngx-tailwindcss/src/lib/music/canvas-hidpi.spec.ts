import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDevicePixelRatio, prepareHiDpiCanvas } from './canvas-hidpi';

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

/**
 * Shared helpers for sharp canvas rendering on high-DPI (retina) screens.
 *
 * The canvas backing store is sized in device pixels while the element keeps
 * its CSS size, and the context is scaled so that all drawing code (and any
 * pointer/hit-testing maths) keeps working in CSS pixels.
 */

/** Current device pixel ratio, or 1 outside the browser / for invalid values. */
export function getDevicePixelRatio(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/**
 * Size a canvas backing store for the device pixel ratio and scale the context
 * so subsequent drawing uses CSS-pixel coordinates (`cssWidth` x `cssHeight`).
 *
 * The backing store is only reassigned when its size actually changes
 * (assigning width/height clears the canvas and resets context state). The
 * transform is reapplied on every call, so it is safe to call once per frame.
 * The caller is responsible for the element's CSS size (e.g. via
 * `[style.width.px]`), which must not be bound through the width/height
 * attributes.
 *
 * @returns the device pixel ratio that was applied
 */
export function prepareHiDpiCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number
): number {
  const dpr = getDevicePixelRatio();
  const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
  const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== backingWidth) {
    canvas.width = backingWidth;
  }
  if (canvas.height !== backingHeight) {
    canvas.height = backingHeight;
  }

  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return dpr;
}

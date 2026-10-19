/**
 * Canvas renderer: paints the same rendered data toSvg() writes, so the two
 * never drift apart. Needs Path2D (every current browser; not Node).
 */
import type { RenderedLayer, RenderedScene } from "../render";

/** The subset of CanvasRenderingContext2D ridgescape uses. */
export type CanvasContext = Pick<CanvasRenderingContext2D, "canvas" | "fill" | "fillStyle" | "createLinearGradient" | "clearRect" | "save" | "restore" | "setTransform" | "scale">;

export interface DrawOptions {
  /** Device pixels per CSS px; the canvas must already be that much larger. Default 1. */
  pixelRatio?: number;
  /** Clear the canvas first. Default true. */
  clear?: boolean;
}

/** Paints one layer in element coordinates (CSS px). */
export function drawLayer(ctx: CanvasContext, layer: RenderedLayer): void {
  if (typeof layer.fill === "string") {
    ctx.fillStyle = layer.fill;
  } else {
    const gradient = ctx.createLinearGradient(0, layer.fill.y1, 0, layer.fill.y2);
    for (const stop of layer.fill.stops) gradient.addColorStop(stop.offset, stop.color);
    ctx.fillStyle = gradient;
  }
  ctx.fill(new Path2D(layer.d));
}

/** Paints layers (all of them by default) onto a canvas sized to the rendered scene. */
export function drawToCanvas(ctx: CanvasContext, rendered: RenderedScene | RenderedLayer[], { pixelRatio = 1, clear = true }: DrawOptions = {}): void {
  const layers = Array.isArray(rendered) ? rendered : rendered.layers;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (clear) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(pixelRatio, pixelRatio);
  for (const layer of layers) drawLayer(ctx, layer);
  ctx.restore();
}

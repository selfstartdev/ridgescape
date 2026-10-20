/**
 * Canvas renderer: paints the same rendered data toSvg() writes, so the two
 * never drift apart. Needs Path2D (every current browser; not Node).
 */
import { format, parseColor } from "../color";
import { mirrorClip } from "../lakes";
import type { Fill, MarkupOptions, RenderedLayer, RenderedScene, RenderedShape } from "../render";

/** The subset of CanvasRenderingContext2D ridgescape uses. */
export type CanvasContext = Pick<
  CanvasRenderingContext2D,
  "canvas" | "fill" | "fillStyle" | "globalAlpha" | "clip" | "transform" | "createLinearGradient" | "createRadialGradient" | "clearRect" | "save" | "restore" | "setTransform" | "scale"
>;

export interface DrawOptions {
  /** Device pixels per CSS px; the canvas must already be that much larger. Default 1. */
  pixelRatio?: number;
  /** Clear the canvas first. Default true. */
  clear?: boolean;
}

/** A colour or gradient as a canvas fill style. */
function fillStyle(ctx: CanvasContext, fill: Fill): string | CanvasGradient {
  if (typeof fill === "string") return fill;
  const gradient = fill.type === "radial" ? ctx.createRadialGradient(fill.cx, fill.cy, 0, fill.cx, fill.cy, fill.r) : ctx.createLinearGradient(fill.x1, fill.y1, fill.x2, fill.y2);
  for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.opacity === undefined || stop.opacity === 1 ? stop.color : withAlpha(stop.color, stop.opacity));
  return gradient;
}

/** `color` at `alpha`: rgba() when ridgescape can parse it, color-mix() for anything else. */
function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (c) return format({ ...c, a: c.a * alpha });
  return `color-mix(in srgb, ${color} ${Number((alpha * 100).toFixed(2))}%, transparent)`;
}

/** Paints one shape in element coordinates (CSS px). */
export function drawShape(ctx: CanvasContext, shape: RenderedShape): void {
  ctx.save();
  if (shape.clip) ctx.clip(new Path2D(shape.clip));
  if (shape.transform) ctx.transform(...shape.transform);
  if (shape.opacity !== undefined) ctx.globalAlpha *= shape.opacity;
  ctx.fillStyle = fillStyle(ctx, shape.fill);
  ctx.fill(new Path2D(shape.d));
  ctx.restore();
}

/** Paints one layer in element coordinates (CSS px). */
export function drawLayer(ctx: CanvasContext, layer: RenderedLayer, { clipMirrors = true }: MarkupOptions = {}): void {
  const clip = layer.mirror && clipMirrors;
  if (clip) {
    ctx.save();
    ctx.clip(new Path2D(mirrorClip(layer.mirror!.water)));
  }
  for (const shape of layer.shapes) drawShape(ctx, shape);
  if (clip) ctx.restore();
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

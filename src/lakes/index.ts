/**
 * Water: a lake's surface and what shows in it. Everything already drawn behind
 * the lake's layer (sky, sun, clouds, far ridges) is mirrored across the
 * waterline and clipped to the water, then tinted (more so further down, as
 * water darkens with depth), with a bright shoreline and a few ripple streaks.
 *
 * A lake's layer is drawn as three parts: its ground with the plain water, one
 * reflection layer for each depth it mirrors (so parallax can move each the
 * opposite way to what it mirrors), then the surface over them.
 */
import { mix } from "../color";
import type { WaterSpan } from "../outline";
import { createRandom } from "../random";
import { capsulePath, rectPath } from "../render/paths";
import type { Matrix, Rect, RenderContext, RenderedLayer, RenderedShape } from "../render/types";
import type { Lake } from "../spec/types";

/** How clear a reflecting lake is: how much of the reflection shows through the tint. */
const CLARITY = 0.6;
/** Ripple streaks per 22px of water. */
const RIPPLES = 0.5;

export interface LakeSpan {
  span: WaterSpan;
  lake: Lake;
  /** Seed for the ripples: the same for every repeat of a lake. */
  seed: string;
}

/** The plain water under each span, drawn with the layer's ground. */
export function waterBase(spans: LakeSpan[], bottom: number, ctx: RenderContext): RenderedShape[] {
  return spans.map(({ span, lake }) => ({ d: rectPath(span.x0, span.y, span.x1, bottom, ctx.fmt), fill: lake.color }));
}

/**
 * Reflections: every shape behind, mirrored at the waterline (y → 2·waterline − y), one layer per
 * depth. Other lakes' reflections and clipped shapes (shorelines, ripples) aren't mirrored again.
 */
export function reflectionLayers(spans: LakeSpan[], behind: RenderedLayer[], bottom: number, key: string, index: number, depth: number, ctx: RenderContext): RenderedLayer[] {
  const out: RenderedLayer[] = [];
  // Spans on one layer share a waterline (lakes on one layer can have different levels: one set per level).
  const byLevel = new Map<number, Rect[]>();
  for (const { span, lake } of spans) {
    if (!lake.reflection) continue;
    const rects = byLevel.get(span.y) ?? [];
    rects.push([span.x0, span.y, span.x1, bottom]);
    byLevel.set(span.y, rects);
  }
  for (const [y, water] of byLevel) {
    const mirror: Matrix = [1, 0, 0, -1, 0, ctx.round(2 * y)];
    const byDepth = new Map<number, RenderedShape[]>();
    for (const layer of behind) {
      if (layer.mirror) continue;
      for (const s of layer.shapes) {
        if (s.clip || s.transform) continue;
        const shapes = byDepth.get(layer.depth) ?? [];
        shapes.push({ d: s.d, fill: s.fill, ...(s.opacity !== undefined ? { opacity: s.opacity } : {}), transform: mirror });
        byDepth.set(layer.depth, shapes);
      }
    }
    for (const [source, shapes] of byDepth) {
      out.push({
        key: `${key}-${out.length}`,
        kind: "reflection",
        index,
        depth,
        shapes,
        top: ctx.round(y),
        mirror: { depth: source, water: water.map((r) => r.map(ctx.round) as Rect) },
      });
    }
  }
  return out;
}

/** The surface over the reflections: the tint, a bright shoreline and ripples. */
export function waterSurface(spans: LakeSpan[], bottom: number, ctx: RenderContext): RenderedShape[] {
  const shapes: RenderedShape[] = [];
  for (const { span, lake, seed } of spans) {
    const { x0, x1, y } = span;
    const water = rectPath(x0, y, x1, bottom, ctx.fmt);

    // Tint: thin at the surface, thicker with depth. Without a reflection, it's the water's own colour.
    const depth = Math.max(40, (ctx.height - y) * 0.6);
    const clear = lake.reflection ? CLARITY : 0;
    const tint = {
      y1: ctx.round(y),
      y2: ctx.round(y + depth),
      stops: [
        { offset: 0, color: lake.color, opacity: ctx.round(0.5 * (1 - clear) + 0.1) },
        { offset: 1, color: lake.color, opacity: ctx.round(Math.min(1, 1 - 0.45 * clear)) },
      ],
    };
    shapes.push({ d: water, fill: { type: "linear", id: ctx.id(tint), x1: 0, x2: 0, ...tint } });

    // A bright line where the water meets the shore behind it.
    const light = mix(lake.color, "#ffffff", 0.55);
    shapes.push({ d: capsulePath(x0, y - 0.6, x1, y + 0.9, ctx.fmt), fill: light, opacity: 0.55, clip: water });

    if (lake.ripples) {
      // The same ripples in every repeat of the lake: positions relative to its left shore.
      const random = createRandom(seed);
      const width = x1 - x0;
      const count = Math.round((RIPPLES * width) / 22);
      let d = "";
      for (let i = 0; i < count; i++) {
        // Bunched toward the surface, longer further down (closer to the viewer).
        const down = 3 + random.next() ** 1.6 * Math.min(depth, 140);
        const length = random.range(8, 46) * (1 + down / 70);
        const cx = x0 + random.next() * width;
        const thick = random.range(0.9, 1.6);
        d += capsulePath(cx - length / 2, y + down, cx + length / 2, y + down + thick, ctx.fmt);
      }
      if (d) shapes.push({ d, fill: light, opacity: ctx.round(0.2 + 0.35 * RIPPLES), clip: water });
    }
  }
  return shapes;
}

/** A mirror's water as one clip path, shifted down by dy. */
export function mirrorClip(water: Rect[], dy = 0, fmt: RenderContext["fmt"] = (n) => String(Math.round(n * 100) / 100 + 0)): string {
  return water.map(([x0, y0, x1, y1]) => rectPath(x0, y0 + dy, x1, y1 + dy, fmt)).join("");
}

/**
 * Water: a lake's surface and what shows in it. Everything already drawn behind
 * the lake's layer (sky, sun, clouds, far ridges) is mirrored across the
 * waterline and clipped to the water, then tinted (more so further down, as
 * water darkens with depth), with a bright shoreline and a few ripple streaks.
 * All of it is plain shapes, so SVG and canvas draw it the same way.
 */
import { mix } from "../color";
import type { WaterSpan } from "../outline";
import { createRandom } from "../random";
import { capsulePath, rectPath } from "../render/paths";
import type { Matrix, RenderContext, RenderedLayer, RenderedShape } from "../render/types";
import type { Lake } from "../spec/types";

/** Shapes for one stretch of water, given every layer drawn before it. */
export function waterShapes(span: WaterSpan, lake: Lake, behind: RenderedLayer[], bottom: number, seed: string, ctx: RenderContext): RenderedShape[] {
  const { x0, x1, y } = span;
  const water = rectPath(x0, y, x1, bottom, ctx.fmt);
  const shapes: RenderedShape[] = [{ d: water, fill: lake.color }];

  // Reflections: y → 2·waterline − y. Shapes that are already reflections (clipped) aren't mirrored again.
  if (lake.reflection > 0) {
    const mirror: Matrix = [1, 0, 0, -1, 0, ctx.round(2 * y)];
    for (const layer of behind) {
      for (const s of layer.shapes) {
        if (s.clip || s.transform) continue;
        shapes.push({ d: s.d, fill: s.fill, ...(s.opacity !== undefined ? { opacity: s.opacity } : {}), clip: water, transform: mirror });
      }
    }
  }

  // Tint: thin at the surface, thicker with depth.
  const depth = Math.max(40, (ctx.height - y) * 0.6);
  const clear = lake.reflection;
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

  if (lake.ripples > 0) {
    // The same ripples in every repeat of the lake: positions relative to its left shore.
    const random = createRandom(seed);
    const width = x1 - x0;
    const count = Math.round((lake.ripples * width) / 22);
    let d = "";
    for (let i = 0; i < count; i++) {
      // Bunched toward the surface, longer further down (closer to the viewer).
      const down = 3 + random.next() ** 1.6 * Math.min(depth, 140);
      const length = random.range(8, 46) * (1 + down / 70);
      const cx = x0 + random.next() * width;
      const thick = random.range(0.9, 1.6);
      d += capsulePath(cx - length / 2, y + down, cx + length / 2, y + down + thick, ctx.fmt);
    }
    if (d) shapes.push({ d, fill: light, opacity: ctx.round(0.2 + 0.35 * lake.ripples), clip: water });
  }
  return shapes;
}

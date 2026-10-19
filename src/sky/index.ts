/**
 * Sky: a gradient behind everything, stars, and a sun or moon with a soft glow.
 * The gradient doesn't move with parallax (moving it would uncover its edge);
 * the stars, sun and moon are as far away as anything gets.
 */
import { createRandom } from "../random";
import { circlePath, rectPath } from "../render/paths";
import type { RenderContext, RenderedLayer, RenderedShape } from "../render/types";
import { resolveLength } from "../spec/length";
import type { Moon, Sky, Stars, Sun } from "../spec/types";

/** Stars repeat in tiles this many px square, so they don't depend on the element's size. */
const STAR_TILE = 1024;

export function skyLayers(sky: Sky, ctx: RenderContext): RenderedLayer[] {
  const layers: RenderedLayer[] = [];
  if (sky.gradient) {
    const [top, bottom] = sky.gradient;
    const content = { y1: 0, y2: ctx.height, stops: [{ offset: 0, color: top }, { offset: 1, color: bottom }] };
    layers.push({
      key: "sky",
      kind: "sky",
      index: 0,
      depth: 0,
      shapes: [{ d: rectPath(0, 0, ctx.width, ctx.height + ctx.overscan, ctx.fmt), fill: { type: "linear", id: ctx.id(content), x1: 0, x2: 0, ...content } }],
      top: 0,
    });
  }
  if (sky.stars) layers.push(starsLayer(sky.stars, ctx));
  if (sky.sun) layers.push(discLayer("sun", sky.sun, ctx, discPath(sky.sun, ctx)));
  if (sky.moon) layers.push(discLayer("moon", sky.moon, ctx, moonPath(sky.moon, ctx)));
  return layers;
}

function starsLayer(stars: Stars, ctx: RenderContext): RenderedLayer {
  const area = resolveLength(stars.area, ctx.height);
  const random = createRandom(stars.seed);
  const count = Math.round((stars.density * STAR_TILE * STAR_TILE) / 10000);
  // One tile of stars, in three brightnesses.
  const tile = Array.from({ length: count }, () => ({
    u: random.next() * STAR_TILE,
    v: random.next() * STAR_TILE,
    r: (0.5 + random.next() * 1.1) * stars.size,
    bucket: Math.floor(random.next() * 3),
    keep: random.next(),
  }));
  const paths = ["", "", ""];
  for (let ty = 0; ty * STAR_TILE < area; ty++) {
    for (let tx = 0; tx * STAR_TILE < ctx.width; tx++) {
      for (const s of tile) {
        const x = tx * STAR_TILE + s.u;
        const y = ty * STAR_TILE + s.v;
        // Thinning out toward the bottom of the area, so stars fade rather than stop.
        if (x > ctx.width + 2 || y > area || s.keep < (y / area) ** 2) continue;
        paths[s.bucket] += circlePath(x, y, s.r, ctx.fmt);
      }
    }
  }
  const opacities = [0.45, 0.7, 1];
  const shapes: RenderedShape[] = paths.flatMap((d, i) => (d ? [{ d, fill: stars.color, opacity: opacities[i] }] : []));
  return { key: "stars", kind: "stars", index: 0, depth: 1, shapes, top: 0 };
}

function center(disc: Sun, ctx: RenderContext) {
  return { x: resolveLength(disc.at[0], ctx.width), y: resolveLength(disc.at[1], ctx.height) };
}

function discPath(sun: Sun, ctx: RenderContext): string {
  const c = center(sun, ctx);
  return circlePath(c.x, c.y, sun.radius, ctx.fmt);
}

/**
 * The lit part of the moon: its disc minus an equal disc shifted to the right.
 * Full at crescent 0, a sliver at 1.
 */
function moonPath(moon: Moon, ctx: RenderContext): string {
  const { x, y } = center(moon, ctx);
  const r = moon.radius;
  const offset = r * (2 - 1.7 * moon.crescent);
  if (offset >= 2 * r) return circlePath(x, y, r, ctx.fmt);
  const ix = x + offset / 2;
  const h = Math.sqrt(r * r - (offset / 2) ** 2);
  const { fmt } = ctx;
  const R = fmt(r);
  // Top intersection → round the left of the moon → bottom intersection → back up the shadow's edge.
  return `M${fmt(ix)} ${fmt(y - h)}A${R} ${R} 0 1 0 ${fmt(ix)} ${fmt(y + h)}A${R} ${R} 0 0 1 ${fmt(ix)} ${fmt(y - h)}Z`;
}

function discLayer(kind: "sun" | "moon", disc: Sun, ctx: RenderContext, d: string): RenderedLayer {
  const c = center(disc, ctx);
  const shapes: RenderedShape[] = [];
  if (disc.glow > 0) {
    const R = disc.radius * (1 + 3.5 * disc.glow);
    const content = {
      cx: ctx.round(c.x),
      cy: ctx.round(c.y),
      r: ctx.round(R),
      stops: [
        { offset: 0, color: disc.color, opacity: 0.6 * disc.glow },
        { offset: ctx.round(disc.radius / R), color: disc.color, opacity: 0.45 * disc.glow },
        { offset: 1, color: disc.color, opacity: 0 },
      ],
    };
    shapes.push({ d: circlePath(c.x, c.y, R, ctx.fmt), fill: { type: "radial", id: ctx.id(content), ...content } });
  }
  shapes.push({ d, fill: disc.color });
  return { key: kind, kind, index: 0, depth: 1, shapes, top: ctx.round(c.y - disc.radius * (1 + 3.5 * disc.glow)) };
}


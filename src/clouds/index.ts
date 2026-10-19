/**
 * Clouds: rows ("bands") at different depths, each a single path of clouds that
 * repeats horizontally like the ground does. Puffy clouds are a flat-bottomed
 * pill with round puffs on top; streaks are a few long, thin lenses. Every piece
 * is drawn clockwise, so one path fills as their union and overlaps don't darken.
 */
import { mix } from "../color";
import { createRandom, type Random } from "../random";
import { capsulePath, circlePath } from "../render/paths";
import type { RenderContext, RenderedLayer } from "../render/types";
import { resolveLength } from "../spec/length";
import type { Clouds, Palette } from "../spec/types";

/** One cloud, in px, centred on x with its base at y. */
interface Cloud {
  x: number;
  y: number;
  width: number;
  random: Random;
}

export function cloudLayers(clouds: Clouds, palette: Palette, ctx: RenderContext): RenderedLayer[] {
  const top = resolveLength(clouds.top, ctx.height);
  const bottom = resolveLength(clouds.bottom, ctx.height);
  const layers: RenderedLayer[] = [];
  for (let i = 0; i < clouds.bands; i++) {
    // 0 for the back (highest, smallest, hazier) row, 1 for the front.
    const t = clouds.bands > 1 ? i / (clouds.bands - 1) : 1;
    const random = createRandom(clouds.seed).fork("band", i);
    const size = clouds.size * (0.55 + 0.45 * t);
    const base = top + (bottom - top) * t;
    const period = 2400 + 300 * i;
    const count = Math.max(1, Math.round((clouds.cover * period) / size));
    const slot = period / count;
    const tile: Cloud[] = Array.from({ length: count }, (_, k) => ({
      x: (k + 0.5 + random.range(-0.35, 0.35)) * slot,
      y: base + random.range(-0.15, 0.15) * size,
      width: size * random.range(0.6, 1.4),
      random: random.fork("cloud", k),
    }));

    let d = "";
    let highest = Infinity;
    for (let copy = -1; copy * period < ctx.width + size * 2; copy++) {
      for (const c of tile) {
        const x = c.x + copy * period;
        if (x + c.width < 0 || x - c.width > ctx.width) continue;
        // Each copy draws the same cloud: a fresh stream per copy would break the repeat.
        const piece = clouds.style === "streaks" ? streaks({ ...c, x, random: c.random.fork("shape") }, ctx) : puffy({ ...c, x, random: c.random.fork("shape") }, ctx);
        d += piece.d;
        highest = Math.min(highest, piece.top);
      }
    }
    if (!d) continue;

    // Further rows sink into the haze; undersides are shaded toward the far colour.
    const color = mix(clouds.color, palette.haze, 0.35 * (1 - t));
    const content = {
      y1: ctx.round(base - size * 0.45),
      y2: ctx.round(base + size * 0.05),
      stops: [
        { offset: 0, color },
        { offset: 1, color: mix(color, palette.far, clouds.shade) },
      ],
    };
    const fill = clouds.shade > 0 ? ({ type: "linear", id: ctx.id(content), x1: 0, x2: 0, ...content } as const) : color;
    layers.push({
      key: `clouds-${i}`,
      kind: "clouds",
      index: i,
      depth: Number((1 - 0.15 * t).toFixed(4)),
      shapes: [{ d, fill, ...(clouds.opacity < 1 ? { opacity: clouds.opacity } : {}) }],
      top: ctx.round(highest),
    });
  }
  return layers;
}

function puffy({ x, y, width, random }: Cloud, ctx: RenderContext) {
  const base = width * 0.14;
  const x0 = x - width / 2;
  let d = capsulePath(x0, y - base, x0 + width, y, ctx.fmt);
  let top = y - base;
  const puffs = 3 + Math.floor(random.next() * 3);
  for (let j = 0; j < puffs; j++) {
    const u = (j + 0.5) / puffs;
    // Bigger in the middle; each one rests on the base without poking out below it.
    const r = width * (0.09 + 0.12 * Math.sin(Math.PI * u)) * random.range(0.85, 1.15);
    const cx = x0 + width * (0.12 + 0.76 * u) + random.range(-0.04, 0.04) * width;
    const cy = y - base / 2 - r * 0.75;
    d += circlePath(cx, cy, r, ctx.fmt);
    top = Math.min(top, cy - r);
  }
  return { d, top };
}

function streaks({ x, y, width, random }: Cloud, ctx: RenderContext) {
  const { fmt } = ctx;
  let d = "";
  let top = y;
  const count = 1 + Math.floor(random.next() * 3);
  for (let j = 0; j < count; j++) {
    const length = width * random.range(0.5, 1.2);
    const h = width * random.range(0.018, 0.04);
    const cx = x + random.range(-0.25, 0.25) * width;
    const by = y - j * width * 0.07;
    // A lens with pointed ends: a full curve over the top, a flatter one underneath, peaking off-centre.
    const peak = cx + random.range(-0.2, 0.2) * length;
    const x0 = cx - length / 2, x1 = cx + length / 2;
    d += `M${fmt(x0)} ${fmt(by)}Q${fmt(peak)} ${fmt(by - 2 * h)} ${fmt(x1)} ${fmt(by)}Q${fmt(peak)} ${fmt(by + 0.5 * h)} ${fmt(x0)} ${fmt(by)}Z`;
    top = Math.min(top, by - h);
  }
  return { d, top };
}

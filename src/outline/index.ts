/**
 * Outlines: a layer's profile laid across the element at its real size, with
 * anchors blended in and trees merged on top, simplified, and closed down past
 * the bottom edge. One closed polygon per layer, however wide the element.
 */
import { buildProfile } from "../profile";
import { placeTrees, treeHeightAt, treeKeyPoints, type Tree } from "../trees";
import { resolveLength, type Size } from "../spec/length";
import type { Anchor, Lake, Layer } from "../spec/types";

export interface Vec {
  x: number;
  y: number;
}

export interface Outline {
  /** Crest points, left to right, in element coordinates (y down), trees included. */
  crest: Vec[];
  /** The crest without its trees, when the layer has any. */
  ground?: Vec[];
  /** Highest point of the crest (smallest y). */
  top: number;
  /** y of the layer's baseline (its lowest valleys, before anchors). */
  baseline: number;
  /** Where the polygon closes, below the bottom edge. */
  bottom: number;
  /** Stretches of water on this layer within the element, left to right. */
  water: WaterSpan[];
}

export interface WaterSpan {
  /** Index into the layer's lakes. */
  lake: number;
  /** Which repeat of the layer it's in (0 for the first). */
  copy: number;
  x0: number;
  x1: number;
  /** y of the water surface. */
  y: number;
}

export interface OutlineOptions {
  /** Extra px below the element the polygon reaches, for parallax. Default 0. */
  overscan?: number;
  /** Max deviation, in px, when dropping crest points. Default 0.25. */
  tolerance?: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function buildOutline(layer: Layer, size: Size, { overscan = 0, tolerance = 0.25 }: OutlineOptions = {}): Outline {
  const profile = buildProfile(layer);
  const { step, values, period } = profile;
  const count = values.length;
  const baseline = resolveLength(layer.baseline, size.height);
  const amplitude = resolveLength(layer.amplitude, size.height);
  // Height of the profile itself at x, between samples.
  const profileAt = (x: number) => {
    const u = x / step;
    const i = Math.floor(u);
    const a = values[mod(i, count)]!, b = values[mod(i + 1, count)]!;
    return baseline + amplitude * (a + (b - a) * (u - i));
  };
  const pointed = layer.profile === "peaks";
  const anchors = layer.anchors.map((a) => anchorShape(a, size, period, profileAt, pointed));
  const lakes = layer.lakes.map((l) => lakeShape(l, size, period, baseline));
  // Anchors first, then lakes level what's under their water.
  const adjust = (x: number, h: number) => {
    for (const a of anchors) h = a(x, h, baseline);
    for (const l of lakes) h = l.adjust(x, h);
    return h;
  };
  const water = waterSpans(lakes, size, period);
  // Extra samples either side of every shore: the bed and the bank meet in a step there, and
  // without them the slope between grid samples could dip under the water just past the shore.
  const shores = water.filter((w) => !lakes[w.lake]!.endless).flatMap((w) => [w.x0 - SHORE, w.x0 + SHORE, w.x1 - SHORE, w.x1 + SHORE]);

  const bottom = size.height + Math.max(0, overscan);
  const last = Math.ceil((size.width + step) / step);
  if (layer.trees) {
    const groundAt = (x: number) => adjust(x, profileAt(x));
    const dry = (x: number) => lakes.every((l) => !l.wet(x));
    const { crest, ground } = withTrees(layer, size, step, last, groundAt, dry, period, tolerance, shores);
    return { crest, ground, top: topOf(crest), baseline: size.height - baseline, bottom, water };
  }

  // Samples sit on the profile's own grid (x = i × step), so a wider element only adds samples at the ends.
  const first = -1;
  const points: Vec[] = [];
  for (let i = first; i <= last; i++) {
    const x = i * step;
    const h = adjust(x, baseline + amplitude * values[mod(i, count)]!);
    points.push({ x, y: size.height - h });
  }
  for (const x of shores) if (x > first * step && x < last * step) points.push({ x, y: size.height - adjust(x, profileAt(x)) });
  points.sort((a, b) => a.x - b.x);
  const crest = simplifyKeeping(points, tolerance, new Set(shores));
  return { crest, top: topOf(crest), baseline: size.height - baseline, bottom, water };
}

interface LakeShape {
  center: number;
  half: number;
  /** Too wide to leave land between its repeats: water all the way across. */
  endless: boolean;
  /** Water surface height above the bottom. */
  level: number;
  adjust: (x: number, h: number) => number;
  /** Within the lake or its banks: no trees here. */
  wet: (x: number) => boolean;
}

/** The lake bed sits this far under the water, so the ground never peeks through. */
const LAKE_BED = 3;
/** Banks rise this far above the water at the shore. */
const BANK = 3;
/** How far either side of a shore its extra samples sit, px: well under the output precision. */
const SHORE = 0.001;
/** The least land, px, between a lake's repeats beyond its two banks. */
const MIN_LAND = 60;

/**
 * A lake: the ground is held just under the water across its width, then rises to a small bank at
 * each shore and eases back into the terrain.
 */
function lakeShape(lake: Lake, size: Size, period: number, baseline: number): LakeShape {
  const center = resolveLength(lake.at, size.width);
  const width = resolveLength(lake.width, size.width);
  const half = Math.min(period / 2 - 1, Math.max(1, width / 2));
  const level = baseline + resolveLength(lake.level, size.height);
  const bank = Math.min(Math.max(half * 0.3, 10), 80);
  // Covering the whole element (`at: "50%", width: "100%"`), or so wide that the land between
  // repeats would be just a seam (less than two banks and a bit of shore): the water carries on
  // all the way across.
  const endless = (center - width / 2 <= 0 && center + width / 2 >= size.width) || period - 2 * half < 2 * bank + MIN_LAND;
  const distance = (x: number) => {
    const d = mod(x - center, period);
    return Math.min(d, period - d);
  };
  return {
    center,
    half,
    endless,
    level,
    adjust(x, h) {
      if (endless) return level - LAKE_BED;
      const d = distance(x);
      if (d <= half) return level - LAKE_BED;
      if (d >= half + bank) return h;
      const t = (d - half) / bank;
      const ease = t * t * (3 - 2 * t);
      // From the bank's top at the shore to the terrain, whichever way the terrain lies.
      return level + BANK + (h - level - BANK) * ease;
    },
    wet: (x) => endless || distance(x) < half + bank * 0.5,
  };
}

/** Every repeat of every lake that shows within the element. */
function waterSpans(lakes: LakeShape[], size: Size, period: number): WaterSpan[] {
  const spans: WaterSpan[] = [];
  lakes.forEach((l, lake) => {
    if (l.endless) {
      spans.push({ lake, copy: 0, x0: -1, x1: size.width + 1, y: size.height - l.level });
      return;
    }
    const start = Math.floor((-l.half - l.center) / period);
    for (let copy = start; l.center + copy * period - l.half < size.width; copy++) {
      const x0 = l.center + copy * period - l.half;
      const x1 = l.center + copy * period + l.half;
      if (x1 < 0) continue;
      spans.push({ lake, copy, x0, x1, y: size.height - l.level });
    }
  });
  return spans.sort((a, b) => a.x0 - b.x0);
}

function topOf(points: Vec[]): number {
  let top = Infinity;
  for (const p of points) if (p.y < top) top = p.y;
  return top;
}

/** Samples per profile step on layers with trees: about 1px, so narrow trees keep their shape. */
const TREE_SUBSTEPS = 4;

/**
 * The crest with trees merged on top: sampled every ~1px plus every tree's tips and corners, then
 * each tree raises the samples it covers to its own outline.
 */
function withTrees(
  layer: Layer,
  size: Size,
  step: number,
  last: number,
  groundAt: (x: number) => number,
  dry: (x: number) => boolean,
  period: number,
  tolerance: number,
  shores: number[],
) {
  const trees = placeTrees({ trees: layer.trees!, height: resolveLength(layer.trees!.height, size.height), period });
  const x0 = -step, x1 = last * step;
  const placed: { tree: Tree; x: number; foot: number }[] = [];
  const widest = trees.reduce((m, t) => Math.max(m, t.width), 0);
  for (let copy = Math.floor((x0 - widest) / period); copy * period < x1 + widest; copy++) {
    for (const tree of trees) {
      const x = tree.x + copy * period;
      const half = tree.width / 2;
      if (x + half < x0 || x - half > x1) continue;
      if (!dry(x - half) || !dry(x) || !dry(x + half)) continue;
      // Not on cliffs: a tree there would hang in the air on its downhill side.
      if (Math.abs(groundAt(x + half) - groundAt(x - half)) > tree.width) continue;
      // Feet a little into the ground, so the slope under a tree never shows a gap.
      placed.push({ tree, x, foot: groundAt(x) - 0.08 * tree.height });
    }
  }

  const xs: number[] = [];
  for (let i = -TREE_SUBSTEPS; i <= last * TREE_SUBSTEPS; i++) xs.push((i / TREE_SUBSTEPS) * step);
  for (const p of placed) for (const dx of treeKeyPoints(p.tree)) if (p.x + dx > x0 && p.x + dx < x1) xs.push(p.x + dx);
  for (const x of shores) if (x > x0 && x < x1) xs.push(x);
  xs.sort((a, b) => a - b);

  const ground = xs.map(groundAt);
  const heights = ground.slice();
  for (const p of placed) {
    const half = p.tree.width / 2;
    for (let j = lowerBound(xs, p.x - half); j < xs.length && xs[j]! <= p.x + half; j++) {
      const h = p.foot + treeHeightAt(p.tree, xs[j]! - p.x);
      if (h > heights[j]!) heights[j] = h;
    }
  }
  const fixed = new Set(shores);
  const toPoints = (hs: number[]) => simplifyKeeping(xs.map((x, j) => ({ x, y: size.height - hs[j]! })), tolerance, fixed);
  return { crest: toPoints(heights), ground: toPoints(ground) };
}

/** First index with xs[i] >= x. */
function lowerBound(xs: number[], x: number): number {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * An anchor as a function from (x, height) to the adjusted height.
 *
 * Peaks and dips lift or lower the terrain as a whole, so its detail rides along and the summit is
 * still craggy; on a "peaks" layer the lift comes to a point. Flat anchors replace the terrain with
 * a level stretch over the middle half of their width.
 */
function anchorShape(
  anchor: Anchor,
  size: Size,
  period: number,
  profileAt: (x: number) => number,
  pointed: boolean,
): (x: number, h: number, baseline: number) => number {
  const at = resolveLength(anchor.at, size.width);
  const radius = Math.min(period / 2, Math.max(1, resolveLength(anchor.width, size.width) / 2));
  const height = resolveLength(anchor.height, size.height);
  const flat = anchor.kind === "flat";
  const inner = flat ? radius / 2 : 0;
  const lift = pointed && anchor.kind === "peak";
  const center = profileAt(at);
  return (x, h, baseline) => {
    let d = mod(x - at, period);
    d = Math.min(d, period - d);
    if (d >= radius) return h;
    const t = d <= inner ? 0 : (d - inner) / (radius - inner);
    // Pointed: steep near the top, easing out at the foot. Otherwise a raised cosine.
    const w = lift ? (1 - t) ** 2 * (1 + 2 * t) * (1 - t) ** 0.6 : 0.5 * (1 + Math.cos(Math.PI * t));
    return flat ? h + w * (baseline + height - h) : h + w * (baseline + height - center);
  };
}

/** simplify(), always keeping the points at the given xs (a shore's near-vertical step is thinner than the tolerance). */
function simplifyKeeping(points: Vec[], tolerance: number, xs: Set<number>): Vec[] {
  if (xs.size === 0 || points.length < 3) return simplify(points, tolerance);
  const out: Vec[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (i < points.length - 1 && !xs.has(points[i]!.x)) continue;
    const piece = simplify(points.slice(start, i + 1), tolerance);
    out.push(...(out.length > 0 ? piece.slice(1) : piece));
    start = i;
  }
  return out;
}

/** Ramer–Douglas–Peucker: drops points within `tolerance` px of the line through their neighbours. */
export function simplify(points: Vec[], tolerance: number): Vec[] {
  if (points.length < 3 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const p = points[a]!, q = points[b]!;
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1, index = -1;
    for (let i = a + 1; i < b; i++) {
      const r = points[i]!;
      const dist = Math.abs(dy * (r.x - p.x) - dx * (r.y - p.y)) / len;
      if (dist > worst) {
        worst = dist;
        index = i;
      }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

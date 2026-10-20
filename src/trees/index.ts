/**
 * Trees: placed once per layer along its repeat width (so they repeat with
 * it), then merged into the crest as an upper envelope, so a forest is still
 * part of the layer's one silhouette.
 *
 * Each tree picks a shape from the layer's mix and is built from a few parts:
 * cones (straight or curved sides) and domes (round or sloping tops). Layers
 * are heights, so there's nothing to see under a crown: every shape rises from
 * the ground at its feet, and a dense row reads as a forest edge.
 */
import { periodicNoise } from "../profile/noise";
import type { Random } from "../random";
import { createRandom } from "../random";
import type { TreeShape, Trees } from "../spec/types";

export type TreePart =
  /** A spire: `base` at its corners rising to `apex` at `offset`; bend > 1 curves the sides in. */
  | { type: "cone"; offset: number; left: number; right: number; base: number; apex: number; bend: number }
  /** A crown: `base` at its edges rising to `height` at `offset`; power 0.5 is a half ellipse, 1 a parabola. */
  | { type: "dome"; offset: number; radius: number; base: number; height: number; power: number };

export interface Tree {
  /** Centre, in the layer's repeat width. */
  x: number;
  kind: "conifer" | "deciduous";
  shape: TreeShape;
  height: number;
  /** Full width at the base: twice the furthest reach from x. */
  width: number;
  parts: TreePart[];
}

export interface TreeOptions {
  trees: Trees;
  /** The tree height in px (Trees.height resolved against the element). */
  height: number;
  /** The layer's repeat width. */
  period: number;
}

interface ShapeSpec {
  kind: Tree["kind"];
  /** Typical width as a share of the height, for spacing. */
  width: number;
  /** Height relative to the others when mixed: broad crowns stand a little lower than spires. */
  scale: number;
  build(h: number, r: Random): TreePart[];
}

/** Jitter a half-width into left and right, so trees aren't mirror images. */
const lean = (half: number, r: Random) => {
  const s = r.range(-0.1, 0.1);
  return { left: half * (1 + s), right: half * (1 - s) };
};

const SHAPES: Record<TreeShape, ShapeSpec> = {
  // A narrow triangle with jagged sides: short tiers of branches, each one's tips poking out past
  // the line of the tree, more of them on bigger trees.
  spruce: {
    kind: "conifer",
    width: 0.42,
    scale: 1,
    build(h, r) {
      const half = h * 0.2 * r.range(0.85, 1.15);
      const sides = lean(half, r);
      const n = Math.max(1, Math.min(9, Math.round(h / 8)));
      const step = (h * 0.85) / n;
      const parts: TreePart[] = [];
      for (let k = 0; k < n; k++) {
        const base = step * k;
        const out = (1 - base / h) * r.range(1.08, 1.25);
        parts.push({ type: "cone", offset: 0, left: sides.left * out, right: sides.right * out, base, apex: Math.min(h, base + step * 2.4), bend: 1 });
      }
      // The top: a clean spire above the last tier.
      parts.push({ type: "cone", offset: 0, left: sides.left * 0.3, right: sides.right * 0.3, base: h * 0.7, apex: h, bend: 1 });
      return parts;
    },
  },
  // One smooth, narrow spire with gently curved sides.
  fir: {
    kind: "conifer",
    width: 0.36,
    scale: 1.05,
    build: (h, r) => [{ type: "cone", offset: 0, ...lean(h * 0.2 * r.range(0.85, 1.15), r), base: 0, apex: h, bend: r.range(1.05, 1.2) }],
  },
  // Ragged and round-shouldered: a broad body with flat-topped clumps along its top. Each clump
  // stays inside the body where it stands (anything wider would drop to the ground as a column).
  pine: {
    kind: "conifer",
    width: 0.62,
    scale: 0.95,
    build(h, r) {
      const radius = h * 0.28 * r.range(0.85, 1.15);
      const body = h * 0.8;
      const parts: TreePart[] = [{ type: "dome", offset: 0, radius, base: 0, height: body, power: 1 }];
      const halfAt = (y: number) => (y >= body ? 0 : radius * Math.sqrt(1 - y / body));
      const clumps = h < 16 ? 1 : r.int(3, 5);
      for (let k = 0; k < clumps; k++) {
        const top = k === 0 ? h : h * r.range(0.62, 0.9);
        const base = top - h * (k === 0 ? 0.3 : r.range(0.14, 0.2));
        const room = halfAt(base);
        const offset = k === 0 ? room * r.range(-0.25, 0.25) : room * r.range(0.2, 0.6) * (r.next() < 0.5 ? -1 : 1);
        const size = (room - Math.abs(offset)) * r.range(0.8, 0.95);
        if (size > 0.8) parts.push({ type: "dome", offset, radius: size, base, height: top, power: 0.3 });
      }
      return parts;
    },
  },
  // A tall, narrow column with a rounded point.
  cypress: {
    kind: "conifer",
    width: 0.26,
    scale: 1.1,
    build(h, r) {
      const half = h * 0.13 * r.range(0.85, 1.15);
      return [
        { type: "dome", offset: 0, radius: half, base: 0, height: h * 0.9, power: 0.4 },
        { type: "cone", offset: 0, left: half * 0.4, right: half * 0.4, base: h * 0.82, apex: h, bend: 1 },
      ];
    },
  },
  // A round crown between two lower, sloping shoulders (a crown's own sides would drop straight down).
  maple: {
    kind: "deciduous",
    width: 0.9,
    scale: 0.85,
    build(h, r) {
      const w = h * 0.9 * r.range(0.85, 1.15);
      return [
        { type: "dome", offset: 0, radius: w * 0.35, base: 0, height: h, power: 0.5 },
        { type: "dome", offset: -w * r.range(0.15, 0.28), radius: w * 0.3 * r.range(0.85, 1.15), base: 0, height: h * r.range(0.65, 0.85), power: 1 },
        { type: "dome", offset: w * r.range(0.15, 0.28), radius: w * 0.3 * r.range(0.85, 1.15), base: 0, height: h * r.range(0.65, 0.85), power: 1 },
      ];
    },
  },
  // Broad and lumpy: a cluster of round crowns over wide shoulders.
  oak: {
    kind: "deciduous",
    width: 1.25,
    scale: 0.8,
    build(h, r) {
      const w = h * 1.25 * r.range(0.85, 1.15);
      const n = h < 14 ? 2 : r.int(3, 5);
      const parts: TreePart[] = [];
      for (let k = 0; k < n; k++) {
        const offset = n === 1 ? 0 : w * (-0.26 + (0.52 * k) / (n - 1) + r.range(-0.05, 0.05));
        // The middle ones highest, so the crown is a dome of lumps.
        const middle = 1 - Math.abs(offset) / (w * 0.4);
        parts.push({ type: "dome", offset, radius: w * r.range(0.17, 0.24), base: 0, height: h * (0.72 + 0.28 * middle) * r.range(0.92, 1), power: 0.5 });
      }
      const top = Math.max(...parts.map((p) => (p.type === "dome" ? p.height : 0)));
      for (const p of parts) if (p.type === "dome") p.height *= h / top;
      parts.push(
        { type: "dome", offset: -w * 0.24, radius: w * 0.27, base: 0, height: h * r.range(0.5, 0.62), power: 1 },
        { type: "dome", offset: w * 0.24, radius: w * 0.27, base: 0, height: h * r.range(0.5, 0.62), power: 1 },
      );
      return parts;
    },
  },
  // Tall and narrow, with a couple of bumps down its sides.
  poplar: {
    kind: "deciduous",
    width: 0.4,
    scale: 1.05,
    build(h, r) {
      const half = h * 0.18 * r.range(0.85, 1.15);
      return [
        { type: "dome", offset: 0, radius: half, base: 0, height: h, power: 0.6 },
        { type: "dome", offset: -half * r.range(0.3, 0.5), radius: half * 0.75, base: 0, height: h * r.range(0.5, 0.7), power: 0.5 },
        { type: "dome", offset: half * r.range(0.3, 0.5), radius: half * 0.75, base: 0, height: h * r.range(0.5, 0.7), power: 0.5 },
      ];
    },
  },
};

const cache = new Map<string, Tree[]>();
const CACHE_SIZE = 64;

/** Trees for one repeat width of a layer, left to right. */
export function placeTrees({ trees, height, period }: TreeOptions): Tree[] {
  const key = JSON.stringify([trees, height, period]);
  const cached = cache.get(key);
  if (cached) return cached;

  const mix = Object.entries(trees.kind) as [TreeShape, number][];
  const mean = (f: (s: ShapeSpec) => number) => mix.reduce((t, [shape, w]) => t + f(SHAPES[shape]) * w, 0);
  // Heights are scaled so the mix averages `height`: one shape alone is exactly that tall.
  const scale = mean((s) => s.scale);

  const random = createRandom(trees.seed);
  const typicalWidth = height * mean((s) => s.width * (s.scale / scale));
  const gap = typicalWidth * (2.4 + (0.55 - 2.4) * trees.density);
  const spots: number[] = [];
  for (let x = random.next() * gap, i = 0; x < period; i++) {
    spots.push(x);
    x += gap * random.fork("gap", i).range(0.6, 1.4);
  }

  // Forest and clearing: smooth noise along the ridge. The spots where it's lowest are forest, as
  // many as `cover` asks for, so cover is the share of trees kept whatever the noise does.
  const cells = Math.max(3, Math.round(period / 700));
  const patches = periodicNoise(random.fork("patches"), cells);
  const patch = spots.map((x) => patches((x / period) * cells));
  const ranked = [...patch].sort((a, b) => a - b);
  const keep = Math.round(trees.cover * spots.length);
  const threshold = keep === 0 ? -Infinity : ranked[keep - 1]!;

  const list: Tree[] = [];
  for (let i = 0; i < spots.length; i++) {
    if (patch[i]! > threshold) continue;
    const x = spots[i]!;
    const r = random.fork("tree", i);
    const shape = pick(mix, r.next());
    const spec = SHAPES[shape];
    const h = height * (1 + (r.next() * 2 - 1) * trees.variation) * (spec.scale / scale);
    const parts = spec.build(h, r.fork("shape"));
    const reach = Math.max(...parts.map((p) => (p.type === "cone" ? Math.max(p.left - p.offset, p.right + p.offset) : Math.abs(p.offset) + p.radius)));
    list.push({ x, kind: spec.kind, shape, height: h, width: reach * 2, parts });
  }

  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, list);
  return list;
}

function pick(mix: [TreeShape, number][], u: number): TreeShape {
  for (const [shape, w] of mix) {
    if (u < w) return shape;
    u -= w;
  }
  return mix[mix.length - 1]![0];
}

/** Height of a tree above its foot at dx from its centre, or -Infinity outside it. */
export function treeHeightAt(tree: Tree, dx: number): number {
  let best = -Infinity;
  for (const p of tree.parts) {
    const a = dx - p.offset;
    if (p.type === "cone") {
      const t = Math.abs(a) / (a < 0 ? p.left : p.right);
      if (t < 1) best = Math.max(best, p.base + (p.apex - p.base) * (1 - t) ** p.bend);
    } else {
      const u = a / p.radius;
      if (u > -1 && u < 1) best = Math.max(best, p.base + (p.height - p.base) * (1 - u * u) ** p.power);
    }
  }
  return best;
}

/** Offsets where a tree's outline has a corner or a top, so sampling never cuts one off. */
export function treeKeyPoints(tree: Tree): number[] {
  const points: number[] = [];
  for (const p of tree.parts) {
    points.push(p.offset);
    // Just inside each corner: where a tier or a tuft stands on what's below it.
    if (p.type === "cone" && p.base > 0) points.push(p.offset - p.left * 0.999, p.offset + p.right * 0.999);
    if (p.type === "dome" && p.base > 0) points.push(p.offset - p.radius * 0.999, p.offset + p.radius * 0.999);
  }
  return points;
}

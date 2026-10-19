/**
 * Trees: placed once per layer along its repeat width (so they repeat with
 * it), then merged into the crest as an upper envelope, so a forest is still
 * part of the layer's one silhouette.
 *
 * Conifers are stacked triangular tiers. Deciduous trees are a round crown
 * between two lower, sloping shoulders (a crown's own sides would drop straight
 * down: layers are heights, so there's nothing to see under a crown). Both rise
 * from the ground at their feet, so a dense row reads as a forest edge.
 */
import { periodicNoise } from "../profile/noise";
import { createRandom } from "../random";
import type { Trees } from "../spec/types";

export interface Dome {
  /** Centre, relative to the tree's x. */
  offset: number;
  /** Half-width. */
  radius: number;
  height: number;
  /** Round (a half ellipse) or sloping (a parabola, so its edges meet the ground at an angle). */
  round: boolean;
}

export interface Tree {
  /** Centre, in the layer's repeat width. */
  x: number;
  kind: "conifer" | "deciduous";
  height: number;
  /** Full width at the base. */
  width: number;
  /** Deciduous only. */
  domes: Dome[];
}

export interface TreeOptions {
  trees: Trees;
  /** The tree height in px (Trees.height resolved against the element). */
  height: number;
  /** The layer's repeat width. */
  period: number;
}

const cache = new Map<string, Tree[]>();
const CACHE_SIZE = 64;

/** Trees for one repeat width of a layer, left to right. */
export function placeTrees({ trees, height, period }: TreeOptions): Tree[] {
  const key = JSON.stringify([trees, height, period]);
  const cached = cache.get(key);
  if (cached) return cached;

  const random = createRandom(trees.seed);
  const typicalWidth = height * (trees.kind === "deciduous" ? 0.9 : trees.kind === "mixed" ? 0.65 : 0.42);
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
    const x = spots[i]!;
    const r = random.fork("tree", i);
    if (patch[i]! <= threshold) {
      const kind = trees.kind === "mixed" ? (r.next() < 0.5 ? "conifer" : "deciduous") : trees.kind;
      const h = height * (1 + (r.next() * 2 - 1) * trees.variation) * (kind === "deciduous" && trees.kind === "mixed" ? 0.85 : 1);
      if (kind === "conifer") {
        list.push({ x, kind, height: h, width: h * 0.42 * r.range(0.85, 1.15), domes: [] });
      } else {
        const w = h * 0.9 * r.range(0.85, 1.15);
        const domes: Dome[] = [
          { offset: 0, radius: w * 0.35, height: h, round: true },
          { offset: -w * r.range(0.15, 0.28), radius: w * 0.3 * r.range(0.85, 1.15), height: h * r.range(0.65, 0.85), round: false },
          { offset: w * r.range(0.15, 0.28), radius: w * 0.3 * r.range(0.85, 1.15), height: h * r.range(0.65, 0.85), round: false },
        ];
        const half = Math.max(...domes.map((d) => Math.abs(d.offset) + d.radius));
        list.push({ x, kind, height: h, width: half * 2, domes });
      }
    }
  }

  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, list);
  return list;
}

/** Tiers for a conifer of this height: more for bigger trees. */
const tiersFor = (h: number) => (h < 10 ? 1 : h < 24 ? 2 : 3);

/** Height of a tree above its foot at dx from its centre, or -Infinity outside it. */
export function treeHeightAt(tree: Tree, dx: number): number {
  let best = -Infinity;
  if (tree.kind === "conifer") {
    const tiers = tiersFor(tree.height);
    const half = tree.width / 2;
    for (let k = 0; k < tiers; k++) {
      // Tier k: a triangle 0.46 of the height tall, narrower and higher than the one below.
      const apex = tiers === 1 ? tree.height : tree.height * (0.46 + (0.54 * k) / (tiers - 1));
      const base = tiers === 1 ? 0 : apex - tree.height * 0.46;
      const hw = half * (1 - (tiers === 1 ? 0 : (0.44 * k) / (tiers - 1)));
      const a = Math.abs(dx);
      if (a < hw) best = Math.max(best, base + (apex - base) * (1 - a / hw));
    }
    return best;
  }
  for (const d of tree.domes) {
    const u = (dx - d.offset) / d.radius;
    if (u > -1 && u < 1) best = Math.max(best, d.height * (d.round ? Math.sqrt(1 - u * u) : 1 - u * u));
  }
  return best;
}

/** Offsets where a tree's outline has a corner or a top, so sampling never cuts one off. */
export function treeKeyPoints(tree: Tree): number[] {
  if (tree.kind === "deciduous") return tree.domes.map((d) => d.offset);
  const tiers = tiersFor(tree.height);
  const half = tree.width / 2;
  const points = [0];
  for (let k = 0; k < tiers; k++) {
    const hw = half * (1 - (tiers === 1 ? 0 : (0.44 * k) / (tiers - 1)));
    // Just inside each tier's corner, where it meets the tier below.
    points.push(-hw * 0.999, hw * 0.999);
  }
  return points;
}

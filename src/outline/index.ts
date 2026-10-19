/**
 * Outlines: a layer's profile laid across the element at its real size, with
 * anchors blended in, simplified, and closed down past the bottom edge. One
 * closed polygon per layer, however wide the element.
 */
import { buildProfile } from "../profile";
import { resolveLength, type Size } from "../spec/length";
import type { Anchor, Layer } from "../spec/types";

export interface Vec {
  x: number;
  y: number;
}

export interface Outline {
  /** Crest points, left to right, in element coordinates (y down). */
  crest: Vec[];
  /** Highest point of the crest (smallest y). */
  top: number;
  /** y of the layer's baseline (its lowest valleys, before anchors). */
  baseline: number;
  /** Where the polygon closes, below the bottom edge. */
  bottom: number;
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

  // Samples sit on the profile's own grid (x = i × step), so a wider element only adds samples at the ends.
  const first = -1;
  const last = Math.ceil((size.width + step) / step);
  const points: Vec[] = [];
  for (let i = first; i <= last; i++) {
    const x = i * step;
    let h = baseline + amplitude * values[mod(i, count)]!;
    for (const a of anchors) h = a(x, h, baseline);
    points.push({ x, y: size.height - h });
  }
  const crest = simplify(points, tolerance);
  let top = Infinity;
  for (const p of crest) if (p.y < top) top = p.y;
  return { crest, top, baseline: size.height - baseline, bottom: size.height + Math.max(0, overscan) };
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

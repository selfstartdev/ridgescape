/**
 * Profiles: a layer's crest line for one period, as heights in [0, 1] sampled
 * every few px. They depend only on the layer (never on the element's size), so
 * resizing reuses them.
 */
import { createRandom } from "../random";
import type { Layer, ProfileKind } from "../spec/types";
import { octaves, type Octaves } from "./noise";

/** Target sample spacing in px. */
export const SAMPLE_STEP = 4;

export interface Profile {
  period: number;
  /** Spacing of `values`, in px: the period divided evenly, close to SAMPLE_STEP. */
  step: number;
  /** Heights in [0, 1] at x = i × step; values[0] follows values[length - 1] seamlessly. */
  values: Float64Array;
}

export type ProfileOptions = Pick<Layer, "profile" | "roughness" | "wavelength" | "period" | "seed">;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function octavesFor(roughness: number, cells: number): Octaves {
  return { cells, count: 2 + Math.round(roughness * 4), gain: 0.3 + 0.3 * roughness };
}

/** Raw heights at x ∈ [0, 1) of the period, any scale; they're normalised afterwards. */
type Shape = (x: number) => number;

const shapes: Record<ProfileKind, (seed: string, cells: number, roughness: number) => Shape> = {
  rolling(seed, cells, roughness) {
    return octaves(createRandom(seed), octavesFor(roughness, cells));
  },
  peaks(seed, cells, roughness) {
    // Ridged noise in the large octaves, so crests come to a point; plain noise in the small ones,
    // since ridged detail turns the whole edge into a row of scallops.
    return octaves(createRandom(seed), octavesFor(roughness, cells), (v, k) => (k < 2 ? (1 - Math.abs(v)) ** 2 : 0.6 * v));
  },
  mesa(seed, cells, roughness) {
    // Smooth here; `finish` turns it into plateaus.
    return octaves(createRandom(seed), octavesFor(roughness * 0.5, cells));
  },
  dunes(seed, cells, roughness) {
    const random = createRandom(seed);
    const slow = Math.max(1, Math.round(cells / 2));
    const warp = octaves(random.fork("warp"), { cells: slow, count: 2, gain: 0.5 });
    const swell = octaves(random.fork("swell"), { cells: slow, count: 1, gain: 1 });
    const detail = octaves(random.fork("detail"), { cells: cells * 4, count: 2, gain: 0.5 });
    // Asymmetric waves: a long windward rise, then a short, steep slip face.
    const crest = 0.78;
    return (x) => {
      const p = x * cells + 0.35 * warp(x);
      const s = p - Math.floor(p);
      const wave = s < crest ? (1 - Math.cos((Math.PI * s) / crest)) / 2 : (1 + Math.cos((Math.PI * (s - crest)) / (1 - crest))) / 2;
      return wave * (0.65 + 0.35 * swell(x)) + 0.08 * roughness * detail(x);
    };
  },
};

/** Applied to the normalised heights; the result is normalised again. */
const finish: Partial<Record<ProfileKind, (v: number) => number>> = {
  // Wider valleys, so the peaks stand out.
  peaks: (v) => v ** 1.3,
  // Plateau curve: flat tops and floors joined by steep sides.
  mesa: (v) => 0.82 * smoothstep(0.38, 0.62, v) + 0.18 * v,
};

const cache = new Map<string, Profile>();
const CACHE_SIZE = 64;

/** The layer's profile, normalised so its lowest point is 0 and its highest 1. */
export function buildProfile(options: ProfileOptions): Profile {
  const key = JSON.stringify([options.profile, options.roughness, options.wavelength, options.period, options.seed]);
  const cached = cache.get(key);
  if (cached) return cached;

  const { profile, roughness, wavelength, period, seed } = options;
  const count = Math.max(8, Math.round(period / SAMPLE_STEP));
  const cells = Math.max(1, Math.round(period / wavelength));
  const shape = shapes[profile](seed, cells, roughness);
  const values = new Float64Array(count);
  for (let i = 0; i < count; i++) values[i] = shape(i / count);
  normalise(values);
  const f = finish[profile];
  if (f) {
    for (let i = 0; i < count; i++) values[i] = f(values[i]!);
    normalise(values);
  }

  const result = { period, step: period / count, values };
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

function normalise(values: Float64Array) {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i]! - min) / range;
}

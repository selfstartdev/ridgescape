/**
 * Periodic 1D value noise: random values on a ring of lattice points, joined by
 * Catmull-Rom curves. Sampled at u ∈ [0, cells) it wraps seamlessly, which is
 * what lets every layer repeat horizontally.
 */
import type { Random } from "../random";

export type Noise = (u: number) => number;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Noise with `cells` lattice points per period, values in about [-1, 1]. */
export function periodicNoise(random: Random, cells: number): Noise {
  const n = Math.max(1, Math.round(cells));
  const values = Array.from({ length: n }, () => random.next() * 2 - 1);
  const at = (i: number) => values[mod(i, n)]!;
  return (u) => {
    const i = Math.floor(u);
    const t = u - i;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    // Catmull-Rom through p1 → p2.
    return (
      p1 +
      0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
    );
  };
}

export interface Octaves {
  /** Lattice cells per period in the first octave. */
  cells: number;
  count: number;
  /** Amplitude ratio between successive octaves. */
  gain: number;
}

/**
 * Sum of octaves, each with twice the cells of the last (so every octave is
 * periodic too). `shape` maps each octave's raw value before it's summed.
 * Sampled at x ∈ [0, 1) of the period.
 */
export function octaves(random: Random, { cells, count, gain }: Octaves, shape: (v: number) => number = (v) => v): (x: number) => number {
  const layers = Array.from({ length: count }, (_, k) => ({
    cells: Math.round(cells) * 2 ** k,
    weight: gain ** k,
    noise: periodicNoise(random.fork("octave", k), Math.round(cells) * 2 ** k),
  }));
  return (x) => {
    let sum = 0;
    for (const o of layers) sum += o.weight * shape(o.noise(x * o.cells));
    return sum;
  };
}

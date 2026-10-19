import { describe, expect, it } from "vitest";
import { buildProfile, periodicNoise, createRandom, type ProfileKind } from "ridgescape";

const kinds: ProfileKind[] = ["rolling", "peaks", "mesa", "dunes"];
const options = (profile: ProfileKind) => ({ profile, roughness: 0.5, wavelength: 600, period: 2000, seed: "test" });

describe("periodic noise", () => {
  it("wraps seamlessly", () => {
    const noise = periodicNoise(createRandom("n"), 5);
    expect(noise(5)).toBeCloseTo(noise(0), 10);
    expect(noise(4.999)).toBeCloseTo(noise(-0.001), 10);
  });
});

describe("profiles", () => {
  it.each(kinds)("%s is normalised to [0, 1]", (kind) => {
    const { values } = buildProfile(options(kind));
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(1);
  });

  it.each(kinds)("%s repeats without a seam", (kind) => {
    const { values } = buildProfile(options(kind));
    const n = values.length;
    // The jump across the seam is no bigger than the largest jump anywhere else.
    let largest = 0;
    for (let i = 1; i < n; i++) largest = Math.max(largest, Math.abs(values[i]! - values[i - 1]!));
    expect(Math.abs(values[0]! - values[n - 1]!)).toBeLessThanOrEqual(largest + 1e-9);
  });

  it("divides the period evenly into samples about 4px apart", () => {
    const p = buildProfile({ ...options("rolling"), period: 1999 });
    expect(p.step * p.values.length).toBeCloseTo(1999, 9);
    expect(p.step).toBeGreaterThan(3.9);
    expect(p.step).toBeLessThan(4.1);
  });

  it("is deterministic per seed and differs between seeds", () => {
    const a = buildProfile(options("peaks"));
    const b = buildProfile({ ...options("peaks"), seed: "test" });
    const c = buildProfile({ ...options("peaks"), seed: "other" });
    expect([...b.values]).toEqual([...a.values]);
    expect([...c.values]).not.toEqual([...a.values]);
  });
});

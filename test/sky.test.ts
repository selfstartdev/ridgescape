import { describe, expect, it } from "vitest";
import { render, resolve, toSvg } from "ridgescape";

const size = { width: 1200, height: 800 };
const last = <T,>(list: T[]) => list[list.length - 1]!;

describe("sky", () => {
  it("is off by default and fills its defaults when on", () => {
    expect(resolve().sky).toBeNull();
    const { sky, palette } = resolve({ sky: { sun: true, moon: { crescent: 0.5 }, stars: true } });
    expect(sky!.gradient).toEqual(palette.sky);
    expect(sky!.sun).toMatchObject({ radius: 56, color: palette.sun });
    expect(sky!.moon!.crescent).toBe(0.5);
    expect(sky!.stars!.seed).toBe("ridgescape:stars");
    expect(resolve(resolve({ sky: { sun: true }, clouds: true }))).toEqual(resolve({ sky: { sun: true }, clouds: true }));
  });

  it("draws sky, stars, sun and moon behind the ground, in that order", () => {
    const r = render({ sky: { sun: true, moon: true, stars: true }, layers: 2 }, size);
    expect(r.layers.map((l) => l.kind)).toEqual(["sky", "stars", "sun", "moon", "ground", "ground"]);
    expect(r.layers.find((l) => l.kind === "sky")!.depth).toBe(0);
    expect(r.layers.find((l) => l.kind === "sun")!.depth).toBe(1);
  });

  it("leaves the gradient out with gradient: false", () => {
    expect(render({ sky: { gradient: false, sun: true } }, size).layers[0]!.kind).toBe("sun");
  });

  it("gives the sun a radial glow, unless glow is 0", () => {
    const svg = toSvg({ sky: { sun: true } }, size);
    expect(svg).toContain("<radialGradient");
    expect(svg).toContain('stop-opacity="0"');
    expect(render({ sky: { sun: { glow: 0 } } }, size).layers.find((l) => l.kind === "sun")!.shapes).toHaveLength(1);
  });

  it("cuts a crescent from the moon", () => {
    const full = render({ sky: { moon: true } }, size).layers.find((l) => l.kind === "moon")!;
    const crescent = render({ sky: { moon: { crescent: 0.8 } } }, size).layers.find((l) => l.kind === "moon")!;
    expect(last(full.shapes).d).toMatch(/A36 36 0 1 1/);
    expect(last(crescent.shapes).d).toMatch(/A36 36 0 1 0 .*A36 36 0 0 1/);
  });

  it("scatters stars by density, only in their area", () => {
    const count = (density: number) => (toSvg({ sky: { stars: { density } } }, size).match(/M/g) ?? []).length;
    expect(count(2)).toBeGreaterThan(count(1) * 1.5);
    const stars = render({ sky: { stars: { area: "30%" } } }, size).layers.find((l) => l.kind === "stars")!;
    for (const shape of stars.shapes) {
      for (const m of shape.d.matchAll(/M[-\d.]+ ([-\d.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(240);
    }
  });

  it("rejects bad input", () => {
    expect(() => resolve({ sky: { sun: { at: ["50%"] as never } } })).toThrow(/sun.at/);
    expect(() => resolve({ sky: { moon: { crescent: 2 } } })).toThrow(/crescent/);
  });
});

describe("clouds", () => {
  it("are off by default; on, they make rows from back to front", () => {
    expect(resolve().clouds).toBeNull();
    const r = render({ clouds: { bands: 3 }, layers: 1 }, size);
    const rows = r.layers.filter((l) => l.kind === "clouds");
    expect(rows.map((l) => l.depth)).toEqual([1, 0.925, 0.85]);
    expect(last(r.layers).kind).toBe("ground");
  });

  it("cover more of the sky with more cover", () => {
    const pieces = (cover: number) => (toSvg({ clouds: { cover, bands: 1 } }, size).match(/M/g) ?? []).length;
    expect(pieces(0.8)).toBeGreaterThan(pieces(0.2));
  });

  it("repeat horizontally: a wider element only adds clouds", () => {
    const narrow = render({ clouds: { bands: 1, shade: 0 } }, { width: 1000, height: 800 }).layers[0]!.shapes[0]!.d;
    const wide = render({ clouds: { bands: 1, shade: 0 } }, { width: 3000, height: 800 }).layers[0]!.shapes[0]!.d;
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(wide.startsWith(narrow.slice(0, 200))).toBe(true);
  });

  it("draw streaks as lenses", () => {
    expect(render({ clouds: { style: "streaks", bands: 1 } }, size).layers[0]!.shapes[0]!.d).toMatch(/^M[-\d.]+ [-\d.]+Q/);
  });

  it("shade their undersides with a gradient, and take an opacity", () => {
    const shape = render({ clouds: { bands: 1, opacity: 0.5 } }, size).layers[0]!.shapes[0]!;
    expect(typeof shape.fill).toBe("object");
    expect(shape.opacity).toBe(0.5);
    expect(typeof render({ clouds: { bands: 1, shade: 0 } }, size).layers[0]!.shapes[0]!.fill).toBe("string");
  });
});

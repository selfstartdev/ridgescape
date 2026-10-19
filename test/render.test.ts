import { describe, expect, it } from "vitest";
import { render, toSvg } from "ridgescape";

describe("render", () => {
  it("draws one closed path per layer, back to front", () => {
    const r = render({ layers: 3 }, { width: 600, height: 300 });
    expect(r.layers.map((l) => l.depth)).toEqual([1, 0.5, 0]);
    for (const l of r.layers) expect(l.shapes[0]!.d).toMatch(/^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+)+Z$/);
  });

  it("is byte-stable", () => {
    expect(toSvg({ seed: 5 }, { width: 500, height: 300 })).toBe(toSvg({ seed: 5 }, { width: 500, height: 300 }));
  });

  it("uses a mist gradient with an id from its content", () => {
    const svg = toSvg({ palette: "fog", layers: 2 }, { width: 400, height: 200 });
    const ids = [...svg.matchAll(/linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(svg).toContain(`fill="url(#${id})"`);
    expect(toSvg({ palette: "fog", layers: 2 }, { width: 400, height: 200, idPrefix: "x" })).toContain('id="x-');
  });

  it("rejects an empty size", () => {
    expect(() => render({}, { width: 0, height: 100 })).toThrow(/width and height/);
  });
});

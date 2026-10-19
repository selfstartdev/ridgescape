import { describe, expect, it } from "vitest";
import { resolve } from "ridgescape";

describe("resolve", () => {
  it("fills every default", () => {
    const scene = resolve();
    expect(scene.seed).toBe("ridgescape");
    expect(scene.layers).toHaveLength(4);
    expect(scene.height).toBe("45%");
    expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  });

  it("spreads depth back to front", () => {
    expect(resolve({ layers: 3 }).layers.map((l) => l.depth)).toEqual([1, 0.5, 0]);
    expect(resolve({ layers: 1 }).layers[0]!.depth).toBe(0);
  });

  it("puts far layers higher, in the scene's units", () => {
    const [back, front] = resolve({ layers: 2 }).layers;
    expect(parseFloat(String(back!.baseline))).toBeGreaterThan(parseFloat(String(front!.baseline)));
    expect(String(back!.baseline)).toMatch(/%$/);
    const px = resolve({ layers: 2, height: 400 }).layers;
    expect(typeof px[0]!.baseline).toBe("number");
  });

  it("keeps explicit values", () => {
    const layer = resolve({ layers: [{ baseline: 40, amplitude: "10%", color: "red", depth: 0.3, seed: "x" }] }).layers[0]!;
    expect(layer).toMatchObject({ baseline: 40, amplitude: "10%", color: "red", depth: 0.3, seed: "x" });
  });

  it("is idempotent", () => {
    const once = resolve({ seed: 9, palette: "fog", layers: [{ profile: "peaks", anchors: [{ at: "50%" }] }, {}] });
    expect(resolve(once)).toEqual(once);
  });

  it("fills anchor defaults by kind, relative to the amplitude", () => {
    const layer = resolve({ layers: [{ amplitude: 100, anchors: [{ at: 10 }, { at: 20, kind: "dip" }, { at: 30, kind: "flat" }] }] }).layers[0]!;
    expect(layer.anchors).toEqual([
      { at: 10, kind: "peak", height: 115, width: "20%" },
      { at: 20, kind: "dip", height: 0, width: "20%" },
      { at: 30, kind: "flat", height: 20, width: "20%" },
    ]);
  });

  it("rejects bad input with a clear message", () => {
    expect(() => resolve({ layers: 0 })).toThrow(/layers/);
    expect(() => resolve({ palette: "nope" as never })).toThrow(/unknown palette/);
    expect(() => resolve({ layers: [{ profile: "spiky" as never }] })).toThrow(/unknown profile/);
    expect(() => resolve({ layers: [{ baseline: "10px" as never }] })).toThrow(/baseline/);
    expect(() => resolve({ layers: [{ roughness: 2 }] })).toThrow(/roughness/);
  });
});

import { describe, expect, it } from "vitest";
import { buildOutline, placeTrees, render, resolve, treeHeightAt, type LayerInput } from "ridgescape";

const size = { width: 1600, height: 600 };
const layer = (trees: LayerInput["trees"], extra: LayerInput = {}) => resolve({ layers: [{ baseline: 100, amplitude: 120, period: 1200, trees, ...extra }] }).layers[0]!;
/** Height above the bottom at x, interpolated. */
function heightAt(crest: { x: number; y: number }[], x: number) {
  const i = crest.findIndex((p) => p.x >= x);
  const a = crest[i - 1]!, b = crest[i]!;
  return size.height - (a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
}

describe("trees", () => {
  it("are off by default and sized by depth when on", () => {
    expect(resolve({ layers: 2 }).layers[0]!.trees).toBeNull();
    const [back, front] = resolve({ layers: [{ trees: true }, { trees: true }] }).layers;
    expect(front!.trees).toMatchObject({ kind: "conifer", height: 44, density: 0.6, color: null, seed: "ridgescape:1:trees" });
    expect(back!.trees!.height).toBe(12);
    const r = resolve({ layers: [{ trees: { kind: "mixed", height: "5%" } }] });
    expect(resolve(r)).toEqual(r);
  });

  it("stand on the ground: the crest never drops below it", () => {
    const o = buildOutline(layer({ density: 0.8 }), size, { tolerance: 0 });
    for (let x = 0; x < size.width; x += 7) expect(heightAt(o.crest, x)).toBeGreaterThanOrEqual(heightAt(o.ground!, x) - 1e-6);
    // …and rise well above it somewhere.
    let most = 0;
    for (let x = 0; x < size.width; x += 3) most = Math.max(most, heightAt(o.crest, x) - heightAt(o.ground!, x));
    expect(most).toBeGreaterThan(30);
  });

  it("repeat with the layer's period", () => {
    const o = buildOutline(layer(true), size, { tolerance: 0 });
    for (const x of [37, 222, 351]) expect(heightAt(o.crest, x + 1200)).toBeCloseTo(heightAt(o.crest, x), 4);
  });

  it("thin out with density and disappear at cover 0", () => {
    const count = (density: number) => placeTrees({ trees: layer({ density })!.trees!, height: 40, period: 1200 }).length;
    expect(count(0.9)).toBeGreaterThan(count(0.2) * 2);
    expect(placeTrees({ trees: layer({ cover: 0 })!.trees!, height: 40, period: 1200 })).toEqual([]);
  });

  it("keep their tips: a conifer's apex is a crest point", () => {
    const o = buildOutline(layer({ density: 0.3, variation: 0 }), size);
    const tree = placeTrees({ trees: layer({ density: 0.3, variation: 0 }).trees!, height: 44, period: 1200 })[3]!;
    expect(o.crest.some((p) => Math.abs(p.x - tree.x) < 1e-6)).toBe(true);
  });

  it("have tiered conifers and domed deciduous outlines", () => {
    const [fir] = placeTrees({ trees: layer({ kind: "conifer", variation: 0 }).trees!, height: 40, period: 1200 });
    expect(treeHeightAt(fir!, 0)).toBeCloseTo(40, 6);
    expect(treeHeightAt(fir!, fir!.width)).toBe(-Infinity);
    const [oak] = placeTrees({ trees: layer({ kind: "deciduous", variation: 0 }).trees!, height: 40, period: 1200 });
    expect(treeHeightAt(oak!, 0)).toBeCloseTo(40, 6);
    expect(oak!.domes).toHaveLength(3);
  });

  it("take their own colour as a second shape", () => {
    expect(render({ layers: [{ trees: true }] }, size).layers[0]!.shapes).toHaveLength(1);
    const shapes = render({ layers: [{ trees: { color: "#123456" } }] }, size).layers[0]!.shapes;
    expect(shapes.map((s) => s.fill)).toEqual(["#123456", expect.any(String)]);
  });

  it("rejects an unknown kind", () => {
    expect(() => resolve({ layers: [{ trees: { kind: "palm" as never } }] })).toThrow(/tree kind/);
  });
});

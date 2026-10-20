import { describe, expect, it } from "vitest";
import { buildOutline, placeTrees, render, resolve, treeHeightAt, TREE_GROUPS, TREE_SHAPES, type LayerInput } from "ridgescape";

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
    expect(front!.trees).toMatchObject({ kind: TREE_GROUPS.conifer, height: 44, density: 0.6, color: null, seed: "ridgescape:1:trees" });
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
    const o = buildOutline(layer({ kind: "fir", density: 0.3, variation: 0 }), size);
    const tree = placeTrees({ trees: layer({ kind: "fir", density: 0.3, variation: 0 }).trees!, height: 44, period: 1200 })[3]!;
    expect(o.crest.some((p) => Math.abs(p.x - tree.x) < 1e-6)).toBe(true);
  });

  it("take a group, a shape, a list or weights as their kind", () => {
    const kind = (k: unknown) => layer({ kind: k as never }).trees!.kind;
    expect(kind("deciduous")).toEqual(TREE_GROUPS.deciduous);
    expect(kind("oak")).toEqual({ oak: 1 });
    expect(kind(["fir", "poplar"])).toEqual({ fir: 0.5, poplar: 0.5 });
    expect(kind({ spruce: 3, maple: 1 })).toEqual({ spruce: 0.75, maple: 0.25 });
    expect(Object.values(kind("mixed")).reduce((t, w) => t + w!, 0)).toBeCloseTo(1, 4);
    expect(() => kind({ spruce: -1 })).toThrow(/trees.kind.spruce/);
    expect(() => kind([])).toThrow(/tree kind/);
  });

  it("mix their shapes at random, in proportion", () => {
    const trees = placeTrees({ trees: layer({ kind: "mixed", density: 1, cover: 1 }).trees!, height: 30, period: 6000 });
    const seen = new Set(trees.map((t) => t.shape));
    expect([...seen].sort()).toEqual([...TREE_SHAPES].sort());
    const conifers = trees.filter((t) => t.kind === "conifer").length / trees.length;
    expect(conifers).toBeGreaterThan(0.35);
    expect(conifers).toBeLessThan(0.65);
  });

  it("are as tall as asked, whatever the shape, when it's the only one", () => {
    for (const shape of TREE_SHAPES) {
      const trees = placeTrees({ trees: layer({ kind: shape, variation: 0 }).trees!, height: 40, period: 1200 });
      for (const t of trees.slice(0, 5)) {
        expect(t.shape).toBe(shape);
        const top = Math.max(...Array.from({ length: 201 }, (_, i) => treeHeightAt(t, ((i - 100) / 100) * (t.width / 2))));
        expect(top).toBeGreaterThan(38);
        expect(top).toBeLessThanOrEqual(40 + 1e-6);
        expect(treeHeightAt(t, t.width / 2 + 0.01)).toBe(-Infinity);
        expect(treeHeightAt(t, -t.width / 2 - 0.01)).toBe(-Infinity);
      }
    }
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

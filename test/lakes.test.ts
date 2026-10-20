import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOutline, drawShape, render, resolve, toSvg, type CanvasContext, type LayerInput } from "ridgescape";

const size = { width: 1200, height: 600 };
const layer = (lakes: LayerInput["lakes"], extra: LayerInput = {}) =>
  resolve({ layers: [{ baseline: 100, amplitude: 120, period: 1000, lakes, ...extra }] }).layers[0]!;
function heightAt(crest: { x: number; y: number }[], x: number) {
  const i = crest.findIndex((p) => p.x >= x);
  const a = crest[i - 1]!, b = crest[i]!;
  return size.height - (a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
}

describe("lakes", () => {
  it("fill their defaults", () => {
    const l = layer([{ at: "50%" }]);
    expect(l.lakes[0]).toMatchObject({ at: "50%", width: "30%", level: 14.4, reflection: true, ripples: true });
    expect(l.lakes[0]!.color).toMatch(/^#/);
    expect(resolve(resolve({ layers: [{ lakes: [{ at: 10 }] }] }))).toEqual(resolve({ layers: [{ lakes: [{ at: 10 }] }] }));
  });

  it("hold the ground just under the water across their width, with banks above it", () => {
    const o = buildOutline(layer([{ at: 400, width: 300, level: 50 }]), size, { tolerance: 0 });
    for (const x of [260, 400, 540]) expect(heightAt(o.crest, x)).toBeCloseTo(147, 6);
    expect(heightAt(o.crest, 246)).toBeGreaterThan(150);
    expect(o.water).toEqual([{ lake: 0, copy: 0, x0: 250, x1: 550, y: 450 }]);
  });

  it("repeat with the layer", () => {
    const o = buildOutline(layer([{ at: 400, width: 200 }]), { width: 2600, height: 600 });
    expect(o.water.map((w) => w.x0)).toEqual([300, 1300, 2300]);
  });

  it("keep trees off the water", () => {
    const o = buildOutline(layer([{ at: 500, width: 400, level: 60 }], { trees: { density: 1 } }), size, { tolerance: 0 });
    for (let x = 310; x < 690; x += 5) expect(heightAt(o.crest, x)).toBeCloseTo(157, 6);
  });

  it("carry on across the layer when as wide as the element, or too wide to leave land between repeats", () => {
    expect(buildOutline(layer([{ at: "40%", width: "100%" }], { period: 3000 }), size).water).toHaveLength(1);
    expect(buildOutline(layer([{ at: 500, width: 1000 }], { period: 3000 }), { width: 1400, height: 600 }).water[0]!.x0).toBe(0);
    const o = buildOutline(layer([{ at: "50%", width: "100%", level: 50 }]), size, { tolerance: 0 });
    expect(o.water).toEqual([{ lake: 0, copy: 0, x0: -1, x1: 1201, y: 450 }]);
    for (let x = 0; x <= 1200; x += 50) expect(heightAt(o.crest, x)).toBeCloseTo(147, 6);
    // With room for land between repeats, they keep their shores.
    expect(buildOutline(layer([{ at: "50%", width: 600 }]), size).water[0]!.x0).toBe(300);
  });

  it("reflect every shape behind them, one layer per depth, mirrored at the waterline and clipped to the water", () => {
    const r = render({ sky: { sun: true }, layers: [{}, { lakes: [{ at: "50%", width: 400 }] }] }, size);
    expect(r.layers.map((l) => l.kind)).toEqual(["sky", "sun", "ground", "ground", "reflection", "reflection", "water"]);
    const ground = r.layers.findIndex((l) => l.key === "ground-1");
    const behind = r.layers.slice(0, ground);
    const reflections = r.layers.filter((l) => l.mirror);
    expect(reflections.map((l) => l.mirror!.depth).sort()).toEqual([...new Set(behind.map((l) => l.depth))].sort());
    expect(reflections.flatMap((l) => l.shapes.map((s) => s.d)).sort()).toEqual(behind.flatMap((l) => l.shapes.map((s) => s.d)).sort());
    for (const l of reflections) {
      expect(l.depth).toBe(0);
      expect(l.mirror!.water).toEqual([[400, 450, 800, 600]].map(([x0, , x1, y1]) => [x0, l.mirror!.water[0]![1], x1, y1]));
      for (const s of l.shapes) expect(s.transform![3]).toBe(-1);
    }
    expect(toSvg({ sky: { sun: true }, layers: [{}, { lakes: [{ at: "50%", width: 400 }] }] }, size)).toContain('<g clip-path="url(#ridgescape-clip-');
  });

  it("leave out reflections and ripples when asked", () => {
    const layers = (lake: object) => render({ layers: [{}, { lakes: [{ at: "50%", ...lake }] }] }, size).layers;
    expect(layers({ reflection: false }).some((l) => l.mirror)).toBe(false);
    const surface = (lake: object) => layers(lake).find((l) => l.kind === "water")!.shapes;
    expect(surface({ ripples: false }).length).toBe(surface({}).length - 1);
    expect(() => layers({ reflection: 0.5 })).toThrow(/true or false/);
  });
});

describe("drawShape", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("clips, then transforms, then fills", () => {
    vi.stubGlobal("Path2D", class { constructor(readonly d: string) {} });
    const calls: string[] = [];
    const ctx = {
      globalAlpha: 1,
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clip: () => calls.push("clip"),
      transform: (...m: number[]) => calls.push(`transform ${m.join(",")}`),
      fill: () => calls.push("fill"),
    } as unknown as CanvasContext;
    drawShape(ctx, { d: "M0 0Z", fill: "#000", clip: "M0 0Z", transform: [1, 0, 0, -1, 0, 900], opacity: 0.5 });
    expect(calls).toEqual(["save", "clip", "transform 1,0,0,-1,0,900", "fill", "restore"]);
    expect(ctx.globalAlpha).toBe(0.5);
  });
});

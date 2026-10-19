import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOutline, drawShape, render, resolve, type CanvasContext, type LayerInput } from "ridgescape";

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
    expect(l.lakes[0]).toMatchObject({ at: "50%", width: "30%", level: 14.4, reflection: 0.6, ripples: 0.5 });
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

  it("reflect every shape behind them, mirrored at the waterline and clipped to the water", () => {
    const r = render({ sky: { sun: true }, layers: [{}, { lakes: [{ at: "50%", width: 400 }] }] }, size);
    const behind = r.layers.slice(0, -1).flatMap((l) => l.shapes);
    const lake = r.layers[r.layers.length - 1]!.shapes;
    const mirrored = lake.filter((s) => s.transform);
    expect(mirrored).toHaveLength(behind.length);
    for (const m of mirrored) {
      expect(m.transform![3]).toBe(-1);
      expect(m.clip).toMatch(/^M/);
    }
    expect(mirrored.map((m) => m.d)).toEqual(behind.map((s) => s.d));
  });

  it("leave out reflections and ripples when asked", () => {
    const shapes = (lake: object) => render({ layers: [{}, { lakes: [{ at: "50%", ...lake }] }] }, size).layers[1]!.shapes;
    expect(shapes({ reflection: 0 }).some((s) => s.transform)).toBe(false);
    expect(shapes({ ripples: 0 }).length).toBe(shapes({}).length - 1);
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

import { describe, expect, it } from "vitest";
import { buildOutline, resolve, simplify, type LayerInput } from "ridgescape";

const layer = (extra: LayerInput = {}) => resolve({ layers: [{ baseline: 50, amplitude: 100, period: 1000, ...extra }] }).layers[0]!;
const size = { width: 800, height: 400 };

/** Crest height above the bottom at x, interpolated. */
function heightAt(crest: { x: number; y: number }[], x: number, height = size.height) {
  const i = crest.findIndex((p) => p.x >= x);
  const a = crest[i - 1]!, b = crest[i]!;
  return height - (a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
}

describe("outlines", () => {
  it("cover the element with a little bleed and stay between baseline and crest", () => {
    const o = buildOutline(layer(), size);
    expect(o.crest[0]!.x).toBeLessThan(0);
    expect(o.crest[o.crest.length - 1]!.x).toBeGreaterThan(size.width);
    for (const p of o.crest) {
      expect(size.height - p.y).toBeGreaterThanOrEqual(50 - 1e-9);
      expect(size.height - p.y).toBeLessThanOrEqual(150 + 1e-9);
    }
    expect(o.bottom).toBe(size.height);
  });

  it("repeat every period", () => {
    const o = buildOutline(layer({ period: 400 }), { width: 1200, height: 400 }, { tolerance: 0 });
    for (const x of [10, 123, 350]) expect(heightAt(o.crest, x + 400)).toBeCloseTo(heightAt(o.crest, x), 6);
  });

  it("only grow at the ends when the element widens", () => {
    const narrow = buildOutline(layer(), size, { tolerance: 0 });
    const wide = buildOutline(layer(), { width: 1600, height: 400 }, { tolerance: 0 });
    expect(wide.crest.slice(0, 100)).toEqual(narrow.crest.slice(0, 100));
  });

  it("reach below the element by the overscan", () => {
    expect(buildOutline(layer(), size, { overscan: 120 }).bottom).toBe(520);
  });

  it("pull to an anchor's height at its position", () => {
    const peak = buildOutline(layer({ anchors: [{ at: 400, height: 140, width: 300 }] }), size, { tolerance: 0 });
    expect(heightAt(peak.crest, 400)).toBeCloseTo(190, 0);
    const dip = buildOutline(layer({ anchors: [{ at: "50%", kind: "dip", width: 300 }] }), size, { tolerance: 0 });
    expect(heightAt(dip.crest, 400)).toBeCloseTo(50, 0);
    const flat = buildOutline(layer({ anchors: [{ at: 400, kind: "flat", height: 30, width: 400 }] }), size, { tolerance: 0 });
    for (const x of [320, 400, 480]) expect(heightAt(flat.crest, x)).toBeCloseTo(80, 6);
  });

  it("leave the profile alone outside an anchor's reach", () => {
    const plain = buildOutline(layer(), size, { tolerance: 0 });
    const anchored = buildOutline(layer({ anchors: [{ at: 400, width: 200 }] }), size, { tolerance: 0 });
    expect(heightAt(anchored.crest, 200)).toBe(heightAt(plain.crest, 200));
    expect(heightAt(anchored.crest, 600)).toBe(heightAt(plain.crest, 600));
  });
});

describe("simplify", () => {
  it("drops points on a straight line and keeps corners", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 5 }, { x: 4, y: 10 }];
    expect(simplify(pts, 0.1)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 10 }]);
  });
});

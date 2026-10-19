import { afterEach, describe, expect, it, vi } from "vitest";
import { drawToCanvas, render, type CanvasContext } from "ridgescape";

class FakePath2D {
  constructor(readonly d: string) {}
}

function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    canvas: { width: 1200, height: 600 },
    fillStyle: "" as unknown,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    setTransform: () => calls.push("reset"),
    clearRect: (_x: number, _y: number, w: number, h: number) => calls.push(`clear ${w}×${h}`),
    scale: (k: number) => calls.push(`scale ${k}`),
    createLinearGradient: (_x1: number, y1: number, _x2: number, y2: number) => {
      const stops: string[] = [];
      return { y1, y2, stops, addColorStop: (o: number, c: string) => stops.push(`${o} ${c}`) };
    },
    fill(path: FakePath2D) {
      calls.push(`fill ${typeof ctx.fillStyle === "string" ? ctx.fillStyle : "gradient"} ${path.d.length}`);
    },
  };
  return { ctx: ctx as unknown as CanvasContext, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("drawToCanvas", () => {
  it("paints the same paths and colours as the SVG, back to front", () => {
    vi.stubGlobal("Path2D", FakePath2D);
    const rendered = render({ palette: "mono", layers: 3 }, { width: 600, height: 300 });
    const { ctx, calls } = fakeContext();
    drawToCanvas(ctx, rendered, { pixelRatio: 2 });
    expect(calls.slice(0, 4)).toEqual(["save", "reset", "clear 1200×600", "scale 2"]);
    expect(calls.slice(4, 7)).toEqual(rendered.layers.map((l) => `fill ${l.fill} ${l.d.length}`));
    expect(calls[calls.length - 1]).toBe("restore");
  });

  it("uses a canvas gradient for mist", () => {
    vi.stubGlobal("Path2D", FakePath2D);
    const rendered = render({ palette: "fog", layers: 1 }, { width: 600, height: 300 });
    const { ctx, calls } = fakeContext();
    drawToCanvas(ctx, rendered, { clear: false });
    expect(calls).toContain(`fill gradient ${rendered.layers[0]!.d.length}`);
    expect(calls.some((c) => c.startsWith("clear"))).toBe(false);
  });
});

// @vitest-environment jsdom
/** Regressions from the code review: one test per finding, using the reviewer's inputs. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachParallax, buildOutline, mirrorClip, presets, render, resolve, toSvg, type SceneInput } from "ridgescape";

const size = { width: 1200, height: 600 };

/** Ground height above the bottom at x, along a crest. */
function heightAt(crest: { x: number; y: number }[], x: number, height = size.height) {
  const i = crest.findIndex((p) => p.x >= x);
  const a = crest[i - 1]!, b = crest[i]!;
  if (b.x === a.x) return height - Math.max(a.y, b.y);
  return height - (a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
}

describe("reflections", () => {
  it("keep the scene's drawing order when layers that aren't next to each other share a depth", () => {
    for (const scene of [presets.lakeside, { ...presets.lakeside, clouds: { bands: 2 } }]) {
      const r = render(scene, { width: 1440, height: 900 });
      const lake = r.layers.findIndex((l) => l.mirror);
      const behind = r.layers.slice(0, lake - 1).flatMap((l) => l.shapes.filter((s) => !s.clip && !s.transform));
      const mirrored = r.layers.filter((l) => l.mirror).flatMap((l) => l.shapes);
      expect(mirrored.map((s) => s.d)).toEqual(behind.map((s) => s.d));
      // Each reflection layer mirrors one depth, and neighbours differ.
      const depths = r.layers.filter((l) => l.mirror).map((l) => l.mirror!.depth);
      depths.slice(1).forEach((d, i) => expect(d).not.toBe(depths[i]));
    }
  });

  it("take the precision the scene is rendered at", () => {
    const scene = { layers: [{}, { lakes: [{ at: 401.23456, width: 300.1 }] }] };
    const r = render(scene, { ...size, precision: 4 });
    const water = r.layers.find((l) => l.mirror)!.mirror!.water[0]!;
    expect(water[0]).toBe(251.1846);
    expect(mirrorClip([water])).toContain("M251.1846 ");
  });

  it("reference what they mirror instead of repeating its path data", () => {
    const scene: SceneInput = { sky: { stars: true }, layers: [{ trees: true }, { lakes: [{ at: "50%", width: "60%" }] }] };
    const r = render(scene, size);
    const svg = toSvg(scene, size);
    const tree = r.layers.find((l) => l.key === "ground-0")!.shapes[0]!;
    expect(svg.split(tree.d).length - 1).toBe(1);
    expect(svg).toContain("<use href=");
  });
});

describe("water", () => {
  it("renders when the lake's colour can't be mixed (a CSS variable)", () => {
    expect(() => render({ layers: [{ color: "var(--hills)", lakes: [{ at: "50%" }] }] }, size)).not.toThrow();
    expect(() => render({ layers: [{ lakes: [{ at: "50%", color: "var(--water)" }] }] }, size)).not.toThrow();
  });

  it("leaves no seam at the shore: the ground is above the water right up to it", () => {
    let checked = 0;
    for (let seed = 0; seed < 40; seed++) {
      const layer = resolve({ seed, layers: [{ lakes: [{ at: 601.3, width: 333 }] }] }).layers[0]!;
      const o = buildOutline(layer, size);
      for (const span of o.water) {
        const level = size.height - span.y;
        for (const dx of [0.25, 0.5, 1]) {
          if (span.x0 - dx > 0) expect(heightAt(o.crest, span.x0 - dx)).toBeGreaterThanOrEqual(level);
          if (span.x1 + dx < size.width) expect(heightAt(o.crest, span.x1 + dx)).toBeGreaterThanOrEqual(level);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("only runs all the way across when the lake covers the element", () => {
    const layer = resolve({ layers: [{ lakes: [{ at: 0, width: 500 }] }] }).layers[0]!;
    for (const width of [499, 500, 501]) {
      const water = buildOutline(layer, { width, height: 600 }).water;
      expect(water[0]!.x0).toBeLessThan(0);
      expect(water[0]!.x1).toBe(250);
    }
    const centred = resolve({ layers: [{ lakes: [{ at: "50%", width: "100%" }] }] }).layers[0]!;
    expect(buildOutline(centred, size).water).toEqual([expect.objectContaining({ x0: -1, x1: size.width + 1 })]);
  });
});

describe("trees", () => {
  it("reject a height of 0 or less instead of placing trees forever", () => {
    for (const height of [0, "0%", -10]) expect(() => resolve({ layers: [{ trees: { height: height as number } }] })).toThrow(RangeError);
  });

  it("show up on every preset layer that asks for them", () => {
    for (const [name, scene] of Object.entries(presets)) {
      const resolved = resolve(scene);
      for (const layer of resolved.layers) {
        if (!layer.trees) continue;
        const o = buildOutline(layer, { width: 1440, height: 900 });
        expect(o.crest, `${name}`).not.toEqual(o.ground);
      }
    }
  });
});

describe("clouds", () => {
  it("cover 0 draws none", () => {
    expect(render({ clouds: { cover: 0 }, layers: 1 }, size).layers.filter((l) => l.kind === "clouds")).toEqual([]);
  });
});

describe("parallax with reflections", () => {
  let rect = { top: 0, bottom: 500 };
  let frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    rect = { top: 0, bottom: 500 };
    frames = [];
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("only changes transforms while scrolling, and reads the layers once", () => {
    const container = document.createElement("div");
    container.innerHTML = '<svg data-depth="1"></svg><div data-depth="0.5" style="clip-path: path(&quot;M0 400H100V500H0Z&quot;)"><svg data-mirror="1"></svg></div>';
    container.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
    document.body.appendChild(container);
    const wrapper = container.querySelector("div")!;
    const inner = wrapper.querySelector("svg")!;
    const clip = wrapper.style.clipPath;
    const detach = attachParallax(container, { strength: 0.5 });
    const query = vi.spyOn(container, "querySelectorAll");
    const scroll = () => {
      window.dispatchEvent(new Event("scroll"));
      for (const f of frames.splice(0)) f(0);
    };
    rect = { top: 100, bottom: 900 };
    scroll();
    // Lake at -25px, mirroring a layer at -50px: the reflection shows at 2 × -25 + 50 = 0, so its inner element moves 25px within the water.
    expect(wrapper.style.transform).toBe("translate3d(0, -25px, 0)");
    expect(inner.style.transform).toBe("translate3d(0, 25px, 0)");
    expect(wrapper.style.clipPath).toBe(clip);
    expect(inner.style.clipPath).toBe("");
    rect = { top: -100, bottom: 400 };
    scroll();
    expect(wrapper.style.clipPath).toBe(clip);
    expect(query).not.toHaveBeenCalled();
    detach();
    expect(inner.style.transform).toBe("");
    expect(wrapper.style.transform).toBe("");
  });
});


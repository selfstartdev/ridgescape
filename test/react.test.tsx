// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presets, Ridgescape, ridgescapeParentStyle, type RidgescapeProps } from "../src/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout, ResizeObserver, canvas or Path2D: stub them so tests control size and see drawing.
let layerSize = { width: 1200, height: 700 };
const observers = new Set<() => void>();
class FakeResizeObserver {
  constructor(private readonly cb: () => void) {}
  observe() {
    observers.add(this.cb);
  }
  disconnect() {
    observers.delete(this.cb);
  }
}
class FakePath2D {
  constructor(readonly d: string) {}
}
let fills: string[] = [];

beforeEach(() => {
  layerSize = { width: 1200, height: 700 };
  fills = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("Path2D", FakePath2D);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ width: layerSize.width, height: layerSize.height, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      canvas: this,
      fillStyle: "",
      setTransform() {},
      clearRect() {},
      scale() {},
      save() {},
      restore() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      fill(path: FakePath2D) {
        fills.push(path.d);
      },
    } as unknown as CanvasRenderingContext2D;
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  observers.clear();
  document.body.innerHTML = "";
});

function page(props: RidgescapeProps) {
  return createElement("main", { style: ridgescapeParentStyle }, createElement(Ridgescape, props), createElement("p", null, "content"));
}

async function hydrate(props: RidgescapeProps) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(page(props));
  document.body.appendChild(container);
  const errors: unknown[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
  await act(async () => {
    hydrateRoot(container, page(props));
  });
  return { container, errors };
}

const layer = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-ridgescape]")!;

describe("<Ridgescape>", () => {
  it("renders one svg per layer on the server, hidden until measured", () => {
    const html = renderToString(page({ scene: presets.sierra }));
    expect(html.match(/<svg/g)).toHaveLength(5);
    expect(html).toContain('width="1440"');
    expect(html).toContain("opacity:0");
  });

  it("hydrates without errors, then lays out at the measured size and fades in", async () => {
    const { container, errors } = await hydrate({ scene: presets.misty });
    expect(errors).toEqual([]);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("1200");
    expect(svg.getAttribute("height")).toBe("700");
    expect(layer(container).style.opacity).toBe("1");
    // misty uses mist gradients
    expect(container.querySelector("linearGradient")).not.toBeNull();
  });

  it("re-renders when the element resizes", async () => {
    const { container } = await hydrate({ scene: { layers: 2 } });
    layerSize = { width: 600, height: 400 };
    await act(async () => observers.forEach((cb) => cb()));
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("600");
  });

  it("draws each layer on its own canvas with the canvas renderer", async () => {
    const { container, errors } = await hydrate({ scene: { layers: 3 }, renderer: "canvas" });
    expect(errors).toEqual([]);
    const canvases = container.querySelectorAll("canvas");
    expect(canvases).toHaveLength(3);
    expect(fills.length).toBeGreaterThanOrEqual(3);
    expect(fills[fills.length - 1]).toMatch(/^M.*Z$/);
    expect(canvases[0]!.style.width).toBe("1200px");
  });

  it("is shown straight away with reveal=none", () => {
    expect(renderToString(page({ scene: {}, reveal: "none" }))).not.toContain("opacity");
  });

  it("warns once about a parent without position or stacking context", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement("section", null, createElement(Ridgescape, { scene: {} })));
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/ridgescapeParentStyle/);
  });
});

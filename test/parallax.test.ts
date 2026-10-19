// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachParallax, parallaxDelta, parallaxOffset } from "ridgescape";

describe("parallaxDelta", () => {
  const vh = 800;
  it("is 0 while an element shorter than the window is fully in view", () => {
    expect(parallaxDelta({ top: 0, bottom: 500 }, vh)).toBe(0);
    expect(parallaxDelta({ top: 300, bottom: 800 }, vh)).toBe(0);
  });
  it("is positive while the bottom is below the window, negative once scrolled past the top", () => {
    expect(parallaxDelta({ top: 500, bottom: 1000 }, vh)).toBe(200);
    expect(parallaxDelta({ top: -120, bottom: 380 }, vh)).toBe(-120);
  });
  it("follows the bottom edge of an element taller than the window", () => {
    expect(parallaxDelta({ top: -1000, bottom: 1300 }, vh)).toBe(500);
    expect(parallaxDelta({ top: -1700, bottom: 600 }, vh)).toBe(-200);
  });
  it("is continuous", () => {
    for (const h of [400, 1600]) {
      for (let top = -2000; top <= 1000; top += 50) {
        const a = parallaxDelta({ top, bottom: top + h }, vh);
        const b = parallaxDelta({ top: top + 1, bottom: top + h + 1 }, vh);
        expect(Math.abs(b - a)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("parallaxOffset", () => {
  it("leaves the front layer alone and moves far layers against the scroll", () => {
    expect(parallaxOffset(0, 0.3, -200, 800)).toBe(0);
    expect(parallaxOffset(1, 0.3, -200, 800)).toBe(60);
    expect(parallaxOffset(0.5, 0.3, 200, 800)).toBe(-30);
  });
  it("stops after a window's height", () => {
    expect(parallaxOffset(1, 0.5, -5000, 800)).toBe(400);
  });
  it("never lifts a layer by more than the element's bottom is off-screen", () => {
    for (const delta of [10, 300, 900]) expect(-parallaxOffset(1, 1, delta, 800)).toBeLessThanOrEqual(delta);
  });
});

describe("attachParallax", () => {
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

  function setup() {
    const container = document.createElement("div");
    container.innerHTML = '<svg data-depth="1"></svg><svg data-depth="0"></svg>';
    container.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
    document.body.appendChild(container);
    const [far, near] = container.querySelectorAll<SVGElement>("svg");
    return { container, far: far!, near: near! };
  }

  it("moves far layers on scroll and resets when detached", () => {
    const { container, far, near } = setup();
    const detach = attachParallax(container, { strength: 0.5 });
    expect(far.style.transform).toBe("");
    rect = { top: -100, bottom: 400 };
    window.dispatchEvent(new Event("scroll"));
    frames.shift()!(0);
    expect(far.style.transform).toBe("translate3d(0, 50px, 0)");
    expect(near.style.transform).toBe("");
    detach();
    expect(far.style.transform).toBe("");
  });

  it("does nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { container, far } = setup();
    rect = { top: -100, bottom: 400 };
    attachParallax(container);
    expect(far.style.transform).toBe("");
  });
});

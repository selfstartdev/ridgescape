/**
 * Scroll parallax: far layers lag behind the page. Only transforms change, so
 * nothing is re-generated or redrawn while scrolling.
 *
 * The landscape looks exactly as designed whenever its element is fully in view
 * (or, for an element taller than the window, when its bottom edge is at the
 * bottom of the window). Away from that, each layer is offset by
 * strength × depth × the distance from there. While the element's bottom is
 * still below the window, layers lift, and the gap that opens at their bottom
 * is always off-screen: a layer moves less than the page does.
 *
 * Reflections move the other way: a lake at offset L mirroring a layer at
 * offset S shows it at 2L − S, clipped to the water, which stays at L. The clip
 * is on an element that moves with the lake, so it never changes.
 */
import { mirrorClip } from "../lakes";
import type { Rect } from "../render/types";

export interface ParallaxOptions {
  /** 0–1: how much the furthest layer lags behind the page. Default 0.3. */
  strength?: number;
}

export const PARALLAX_DEFAULTS = { strength: 0.3 };

/** px the element is away from its designed position: negative once scrolled past, positive before. */
export function parallaxDelta(rect: { top: number; bottom: number }, viewportHeight: number): number {
  if (rect.bottom > viewportHeight) return rect.bottom - viewportHeight;
  return Math.max(Math.min(rect.top, 0), rect.bottom - viewportHeight);
}

/** Vertical offset in px for a layer at `depth`, given the element's delta. */
export function parallaxOffset(depth: number, strength: number, delta: number, viewportHeight: number): number {
  // Past a window's height the landscape is off-screen, so there's no need to keep moving it.
  const d = Math.min(viewportHeight, Math.max(-viewportHeight, delta));
  const k = Math.min(1, Math.max(0, strength * depth));
  return round(-k * d);
}

/**
 * Moves the layers inside `container` as the page scrolls: elements with a
 * `data-depth` attribute, as <Ridgescape> and render() layers are drawn, and
 * reflections. A reflection is an element with `data-mirror` (the depth it
 * mirrors) inside one with `data-depth` (its lake's depth) that is clipped to
 * the water: the outer one moves with the lake, the inner one by the rest. Does
 * nothing under prefers-reduced-motion. Returns a function that stops it and
 * resets the layers.
 *
 * The elements are read once, so attach again after replacing them.
 */
export function attachParallax(container: HTMLElement, { strength = PARALLAX_DEFAULTS.strength }: ParallaxOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};
  const depth = (el: Element, name: string) => Number(el.getAttribute(name)) || 0;
  const layers = Array.from(container.querySelectorAll<HTMLElement | SVGElement>("[data-depth]"), (el) => ({ el, depth: depth(el, "data-depth") }));
  const mirrors = Array.from(container.querySelectorAll<HTMLElement | SVGElement>("[data-mirror]"), (el) => {
    const lake = el.parentElement?.closest("[data-depth]");
    return { el, depth: depth(el, "data-mirror"), lake: lake && container.contains(lake) ? depth(lake, "data-depth") : 0 };
  });
  const all = [...layers, ...mirrors];
  const reset = () => {
    for (const { el } of all) {
      el.style.transform = "";
      el.style.willChange = "";
    }
  };
  const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const move = (el: HTMLElement | SVGElement, offset: number) => {
    el.style.willChange = "transform";
    el.style.transform = offset === 0 ? "" : `translate3d(0, ${offset}px, 0)`;
  };

  let frame = 0;
  const update = () => {
    frame = 0;
    if (reduced?.matches) return reset();
    const vh = window.innerHeight;
    const delta = parallaxDelta(container.getBoundingClientRect(), vh);
    const offset = (d: number) => parallaxOffset(d, strength, delta, vh);
    for (const l of layers) move(l.el, offset(l.depth));
    // A reflection shows at 2L − S; its lake's element is already at L.
    for (const m of mirrors) move(m.el, round(offset(m.lake) - offset(m.depth)));
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reduced?.addEventListener?.("change", schedule);
  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    reduced?.removeEventListener?.("change", schedule);
    if (frame) cancelAnimationFrame(frame);
    reset();
  };
}

const round = (n: number) => Math.round(n * 100) / 100 + 0;

/** CSS clip-path for a reflection's outer element: its water. */
export function clipStyle(water: Rect[]): string {
  return `path("${mirrorClip(water)}")`;
}

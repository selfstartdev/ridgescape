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
 * offset S shows it at 2L − S, clipped to the water, which stays at L.
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
  const offset = -k * d;
  return offset === 0 ? 0 : Math.round(offset * 100) / 100;
}

/**
 * Moves the layers inside `container` (elements with a `data-depth` attribute,
 * as <Ridgescape> and render() layers are drawn) as the page scrolls. Does
 * nothing under prefers-reduced-motion. Returns a function that stops it and
 * resets the layers.
 */
export function attachParallax(container: HTMLElement, { strength = PARALLAX_DEFAULTS.strength }: ParallaxOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};
  const layers = () => Array.from(container.querySelectorAll<HTMLElement | SVGElement>("[data-depth]"));
  const reset = () => {
    for (const el of layers()) {
      el.style.transform = "";
      el.style.willChange = "";
      const water = waterOf(el);
      if (water) el.style.clipPath = clipStyle(water, 0);
    }
  };
  const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  let frame = 0;
  const update = () => {
    frame = 0;
    if (reduced?.matches) return reset();
    const vh = window.innerHeight;
    const delta = parallaxDelta(container.getBoundingClientRect(), vh);
    for (const el of layers()) {
      let offset = parallaxOffset(Number(el.getAttribute("data-depth")) || 0, strength, delta, vh);
      const water = waterOf(el);
      if (water) {
        const source = parallaxOffset(Number(el.getAttribute("data-mirror")) || 0, strength, delta, vh);
        const lake = offset;
        offset = round(2 * lake - source);
        // Keep the clip on the water: in the element's own coordinates, it's the other way by as much.
        el.style.clipPath = clipStyle(water, round(lake - offset));
      }
      el.style.willChange = "transform";
      el.style.transform = offset === 0 ? "" : `translate3d(0, ${offset}px, 0)`;
    }
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

/** A reflection element's water, from its data-water attribute; null for every other layer. */
function waterOf(el: Element): Rect[] | null {
  const attr = el.getAttribute("data-water");
  if (!attr) return null;
  try {
    return JSON.parse(attr) as Rect[];
  } catch {
    return null;
  }
}

/** CSS clip-path for a reflection element, its water shifted down by dy. */
export function clipStyle(water: Rect[], dy: number): string {
  return `path("${mirrorClip(water, dy)}")`;
}

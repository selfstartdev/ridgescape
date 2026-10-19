/**
 * Renderer: a scene at a size → plain data (one closed path and one fill per
 * layer). toSvg() writes it as an SVG string, drawToCanvas() paints it, and
 * ridgescape/react maps it to elements, so all three draw the same thing.
 */
import { mix } from "../color";
import { buildOutline } from "../outline";
import { hashString } from "../random";
import { resolve } from "../spec/resolve";
import type { Scene, SceneInput } from "../spec/types";

export interface RenderOptions {
  /** Element width in px. */
  width: number;
  /** Element height in px. */
  height: number;
  /** Extra px every layer reaches below the element, so parallax never uncovers its bottom edge. Default 0. */
  overscan?: number;
  /** Prefix for gradient ids, which are otherwise derived from their content. Default "ridgescape". */
  idPrefix?: string;
  /** Decimal places for coordinates. Default 2, which keeps output byte-stable. */
  precision?: number;
}

export interface GradientStop {
  offset: number;
  color: string;
}

/** A vertical gradient in element coordinates. */
export interface LinearFill {
  id: string;
  y1: number;
  y2: number;
  stops: GradientStop[];
}

export interface RenderedLayer {
  /** Position in the scene, back to front. */
  index: number;
  /** 0 (front) to 1 (horizon): how much the layer lags behind in parallax. */
  depth: number;
  /** The layer's closed outline as SVG path data, in element coordinates. */
  d: string;
  /** A colour, or a vertical gradient (mist). */
  fill: string | LinearFill;
  /** Highest point of the crest (smallest y). */
  top: number;
}

export interface RenderedScene {
  width: number;
  height: number;
  overscan: number;
  /** Back to front, in drawing order. */
  layers: RenderedLayer[];
}

export function render(scene: SceneInput | Scene, { width, height, overscan = 0, idPrefix = "ridgescape", precision = 2 }: RenderOptions): RenderedScene {
  if (!(width > 0) || !(height > 0)) throw new RangeError(`ridgescape: width and height must be greater than 0, got ${width} × ${height}`);
  const resolved = resolve(scene);
  const fmt = (n: number) => formatNumber(n, precision);
  const layers = resolved.layers.map((layer, index): RenderedLayer => {
    const outline = buildOutline(layer, { width, height }, { overscan });
    const { crest, bottom } = outline;
    let d = "M" + fmt(crest[0]!.x) + " " + fmt(crest[0]!.y);
    for (let i = 1; i < crest.length; i++) d += "L" + fmt(crest[i]!.x) + " " + fmt(crest[i]!.y);
    d += "L" + fmt(crest[crest.length - 1]!.x) + " " + fmt(bottom) + "L" + fmt(crest[0]!.x) + " " + fmt(bottom) + "Z";

    let fill: RenderedLayer["fill"] = layer.color;
    if (layer.mist > 0) {
      // From the highest crest down to the valleys, fading into the haze; solid haze-mix below.
      const y1 = outline.top;
      const y2 = Math.max(outline.baseline, y1 + 1);
      const gradient = {
        y1: Number(fmt(y1)),
        y2: Number(fmt(y2)),
        stops: [
          { offset: 0, color: layer.color },
          { offset: 1, color: mix(layer.color, resolved.haze.color, layer.mist) },
        ],
      };
      // Ids from the content, so two scenes on one page never pick up each other's gradients.
      fill = { id: `${idPrefix}-${hashString(JSON.stringify(gradient)).toString(36)}`, ...gradient };
    }
    return { index, depth: layer.depth, d, fill, top: Number(fmt(outline.top)) };
  });
  return { width, height, overscan: Math.max(0, overscan), layers };
}

export function formatNumber(n: number, precision = 2): string {
  const s = String(Number(n.toFixed(precision)));
  return s === "-0" ? "0" : s;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The SVG markup for one layer's fill definition, if it needs one. */
export function gradientMarkup(fill: LinearFill): string {
  const stops = fill.stops.map((s) => `<stop offset="${s.offset}" stop-color="${escape(s.color)}"/>`).join("");
  return `<linearGradient id="${escape(fill.id)}" gradientUnits="userSpaceOnUse" x1="0" y1="${fill.y1}" x2="0" y2="${fill.y2}">${stops}</linearGradient>`;
}

/** The SVG markup for one layer's path. */
export function layerMarkup(layer: RenderedLayer): string {
  const fill = typeof layer.fill === "string" ? escape(layer.fill) : `url(#${escape(layer.fill.id)})`;
  return `<path d="${layer.d}" fill="${fill}"/>`;
}

/** Writes rendered data as a standalone SVG string. */
export function serialize(rendered: RenderedScene): string {
  const { width, height, layers } = rendered;
  const gradients = layers.flatMap((l) => (typeof l.fill === "string" ? [] : [gradientMarkup(l.fill)]));
  const defs = gradients.length > 0 ? `<defs>${gradients.join("")}</defs>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    defs +
    layers.map(layerMarkup).join("") +
    `</svg>`
  );
}

/** A scene as a standalone SVG string at the given size. */
export function toSvg(scene: SceneInput | Scene, options: RenderOptions): string {
  return serialize(render(scene, options));
}

/**
 * Renderer: a scene at a size → plain data (layers of shapes). toSvg() writes
 * it as an SVG string, drawToCanvas() paints it, and ridgescape/react maps it to
 * elements, so all three draw the same thing.
 */
import { cloudLayers } from "../clouds";
import { mix } from "../color";
import { buildOutline } from "../outline";
import { hashString } from "../random";
import { skyLayers } from "../sky";
import { resolve } from "../spec/resolve";
import type { Scene, SceneInput } from "../spec/types";
import { groundPath } from "./paths";
import type { Fill, LinearFill, RadialFill, RenderContext, RenderedLayer, RenderedScene, RenderedShape } from "./types";

export type * from "./types";

export interface RenderOptions {
  /** Element width in px. */
  width: number;
  /** Element height in px. */
  height: number;
  /** Extra px every layer reaches below the element. Default 0. */
  overscan?: number;
  /** Prefix for gradient and clip ids, which are otherwise derived from their content. Default "ridgescape". */
  idPrefix?: string;
  /** Decimal places for coordinates. Default 2, which keeps output byte-stable. */
  precision?: number;
}

export function render(scene: SceneInput | Scene, { width, height, overscan = 0, idPrefix = "ridgescape", precision = 2 }: RenderOptions): RenderedScene {
  if (!(width > 0) || !(height > 0)) throw new RangeError(`ridgescape: width and height must be greater than 0, got ${width} × ${height}`);
  const resolved = resolve(scene);
  const fmt = (n: number) => formatNumber(n, precision);
  const ctx: RenderContext = {
    width,
    height,
    overscan: Math.max(0, overscan),
    fmt,
    round: (n) => Number(fmt(n)),
    // Ids from the content, so two scenes on one page never pick up each other's gradients.
    id: (content) => `${idPrefix}-${hashString(JSON.stringify(content)).toString(36)}`,
  };

  const layers: RenderedLayer[] = [];
  if (resolved.sky) layers.push(...skyLayers(resolved.sky, ctx));
  if (resolved.clouds) layers.push(...cloudLayers(resolved.clouds, resolved.palette, ctx));
  resolved.layers.forEach((layer, index) => {
    const outline = buildOutline(layer, { width, height }, { overscan: ctx.overscan });
    let fill: Fill = layer.color;
    if (layer.mist > 0) {
      // From the highest crest down to the valleys, fading into the haze; solid haze-mix below.
      const content = {
        y1: ctx.round(outline.top),
        y2: ctx.round(Math.max(outline.baseline, outline.top + 1)),
        stops: [
          { offset: 0, color: layer.color },
          { offset: 1, color: mix(layer.color, resolved.haze.color, layer.mist) },
        ],
      };
      fill = { type: "linear", id: ctx.id(content), x1: 0, x2: 0, ...content };
    }
    // Trees in their own colour: the whole silhouette in that colour, then the bare ground over it.
    const shapes: RenderedShape[] =
      layer.trees?.color && outline.ground
        ? [{ d: groundPath(outline.crest, outline.bottom, fmt), fill: layer.trees.color }, { d: groundPath(outline.ground, outline.bottom, fmt), fill }]
        : [{ d: groundPath(outline.crest, outline.bottom, fmt), fill }];
    layers.push({ key: `ground-${index}`, kind: "ground", index, depth: layer.depth, shapes, top: ctx.round(outline.top) });
  });
  return { width, height, overscan: ctx.overscan, layers };
}

export function formatNumber(n: number, precision = 2): string {
  const s = String(Number(n.toFixed(precision)));
  return s === "-0" ? "0" : s;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function stopsMarkup(fill: LinearFill | RadialFill): string {
  return fill.stops
    .map((s) => `<stop offset="${s.offset}" stop-color="${escape(s.color)}"${s.opacity !== undefined && s.opacity !== 1 ? ` stop-opacity="${s.opacity}"` : ""}/>`)
    .join("");
}

/** The SVG markup for a gradient. */
export function gradientMarkup(fill: LinearFill | RadialFill): string {
  if (fill.type === "radial") {
    return `<radialGradient id="${escape(fill.id)}" gradientUnits="userSpaceOnUse" cx="${fill.cx}" cy="${fill.cy}" r="${fill.r}">${stopsMarkup(fill)}</radialGradient>`;
  }
  return `<linearGradient id="${escape(fill.id)}" gradientUnits="userSpaceOnUse" x1="${fill.x1}" y1="${fill.y1}" x2="${fill.x2}" y2="${fill.y2}">${stopsMarkup(fill)}</linearGradient>`;
}

/** The id of a shape's clip path. */
export function clipId(shape: RenderedShape, idPrefix: string): string {
  return `${idPrefix}-clip-${hashString(shape.clip!).toString(36)}`;
}

/** Gradient and clip path definitions the layers need, each once, in order of first use. */
export function defsMarkup(layers: RenderedLayer[], idPrefix = "ridgescape"): string {
  const defs = new Map<string, string>();
  for (const layer of layers) {
    for (const shape of layer.shapes) {
      if (typeof shape.fill !== "string" && !defs.has(shape.fill.id)) defs.set(shape.fill.id, gradientMarkup(shape.fill));
      if (shape.clip) {
        const id = clipId(shape, idPrefix);
        if (!defs.has(id)) defs.set(id, `<clipPath id="${id}"><path d="${shape.clip}"/></clipPath>`);
      }
    }
  }
  return defs.size > 0 ? `<defs>${[...defs.values()].join("")}</defs>` : "";
}

/** The SVG markup for one shape. */
export function shapeMarkup(shape: RenderedShape, idPrefix = "ridgescape"): string {
  const fill = typeof shape.fill === "string" ? escape(shape.fill) : `url(#${escape(shape.fill.id)})`;
  const opacity = shape.opacity !== undefined && shape.opacity !== 1 ? ` opacity="${shape.opacity}"` : "";
  const transform = shape.transform ? ` transform="matrix(${shape.transform.join(" ")})"` : "";
  const path = `<path d="${shape.d}" fill="${fill}"${opacity}${transform}/>`;
  return shape.clip ? `<g clip-path="url(#${clipId(shape, idPrefix)})">${path}</g>` : path;
}

/** The SVG markup for one layer's shapes. */
export function layerMarkup(layer: RenderedLayer, idPrefix = "ridgescape"): string {
  return layer.shapes.map((s) => shapeMarkup(s, idPrefix)).join("");
}

/** Writes rendered data as a standalone SVG string. */
export function serialize(rendered: RenderedScene, idPrefix = "ridgescape"): string {
  const { width, height, layers } = rendered;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    defsMarkup(layers, idPrefix) +
    layers.map((l) => layerMarkup(l, idPrefix)).join("") +
    `</svg>`
  );
}

/** A scene as a standalone SVG string at the given size. */
export function toSvg(scene: SceneInput | Scene, options: RenderOptions): string {
  return serialize(render(scene, options), options.idPrefix);
}

/** Rendered data: what toSvg(), drawToCanvas() and <Ridgescape> all draw from. */

export interface GradientStop {
  offset: number;
  color: string;
  /** Default 1. */
  opacity?: number;
}

/** A linear gradient in element coordinates. */
export interface LinearFill {
  type: "linear";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
}

/** A radial gradient in element coordinates. */
export interface RadialFill {
  type: "radial";
  id: string;
  cx: number;
  cy: number;
  r: number;
  stops: GradientStop[];
}

export type Fill = string | LinearFill | RadialFill;

/** [a, b, c, d, e, f], as in CSS and canvas: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];

export interface RenderedShape {
  /** SVG path data, in element coordinates (before `transform`). */
  d: string;
  fill: Fill;
  /** Default 1. */
  opacity?: number;
  /** Path data the shape is clipped to, in element coordinates (not transformed). */
  clip?: string;
  transform?: Matrix;
  /** Set on shapes a reflection draws again: SVG gives the path this id. */
  id?: string;
  /** A reflection of the shape with this id: SVG draws it with <use> (which takes that shape's fill), canvas from `d`. */
  href?: string;
}

export type LayerKind = "sky" | "stars" | "sun" | "moon" | "clouds" | "ground" | "reflection" | "water";

/** [x0, y0, x1, y1]. */
export type Rect = [number, number, number, number];

/**
 * A reflection layer: neighbouring layers at `depth` mirrored in a lake, clipped to its water. With
 * parallax it moves the opposite way to what it mirrors, as a reflection does.
 *
 * For parallax, draw it as two elements: an outer one with `data-depth` (the lake's depth), clipped
 * to the water with `clip-path: clipStyle(mirror.water)`, around an inner one with
 * `data-mirror` (this depth) holding the shapes. attachParallax moves the outer one with the
 * lake and the inner one within it, so only transforms change while scrolling.
 */
export interface Mirror {
  /** Depth of the layers it mirrors. */
  depth: number;
  /** The water it shows in, rounded to the render's precision. */
  water: Rect[];
}

export interface RenderedLayer {
  /** Unique within the scene: "sky", "clouds-1", "ground-3"… */
  key: string;
  kind: LayerKind;
  /**
   * For ground layers, and the reflection and water layers of their lakes, the position in the
   * scene's `layers`; otherwise the position among its kind.
   */
  index: number;
  /**
   * 0 (front) to 1 (horizon): how much the layer lags behind in parallax. A reflection has its lake's
   * depth; what it mirrors is `mirror.depth`.
   */
  depth: number;
  /** Drawn in order. */
  shapes: RenderedShape[];
  /** Highest point of the layer (smallest y). */
  top: number;
  /** Reflection layers only: see Mirror for how to draw them for parallax. */
  mirror?: Mirror;
}

export interface RenderedScene {
  width: number;
  height: number;
  overscan: number;
  /** Back to front, in drawing order: sky, stars, sun, moon, clouds, then the ground layers (each followed by its lakes' reflection and water layers). */
  layers: RenderedLayer[];
}

/** Shared by the generators while rendering. */
export interface RenderContext {
  width: number;
  height: number;
  overscan: number;
  /** Number → string at the output precision. */
  fmt: (n: number) => string;
  /** Rounds to the output precision. */
  round: (n: number) => number;
  /** An id for a gradient or clip path from its content, so scenes on one page never share one by accident. */
  id: (content: unknown) => string;
}

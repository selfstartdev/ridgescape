import type { KeyPart } from "../random";
import type { PaletteName } from "../palettes";

/** px, or a percentage of the element's height (vertical lengths) or width (horizontal lengths). */
export type Length = number | `${number}%`;

export type ProfileKind = "rolling" | "peaks" | "mesa" | "dunes";

export type AnchorKind = "peak" | "dip" | "flat";

/** A hand-placed shape on a layer, blended into its generated profile. */
export interface AnchorInput {
  /** x position: px, or % of the element's width. */
  at: Length;
  /** Default "peak". */
  kind?: AnchorKind;
  /** Height above the layer's baseline that the profile is pulled to. Default per kind. */
  height?: Length;
  /** How far the anchor's influence reaches, in total: px, or % of the element's width. Default "20%". */
  width?: Length;
}

export interface Anchor {
  at: Length;
  kind: AnchorKind;
  height: Length;
  width: Length;
}

/** Groups of tree shapes: each tree picks one of the group's shapes at random. */
export type TreeKind = "conifer" | "deciduous" | "mixed";

/** Conifers: spruce (tiered), fir (a smooth spire), pine (tufts on top), cypress (a column). Deciduous: maple (round), oak (broad and lumpy), poplar (tall and narrow). */
export type TreeShape = "spruce" | "fir" | "pine" | "cypress" | "maple" | "oak" | "poplar";

/** A group, one shape, a list of either (equally likely), or shapes with weights. */
export type TreeKindInput = TreeKind | TreeShape | readonly (TreeKind | TreeShape)[] | Partial<Record<TreeShape, number>>;

/** A tree line along a layer's crest. */
export interface TreesInput {
  /** Which trees, mixed at random. Default "conifer". */
  kind?: TreeKindInput;
  /** 0–1: sparse to a solid forest. Default 0.6. */
  density?: number;
  /** Typical tree height: px, or % of the element's height. Default by depth: 44px at the front, smaller further back. */
  height?: Length;
  /** 0–1: how much of the ridge is forest rather than clearing. Default 1: unbroken. */
  cover?: number;
  /** 0–1: how much tree heights vary. Default 0.3. */
  variation?: number;
  /** Default: the layer's colour, so trees and ground are one silhouette. */
  color?: string;
  seed?: KeyPart;
}

export interface Trees {
  /** Each shape's share of the trees, summing to 1. */
  kind: Partial<Record<TreeShape, number>>;
  density: number;
  height: Length;
  cover: number;
  variation: number;
  /** null: the layer's colour. */
  color: string | null;
  seed: string;
}

/** A lake on a layer: its ground is flattened under a stretch of water that reflects what's behind. */
export interface LakeInput {
  /** Centre: px, or % of the element's width. */
  at: Length;
  /** Width of the water: px, or % of the element's width. Default "30%". */
  width?: Length;
  /** Water level above the layer's baseline: px, or % of the element's height. Default 12% of the amplitude. */
  level?: Length;
  /** Water colour. Default: the sky's bottom colour, darkened toward the layer's. */
  color?: string;
  /** Mirror the sky, clouds and layers behind it. Default true. */
  reflection?: boolean;
  /** Ripple streaks on the surface. Default true. */
  ripples?: boolean;
}

export interface Lake {
  at: Length;
  width: Length;
  level: Length;
  color: string;
  reflection: boolean;
  ripples: boolean;
}

export interface LayerInput {
  /** Default "rolling". */
  profile?: ProfileKind;
  /** 0 (front) to 1 (horizon). Default: spread evenly, back to front. */
  depth?: number;
  /** Height of the layer's lowest valleys above the bottom of the element. */
  baseline?: Length;
  /** How far the highest crest rises above the baseline. */
  amplitude?: Length;
  /** 0–1: smooth to craggy. */
  roughness?: number;
  /** Typical width of one hill, in px. */
  wavelength?: number;
  /** Width after which the layer repeats, in px. */
  period?: number;
  /** Fill colour. Default: from the palette and haze, by depth. */
  color?: string;
  /** 0–1: how far the layer fades into the haze colour toward its valleys. */
  mist?: number;
  anchors?: AnchorInput[];
  /** A tree line along the crest: true for the defaults. */
  trees?: boolean | TreesInput | null;
  lakes?: LakeInput[];
  /** Default: derived from the scene's seed and the layer's index. */
  seed?: KeyPart;
}

/** A layer with every default filled in. */
export interface Layer {
  profile: ProfileKind;
  depth: number;
  baseline: Length;
  amplitude: Length;
  roughness: number;
  wavelength: number;
  period: number;
  color: string;
  mist: number;
  anchors: Anchor[];
  trees: Trees | null;
  lakes: Lake[];
  seed: string;
}

export interface PaletteInput {
  /** Colour of the front layer. */
  near: string;
  /** Colour of the furthest layer, before haze. */
  far: string;
  /** Colour everything fades toward with depth. Default `far`. */
  haze?: string;
  /** Sky gradient, top to bottom. Used by the playground and, later, by sky effects. */
  sky?: [string, string];
  /** Default mist for every layer. */
  mist?: number;
  /** Sun or moon colour. Default: the haze, lightened. */
  sun?: string;
  /** Cloud colour. Default: the haze, lightened. */
  cloud?: string;
}

export interface Palette {
  near: string;
  far: string;
  haze: string;
  sky: [string, string];
  mist: number;
  sun: string;
  cloud: string;
}

/** A position: x (px, or % of the element's width) from the left, y (px, or % of its height) from the top. */
export type Point = [x: Length, y: Length];

export interface SunInput {
  /** Centre of the disc. */
  at?: Point;
  /** px. */
  radius?: number;
  /** Default: the palette's sun colour. */
  color?: string;
  /** 0–1: size and strength of the soft glow around it. */
  glow?: number;
}

export interface Sun {
  at: Point;
  radius: number;
  color: string;
  glow: number;
}

export interface MoonInput extends SunInput {
  /** 0 (full) to 1 (a thin sliver). */
  crescent?: number;
}

export interface Moon extends Sun {
  crescent: number;
}

export interface StarsInput {
  /** Stars per 100 × 100 px. Default 1. */
  density?: number;
  /** Size multiplier. Default 1. */
  size?: number;
  /** How far down from the top stars reach. Default "70%". */
  area?: Length;
  /** Default "#ffffff". */
  color?: string;
  seed?: KeyPart;
}

export interface Stars {
  density: number;
  size: number;
  area: Length;
  color: string;
  seed: string;
}

export interface SkyInput {
  /** Top and bottom colours. Default: the palette's sky; false for none (stars, sun and moon only). */
  gradient?: [string, string] | false | null;
  sun?: boolean | SunInput | null;
  moon?: boolean | MoonInput | null;
  stars?: boolean | StarsInput | null;
}

export interface Sky {
  gradient: [string, string] | null;
  sun: Sun | null;
  moon: Moon | null;
  stars: Stars | null;
}

export type CloudStyle = "puffy" | "streaks";

export interface CloudsInput {
  /** "puffy" (default): flat-bottomed heaps. "streaks": long thin wisps. */
  style?: CloudStyle;
  /** Rows of clouds at different depths. Default 2. */
  bands?: number;
  /** 0–1: how much of each row is cloud. Default 0.4. */
  cover?: number;
  /** Bases of the highest and lowest rows, from the top. Default "14%" and "40%". */
  top?: Length;
  bottom?: Length;
  /** Typical cloud width in the front row, px. Default 240. */
  size?: number;
  /** Default: the palette's cloud colour. */
  color?: string;
  /** 0–1: how much darker the undersides are. Default 0.2. */
  shade?: number;
  /** Default 0.92. */
  opacity?: number;
  seed?: KeyPart;
}

export interface Clouds {
  style: CloudStyle;
  bands: number;
  cover: number;
  top: Length;
  bottom: Length;
  size: number;
  color: string;
  shade: number;
  opacity: number;
  seed: string;
}

export interface HazeInput {
  /** Default: the palette's haze colour. */
  color?: string;
  /** 0–1: how much the furthest layer is covered by haze. Default 0.5. */
  strength?: number;
  /** Exponent on depth: above 1 keeps near layers clearer. Default 1.2. */
  curve?: number;
}

export interface Haze {
  color: string;
  strength: number;
  curve: number;
}

export interface SceneInput {
  /** Default "ridgescape". */
  seed?: KeyPart;
  /** A preset name or your own colours. Default "dusk". */
  palette?: PaletteName | PaletteInput;
  /** A count, or layers back to front. Default 4. */
  layers?: number | LayerInput[];
  /** Height of the landscape band, which sets the default baselines and amplitudes. Default "45%". */
  height?: Length;
  haze?: HazeInput;
  /** A sky behind everything: gradient, sun or moon, stars. Default none (the element's background shows). */
  sky?: boolean | SkyInput | null;
  clouds?: boolean | CloudsInput | null;
}

/** A scene with every default filled in: plain, JSON-serialisable data. */
export interface Scene {
  seed: string;
  palette: Palette;
  height: Length;
  haze: Haze;
  sky: Sky | null;
  clouds: Clouds | null;
  /** Back to front, in drawing order. */
  layers: Layer[];
}

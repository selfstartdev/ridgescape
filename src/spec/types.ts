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
}

export interface Palette {
  near: string;
  far: string;
  haze: string;
  sky: [string, string];
  mist: number;
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
}

/** A scene with every default filled in: plain, JSON-serialisable data. */
export interface Scene {
  seed: string;
  palette: Palette;
  height: Length;
  haze: Haze;
  /** Back to front, in drawing order. */
  layers: Layer[];
}

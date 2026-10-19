// Main API
export { render, serialize, toSvg, type GradientStop, type LinearFill, type RenderedLayer, type RenderedScene, type RenderOptions } from "./render";
export { resolve, resolvePalette, ANCHOR_HEIGHTS, DEPTH_DEFAULTS, PROFILE_DEFAULTS, SCENE_DEFAULTS } from "./spec/resolve";
export { palettes, type PaletteName } from "./palettes";
export { ridgescapeParentStyle } from "./parent";
export type {
  Anchor,
  AnchorInput,
  AnchorKind,
  Haze,
  HazeInput,
  Layer,
  LayerInput,
  Length,
  Palette,
  PaletteInput,
  ProfileKind,
  Scene,
  SceneInput,
} from "./spec/types";

// Building blocks, for advanced use
export { resolveLength, scaleLength, type Size } from "./spec/length";
export { buildProfile, SAMPLE_STEP, type Profile, type ProfileOptions } from "./profile";
export { periodicNoise, octaves, type Noise, type Octaves } from "./profile/noise";
export { buildOutline, simplify, type Outline, type OutlineOptions, type Vec } from "./outline";
export { layerColor, mix } from "./color";
export { formatNumber, gradientMarkup, layerMarkup } from "./render";
export { createRandom, hashString, type KeyPart, type Random } from "./random";

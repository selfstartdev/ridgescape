// Main API
export {
  render,
  serialize,
  toSvg,
  type Fill,
  type GradientStop,
  type LayerKind,
  type LinearFill,
  type MarkupOptions,
  type Matrix,
  type Mirror,
  type RadialFill,
  type Rect,
  type RenderedLayer,
  type RenderedScene,
  type RenderedShape,
  type RenderOptions,
} from "./render";
export { resolve, resolvePalette, ANCHOR_HEIGHTS, CLOUD_DEFAULTS, DEPTH_DEFAULTS, PROFILE_DEFAULTS, SCENE_DEFAULTS, SKY_DEFAULTS, TREE_DEFAULTS, TREE_GROUPS, TREE_SHAPES, LAKE_DEFAULTS } from "./spec/resolve";
export { palettes, type PaletteName } from "./palettes";
export { presets, type PresetName } from "./presets";
export { drawLayer, drawShape, drawToCanvas, type CanvasContext, type DrawOptions } from "./canvas";
export { attachParallax, clipStyle, parallaxDelta, parallaxOffset, PARALLAX_DEFAULTS, type ParallaxOptions } from "./parallax";
export { ridgescapeParentStyle } from "./parent";
export type {
  Anchor,
  AnchorInput,
  AnchorKind,
  Clouds,
  CloudsInput,
  CloudStyle,
  Haze,
  HazeInput,
  Lake,
  LakeInput,
  Layer,
  LayerInput,
  Length,
  Moon,
  MoonInput,
  Palette,
  PaletteInput,
  Point,
  ProfileKind,
  Scene,
  SceneInput,
  Sky,
  SkyInput,
  Stars,
  StarsInput,
  Sun,
  SunInput,
  TreeKind,
  TreeKindInput,
  TreeShape,
  Trees,
  TreesInput,
} from "./spec/types";

// Building blocks, for advanced use
export { resolveLength, scaleLength, type Size } from "./spec/length";
export { buildProfile, SAMPLE_STEP, type Profile, type ProfileOptions } from "./profile";
export { periodicNoise, octaves, type Noise, type Octaves } from "./profile/noise";
export { buildOutline, simplify, type Outline, type OutlineOptions, type Vec, type WaterSpan } from "./outline";
export { mirrorClip, reflectionLayers, waterBase, waterSurface, type LakeSpan } from "./lakes";
export { placeTrees, treeHeightAt, treeKeyPoints, type Tree, type TreeOptions, type TreePart } from "./trees";
export { format as formatColor, layerColor, mix, parseColor, type RGBA } from "./color";
export { clipId, mirrorClipId, defsMarkup, formatNumber, gradientMarkup, layerMarkup, shapeMarkup } from "./render";
export { capsulePath, circlePath, groundPath, rectPath } from "./render/paths";
export { createRandom, hashString, type KeyPart, type Random } from "./random";

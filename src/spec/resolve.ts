/**
 * resolve(): shorthands and defaults → a complete, JSON-serialisable Scene.
 * Everything that depends on depth (heights, smoothness, hill size, colour) is
 * decided here, so the rest of the pipeline only reads fields.
 */
import { palettes, type PaletteName } from "../palettes";
import { isLength, scaleLength } from "./length";
import type {
  Anchor,
  AnchorInput,
  AnchorKind,
  CloudsInput,
  Clouds,
  CloudStyle,
  Haze,
  Layer,
  LayerInput,
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
  Lake,
  LakeInput,
} from "./types";
import { layerColor, mix } from "../color";

export const SCENE_DEFAULTS = {
  seed: "ridgescape",
  palette: "dusk" as PaletteName,
  layers: 4,
  height: "45%" as const,
  haze: { strength: 0.5, curve: 1.2 },
};

const PROFILES: readonly ProfileKind[] = ["rolling", "peaks", "mesa", "dunes"];
const ANCHOR_KINDS: readonly AnchorKind[] = ["peak", "dip", "flat"];

/** Per profile: default roughness, and hill width relative to the depth default. */
export const PROFILE_DEFAULTS: Record<ProfileKind, { roughness: number; wavelength: number }> = {
  rolling: { roughness: 0.35, wavelength: 1 },
  peaks: { roughness: 0.75, wavelength: 0.8 },
  mesa: { roughness: 0.3, wavelength: 1.3 },
  dunes: { roughness: 0.25, wavelength: 0.55 },
};

/** Defaults that follow depth d (0 front, 1 horizon), as fractions of the scene's height or px. */
export const DEPTH_DEFAULTS = {
  /** Valleys: low at the front, high at the back. */
  baseline: (d: number) => 0.04 + 0.48 * d,
  /** Hills: gentle at the front, tall at the back. */
  amplitude: (d: number) => 0.28 + 0.3 * d,
  /** Hill width in px: broad at the front. */
  wavelength: (d: number) => 900 - 380 * d,
  /** Repeat width in px, different per layer so repeats don't line up. */
  period: (d: number) => 1800 + 700 * d,
  /** Far layers are smoother. */
  roughness: (d: number) => 1 - 0.3 * d,
};

export const SKY_DEFAULTS = {
  sun: { at: ["72%", "28%"] as Point, radius: 56, glow: 0.6 },
  moon: { at: ["24%", "22%"] as Point, radius: 36, glow: 0.35, crescent: 0 },
  stars: { density: 1, size: 1, area: "70%" as const, color: "#ffffff" },
};

export const CLOUD_DEFAULTS = {
  style: "puffy" as CloudStyle,
  bands: 2,
  cover: 0.4,
  top: "14%" as const,
  bottom: "40%" as const,
  size: 240,
  shade: 0.2,
  opacity: 0.92,
};

export const TREE_DEFAULTS = {
  kind: "conifer" as TreeKind,
  density: 0.6,
  cover: 1,
  variation: 0.3,
  /** Height in px by depth: 44 at the front, 12 at the horizon. */
  height: (d: number) => Math.round(44 * (1 - 0.72 * d)),
};

/** What each group expands to: mostly spruce and fir, or maple and oak, with a few of the rest. */
export const TREE_GROUPS: Record<TreeKind, Partial<Record<TreeShape, number>>> = {
  conifer: { spruce: 0.4, fir: 0.32, pine: 0.16, cypress: 0.12 },
  deciduous: { maple: 0.4, oak: 0.38, poplar: 0.22 },
  mixed: { spruce: 0.2, fir: 0.16, pine: 0.08, cypress: 0.06, maple: 0.2, oak: 0.19, poplar: 0.11 },
};

export const TREE_SHAPES: readonly TreeShape[] = ["spruce", "fir", "pine", "cypress", "maple", "oak", "poplar"];

export const LAKE_DEFAULTS = { width: "30%" as const, level: 0.12, reflection: true, ripples: true };

/** Anchor heights by kind, as fractions of the layer's amplitude. */
export const ANCHOR_HEIGHTS: Record<AnchorKind, number> = { peak: 1.15, dip: 0, flat: 0.2 };

export function resolve(input: SceneInput | Scene = {}): Scene {
  const seed = String(input.seed ?? SCENE_DEFAULTS.seed);
  const palette = resolvePalette(input.palette ?? SCENE_DEFAULTS.palette);
  const height = input.height ?? SCENE_DEFAULTS.height;
  if (!isLength(height)) throw new TypeError(`ridgescape: height must be px or a percentage, got ${JSON.stringify(height)}`);
  const haze: Haze = {
    color: input.haze?.color ?? palette.haze,
    strength: unit(input.haze?.strength ?? SCENE_DEFAULTS.haze.strength, "haze.strength"),
    curve: positive(input.haze?.curve ?? SCENE_DEFAULTS.haze.curve, "haze.curve"),
  };

  const raw = input.layers ?? SCENE_DEFAULTS.layers;
  const list: LayerInput[] = typeof raw === "number" ? Array.from({ length: count(raw) }, () => ({})) : raw;
  const n = list.length;
  const layers = list.map((layer, i) => resolveLayer(layer, { index: i, depth: n > 1 ? (n - 1 - i) / (n - 1) : 0, seed, palette, haze, height }));
  const sky = input.sky ? resolveSky(input.sky === true ? {} : input.sky, palette, seed) : null;
  const clouds = input.clouds ? resolveClouds(input.clouds === true ? {} : input.clouds, palette, seed) : null;
  return { seed, palette, height, haze, sky, clouds, layers };
}

interface LayerContext {
  index: number;
  /** Default depth from the layer's place in the list. */
  depth: number;
  seed: string;
  palette: Palette;
  haze: Haze;
  height: Scene["height"];
}

function resolveLayer(input: LayerInput, ctx: LayerContext): Layer {
  const profile = input.profile ?? "rolling";
  if (!PROFILES.includes(profile)) throw new TypeError(`ridgescape: unknown profile ${JSON.stringify(profile)}; expected ${PROFILES.join(", ")}`);
  const depth = unit(input.depth ?? ctx.depth, "depth");
  const p = PROFILE_DEFAULTS[profile];
  const amplitude = length(input.amplitude ?? scaleLength(ctx.height, DEPTH_DEFAULTS.amplitude(depth)), "amplitude");
  const seed = String(input.seed ?? `${ctx.seed}:${ctx.index}`);
  const color = input.color ?? layerColor(ctx.palette, ctx.haze, depth);
  return {
    profile,
    depth,
    baseline: length(input.baseline ?? scaleLength(ctx.height, DEPTH_DEFAULTS.baseline(depth)), "baseline"),
    amplitude,
    roughness: unit(input.roughness ?? round(p.roughness * DEPTH_DEFAULTS.roughness(depth)), "roughness"),
    wavelength: positive(input.wavelength ?? Math.round(DEPTH_DEFAULTS.wavelength(depth) * p.wavelength), "wavelength"),
    period: positive(input.period ?? Math.round(DEPTH_DEFAULTS.period(depth)), "period"),
    color,
    mist: unit(input.mist ?? ctx.palette.mist, "mist"),
    anchors: (input.anchors ?? []).map((a) => resolveAnchor(a, amplitude)),
    trees: input.trees ? resolveTrees(input.trees === true ? {} : input.trees, depth, seed) : null,
    lakes: (input.lakes ?? []).map((l) => resolveLake(l, amplitude, color, ctx.palette)),
    seed,
  };
}

function flag(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`ridgescape: ${name} must be true or false, got ${JSON.stringify(value)}`);
  return value;
}

function resolveLake(input: LakeInput | Lake, amplitude: Layer["amplitude"], layerColor: string, palette: Palette): Lake {
  return {
    at: length(input.at, "lake at"),
    width: length(input.width ?? LAKE_DEFAULTS.width, "lake width"),
    level: length(input.level ?? scaleLength(amplitude, LAKE_DEFAULTS.level), "lake level"),
    color: input.color ?? waterColor(palette.sky[1], layerColor),
    reflection: flag(input.reflection ?? LAKE_DEFAULTS.reflection, "lake reflection"),
    ripples: flag(input.ripples ?? LAKE_DEFAULTS.ripples, "lake ripples"),
  };
}

/** Water takes the sky's colour, a little toward the land around it. */
function waterColor(sky: string, land: string): string {
  try {
    return mix(sky, land, 0.35);
  } catch {
    return land;
  }
}

function resolveTrees(input: TreesInput | Trees, depth: number, layerSeed: string): Trees {
  return {
    kind: resolveTreeKind(input.kind ?? TREE_DEFAULTS.kind),
    density: unit(input.density ?? TREE_DEFAULTS.density, "trees.density"),
    height: length(input.height ?? TREE_DEFAULTS.height(depth), "trees.height"),
    cover: unit(input.cover ?? TREE_DEFAULTS.cover, "trees.cover"),
    variation: unit(input.variation ?? TREE_DEFAULTS.variation, "trees.variation"),
    color: input.color ?? null,
    seed: String(input.seed ?? `${layerSeed}:trees`),
  };
}

/** A tree kind as shares of each shape, in a fixed order, summing to 1. */
function resolveTreeKind(input: TreeKindInput): Trees["kind"] {
  const fail = (kind: unknown): never => {
    throw new TypeError(`ridgescape: unknown tree kind ${JSON.stringify(kind)}; expected one of ${[...Object.keys(TREE_GROUPS), ...TREE_SHAPES].join(", ")}`);
  };
  const weights: Partial<Record<TreeShape, number>> = {};
  const add = (name: string, weight: number) => {
    if (name in TREE_GROUPS) {
      for (const [shape, w] of Object.entries(TREE_GROUPS[name as TreeKind])) weights[shape as TreeShape] = (weights[shape as TreeShape] ?? 0) + w * weight;
    } else if (TREE_SHAPES.includes(name as TreeShape)) {
      weights[name as TreeShape] = (weights[name as TreeShape] ?? 0) + weight;
    } else fail(name);
  };
  if (typeof input === "string") add(input, 1);
  else if (Array.isArray(input)) for (const name of input as readonly string[]) add(name, 1);
  else if (input && typeof input === "object") {
    for (const [name, w] of Object.entries(input)) {
      if (!TREE_SHAPES.includes(name as TreeShape)) fail(name);
      if (typeof w !== "number" || !(w >= 0) || !Number.isFinite(w)) throw new TypeError(`ridgescape: trees.kind.${name} must be a number ≥ 0`);
      add(name, w);
    }
  } else fail(input);
  const total = Object.values(weights).reduce((t: number, w) => t + w!, 0);
  if (!(total > 0)) fail(input);
  const out: Partial<Record<TreeShape, number>> = {};
  for (const shape of TREE_SHAPES) if (weights[shape]) out[shape] = Number((weights[shape]! / total).toFixed(6));
  return out;
}

function resolveAnchor(input: AnchorInput, amplitude: Layer["amplitude"]): Anchor {
  const kind = input.kind ?? "peak";
  if (!ANCHOR_KINDS.includes(kind)) throw new TypeError(`ridgescape: unknown anchor kind ${JSON.stringify(kind)}; expected ${ANCHOR_KINDS.join(", ")}`);
  return {
    at: length(input.at, "anchor at"),
    kind,
    height: length(input.height ?? scaleLength(amplitude, ANCHOR_HEIGHTS[kind]), "anchor height"),
    width: length(input.width ?? "20%", "anchor width"),
  };
}

function resolveSky(input: SkyInput | Sky, palette: Palette, seed: string): Sky {
  const gradient = input.gradient === false || input.gradient === null ? null : (input.gradient ?? palette.sky);
  const disc = <T extends SunInput>(value: boolean | T | null | undefined, defaults: { at: Point; radius: number; glow: number }, name: string): Sun | null => {
    if (!value) return null;
    const v: SunInput = value === true ? {} : value;
    const at = v.at ?? defaults.at;
    if (!Array.isArray(at) || at.length !== 2 || !isLength(at[0]) || !isLength(at[1])) throw new TypeError(`ridgescape: ${name}.at must be [x, y] in px or percentages, got ${JSON.stringify(at)}`);
    return { at: [at[0], at[1]], radius: positive(v.radius ?? defaults.radius, `${name}.radius`), color: v.color ?? palette.sun, glow: unit(v.glow ?? defaults.glow, `${name}.glow`) };
  };
  const sun = disc(input.sun, SKY_DEFAULTS.sun, "sun");
  const moonDisc = disc(input.moon, SKY_DEFAULTS.moon, "moon");
  const moonInput: MoonInput = typeof input.moon === "object" && input.moon ? input.moon : {};
  const moon: Moon | null = moonDisc && { ...moonDisc, crescent: unit(moonInput.crescent ?? SKY_DEFAULTS.moon.crescent, "moon.crescent") };
  let stars: Stars | null = null;
  if (input.stars) {
    const s: StarsInput = input.stars === true ? {} : input.stars;
    stars = {
      density: positive(s.density ?? SKY_DEFAULTS.stars.density, "stars.density"),
      size: positive(s.size ?? SKY_DEFAULTS.stars.size, "stars.size"),
      area: length(s.area ?? SKY_DEFAULTS.stars.area, "stars.area"),
      color: s.color ?? SKY_DEFAULTS.stars.color,
      seed: String(s.seed ?? `${seed}:stars`),
    };
  }
  return { gradient: gradient ? [gradient[0], gradient[1]] : null, sun, moon, stars };
}

const CLOUD_STYLES: readonly CloudStyle[] = ["puffy", "streaks"];

function resolveClouds(input: CloudsInput | Clouds, palette: Palette, seed: string): Clouds {
  const style = input.style ?? CLOUD_DEFAULTS.style;
  if (!CLOUD_STYLES.includes(style)) throw new TypeError(`ridgescape: unknown cloud style ${JSON.stringify(style)}; expected ${CLOUD_STYLES.join(", ")}`);
  const bands = input.bands ?? CLOUD_DEFAULTS.bands;
  if (!Number.isInteger(bands) || bands < 1 || bands > 8) throw new RangeError(`ridgescape: clouds.bands must be a whole number from 1 to 8, got ${bands}`);
  return {
    style,
    bands,
    cover: unit(input.cover ?? CLOUD_DEFAULTS.cover, "clouds.cover"),
    top: length(input.top ?? CLOUD_DEFAULTS.top, "clouds.top"),
    bottom: length(input.bottom ?? CLOUD_DEFAULTS.bottom, "clouds.bottom"),
    size: positive(input.size ?? CLOUD_DEFAULTS.size, "clouds.size"),
    color: input.color ?? palette.cloud,
    shade: unit(input.shade ?? CLOUD_DEFAULTS.shade, "clouds.shade"),
    opacity: unit(input.opacity ?? CLOUD_DEFAULTS.opacity, "clouds.opacity"),
    seed: String(input.seed ?? `${seed}:clouds`),
  };
}

export function resolvePalette(input: PaletteName | PaletteInput): Palette {
  const p: PaletteInput | undefined = typeof input === "string" ? palettes[input] : input;
  if (!p) throw new TypeError(`ridgescape: unknown palette ${JSON.stringify(input)}; expected ${Object.keys(palettes).join(", ")} or your own colours`);
  const haze = p.haze ?? p.far;
  return { near: p.near, far: p.far, haze, sky: p.sky ?? [haze, haze], mist: p.mist ?? 0, sun: p.sun ?? lighten(haze, 0.5), cloud: p.cloud ?? lighten(haze, 0.6) };
}

/** The haze toward white, or white if the haze can't be mixed (a CSS variable, say). */
function lighten(color: string, t: number): string {
  try {
    return mix(color, "#ffffff", t);
  } catch {
    return "#ffffff";
  }
}

function count(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 32) throw new RangeError(`ridgescape: layers must be a whole number from 1 to 32, got ${n}`);
  return n;
}

function unit(n: number, name: string): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1) throw new RangeError(`ridgescape: ${name} must be from 0 to 1, got ${n}`);
  return n;
}

function positive(n: number, name: string): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) throw new RangeError(`ridgescape: ${name} must be greater than 0, got ${n}`);
  return n;
}

function length<T>(value: T, name: string): T & Layer["baseline"] {
  if (!isLength(value)) throw new TypeError(`ridgescape: ${name} must be px or a percentage, got ${JSON.stringify(value)}`);
  return value as T & Layer["baseline"];
}

const round = (n: number) => Number(n.toFixed(4));

/**
 * resolve(): shorthands and defaults → a complete, JSON-serialisable Scene.
 * Everything that depends on depth (heights, smoothness, hill size, colour) is
 * decided here, so the rest of the pipeline only reads fields.
 */
import { palettes, type PaletteName } from "../palettes";
import { isLength, scaleLength } from "./length";
import type { Anchor, AnchorInput, AnchorKind, Haze, Layer, LayerInput, Palette, PaletteInput, ProfileKind, Scene, SceneInput } from "./types";
import { layerColor } from "../color";

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
  return { seed, palette, height, haze, layers };
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
  return {
    profile,
    depth,
    baseline: length(input.baseline ?? scaleLength(ctx.height, DEPTH_DEFAULTS.baseline(depth)), "baseline"),
    amplitude,
    roughness: unit(input.roughness ?? round(p.roughness * DEPTH_DEFAULTS.roughness(depth)), "roughness"),
    wavelength: positive(input.wavelength ?? Math.round(DEPTH_DEFAULTS.wavelength(depth) * p.wavelength), "wavelength"),
    period: positive(input.period ?? Math.round(DEPTH_DEFAULTS.period(depth)), "period"),
    color: input.color ?? layerColor(ctx.palette, ctx.haze, depth),
    mist: unit(input.mist ?? ctx.palette.mist, "mist"),
    anchors: (input.anchors ?? []).map((a) => resolveAnchor(a, amplitude)),
    seed: String(input.seed ?? `${ctx.seed}:${ctx.index}`),
  };
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

export function resolvePalette(input: PaletteName | PaletteInput): Palette {
  const p: PaletteInput | undefined = typeof input === "string" ? palettes[input] : input;
  if (!p) throw new TypeError(`ridgescape: unknown palette ${JSON.stringify(input)}; expected ${Object.keys(palettes).join(", ")} or your own colours`);
  return { near: p.near, far: p.far, haze: p.haze ?? p.far, sky: p.sky ?? [p.haze ?? p.far, p.haze ?? p.far], mist: p.mist ?? 0 };
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

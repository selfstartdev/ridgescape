import type { Haze, Palette } from "../spec/types";
import { parseColor, type RGBA } from "./parse";

export { parseColor, type RGBA } from "./parse";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * Math.max(0, v) : 1.055 * v ** (1 / 2.4) - 0.055) * 255;

type Lab = [number, number, number, number];

function toOklab({ r, g, b, a }: RGBA): Lab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    a,
  ];
}

function fromOklab([L, A, B, alpha]: Lab): RGBA {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

function parse(color: string): RGBA {
  const c = parseColor(color);
  if (!c) throw new TypeError(`ridgescape: can't mix ${JSON.stringify(color)}; palette and haze colours must be hex, rgb(), hsl() or named`);
  return c;
}

/** `a` mixed toward `b` by t (0–1), in OKLab. Returns hex, or rgba() when not opaque. */
export function mix(a: string, b: string, t: number): string {
  const la = toOklab(parse(a)), lb = toOklab(parse(b));
  const u = clamp(t, 0, 1);
  return format(fromOklab(la.map((v, i) => v + (lb[i]! - v) * u) as Lab));
}

export function format({ r, g, b, a }: RGBA): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  if (a >= 1) return `#${h(r)}${h(g)}${h(b)}`;
  const c = (n: number) => Math.round(clamp(n, 0, 255));
  return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Number(clamp(a, 0, 1).toFixed(3))})`;
}

/** A layer's default colour: near → far by depth, then into the haze. */
export function layerColor(palette: Palette, haze: Haze, depth: number): string {
  return mix(mix(palette.near, palette.far, depth), haze.color, haze.strength * depth ** haze.curve);
}

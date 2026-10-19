import type { Length } from "./types";

export interface Size {
  width: number;
  height: number;
}

const PERCENT = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)%\s*$/i;

export function isLength(value: unknown): value is Length {
  return (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && PERCENT.test(value));
}

/** A length in px; percentages are of `total`. */
export function resolveLength(value: Length, total: number): number {
  if (typeof value === "number") return value;
  const m = PERCENT.exec(value);
  if (!m) throw new TypeError(`ridgescape: expected px or a percentage, got ${JSON.stringify(value)}`);
  return (Number(m[1]) / 100) * total;
}

/** `value` scaled by `k`, in the same unit, so defaults derived from a % stay a %. */
export function scaleLength(value: Length, k: number): Length {
  if (typeof value === "number") return round(value * k);
  return `${round(resolveLength(value, 100) * k)}%`;
}

const round = (n: number) => Number(n.toFixed(4));

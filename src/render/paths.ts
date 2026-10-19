/**
 * Path data for the simple shapes. All are drawn clockwise on screen, so any
 * number of them in one path fill as their union.
 */
import type { RenderContext } from "./types";

type Fmt = RenderContext["fmt"];

export function circlePath(cx: number, cy: number, r: number, fmt: Fmt): string {
  const R = fmt(r);
  return `M${fmt(cx - r)} ${fmt(cy)}A${R} ${R} 0 1 1 ${fmt(cx + r)} ${fmt(cy)}A${R} ${R} 0 1 1 ${fmt(cx - r)} ${fmt(cy)}Z`;
}

/** A horizontal pill from (x0, y0) to (x1, y1). */
export function capsulePath(x0: number, y0: number, x1: number, y1: number, fmt: Fmt): string {
  const r = Math.min((y1 - y0) / 2, (x1 - x0) / 2);
  const R = fmt(r);
  return `M${fmt(x0 + r)} ${fmt(y0)}H${fmt(x1 - r)}A${R} ${R} 0 0 1 ${fmt(x1 - r)} ${fmt(y1)}H${fmt(x0 + r)}A${R} ${R} 0 0 1 ${fmt(x0 + r)} ${fmt(y0)}Z`;
}

export function rectPath(x0: number, y0: number, x1: number, y1: number, fmt: Fmt): string {
  return `M${fmt(x0)} ${fmt(y0)}H${fmt(x1)}V${fmt(y1)}H${fmt(x0)}Z`;
}

/** A polyline closed down to `bottom`: the shape of a ground layer. */
export function groundPath(points: { x: number; y: number }[], bottom: number, fmt: Fmt): string {
  let d = "M" + fmt(points[0]!.x) + " " + fmt(points[0]!.y);
  for (let i = 1; i < points.length; i++) d += "L" + fmt(points[i]!.x) + " " + fmt(points[i]!.y);
  return d + "L" + fmt(points[points.length - 1]!.x) + " " + fmt(bottom) + "L" + fmt(points[0]!.x) + " " + fmt(bottom) + "Z";
}

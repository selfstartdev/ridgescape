"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { attachParallax, clipStyle, defsMarkup, drawLayer, layerMarkup, render, type ParallaxOptions, type RenderedLayer, type Scene, type SceneInput } from "ridgescape";

// Everything in the core is also available from "ridgescape/react", including ridgescapeParentStyle
// (though server components should import that from "ridgescape"; see src/parent.ts).
export * from "ridgescape";

export interface RidgescapeProps {
  /** The landscape: a scene, a resolved Scene, or a preset (`presets.sierra`). */
  scene: SceneInput | Scene;
  /** "svg" (default) renders on the server too; "canvas" draws in the browser. */
  renderer?: "svg" | "canvas";
  /**
   * Far layers lag behind as the page scrolls. true for the default strength (0.3), or
   * `{ strength }` from 0 to 1. Off under prefers-reduced-motion, and with attach="fixed".
   */
  parallax?: boolean | ParallaxOptions;
  /**
   * "scroll" (default): the layer covers its parent and scrolls with the page.
   * "fixed": the layer is pinned to the viewport.
   */
  attach?: "scroll" | "fixed";
  /** Break out of the parent's width to the full viewport width (the parent's height is kept). */
  fullBleed?: boolean;
  /** Size rendered on the server and before the layer is measured. Default 1440 × 900. */
  initialSize?: { width: number; height: number };
  /**
   * "fade" (default): hidden until measured, then faded in, so the landscape never jumps.
   * "none": shown straight away at `initialSize`, then re-laid out once measured.
   */
  reveal?: "fade" | "none";
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_INITIAL_SIZE = { width: 1440, height: 900 };

interface Size {
  width: number;
  height: number;
}

/**
 * A layered landscape behind its parent's content.
 *
 * Place it inside the element it should sit behind; give that element
 * `ridgescapeParentStyle` (position: relative; isolation: isolate).
 */
export function Ridgescape({
  scene,
  renderer = "svg",
  parallax = false,
  attach = "scroll",
  fullBleed = false,
  initialSize = DEFAULT_INITIAL_SIZE,
  reveal = "fade",
  className,
  style,
}: RidgescapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idPrefix = "ridgescape" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Unmeasured until mount, so server and first client render match exactly.
  const [measured, setMeasured] = useState<Size | null>(null);
  const [bleedWidth, setBleedWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      if (next.width === 0 || next.height === 0) return;
      setMeasured((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
      // 100vw includes the vertical scrollbar; the document's client width does not.
      if (fullBleed) setBleedWidth(document.documentElement.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (fullBleed) observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [fullBleed]);

  useEffect(() => {
    if (isDev() && attach === "scroll") warnAboutParent(ref.current);
  }, [attach]);

  // Scenes are plain data, so a serialized key keeps inline objects from re-rendering every time.
  const sceneKey = JSON.stringify(scene);
  const size = measured ?? initialSize;
  const rendered = useMemo(
    () => render(scene, { width: size.width, height: size.height, idPrefix }),
    [sceneKey, size.width, size.height, idPrefix], // sceneKey stands in for scene
  );

  const strength = typeof parallax === "object" ? parallax.strength : undefined;
  const parallaxOn = parallax !== false && attach !== "fixed";
  useEffect(() => {
    const el = ref.current;
    if (!parallaxOn || !el) return;
    // Re-attached after every render, so new layer elements pick up their offsets straight away.
    return attachParallax(el, { strength });
  }, [parallaxOn, strength, rendered, renderer]);

  const hidden = reveal === "fade" && measured === null;
  const layerStyle: CSSProperties = {
    position: attach === "fixed" ? "fixed" : "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: -1,
    pointerEvents: "none",
    ...(reveal === "fade" ? { opacity: hidden ? 0 : 1, transition: "opacity 150ms ease-out" } : {}),
    ...(fullBleed && attach === "scroll"
      ? { left: "50%", right: "auto", width: bleedWidth ?? "100vw", transform: "translateX(-50%)" }
      : {}),
    ...style,
  };

  const { width, height, overscan } = rendered;
  return (
    <div ref={ref} aria-hidden="true" className={className} style={layerStyle} data-ridgescape="">
      {rendered.layers.map((layer) => {
        const props = { layer, width, height: height + overscan, idPrefix };
        const element = renderer === "canvas" ? <CanvasLayer {...props} /> : <SvgLayer {...props} />;
        // A reflection: an element clipped to the water that moves with the lake, the layer moving within it.
        return layer.mirror ? (
          <div
            key={layer.key}
            data-depth={layer.depth}
            data-kind={layer.kind}
            style={{ ...layerElementStyle, width, height: height + overscan, clipPath: clipStyle(layer.mirror.water) }}
          >
            {element}
          </div>
        ) : (
          <Fragment key={layer.key}>{element}</Fragment>
        );
      })}
    </div>
  );
}

interface LayerProps {
  layer: RenderedLayer;
  width: number;
  height: number;
  idPrefix: string;
}

/** Every layer is its own element, so parallax can move it without redrawing. */
const layerElementStyle: CSSProperties = { position: "absolute", top: 0, left: 0, display: "block" };

/** Reflections are clipped to their water by the element around them, so parallax can move them within it. */
const unclipped = { clipMirrors: false };

/** Attributes for a layer's element: its depth for parallax, or for a reflection, the depth it mirrors. */
function layerAttributes(layer: RenderedLayer, style: CSSProperties) {
  return {
    ...(layer.mirror ? { "data-mirror": layer.mirror.depth } : { "data-depth": layer.depth, "data-kind": layer.kind }),
    style,
  };
}

function SvgLayer({ layer, width, height, idPrefix }: LayerProps) {
  // The same markup toSvg() writes, so the two can't drift apart.
  const markup = defsMarkup([layer], idPrefix, unclipped) + layerMarkup(layer, idPrefix, unclipped);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      focusable="false"
      {...layerAttributes(layer, layerElementStyle)}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function CanvasLayer({ layer, width, height }: LayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    // Capped at 2: a landscape is soft-edged, and a 3× full-page canvas per layer costs real memory.
    setRatio(Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
  }, []);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.scale(ratio, ratio);
    drawLayer(ctx, layer, unclipped);
  }, [layer, ratio, width, height]);
  return (
    <canvas
      ref={ref}
      width={Math.round(width * ratio)}
      height={Math.round(height * ratio)}
      {...layerAttributes(layer, { ...layerElementStyle, width, height })}
    />
  );
}

function isDev(): boolean {
  // Bundlers replace process.env.NODE_ENV; guard for environments without `process`.
  return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
}

const warned = new WeakSet<Element>();

function warnAboutParent(el: HTMLElement | null) {
  const parent = el?.parentElement;
  if (!parent || warned.has(parent)) return;
  const cs = getComputedStyle(parent);
  const problems: string[] = [];
  if (cs.position === "static") problems.push("is not positioned (the layer will cover the wrong element)");
  const stacking = cs.isolation === "isolate" || (cs.position !== "static" && cs.zIndex !== "auto");
  if (!stacking) problems.push("has no stacking context (the layer can disappear behind backgrounds)");
  if (problems.length === 0) return;
  warned.add(parent);
  console.warn(
    `ridgescape: the parent of <Ridgescape> ${problems.join(" and ")}. Give it ridgescapeParentStyle ` +
      `({ position: "relative", isolation: "isolate" }).`,
    parent,
  );
}

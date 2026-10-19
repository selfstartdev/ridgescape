import { describe, expect, it } from "vitest";
import { layerColor, mix, resolve } from "ridgescape";

describe("colour", () => {
  it("mixes in OKLab and returns hex", () => {
    expect(mix("#000", "#fff", 0)).toBe("#000000");
    expect(mix("#000", "#fff", 1)).toBe("#ffffff");
    // Lightness 0.5 in OKLab, a perceptual mid grey.
    expect(mix("black", "white", 0.5)).toBe("#636363");
  });

  it("keeps alpha", () => {
    expect(mix("rgba(0, 0, 0, 0)", "#000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("rejects colours it can't mix", () => {
    expect(() => mix("var(--x)", "#000", 0.5)).toThrow(/can't mix/);
  });

  it("fades layers into the haze with depth", () => {
    const { palette, haze } = resolve({ palette: "mono" });
    expect(layerColor(palette, haze, 0)).toBe(palette.near.toLowerCase());
    const far = layerColor(palette, haze, 1);
    expect(far).toBe(mix(palette.far, palette.haze, haze.strength));
  });

  it("lets a layer colour skip the palette", () => {
    expect(resolve({ palette: { near: "var(--a)", far: "var(--b)" }, layers: [{ color: "var(--c)" }] }).layers[0]!.color).toBe("var(--c)");
  });
});

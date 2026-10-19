/**
 * Golden tests: the stability promise.
 *
 * Same scene + same element size + same major version = identical output. If a
 * golden file changes, the generated output changed, and from 1.0 that is a
 * MAJOR release. Never update these with `vitest -u` to make a failure go away;
 * treat it as a deliberate decision and record it in a changeset.
 */
import { describe, expect, it } from "vitest";
import { palettes, presets, toSvg, type SceneInput } from "../src";

const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

describe("golden presets", () => {
  for (const [name, scene] of Object.entries(presets)) {
    it.each(sizes)(`${name} at $name size`, async ({ name: sizeName, width, height }) => {
      await expect(toSvg(scene, { width, height }) + "\n").toMatchFileSnapshot(`golden/presets/${name}-${sizeName}.svg`);
    });
  }
});

/** One of everything the presets don't cover. */
const extras: Record<string, SceneInput> = {
  profiles: { seed: "profiles", layers: (["peaks", "mesa", "dunes", "rolling"] as const).map((profile) => ({ profile, roughness: 0.6 })) },
  anchors: {
    seed: "anchors",
    layers: [
      { profile: "peaks", anchors: [{ at: "70%", height: "40%", width: 500 }] },
      { anchors: [{ at: "30%", kind: "flat", width: "40%" }] },
      { anchors: [{ at: 200, kind: "dip", width: 300 }] },
    ],
  },
  px: { seed: "px", height: 420, layers: [{ baseline: 180, amplitude: 160, period: 1200 }, { mist: 0.5 }] },
  colours: { seed: "colours", palette: { near: "rgb(20 40 60)", far: "hsl(200 40% 70%)", haze: "white", mist: 0.3 }, layers: [{ color: "#a0c" }, {}, {}] },
  overscan: { seed: "overscan", layers: 2 },
};

describe("golden extras", () => {
  it.each(Object.entries(extras))("%s", async (name, scene) => {
    const overscan = name === "overscan" ? 200 : 0;
    await expect(toSvg(scene, { width: 1440, height: 900, overscan }) + "\n").toMatchFileSnapshot(`golden/extras/${name}.svg`);
  });

  it.each(Object.keys(palettes))("palette %s", async (palette) => {
    await expect(toSvg({ seed: "palette", palette: palette as keyof typeof palettes, layers: 5 }, { width: 1440, height: 900 }) + "\n").toMatchFileSnapshot(
      `golden/palettes/${palette}.svg`,
    );
  });
});

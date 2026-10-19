import type { SceneInput } from "../spec/types";

/**
 * Hand-made scenes. Spread one and override what you like:
 * `{ ...presets.sierra, palette: "alpine" }`.
 */
export const presets = {
  /** Mountains at dusk behind rolling foothills. */
  sierra: { seed: 1, palette: "dusk", layers: [{ profile: "peaks" }, { profile: "peaks" }, {}, {}, {}] },
  /** A low, green footer. */
  meadow: { seed: 2, palette: "forest", height: "30%", layers: 3 },
  /** Many soft ridges sinking into fog. */
  misty: { seed: 3, palette: "fog", layers: 7, haze: { strength: 0.9 } },
  /** Mesas behind dunes. */
  mesa: { seed: 4, palette: "desert", layers: [{ profile: "mesa" }, { profile: "dunes" }, { profile: "dunes" }] },
  /** Snowy peaks, tall and pale. */
  glacier: { seed: 5, palette: "alpine", height: "60%", layers: [{ profile: "peaks" }, { profile: "peaks" }, { profile: "peaks" }, {}] },
  /** Dark hills under a night sky. */
  nightfall: { seed: 6, palette: "night", layers: 4 },
  /** A bright day: sun and puffy clouds over green hills. Draws its own sky. */
  summer: { seed: 7, palette: "alpine", sky: { sun: { at: ["78%", "22%"] } }, clouds: { bands: 2, cover: 0.45 }, layers: [{ profile: "peaks" }, {}, { color: "#4f7a4a" }, { color: "#355c37" }] },
  /** A crescent moon, stars and wisps of cloud. Draws its own sky. */
  starlight: { seed: 8, palette: "night", sky: { moon: { crescent: 0.55 }, stars: true }, clouds: { style: "streaks", cover: 0.3, opacity: 0.7 }, layers: [{ profile: "peaks" }, { trees: true }, { trees: { density: 0.8 } }] },
  /** Pine forest climbing the hills, with misty valleys. */
  pinewood: { seed: 9, palette: "forest", layers: [{ profile: "peaks" }, { trees: true }, { trees: true }, { trees: { density: 0.85 } }] },
} satisfies Record<string, SceneInput>;

export type PresetName = keyof typeof presets;

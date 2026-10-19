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
} satisfies Record<string, SceneInput>;

export type PresetName = keyof typeof presets;

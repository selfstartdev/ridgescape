import type { PaletteInput } from "../spec/types";

/** Colour presets. Spread one into your own palette to adjust it: `{ ...palettes.dusk, near: "#2a1b3d" }`. */
export const palettes = {
  dusk: { near: "#2b1e3f", far: "#8a5a83", haze: "#f3b38a", sky: ["#3d3466", "#f6c49a"] },
  dawn: { near: "#3c3a5e", far: "#c49bb0", haze: "#ffd9c7", sky: ["#a9b8de", "#ffe2cf"] },
  alpine: { near: "#1f3446", far: "#6f8ea6", haze: "#e4eef5", sky: ["#8fb6d8", "#eaf3f9"] },
  forest: { near: "#173a2b", far: "#5f8a6a", haze: "#dfe9d8", sky: ["#bfd8d2", "#eef3e4"], mist: 0.25 },
  desert: { near: "#7a3b24", far: "#d29a6a", haze: "#f6dcb8", sky: ["#f2a65e", "#fbe3c0"] },
  fog: { near: "#3a4148", far: "#9aa3aa", haze: "#e9ecee", sky: ["#d5dadd", "#eff1f2"], mist: 0.6 },
  night: { near: "#0b1020", far: "#2b3a5e", haze: "#4a5a86", sky: ["#05070f", "#24325a"] },
  mono: { near: "#262626", far: "#a3a3a3", haze: "#e5e5e5", sky: ["#f5f5f5", "#e5e5e5"] },
} satisfies Record<string, PaletteInput & { sky: [string, string] }>;

export type PaletteName = keyof typeof palettes;

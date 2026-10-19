# ridgescape

Layered landscape backgrounds for the web: ridges fading into the haze, generated from a seed, repeating at any width, with scroll parallax.

A layered landscape behind a hero or a footer usually means drawing each layer in a vector tool, stacking SVGs, matching colours by eye and writing scroll code, and then it stretches on wide screens. ridgescape generates the layers from a short description instead, for the element's real size. Every layer repeats seamlessly, so a wider screen shows more landscape rather than wider hills, and colours fade into the haze with depth on their own.

**[Docs and playground →](https://ridgescape.selfstartdev.com)**

```sh
npm install ridgescape
```

- `ridgescape`: the core. No dependencies; runs in Node, the browser, build scripts and edge runtimes. Writes SVG strings and paints canvases.
- `ridgescape/react`: the `<Ridgescape>` component. React 18 or 19, an optional peer dependency.

## React

`<Ridgescape>` is a layer, not a wrapper. Put it inside the element it should sit behind, and give that element `ridgescapeParentStyle`:

```tsx
import { ridgescapeParentStyle } from "ridgescape";
import { Ridgescape } from "ridgescape/react";

<section style={{ ...ridgescapeParentStyle, background: "linear-gradient(#3d3466, #f6c49a)" }}>
  <Ridgescape scene={{ seed: "home", palette: "dusk", layers: 5 }} parallax />
  {children}
</section>
```

`ridgescapeParentStyle` is `{ position: "relative", isolation: "isolate" }`: the layer covers this element and can't slip behind its background. In development, `<Ridgescape>` warns if either is missing. Import it from `ridgescape`, not `ridgescape/react`: a React Server Component importing a plain value from a client module gets an empty reference.

The landscape is transparent above the ridges, so the element's background is the sky. Each palette has a sky gradient: `resolve(scene).palette.sky`.

| Prop | Default | Meaning |
|---|---|---|
| `scene` | | The landscape (below), or a preset: `presets.sierra`. |
| `renderer` | `"svg"` | `"canvas"` draws in the browser instead. |
| `parallax` | `false` | `true`, or `{ strength }` from 0 to 1 (default 0.3). |
| `attach` | `"scroll"` | `"fixed"` pins the layer to the viewport (no parallax). |
| `fullBleed` | `false` | Break out of the parent's width to the full viewport width. |
| `initialSize` | `{ width: 1440, height: 900 }` | Size rendered on the server and before measuring. |
| `reveal` | `"fade"` | `"none"` shows the server render without waiting for the measurement. |
| `className`, `style` | | On the layer. |

## A scene

```ts
{
  seed: "home",          // the same seed always draws the same landscape
  palette: "dusk",       // dusk, dawn, alpine, forest, desert, fog, night, mono, or { near, far, haze, sky, mist }
  layers: 5,             // a count, or layers back to front
  height: "45%",         // the band the landscape fills, from the bottom
  haze: { strength: 0.5, curve: 1.2 },
}
```

Lengths are px as a number or a percentage as a string (of the element's height for vertical lengths, its width for horizontal ones).

Each layer has a depth from 1 (horizon) to 0 (front), spread evenly by default, and depth sets its other defaults: further layers sit higher, are smoother, fade more into the haze and lag more in parallax. Set any field to override it:

```ts
layers: [
  { profile: "peaks", anchors: [{ at: "70%", height: "40%", width: 500 }] },
  { profile: "rolling", mist: 0.4 },
  { color: "var(--hills)" },
]
```

| Layer field | Meaning |
|---|---|
| `profile` | `"rolling"` (default), `"peaks"`, `"mesa"` or `"dunes"`. |
| `depth` | 0 (front) to 1 (horizon). |
| `baseline` | Height of the lowest valleys, from the bottom. |
| `amplitude` | How far the highest crest rises above the baseline. |
| `roughness` | 0 smooth to 1 craggy. |
| `wavelength` | Typical hill width, px. |
| `period` | The layer repeats every this many px. |
| `color` | Instead of the palette and haze; any CSS colour. |
| `mist` | 0–1: fade toward the haze colour in the valleys. |
| `anchors` | Peaks, dips or flat stretches at chosen positions: `{ at, kind?, height?, width? }`. |
| `trees` | A tree line along the crest: `true`, or `{ kind, height, density, cover, variation, color, seed }` (kinds: conifer, deciduous, mixed). |
| `seed` | Instead of one derived from the scene's seed and the layer's index. |

Nine presets are in `presets` (`sierra`, `meadow`, `misty`, `mesa`, `glacier`, `nightfall`, `pinewood`, and `summer` and `starlight`, which draw their own sky); spread one and change what you like.

## Sky and clouds

```ts
{
  sky: { sun: { at: ["72%", "28%"], radius: 56, glow: 0.6 }, stars: true },   // or moon: { crescent: 0.5 }; sky: true for just the gradient
  clouds: { style: "puffy", bands: 2, cover: 0.4, top: "14%", bottom: "40%", size: 240 },   // or style: "streaks"
}
```

The sky is the palette's gradient (or your own, or none), with an optional sun or moon with a soft glow, and stars. Clouds come in rows at different depths and repeat horizontally like the ground. With parallax, the gradient stays put and everything else drifts by depth.

## SVG and canvas, without React

```ts
import { drawToCanvas, render, toSvg } from "ridgescape";

const svg = toSvg({ seed: 1 }, { width: 1440, height: 900 });

const rendered = render({ seed: 1 }, { width: 1440, height: 900 });
drawToCanvas(canvas.getContext("2d"), rendered, { pixelRatio: 2 });
```

`toSvg()` writes one path per layer, rounded to two decimals: the same input always gives the same bytes. `drawToCanvas()` paints the same paths. `attachParallax(element, { strength })` moves the elements inside `element` that carry a `data-depth` attribute as the page scrolls.

## Stability

Output is a pure function of the scene, the element size and the package version. From 1.0, any change to generated output (presets included) is a major release; before 1.0, a minor version may change it and a patch never does.

## License

MIT

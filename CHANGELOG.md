# ridgescape

## 0.2.0

### Minor Changes

- 1ff16d5: Lakes: `lakes` on a layer holds its ground under a stretch of water with small banks and no trees, and the water mirrors everything behind it (sky, sun, clouds, far ridges), tinted with depth, with a shoreline highlight and ripples (`reflection` and `ripples` switch them off). A lake that covers the element, or too wide to leave land between its repeats, carries on across the layer. Reflections are their own layers (kind "reflection", with `mirror`), one per run of neighbouring layers at a depth, so with parallax each moves the opposite way to what it mirrors and stays true while scrolling (drawn inside an element clipped to the water, so only transforms change); the surface is a "water" layer over them. Shapes can now carry a `clip` and a `transform`, which both renderers apply, and an `id` and `href`: SVG draws a reflection with `<use>` instead of repeating the path data. New preset `lakeside`.
- 520bd12: Sky and clouds: `sky` draws a gradient with an optional sun or crescent moon (with a soft glow) and stars; `clouds` adds rows of puffy clouds or thin streaks at different depths, repeating horizontally and drifting with parallax. Palettes gain `sun` and `cloud` colours, and there are two new presets, `summer` and `starlight`. Rendered layers are now lists of shapes (`kind`, `key`, `shapes`) so skies and clouds can carry gradients, glows and opacity; ground-only output is unchanged.
- 6494002: Tree lines: `trees` on a layer adds a row of trees along its crest. Each tree picks one of seven shapes at random: conifers (spruce, fir, pine, cypress) and deciduous (maple, oak, poplar). `kind` takes a group (`"conifer"`, `"deciduous"`, `"mixed"`), one shape, a list, or shapes with weights. Trees are sized by depth, with `density`, `cover` (forest vs clearing; default 1, unbroken), `variation` and an optional own `color`. Trees repeat with the layer and are merged into its silhouette. New preset `pinewood`; `starlight` now has trees.

## 0.1.0

### Minor Changes

- First release: layered landscapes from a seed, with rolling, peaks, mesa and dunes profiles, depth-driven defaults, seamless horizontal repeats, anchors (peak, dip, flat), lengths in px or %, OKLab haze and mist, eight palettes and six scene presets. `toSvg()`, `render()` and `drawToCanvas()` in a zero-dependency core; `<Ridgescape>` in `ridgescape/react` with SVG or canvas rendering and scroll parallax (`attachParallax()` without React).

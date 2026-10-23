---
"ridgescape": minor
---

Lakes: `lakes` on a layer holds its ground under a stretch of water with small banks and no trees, and the water mirrors everything behind it (sky, sun, clouds, far ridges), tinted with depth, with a shoreline highlight and ripples (`reflection` and `ripples` switch them off). A lake that covers the element, or too wide to leave land between its repeats, carries on across the layer. Reflections are their own layers (kind "reflection", with `mirror`), one per run of neighbouring layers at a depth, so with parallax each moves the opposite way to what it mirrors and stays true while scrolling (drawn inside an element clipped to the water, so only transforms change); the surface is a "water" layer over them. Shapes can now carry a `clip` and a `transform`, which both renderers apply, and an `id` and `href`: SVG draws a reflection with `<use>` instead of repeating the path data. New preset `lakeside`.

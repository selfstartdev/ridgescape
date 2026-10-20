---
"ridgescape": minor
---

Tree lines: `trees` on a layer adds a row of trees along its crest. Each tree picks one of seven shapes at random: conifers (spruce, fir, pine, cypress) and deciduous (maple, oak, poplar). `kind` takes a group (`"conifer"`, `"deciduous"`, `"mixed"`), one shape, a list, or shapes with weights. Trees are sized by depth, with `density`, `cover` (forest vs clearing), `variation` and an optional own `color`. Trees repeat with the layer and are merged into its silhouette. New preset `pinewood`; `starlight` now has trees.

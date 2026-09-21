# Technical notes

## Features

- Each detected sound also releases 3–5 coloured drifting lights with curved dotted trails. Small dots and paper-like flecks loosely follow them through the 3D garden. They use the note colour, spread over the expanding garden, and gently fade after about a minute. Only these transient effects are capped (72 lights and 900 followers); permanent plants stay. New garden clears both plants and lights. Controls → Test signal previews the effect without microphone access.
- Every sound adds a new plant. Existing plants remain until New garden or a page reload. There is no plant-count cap and no automatic replacement.
- An outward spiral and spatial hash reserve each plant's footprint plus a clearance margin. The ground and camera bounds expand with the garden. Silhouettes can still cross when viewed from an angle, as in any 3D scene.
- Trees, daisies, bells, stars, and the small geometric crystal flowers inspired by the reference are separate plants. New flowers are never stacked on an existing one.
- Exactly two out of each five plants, in shuffled order, get outlined leaves and a small basal rosette. Glitter streams from all new growth. Leafy plants also shed a few tiny leaves. Only temporary particles fade or are recycled.
- Each plant's outlines are merged into at most three line batches. Placement is checked against neighboring cells. Practical limits still depend on GPU and memory: this is a growing scene, not a promise of unlimited performance.

## Checks

```powershell
dotnet run -- --self-test
node --test tests/layout.test.mjs
```

The C# checks cover FFT bins, YIN pitch (including stronger harmonics), three distinct synthetic sounds, attack sharpness, stable noise, silence, sustained tone suppression, same-volume note changes, and color/size/shape mappings. Node is optional for running the layout tests; it is not needed to run the app. The layout tests retain 1000 plants without footprint overlap and verify the partial leaf distribution.

Algorithm background: [aubio pitch documentation](https://aubio.org/doc/latest/pitch_8h.html) describes the YIN family; [Brossier's audio-analysis thesis](https://aubio.org/phd/thesis/brossier06thesis.pdf) discusses spectral and onset methods. This project uses its own small C# implementation rather than the aubio library. Three.js is vendored with its MIT license under wwwroot/vendor/three.

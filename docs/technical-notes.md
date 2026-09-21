# Technical notes

## Features

- Each detected sound also releases 3–5 coloured drifting lights with curved dotted trails. Small dots and paper-like flecks loosely follow them through the 3D garden. They use the note colour, spread over the expanding garden, and gently fade after about a minute. Only these transient effects are capped (72 lights and 900 followers); permanent plants stay. New garden clears both plants and lights. Controls → Test signal previews the effect without microphone access.
- Every sound adds a new plant. Existing plants remain until New garden or a page reload. There is no plant-count cap and no automatic replacement.
- An outward spiral and spatial hash reserve each plant's footprint plus a clearance margin. The ground and camera bounds expand with the garden. Silhouettes can still cross when viewed from an angle, as in any 3D scene.
- Trees, daisies, bells, stars, and the small geometric crystal flowers inspired by the reference are separate plants. New flowers are never stacked on an existing one.
- Exactly two out of each five plants, in shuffled order, get outlined leaves and a small basal rosette. Glitter streams from all new growth. Leafy plants also shed a few tiny leaves. Only temporary particles fade or are recycled.
- Each plant's outlines are merged into at most three line batches. Placement is checked against neighboring cells. Practical limits still depend on GPU and memory: this is a growing scene, not a promise of unlimited performance.

## Real audio analysis in C#

The browser resamples mono input to 16 kHz and sends 512-sample PCM16 chunks to the local C# server. AudioAnalyzer.cs keeps an overlapping 2048-sample window (128 ms), analyzed every 512 samples (32 ms).

1. A radix-2 FFT with a Hann window measures spectral centroid (brightness), flatness, and positive spectral flux.
2. YIN estimates the fundamental pitch from 65 to 1100 Hz and provides a confidence score. Pitch detection uses the waveform, not a guessed FFT peak.
3. Adaptive spectral-flux onset detection is gated by a calibrated noise floor and a cooldown. It can detect a new note even when volume does not increase.
4. An onset is observed for another 128 ms to estimate its character. A 1 ms RMS envelope measures attack rise from 10% to 90% of its peak.
5. Confident pitch maps to color around a pitch-class color wheel; octaves share a color. Unpitched sounds use a brightness palette. Brightness chooses the tonal flower family and tree spread. Peak loudness controls plant size; attack sharpness controls growth speed.

Knock-like low transient sounds choose trees. Bright, noisy clap-like sounds choose crystal flowers. Sustained, periodic voice-like sounds choose bells, daisies, or stars according to brightness. These are transparent heuristics, not a trained sound classifier: instruments can be voice-like, noisy rooms can cause false onsets, and chords/overlapping sources can confuse pitch. Test with your own microphone and adjust sensitivity. Measured pitch and brightness plus the estimated family appear under Controls.

Test signal sends three **silent synthetic inputs** (knock, clap, voiced tone) through the actual AudioWorklet, HTTP endpoint, and analyzer. It does not test the physical microphone and is never automatically started.

## Privacy and scope

Raw audio now travels from the browser to the server on **your own computer**, in order to do the DSP in C#. It is processed in memory and is not written to disk or sent to a cloud service. Camera frames stay in the browser. The server binds only to 127.0.0.1. This release does not record performances, save gardens across reloads, identify people, use a database, or train a model.

## Checks

```powershell
dotnet run -- --self-test
node --test tests/layout.test.mjs
```

The C# checks cover FFT bins, YIN pitch (including stronger harmonics), three distinct synthetic sounds, attack sharpness, stable noise, silence, sustained tone suppression, same-volume note changes, and color/size/shape mappings. Node is optional for running the layout tests; it is not needed to run the app. The layout tests retain 1000 plants without footprint overlap and verify the partial leaf distribution.

Algorithm background: [aubio pitch documentation](https://aubio.org/doc/latest/pitch_8h.html) describes the YIN family; [Brossier's audio-analysis thesis](https://aubio.org/phd/thesis/brossier06thesis.pdf) discusses spectral and onset methods. This project uses its own small C# implementation rather than the aubio library. Three.js is vendored with its MIT license under wwwroot/vendor/three.

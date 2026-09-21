<h1 align="center">Melody Garden</h1>
I wanted to turn music into something you can watch grow. A guitar note, a voice, or a tap on a desk becomes part of a small garden, with flowers, branching trees, and lights that drift between them.

The project brings together my interest in sound, mathematics, and interactive visuals. I kept the space simple: a cream background, an optional camera beside the garden, and room for each new plant.

## Inside the garden

- **Sound becomes a plant.** Pitch influences colour, brightness shapes the flowers, and louder sounds grow larger plants.
- **A space that keeps growing.** Flowers and trees spread outward, with falling glitter, little leaves, and coloured lights followed by dotted trails.
- **Play your way.** Use a microphone or USB audio interface, orbit the garden, or try the built-in test signal.

## Tools

- **C# and ASP.NET Core** for live audio analysis, using FFT, YIN pitch estimation, and onset detection.
- **JavaScript, Three.js, HTML and CSS** for audio capture, the 3D garden, and the interface.

<details>
<summary><strong>Run it locally</strong></summary>

With the **.NET 10 SDK** installed, run this from the repository root:

```sh
dotnet run --project MelodyGarden.csproj
```

Open [Melody Garden](http://localhost:5196/) in Chrome or Edge. Click **Listen**, allow your microphone, then play or tap your desk. **Controls → Test signal** works without a microphone.

Audio is processed locally in memory. Gardens last until you reload or choose **New garden**.

[How it works and tests](docs/technical-notes.md)

</details>

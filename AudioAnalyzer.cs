using System.Numerics;

public record AudioFeatures(double Rms, double Peak, double PitchHz, double Confidence, double CentroidHz, double Flux, double Attack, double Flatness, double BlockRms);
public record PlantEvent(string Color, string Kind, double Strength, double Size, double Brightness, string Sound, double PitchHz, double Confidence, double CentroidHz, double Attack);

// 128 ms Hann spectrum, 32 ms hop; no external ML service or audio storage.
public sealed class AudioAnalyzer
{
    public const int SampleRate = 16000, Window = 2048, Hop = 512;
    readonly double[] ring = new double[Window], previousSpectrum = new double[Window / 2];
    readonly Complex[] spectrum = new Complex[Window];
    int cursor, received, sinceHop;
    double noise = .0003, fluxMean = .03, previousBlock, lastEvent = -10;
    Pending? pending;
    public bool Calibrating => received < SampleRate * .5;
    public AudioFeatures? Latest { get; private set; }
    public long NextSequence { get; set; }
    sealed class Pending(AudioFeatures f, double time, double[] frame) {
        public AudioFeatures Best = f; public double Started = time, Peak = f.Peak, Attack = f.Attack;
        public int Active; public double Pitch, Confidence;
        public List<double> Wave = new(frame);
    }
    public List<PlantEvent> Push(ReadOnlySpan<short> samples, double gain)
    {
        var events = new List<PlantEvent>();
        foreach (var sample in samples) {
            ring[cursor] = sample / 32768.0; cursor = (cursor + 1) % Window; received++; sinceHop++;
            if (received < Window || sinceHop < Hop) continue;
            sinceHop = 0; var frame = new double[Window];
            for (int i = 0; i < Window; i++) frame[i] = ring[(cursor + i) % Window];
            var f = Analyze(frame); Latest = f;
            var time = received / (double)SampleRate;
            if (Calibrating) { noise = noise * .8 + f.BlockRms * .2; fluxMean = fluxMean * .9 + f.Flux * .1; continue; }
            var gate = Math.Max(.0015 / gain, noise * 2.8);
            if (f.BlockRms < gate) noise = noise * .99 + f.BlockRms * .01;
            if (pending is null && time - lastEvent > .28 && f.Rms > gate && f.Flux > Math.Max(.16, fluxMean * 1.8 + .05)) pending = new Pending(f, time, frame);
            if (pending is { } p) {
                if (time > p.Started) p.Wave.AddRange(frame.AsSpan(Window - Hop).ToArray());
                if (f.Rms > p.Best.Rms) p.Best = f;
                p.Peak = Math.Max(p.Peak, f.Peak); p.Attack = Math.Max(p.Attack, f.Attack);
                if (f.BlockRms > Math.Max(gate, p.Peak * .08)) p.Active++;
                if (f.Confidence > p.Confidence) { p.Pitch = f.PitchHz; p.Confidence = f.Confidence; }
                if (time - p.Started >= .128) {
                    events.Add(Map(p.Best with { Peak = p.Peak, Attack = MeasureAttack(p.Wave), PitchHz = p.Pitch, Confidence = p.Confidence }, p.Active, gain));
                    lastEvent = time; pending = null;
                }
            }
            fluxMean = fluxMean * .94 + Math.Min(f.Flux, .5) * .06;
        }
        return events;
    }
    // 1 ms RMS envelope: time from 10% to 90% of the onset's peak, mapped to [0,1].
    public static double MeasureAttack(IReadOnlyList<double> samples)
    {
        var envelope = new double[samples.Count / 16];
        for (int i = 0; i < envelope.Length; i++) { double sum = 0; for (int j = 0; j < 16; j++) sum += samples[i * 16 + j] * samples[i * 16 + j]; envelope[i] = Math.Sqrt(sum / 16); }
        var peak = envelope.Max(); if (peak < 1e-8) return 0;
        var low = Array.FindIndex(envelope, x => x >= peak * .1); var high = Array.FindIndex(envelope, low, x => x >= peak * .9);
        return 1 / (1 + Math.Max(0, high - low) / 10.0);
    }
    AudioFeatures Analyze(double[] frame)
    {
        var mean = frame.Average(); double energy = 0, peak = 0, block = 0;
        for (int i = 0; i < Window; i++) {
            frame[i] -= mean; var x = frame[i]; energy += x * x; peak = Math.Max(peak, Math.Abs(x));
            if (i >= Window - Hop) block += x * x;
            spectrum[i] = new Complex(x * (.5 - .5 * Math.Cos(2 * Math.PI * i / (Window - 1))), 0);
        }
        Fft(spectrum);
        double total = 0, weighted = 0, positive = 0, logarithms = 0;
        for (int k = 1; k < Window / 2; k++) {
            double magnitude = spectrum[k].Magnitude / Window;
            total += magnitude; weighted += magnitude * k * SampleRate / Window;
            positive += Math.Max(0, magnitude - previousSpectrum[k]);
            logarithms += Math.Log(magnitude + 1e-12); previousSpectrum[k] = magnitude;
        }
        var rms = Math.Sqrt(energy / Window); var blockRms = Math.Sqrt(block / Hop);
        var attack = Math.Clamp((blockRms - previousBlock) / (blockRms + .00001), 0, 1); previousBlock = blockRms;
        var pitch = rms > .0003 ? Yin(frame) : (Hz: 0.0, Confidence: 0.0);
        return new(rms, peak, pitch.Hz, pitch.Confidence, total > 1e-9 ? weighted / total : 0,
            total > 1e-9 ? positive / total : 0, attack,
            total > 1e-9 ? Math.Exp(logarithms / (Window / 2 - 1)) / (total / (Window / 2 - 1)) : 0, blockRms);
    }
    public static (double Hz, double Confidence) Yin(double[] data)
    {
        const int maxLag = SampleRate / 65, minLag = SampleRate / 1100;
        var normalized = new double[maxLag + 1]; double cumulative = 0;
        for (int lag = 1; lag <= maxLag; lag++) {
            double difference = 0;
            for (int j = 0; j < data.Length / 2; j++) { double d = data[j] - data[j + lag]; difference += d * d; }
            cumulative += difference; normalized[lag] = cumulative > 1e-14 ? difference * lag / cumulative : 1;
        }
        for (int lag = minLag; lag < maxLag - 1; lag++) {
            if (normalized[lag] >= .17) continue;
            while (lag + 1 < maxLag && normalized[lag + 1] < normalized[lag]) lag++;
            double left = normalized[lag - 1], middle = normalized[lag], right = normalized[Math.Min(lag + 1, maxLag)];
            double denominator = 2 * (2 * middle - left - right);
            double offset = Math.Abs(denominator) > 1e-12 ? (right - left) / denominator : 0;
            return (SampleRate / (lag + Math.Clamp(offset, -.5, .5)), Math.Clamp(1 - middle, 0, 1));
        }
        return (0, 0);
    }
    public static void Fft(Complex[] data)
    {
        int n = data.Length;
        for (int i = 1, j = 0; i < n; i++) { int bit = n >> 1; for (; (j & bit) != 0; bit >>= 1) j ^= bit; j ^= bit; if (i < j) (data[i], data[j]) = (data[j], data[i]); }
        for (int length = 2; length <= n; length <<= 1) {
            var step = Complex.FromPolarCoordinates(1, -2 * Math.PI / length);
            for (int start = 0; start < n; start += length) { var w = Complex.One;
                for (int j = 0; j < length / 2; j++) { var a = data[start + j]; var b = data[start + j + length / 2] * w; data[start + j] = a + b; data[start + j + length / 2] = a - b; w *= step; }
            }
        }
    }
    public static PlantEvent Map(AudioFeatures f, int activeHops, double gain)
    {
        double brightness = Math.Clamp(f.CentroidHz / 5000, 0, 1);
        bool voiced = f.Confidence > .8 && f.PitchHz > 0 && activeHops >= 4;
        string sound = voiced ? "voice-like" : f.CentroidHz > 2200 && f.Flatness > .12 ? "clap-like" : f.Attack > .4 && f.CentroidHz < 1700 ? "knock-like" : "mixed";
        string kind = sound switch { "knock-like" => "tree", "clap-like" => "crystal", _ => brightness < .18 ? "bell" : brightness < .4 ? "daisy" : brightness < .65 ? "star" : "crystal" };
        // Unpitched transients use a timbre palette; never invent a pitch for noise.
        double pitch = f.Confidence >= .8 ? f.PitchHz : 0;
        double hue = pitch > 0 ? ((69 + 12 * Math.Log2(pitch / 440)) % 12 + 12) % 12 * 30 : 30 + brightness * 230;
        var color = HslHex(hue, .48, .61);
        var strength = Math.Clamp(Math.Sqrt(f.Peak * gain), 0, 1);
        return new(color, kind, strength, .6 + strength * 1.8, brightness, sound, pitch, f.Confidence, f.CentroidHz, f.Attack);
    }
    static string HslHex(double hue, double saturation, double lightness)
    {
        double a = saturation * Math.Min(lightness, 1 - lightness);
        int Channel(double n) { var k = (n + hue / 30) % 12; return (int)Math.Round(255 * (lightness - a * Math.Max(-1, Math.Min(Math.Min(k - 3, 9 - k), 1)))); }
        return $"#{Channel(0):x2}{Channel(8):x2}{Channel(4):x2}";
    }
}

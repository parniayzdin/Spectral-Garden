using System.Numerics;
static class AudioChecks
{
    public static void Run()
    {
        var bins = Enumerable.Range(0, 2048).Select(i => new Complex(Math.Sin(2 * Math.PI * 64 * i / 2048), 0)).ToArray();
        AudioAnalyzer.Fft(bins); Check("FFT locates a known frequency", bins[64].Magnitude > 1000 && bins[63].Magnitude < .001);
        foreach (var hz in new[] { 82.41, 220.0, 440.0, 880.0 }) {
            var wave = Enumerable.Range(0, 2048).Select(i => .15 * Math.Sin(2 * Math.PI * hz * i / 16000)).ToArray();
            var pitch = AudioAnalyzer.Yin(wave); Check($"YIN {hz} Hz", Math.Abs(pitch.Hz - hz) / hz < .015 && pitch.Confidence > .9);
        }
        var silence = RunSignal(new double[16000]); Check("silence produces no plants", silence.Count == 0);
        var signal = MakeDemo(); var events = RunSignal(signal);
        foreach (var e in events) Console.WriteLine($"EVENT {e.Sound}: {e.Kind}, pitch={e.PitchHz:F1}, centroid={e.CentroidHz:F0}, attack={e.Attack:F2}, size={e.Size:F2}");
        Check("three separated sounds create three plants", events.Count == 3);
        Check("knock chooses a tree", events[0].Sound == "knock-like" && events[0].Kind == "tree");
        Check("clap chooses a geometric flower", events[1].Sound == "clap-like" && events[1].Kind == "crystal");
        Check("voiced sound has real pitch", events[2].Sound == "voice-like" && Math.Abs(events[2].PitchHz - 220) < 4);
        Check("sharp attacks differ from a gradual voice onset", events[1].Attack > events[2].Attack + .3);
        var tone = new double[16000 * 3]; for(int i=12000;i<tone.Length;i++) tone[i]=.12*Math.Sin(2*Math.PI*330*i/16000);
        Check("sustained tone doesn't repeatedly sprout", RunSignal(tone).Count == 1);
        var change = new double[16000 * 3]; for(int i=12800;i<change.Length;i++) change[i]=.12*Math.Sin(2*Math.PI*(i<25600?220:440)*i/16000);
        Check("spectral flux hears a new note at unchanged volume", RunSignal(change).Count == 2);
        var harmonic = Enumerable.Range(0,2048).Select(i => .04*Math.Sin(2*Math.PI*220*i/16000)+.15*Math.Sin(2*Math.PI*440*i/16000)+.08*Math.Sin(2*Math.PI*660*i/16000)).ToArray();
        Check("YIN finds the fundamental under stronger harmonics", Math.Abs(AudioAnalyzer.Yin(harmonic).Hz-220)<4);
        var random = new Random(27); var noise = Enumerable.Range(0,32000).Select(_=>(random.NextDouble()*2-1)*.005).ToArray();
        Check("steady background noise is calibrated out", RunSignal(noise).Count == 0);
        var f = new AudioFeatures(.1,.1,220,.99,1000,.4,.8,.01,.1);
        var quiet=AudioAnalyzer.Map(f with {Peak=.02},5,2);var loud=AudioAnalyzer.Map(f with {Peak=.3},5,2);
        Check("louder sounds grow larger", loud.Size > quiet.Size);
        Check("pitch changes color", AudioAnalyzer.Map(f with {PitchHz=261.63},5,2).Color != quiet.Color);
        Check("brightness changes tonal shapes", AudioAnalyzer.Map(f with {CentroidHz=500},5,2).Kind != AudioAnalyzer.Map(f with {CentroidHz=2100},5,2).Kind);
        Console.WriteLine("All audio checks passed.");
    }
    public static double[] MakeDemo()
    {
        var data=new double[16000*4];var random=new Random(7);
        for(int i=0;i<1600;i++){double t=i/16000.0;data[12800+i]=.25*Math.Sin(2*Math.PI*140*t)*Math.Exp(-t*60);}
        double previous=0;for(int i=0;i<1200;i++){double t=i/16000.0,noise=random.NextDouble()*2-1;data[25600+i]=.24*(noise-previous)*Math.Exp(-t*55);previous=noise;}
        for(int i=0;i<11200;i++){double t=i/16000.0,fade=Math.Min(1,t/.045)*Math.Min(1,(.7-t)/.06);data[38400+i]=fade*(.14*Math.Sin(2*Math.PI*220*t)+.035*Math.Sin(2*Math.PI*440*t));}
        return data;
    }
    static List<PlantEvent> RunSignal(double[] data)
    {
        var analyzer=new AudioAnalyzer();var events=new List<PlantEvent>();
        for(int offset=0;offset+512<=data.Length;offset+=512){var block=data.Skip(offset).Take(512).Select(x=>(short)Math.Clamp(x*32767,short.MinValue,short.MaxValue)).ToArray();events.AddRange(analyzer.Push(block,2));}
        return events;
    }
    static void Check(string name,bool condition){if(!condition)throw new Exception("FAIL: "+name);Console.WriteLine("PASS: "+name);}
}

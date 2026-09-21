using System.Collections.Concurrent;
using System.Buffers.Binary;
if (args.Contains("--self-test")) { AudioChecks.Run(); return; }
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5196");
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 8192);
var app = builder.Build();
var sessions = new ConcurrentDictionary<Guid, AudioSession>();
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapPost("/api/listen", () => {
    foreach (var item in sessions) if (Environment.TickCount64 - item.Value.LastUsed > 600_000) sessions.TryRemove(item.Key, out _);
    if (sessions.Count >= 32) return Results.StatusCode(429);
    var id = Guid.NewGuid(); sessions[id] = new(); return Results.Ok(new { id, sampleRate = AudioAnalyzer.SampleRate });
});
app.MapDelete("/api/listen/{id:guid}", (Guid id) => { sessions.TryRemove(id, out _); return Results.NoContent(); });
app.MapPost("/api/audio/{id:guid}", async (Guid id, long sequence, double gain, int sampleRate, HttpRequest request) => {
    if (!sessions.TryGetValue(id, out var session)) return Results.NotFound();
    if (sampleRate != AudioAnalyzer.SampleRate || !double.IsFinite(gain) || gain is < .5 or > 8 || sequence < 0 || request.ContentType != "application/octet-stream") return Results.BadRequest();
    using var memory = new MemoryStream(); await request.Body.CopyToAsync(memory);
    var bytes = memory.ToArray();
    if (bytes.Length == 0 || bytes.Length > 8192 || bytes.Length % (AudioAnalyzer.Hop * 2) != 0) return Results.BadRequest();
    var samples = new short[bytes.Length / 2];
    for (int i = 0; i < samples.Length; i++) samples[i] = BinaryPrimitives.ReadInt16LittleEndian(bytes.AsSpan(i * 2, 2));
    lock (session) {
        if (sequence < session.Analyzer.NextSequence) return Results.Conflict();
        if (sequence > session.Analyzer.NextSequence) session.Analyzer = new(); // Recalibrate across dropped audio; don't create a false onset.
        session.LastUsed = Environment.TickCount64;
        var events = session.Analyzer.Push(samples, gain);
        session.Analyzer.NextSequence = sequence + samples.Length;
        return Results.Ok(new { events, calibrating = session.Analyzer.Calibrating, features = session.Analyzer.Latest });
    }
});
app.Run();
sealed class AudioSession { public AudioAnalyzer Analyzer = new(); public long LastUsed = Environment.TickCount64; }

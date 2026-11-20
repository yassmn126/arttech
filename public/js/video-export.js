// Export a day's memory as a short MP4 with sound — rendered frame by frame (WebCodecs via Mediabunny),
// so it is faster than real time, exactly on the beat, and still works if the tab is in the background.
// Uses the day's current photo frame style; visuals pulse with the loudness of the audio that is actually in the file.
import { MemoryRenderer } from './renderer.js';
import { soundtrackFor } from './soundtrack.js';

const FPS = 30;
// MessageChannel tasks are not throttled in background tabs (setTimeout is), so the UI stays responsive either way
const yieldNow = () => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });

function loudness(buffer, fps) { // per-video-frame RMS of the soundtrack, 0..~1
  const sr = buffer.sampleRate, n = Math.ceil(buffer.duration * fps), out = new Float32Array(n), chans = [...Array(buffer.numberOfChannels).keys()].map((c) => buffer.getChannelData(c));
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * sr) / fps), b = Math.min(chans[0].length, Math.floor(((i + 1) * sr) / fps));
    let s = 0; for (let k = a; k < b; k++) for (const ch of chans) s += ch[k] * ch[k];
    out[i] = Math.sqrt(s / Math.max(1, (b - a) * chans.length)) * 3;
  }
  return out;
}

export async function exportVideo(day, { frame, dayNumber = 1, onProgress } = {}) {
  if (!('VideoEncoder' in window)) throw new Error('этот браузер не умеет кодировать видео — откройте дневник в свежем Chrome или Edge');
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality, getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } = await import('mediabunny');
  onProgress?.(0, 'звук');
  const sound = await soundtrackFor(day);
  const r = await new MemoryRenderer(document.createElement('canvas'), { ...day, photos: day.photoUrls, song: day.song, frame, dayNumber }).load();
  const W = r.cv.width, H = r.cv.height;
  const vcodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
  if (!vcodec) throw new Error('браузер не нашёл видеокодек для 1080×1350');
  const acodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 });

  const env = loudness(sound.buffer, FPS);
  let fi = 0; r.getLevel = () => env[fi] ?? 0;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  // fixed 4.5 Mbit/s: crisp at 1080×1350 without spending bits on per-frame grain (≈17 MB for 30 s)
  const video = new CanvasSource(r.cv, { codec: vcodec, quality: new Quality({ bitrate: 4_500_000 }), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  const audio = acodec ? new AudioBufferSource({ codec: acodec, quality: new Quality('high') }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const total = Math.round(sound.seconds * FPS);
  for (fi = 0; fi < total; fi++) {
    r.renderAt(fi / FPS);
    await video.add(fi / FPS, 1 / FPS);
    if (fi % 6 === 0) { onProgress?.((fi / total) * 0.95, 'кадры'); await yieldNow(); }
  }
  if (audio) await audio.add(sound.buffer);
  await output.finalize();
  onProgress?.(1, 'готово');
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), seconds: Math.round(sound.seconds * 10) / 10, audio: acodec ? sound.kind : 'none', codecs: `${vcodec}${acodec ? ` + ${acodec}` : ''}`, score: sound.score };
}

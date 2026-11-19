// Music → tempo, energy, brightness, light/dark (major-ish) and warmth.
// Three sources, strongest wins: real audio analysis > user vibe sliders > genre/era metadata.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// key: [match, bpm, energy 0..1, valence -1..1, warmth -1..1, label]
const GENRES = [
  ['jazz', /jazz|swing|vocal|standards|crooner|big band|bossa/i, 100, 0.35, 0.55, 0.8, 'джаз / вокал'],
  ['classical', /classical|orchestra|piano|ambient|soundtrack|score|new age|instrumental/i, 70, 0.2, 0.2, 0.2, 'классика / эмбиент'],
  ['electronic', /electro|techno|house|dance|edm|trance|dubstep|drum|synth|idm|club/i, 128, 0.85, 0.25, -0.6, 'электроника'],
  ['rock', /rock|metal|punk|grunge|hardcore/i, 122, 0.82, 0.15, 0.1, 'рок'],
  ['hiphop', /hip.?hop|rap|trap|drill|r&b|rnb/i, 90, 0.7, 0.25, 0, 'хип-хоп / R&B'],
  ['lofi', /lo.?fi|chill|downtempo|trip.?hop/i, 80, 0.25, 0.3, 0.4, 'lo-fi / чилл'],
  ['soul', /soul|funk|disco|motown|gospel/i, 112, 0.7, 0.75, 0.7, 'соул / фанк'],
  ['folk', /folk|indie|singer|acoustic|country|bard|авторск/i, 95, 0.35, 0.35, 0.6, 'инди / фолк'],
  ['latin', /latin|reggae|salsa|afro|samba|reggaeton/i, 100, 0.72, 0.8, 0.85, 'латино / регги'],
  ['blues', /blues/i, 80, 0.4, -0.15, 0.6, 'блюз'],
  ['pop', /pop|k-pop|j-pop|estrada|эстрад/i, 115, 0.65, 0.65, 0.3, 'поп'],
];
const FALLBACK = ['other', null, 105, 0.5, 0.35, 0.3, 'без жанра'];
export const GENRE_OPTIONS = [...GENRES.map((g) => [g[0], g[6]]), ['other', 'другое']];

export function profileFromMeta({ genre = '', genreKey, year }) {
  const g = GENRES.find((x) => x[0] === genreKey) || GENRES.find((x) => x[1].test(genre)) || FALLBACK;
  const y = Number(year) || null;
  return {
    genreKey: g[0], genreLabel: g[6], bpm: g[2], energy: g[3], valence: g[4], warmth: g[5],
    year: y, eraAge: y ? clamp((2026 - y) / 60) : 0, // 0 = today, 1 = 60+ years old
  };
}

export async function decodeAudio(arrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { return await ctx.decodeAudioData(arrayBuffer); } finally { ctx.close(); }
}

function toMono(buf) {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

export function analyzeAudioBuffer(buf) {
  const sr = buf.sampleRate, mono = toMono(buf), hop = 512;
  const frames = Math.floor(mono.length / hop);
  const rms = new Float32Array(frames);
  let zc = 0;
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * hop, e = i + hop; i < e; i++) {
      s += mono[i] * mono[i];
      if (i && (mono[i] >= 0) !== (mono[i - 1] >= 0)) zc++;
    }
    rms[f] = Math.sqrt(s / hop);
  }
  const mean = rms.reduce((a, b) => a + b, 0) / frames;
  const std = Math.sqrt(rms.reduce((a, b) => a + (b - mean) ** 2, 0) / frames);

  // onset strength = positive energy flux, then autocorrelation over 60..180 BPM
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, rms[f] - rms[f - 1]);
  const fm = flux.reduce((a, b) => a + b, 0) / frames;
  for (let f = 0; f < frames; f++) flux[f] -= fm;
  let bestBpm = 100, best = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * (sr / hop);
    const l0 = Math.floor(lag), fr = lag - l0;
    let s = 0;
    for (let f = 0; f + l0 + 1 < frames; f++) s += flux[f] * (flux[f + l0] * (1 - fr) + flux[f + l0 + 1] * fr);
    s *= Math.exp(-0.5 * (Math.log2(bpm / 115) / 0.9) ** 2); // gentle prior against octave errors
    if (s > best) { best = s; bestBpm = bpm; }
  }
  return {
    bpm: Math.round(bestBpm),
    energy: clamp((mean - 0.025) / 0.2),
    brightness: clamp((zc / mono.length - 0.02) / 0.14),
    dynamics: clamp(mean ? std / mean / 1.2 : 0),
    duration: buf.duration,
  };
}

// Keep only the most energetic ≤30 s window, mono 22.05 kHz 16-bit WAV.
export async function makeExcerptWav(buf, seconds = 30) {
  const mono = toMono(buf), sr = buf.sampleRate, win = Math.min(mono.length, Math.floor(seconds * sr));
  let start = 0, best = -1;
  for (let s = 0; s + win <= mono.length; s += sr) {
    let e = 0;
    for (let i = s; i < s + win; i += 64) e += mono[i] * mono[i];
    if (e > best) { best = e; start = s; }
  }
  const outSr = 22050, outLen = Math.ceil((win / sr) * outSr);
  const off = new OfflineAudioContext(1, outLen, outSr);
  const slice = off.createBuffer(1, win, sr);
  slice.copyToChannel(mono.subarray(start, start + win), 0);
  const src = off.createBufferSource();
  src.buffer = slice;
  const g = off.createGain();
  g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.8); // fade in/out
  g.gain.setValueAtTime(1, Math.max(0.9, win / sr - 1.2)); g.gain.linearRampToValueAtTime(0, win / sr);
  src.connect(g).connect(off.destination); src.start();
  const out = (await off.startRendering()).getChannelData(0);
  return { dataUrl: await blobToDataUrl(encodeWav(out, outSr)), seconds: win / sr, startSec: start / sr };
}

function encodeWav(samples, sr) {
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, clamp(samples[i], -1, 1) * 0x7fff, true);
  return new Blob([b], { type: 'audio/wav' });
}

const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

// Official 30 s preview: streamed through our proxy for analysis, never saved.
export async function analyzePreview(previewUrl) {
  const r = await fetch(`/api/music/preview?url=${encodeURIComponent(previewUrl)}`);
  if (!r.ok) throw new Error('preview unavailable');
  return analyzeAudioBuffer(await decodeAudio(await r.arrayBuffer()));
}

export function embedFor(url) {
  if (!url) return null;
  let m;
  if ((m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/.exec(url))) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  if ((m = /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist)\/(\w+)/.exec(url))) return { kind: 'spotify', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  if ((m = /music\.yandex\.\w+\/album\/(\d+)\/track\/(\d+)/.exec(url))) return { kind: 'yandex', src: `https://music.yandex.ru/iframe/#track/${m[2]}/${m[1]}` };
  return { kind: 'link', src: url };
}

// Fuse: audio features (if any) > manual vibe (if set) > genre/era defaults.
export function musicVector(meta, audio, vibe = {}) {
  const p = profileFromMeta(meta);
  const src = [`жанр «${p.genreLabel}»${p.year ? `, ${p.year}` : ''}`];
  let { bpm, energy, valence } = p;
  if (vibe.tempo) { bpm = { slow: 72, mid: 104, fast: 138 }[vibe.tempo]; src.push(`темп отмечен вручную: ${vibe.tempo}`); }
  if (vibe.mode) { valence = vibe.mode === 'major' ? 0.6 : -0.45; src.push(vibe.mode === 'major' ? 'звучит светло (мажор)' : 'звучит тёмно (минор)'); }
  if (vibe.energy != null && vibe.energy !== '') energy = Number(vibe.energy);
  let brightness = clamp(0.5 + p.warmth * -0.2 + valence * 0.2);
  if (audio) {
    bpm = audio.bpm; energy = audio.energy * 0.75 + energy * 0.25; brightness = audio.brightness;
    src.push(`аудиоанализ: ${audio.bpm} BPM, энергия ${Math.round(audio.energy * 100)}%`);
  }
  return { ...p, bpm, energy: clamp(energy), valence: clamp(valence, -1, 1), brightness, sources: src, analyzed: Boolean(audio) };
}

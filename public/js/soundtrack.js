// Sound for exported videos.
// • Your own file (rights confirmed, ≤30 s excerpt) → the video uses that clip.
// • iTunes previews may only be streamed, never saved, and links have no audio at all → the video gets an
//   original "day soundtrack" synthesized from the song's analysis: same BPM, major/minor from the song's mood,
//   key from the day's colour, drums/arp/vinyl from energy and nostalgia. No copyrighted audio ends up in a file.
import { glowOf } from './util.js';

const NOTE = ['до', 'до♯', 'ре', 'ре♯', 'ми', 'фа', 'фа♯', 'соль', 'соль♯', 'ля', 'ля♯', 'си'];
const pct = (v) => `${Math.round(v * 100)}%`;
function hueOf(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  return ((mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) % 360;
}

// Pure: the day's style + music analysis → a small score with explainable reasons.
export function scoreFor(style, music = {}) {
  const f = style.fused, bpm = style.rhythm.bpm;
  const valence = music.valence ?? f.valence, energy = music.energy ?? f.arousal, brightness = music.brightness ?? 0.5;
  const minor = valence < 0;
  const glow = glowOf(style.palette), root = 45 + (Math.round(hueOf(glow) / 30) % 12); // A2..G#3, the colour wheel mapped onto the circle of notes
  const prog = minor ? [[0, 'm'], [8, ''], [3, ''], [10, '']] : [[0, ''], [9, 'm'], [5, ''], [7, '']]; // i–VI–III–VII / I–vi–IV–V
  const layers = { pad: true, bass: true, kick: energy > 0.3, hats: energy > 0.6, arp: f.arousal > 0.4, crackle: style.texture.grain > 0.3 || (music.eraAge ?? 0) > 0.4 };
  const kickEvery = energy >= 0.6 && bpm >= 110 ? 1 : 2; // four-on-the-floor only for energetic songs at a dance tempo
  const cutoff = Math.round(450 + brightness * 2600 + (minor ? -150 : 150));
  const key = `${NOTE[root % 12]} ${minor ? 'минор' : 'мажор'}`;
  const reasons = [
    `темп ${bpm} BPM — как у песни`,
    `${key}: лад от настроения песни (${valence >= 0 ? '+' : '−'}${Math.abs(valence).toFixed(2)}), тоника от цвета дня ${glow}`,
    layers.kick ? `бочка ${kickEvery === 1 ? 'на каждую долю — энергичная песня в танцевальном темпе' : 'на 1 и 3 долю'} (энергия ${pct(energy)})` : `без ударных — энергия всего ${pct(energy)}`,
    layers.hats ? 'хэты восьмыми — быстрая, яркая песня' : null,
    layers.arp ? 'арпеджио — живой день' : null,
    layers.crackle ? 'потрескивание винила — ностальгия и зерно дня' : null,
    `фильтр ${cutoff} Гц — ${brightness > 0.5 ? 'звонкий' : 'приглушённый'} звук песни`,
  ].filter(Boolean);
  return { bpm, root, minor, prog, layers, kickEvery, cutoff, key, reasons };
}

// Video length: whole bars, ~two passes through the photos, 12–30 s.
export function soundtrackSeconds(style, photoCount = 1) {
  const bar = 240 / style.rhythm.bpm, want = Math.min(30, Math.max(15, style.rhythm.photoSeconds * photoCount * 2));
  return Math.min(30, Math.max(12, Math.round(want / bar) * bar));
}

export async function renderScore(score, seconds, sr = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.85, 1.2);
  master.gain.setValueAtTime(0.85, Math.max(1.3, seconds - 1.8)); master.gain.linearRampToValueAtTime(0, seconds);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = score.cutoff; lp.Q.value = 0.7; lp.connect(master);
  const hz = (m) => 440 * 2 ** ((m - 69) / 12), beat = 60 / score.bpm, bar = beat * 4;
  const noise = ctx.createBuffer(1, sr, sr); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const tone = (type, freq, t, dur, peak, dest = lp, attack = 0.01) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  };
  for (let b = 0, t = 0; t < seconds; b++, t += bar) {
    const [off, q] = score.prog[b % 4], third = q === 'm' ? 3 : 4, chord = [0, third, 7, 12].map((i) => score.root + 12 + off + i);
    chord.forEach((m, k) => [-7, 7].forEach((det) => { // soft detuned pad, one chord per bar
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = k ? 'sawtooth' : 'triangle'; o.frequency.value = hz(m); o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + Math.min(0.9, bar * 0.35)); g.gain.setValueAtTime(0.035, t + bar * 0.85); g.gain.linearRampToValueAtTime(0, t + bar + 0.3);
      o.connect(g).connect(lp); o.start(t); o.stop(t + bar + 0.35);
    }));
    for (let i = 0; i < 4; i++) {
      const bt = t + i * beat; if (bt >= seconds) break;
      if (score.layers.bass && i % 2 === 0) tone('sine', hz(score.root + off), bt, beat * 1.6, 0.16, master, 0.02);
      if (score.layers.kick && i % score.kickEvery === 0) { const k = tone('sine', 140, bt, 0.3, 0.6, master, 0.003); k.frequency.exponentialRampToValueAtTime(46, bt + 0.12); }
      if (score.layers.hats) { const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7000;
        g.gain.setValueAtTime(0.05, bt + beat / 2); g.gain.exponentialRampToValueAtTime(0.0008, bt + beat / 2 + 0.05); s.connect(hp).connect(g).connect(master); s.start(bt + beat / 2); s.stop(bt + beat / 2 + 0.08); }
      if (score.layers.arp) [0, 1].forEach((h) => tone('triangle', hz(chord[(i * 2 + h) % 3] + 12), bt + (h * beat) / 2, beat * 0.45, 0.045));
    }
  }
  if (score.layers.crackle) { // vinyl: sparse clicks + a little hiss
    const c = ctx.createBuffer(1, sr * 2, sr), d = c.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 0.01 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.9 : 0);
    const s = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter(); s.buffer = c; s.loop = true; hp.type = 'highpass'; hp.frequency.value = 1500; g.gain.value = 0.35;
    s.connect(hp).connect(g).connect(master); s.start(0); s.stop(seconds);
  }
  return ctx.startRendering();
}

// Decode + resample the day's own clip to 48 kHz stereo, with a soft fade-out.
async function clipBuffer(url, sr = 48000) {
  const data = await (await fetch(url)).arrayBuffer();
  const decoded = await new OfflineAudioContext(2, 1, sr).decodeAudioData(data); // decodeAudioData resamples to the context rate
  const seconds = Math.min(30, decoded.duration), ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = decoded;
  g.gain.setValueAtTime(1, Math.max(0, seconds - 1.2)); g.gain.linearRampToValueAtTime(0, seconds);
  s.connect(g).connect(ctx.destination); s.start(0);
  return ctx.startRendering();
}

export async function soundtrackFor(day) {
  if (day.clipUrl) { const buffer = await clipBuffer(day.clipUrl); return { buffer, seconds: buffer.duration, kind: 'clip' }; }
  const score = scoreFor(day.style, day.analysis?.music || {});
  const seconds = soundtrackSeconds(day.style, day.photoUrls?.length || 1);
  return { buffer: await renderScore(score, seconds), seconds, kind: 'synth', score };
}

// Song playback + live level for the renderer, and mood-matched voice-over.
import { embedFor } from './analyze-music.js';

export function audioSrc(song) {
  if (song.clipUrl) return song.clipUrl;               // saved excerpt of the user's own/free file
  if (song.clipDataUrl) return song.clipDataUrl;       // same, before saving
  if (song.previewUrl) return `/api/music/preview?url=${encodeURIComponent(song.previewUrl)}`; // official preview, streamed
  return null;
}

export class Player {
  constructor(song, renderer) { this.song = song; this.renderer = renderer; this.src = audioSrc(song); this.embed = this.src ? null : embedFor(song.url); }

  mount(el) {
    el.innerHTML = '';
    if (this.src) {
      this.audio = new Audio(this.src); this.audio.loop = true; this.audio.preload = 'auto';
    } else if (this.embed && this.embed.kind !== 'link') {
      const hgt = { youtube: 200, spotify: 152, yandex: 180 }[this.embed.kind];
      el.innerHTML = `<iframe src="${this.embed.src}" height="${hgt}" allow="autoplay; encrypted-media; clipboard-write" loading="lazy"></iframe>`;
    } else if (this.embed) {
      el.innerHTML = `<a class="btn ghost" href="${this.embed.src}" target="_blank" rel="noopener">Открыть песню ↗</a>`;
    }
  }

  get hasAudio() { return Boolean(this.audio); }
  get playing() { return this.audio && !this.audio.paused; }

  async play() {
    if (!this.audio) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const node = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024;
      node.connect(this.analyser).connect(this.ctx.destination);
      const buf = new Float32Array(this.analyser.fftSize);
      this.renderer.getLevel = () => {
        if (!this.playing) return null;
        this.analyser.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        return Math.sqrt(s / buf.length) * 3;
      };
    }
    await this.ctx.resume();
    await this.audio.play();
  }

  pause() { this.audio?.pause(); }
  setVolume(v) { if (this.audio) this.audio.volume = v; }
  destroy() { this.pause(); speechSynthesis.cancel(); this.ctx?.close(); if (this.renderer) this.renderer.getLevel = null; }
}

// Voice rules: the day's energy sets the speed, its light sets the pitch.
export function voiceFor(st) {
  const f = st.fused;
  const rate = +(0.78 + f.arousal * 0.42).toFixed(2), pitch = +(0.88 + f.valence * 0.12 + f.tension * 0.06).toFixed(2);
  const kind = f.arousal < 0.35 ? 'тихо и медленно' : f.arousal > 0.65 ? 'живо и быстро' : 'ровно';
  return { rate, pitch, label: `${kind}: скорость ${rate}, тон ${pitch}` };
}

export function speak(text, st, player) {
  speechSynthesis.cancel();
  const v = voiceFor(st), u = new SpeechSynthesisUtterance(text);
  const ru = speechSynthesis.getVoices().filter((x) => /^ru/i.test(x.lang));
  u.lang = 'ru-RU'; u.voice = ru.find((x) => /natural|online/i.test(x.name)) || ru[0] || null;
  u.rate = v.rate; u.pitch = v.pitch;
  u.onstart = () => player?.setVolume(0.3); // duck the song under the voice
  u.onend = u.onerror = () => player?.setVolume(1);
  speechSynthesis.speak(u);
}

// Living memory renderer: a 4:5 page (1080×1350) that every day shares,
// filled by the day's technique, palette, type, rhythm and texture.
import { rng, canvas, windowFor, prepare, drawScene } from './techniques.js';

export const W = 1080, H = 1350, M = Math.round(W * 0.06);
const WEEKDAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function noiseTile(R, size = 256) {
  const c = canvas(size, size), x = c.getContext('2d'), d = x.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}

function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const tryL = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…'); }
  return lines;
}

export class MemoryRenderer {
  constructor(cv, day) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    this.day = day; this.st = day.style; this.getLevel = null; this.raf = 0; this.t0 = 0;
  }

  async load() {
    const st = this.st, R = rng(st.seed);
    const fam = `${st.type.italic ? 'italic ' : ''}${st.type.weight} 72px Fraunces`;
    await Promise.allSettled([fam, '400 40px Caveat', '400 24px "JetBrains Mono"', 'italic 400 30px Fraunces'].map((f) => document.fonts.load(f, 'АаЯя')));
    this.imgs = await Promise.all(this.day.photos.map(loadImage));
    this.win = windowFor(st.technique, W, H, M);
    this.prep = prepare(st.technique, this.imgs, st, this.win, R);
    this.grain = [0, 1, 2].map(() => noiseTile(R));
    this.paperTex = noiseTile(rng(7), 192);
    // Dark pages get a real vignette; light pages a faint plum one, so light days stay luminous instead of greying.
    const v = this.ctx.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H / 2, W * 0.85);
    const vc = st.darkPaper ? '0,0,0' : '70,40,90', va = st.texture.vignette * (st.darkPaper ? 1 : 0.4);
    v.addColorStop(0, `rgba(${vc},0)`); v.addColorStop(1, `rgba(${vc},${va.toFixed(3)})`);
    this.vignette = v;
    const b = this.ctx.createRadialGradient(W * 0.22, H * 0.12, 0, W * 0.22, H * 0.12, W * 0.9); // soft window light
    b.addColorStop(0, 'rgba(255,248,232,0.32)'); b.addColorStop(1, 'rgba(255,248,232,0)');
    this.bloom = st.darkPaper ? null : b;
    this.caption = this.makeCaption(this.day.text);
    return this;
  }

  makeCaption(text) {
    const s = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s/)[0];
    return s.length > 96 ? s.slice(0, 94).replace(/\s*\S*$/, '') + '…' : s;
  }

  frameAt(t) {
    const st = this.st, n = this.imgs.length, ps = st.rhythm.photoSeconds;
    const beat = (t * st.rhythm.bpm) / 60, beatN = Math.floor(beat), phase = beat - beatN;
    let pulse = Math.exp(-phase * 6) * st.rhythm.motion;
    const lvl = this.getLevel?.();
    if (lvl != null) pulse = Math.max(pulse * 0.35, Math.min(1, lvl * 1.6) * st.rhythm.motion);
    const slot = t / ps, idx = Math.floor(slot) % n, local = slot - Math.floor(slot);
    const dis = 0.45 - st.fused.arousal * 0.25; // calmer days dissolve longer
    const mix = n > 1 && st.rhythm.transition === 'dissolve' ? Math.max(0, (local - (1 - dis)) / dis) : 0;
    return { t, st, W, H, M, win: this.win, idx, next: (idx + 1) % n, mix: mix * mix * (3 - 2 * mix), local, pulse, beatN };
  }

  renderAt(t) {
    const ctx = this.ctx, st = this.st, f = this.frameAt(t);
    this.lastFrame = f; // the player's VU meter reads the beat pulse from here
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = st.paper; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = st.darkPaper ? 'screen' : 'multiply';
    ctx.fillStyle = ctx.createPattern(this.paperTex, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.restore();

    drawScene(ctx, st.technique, this.prep, f);
    if (this.bloom) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = this.bloom; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    this.drawType(ctx, f);

    ctx.save(); // film grain over everything, re-rolled each frame
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = st.texture.grain * 0.45;
    const g = this.grain[Math.floor(t * 24) % 3];
    ctx.translate(-((t * 997) % 256), -((t * 613) % 256));
    ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
    ctx.save(); ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  drawType(ctx, f) {
    const st = this.st, d = this.day, ty = st.type, ink = st.ink;
    const date = new Date(`${d.date}T12:00:00`);
    ctx.save(); ctx.fillStyle = ink; ctx.textBaseline = 'alphabetic';
    // constant: top band
    ctx.font = '500 22px "JetBrains Mono", monospace'; ctx.letterSpacing = '2px';
    ctx.fillText(`${d.date.split('-').reverse().join('.')} · ${WEEKDAYS[date.getDay()]}`, M, M + 22);
    ctx.textAlign = 'right'; ctx.fillText(`№ ${String(d.dayNumber || 1).padStart(3, '0')}`, W - M, M + 22);
    ctx.globalAlpha = 0.5; ctx.fillRect(M, M + 42, W - 2 * M, 1.5); ctx.globalAlpha = 1;

    // constant: caption line + title block, bottom-left
    ctx.textAlign = 'left';
    const capFont = { hand: '400 40px Caveat, cursive', mono: '400 22px "JetBrains Mono", monospace', serif: 'italic 400 28px Fraunces, Georgia, serif' }[ty.caption];
    ctx.font = capFont; ctx.letterSpacing = '0px'; ctx.globalAlpha = 0.85;
    const capLines = wrap(ctx, ty.caption === 'mono' ? `> ${this.caption}` : this.caption, W - 2 * M, 2);
    const titleSize = st.technique === 'ma' ? 56 : st.technique === 'collage' ? 78 : 70;
    ctx.font = `${ty.italic ? 'italic ' : ''}${ty.weight} ${titleSize}px Fraunces, Georgia, serif`;
    ctx.letterSpacing = `${ty.tracking * titleSize}px`;
    const title = ty.caps ? d.title.toUpperCase() : d.title;
    const tLines = wrap(ctx, title, W - 2 * M, 2);
    const baseY = H - M - 46, lh = titleSize * 1.04;
    const appear = Math.min(1, f.t / 1.2);
    ctx.globalAlpha = appear;
    tLines.forEach((l, i) => ctx.fillText(l, M, baseY - (tLines.length - 1 - i) * lh + (1 - appear) * 12));
    ctx.font = capFont; ctx.letterSpacing = '0px'; ctx.globalAlpha = 0.8 * appear;
    const capH = ty.caption === 'hand' ? 44 : 32, capY = baseY - tLines.length * lh - 18;
    capLines.forEach((l, i) => ctx.fillText(l, M, capY - (capLines.length - 1 - i) * capH));

    // constant: footer
    ctx.globalAlpha = 0.65; ctx.font = '400 19px "JetBrains Mono", monospace'; ctx.letterSpacing = '1px';
    const s = d.song || {};
    ctx.fillText(`♪ ${[s.artist, s.title].filter(Boolean).join(' — ') || 'песня дня'} · ${st.rhythm.bpm} bpm`.slice(0, 64), M, H - M + 6);
    ctx.textAlign = 'right'; ctx.fillText(`genesis · ${st.techniqueLabel.toLowerCase()}`, W - M, H - M + 6);
    ctx.restore();
  }

  start() { this.stop(); this.paused = false; this.t0 = performance.now(); this.loop(); }
  loop() {
    // rAF timestamps can precede a restart()'s performance.now(), so never let t go negative
    const tick = (now) => { this.renderAt(Math.max(0, (now - this.t0) / 1000)); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }
  get time() { return this.paused ? this.pausedAt : Math.max(0, (performance.now() - this.t0) / 1000); }
  get cycle() { return this.imgs.length * this.st.rhythm.photoSeconds; } // one pass through all photos
  pause() { if (this.paused) return; this.pausedAt = this.time; this.paused = true; this.stop(); }
  resume() { if (!this.paused) return; this.paused = false; this.t0 = performance.now() - this.pausedAt * 1000; this.loop(); }
  seek(t) { t = Math.max(0, t); this.t0 = performance.now() - t * 1000; if (this.paused) { this.pausedAt = t; this.renderAt(t); } }
  restart() { this.seek(0); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  poster() { // a still that represents the day in the archive feed
    this.renderAt(Math.max(1.4, Math.min(this.st.rhythm.photoSeconds * 0.5, 3.6)));
    return this.cv.toDataURL('image/jpeg', 0.88);
  }
}

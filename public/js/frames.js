// Photo frame styles for the 4:5 memory card. The frame decides how the photos are presented;
// the day's analysis still decides the atmosphere: photos are processed by the day's art technique,
// mood colours tint frame/tape/stickers, the slideshow and booth flashes follow the song's BPM.
import { drawCover, prepare, rng } from './techniques.js';
import { glowOf } from './util.js';

export const FRAMES = [['poster', 'Арт-постер'], ['polaroid', 'Полароид'], ['booth', 'Фотобудка'], ['film', 'Плёнка 35мм'], ['scrapbook', 'Скрапбук']];
export const FRAME_IDS = FRAMES.map(([k]) => k);
export const frameLabel = (k) => (FRAMES.find(([id]) => id === k) || FRAMES[0])[1];

const W = 1080, H = 1350, HAND = 'Caveat, cursive', MONO = '"JetBrains Mono", monospace';
const PHOTO = { polaroid: [680, 680], booth: [560, 420], film: [640, 427], scrapbook: [640, 520] }; // processing size per frame

// ---- small helpers ----
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function fit(ctx, txt, weight, size, family, maxW) { let s = size; do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(txt).width > maxW && s > 14); }
function shadow(ctx, blur = 28, y = 12, a = 0.28) { ctx.shadowColor = `rgba(60,40,90,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; }
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function star(ctx, cx, cy, r, fill = '#ffd84d') {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#e8a42a'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.35, cy - r * 0.15); ctx.lineTo(cx - r * 0.1, cy - r * 0.42); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.stroke();
}
function heart(ctx, cx, cy, s, fill = '#ff8fc3') {
  ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.75);
  ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.05, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.05, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = s * 0.12; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
}
function sticker(ctx, s, pulse) {
  const k = 1 + pulse * 0.12;
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(k, k);
  shadow(ctx, 8, 3, 0.25);
  if (s.kind === 'star') star(ctx, 0, 0, s.r); else heart(ctx, 0, 0, s.r, s.fill);
  ctx.restore();
}
function grid(ctx, color, step = 36) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
}
function dots(ctx, color, step = 60) {
  ctx.save(); ctx.fillStyle = color;
  for (let y = step / 2, r = 0; y < H; y += step, r++) for (let x = (r % 2 ? step / 2 : 0) + step / 4; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); }
  ctx.restore();
}
function tornPath(R, w, h, amp = 6, step = 20) { // centred at 0,0
  const pts = [], x = -w / 2, y = -h / 2;
  const edge = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step)), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    for (let i = 0; i < n; i++) { const k = i / n, j = (R() - 0.5) * 2 * amp; pts.push([x0 + (x1 - x0) * k + nx * j, y0 + (y1 - y0) * k + ny * j]); }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  const p = new Path2D(); pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b))); p.closePath();
  return p;
}
function washi(ctx, cx, cy, w, h, rot, color, pattern) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha = 0.78;
  const zig = (x, y0, y1, dir) => { for (let y = y0, i = 0; y <= y1; y += 7, i++) ctx.lineTo(x + (i % 2 ? 5 : 0) * dir, y); };
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); zig(w / 2, -h / 2, h / 2, -1); ctx.lineTo(-w / 2, h / 2); zig(-w / 2, -h / 2, h / 2, 1); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.clip();
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff';
  if (pattern === 'dots') { for (let x = -w / 2 + 10; x < w / 2; x += 22) for (let y = -h / 2 + 10; y < h / 2; y += 18) { ctx.beginPath(); ctx.arc(x + ((y / 18) % 2 ? 11 : 0), y, 3.5, 0, 7); ctx.fill(); } }
  else if (pattern === 'grid') { for (let x = -w / 2; x < w / 2; x += 16) ctx.fillRect(x, -h / 2, 4, h); for (let y = -h / 2; y < h / 2; y += 16) ctx.fillRect(-w / 2, y, w, 4); }
  else { for (let x = -w / 2 - h; x < w / 2; x += 20) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2); ctx.lineTo(x + h + 9, -h / 2); ctx.lineTo(x + 9, h / 2); ctx.fill(); } }
  ctx.restore();
}
function photo(ctx, fs, f, i, x, y, w, h, { zoom = 1.04, px = 0, py = 0, fade = true } = {}) {
  const L = fs.layers; if (!L.length) return;
  const z = zoom + (f.still ? 0 : 0.035 * f.local * f.st.rhythm.motion);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  drawCover(ctx, L[i % L.length], x, y, w, h, z, px, py);
  if (fade && f.mix > 0 && L.length > 1) { ctx.globalAlpha = f.mix; drawCover(ctx, L[(i + 1) % L.length], x, y, w, h, zoom, px, py); }
  ctx.restore();
}
function footer(ctx, m, st, label, dark = false) { // constant series element on every frame
  ctx.save(); noShadow(ctx);
  ctx.fillStyle = dark ? 'rgba(24,20,30,.72)' : rgba(st.paper, 0.82);
  ctx.beginPath(); ctx.roundRect(60, H - 76, W - 120, 46, 23); ctx.fill();
  ctx.fillStyle = dark ? '#f3eefc' : st.ink; ctx.font = `500 19px ${MONO}`; ctx.textBaseline = 'middle';
  const song = [m.song?.artist, m.song?.title].filter(Boolean).join(' — ') || 'песня дня';
  const right = `${st.rhythm.bpm} bpm · genesis · ${label}`, room = W - 168 - ctx.measureText(right).width - 28;
  let left = `№ ${String(m.dayNumber || 1).padStart(3, '0')} · ♪ ${song}`;
  if (ctx.measureText(left).width > room) { while (left.length > 8 && ctx.measureText(`${left}…`).width > room) left = left.slice(0, -1); left = `${left.trimEnd()}…`; }
  ctx.fillText(left, 84, H - 52);
  ctx.textAlign = 'right'; ctx.fillText(right, W - 84, H - 52);
  ctx.restore();
}
const dateDots = (d) => d.split('-').reverse().join('.');

function duotone(img, w, h, color) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.15) brightness(1.25)'; drawCover(x, img, 0, 0, w, h, 1.06);
  x.filter = 'none'; x.globalCompositeOperation = 'color'; x.fillStyle = color; x.fillRect(0, 0, w, h);
  return c;
}

// In a photo frame the photo is the point: if the technique left it too dark to read (e.g. night photos under
// Kandinsky's dark duotone), lift it just enough. The technique's colouring stays; only exposure changes.
function readable(layer) {
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(layer, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; let l = 0;
  for (let i = 0; i < d.length; i += 4) l += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  l /= d.length / 4;
  if (l >= 0.3) return layer;
  const out = document.createElement('canvas'); out.width = layer.width; out.height = layer.height;
  const o = out.getContext('2d'); o.filter = `brightness(${Math.min(2.6, 0.42 / Math.max(0.04, l)).toFixed(2)}) contrast(1.08) saturate(1.15)`; o.drawImage(layer, 0, 0);
  return out;
}

// ---- prepare: process photos with the day's technique at the frame's size, lay out stickers & tape ----
export function prepareFrame(kind, imgs, st) {
  const R = rng(st.seed ^ 0x51f15e), [pw, ph] = PHOTO[kind];
  // Kandinsky days: the poster's hard duotone (contrast 1.7) crushes shadows to black, which kills a framed photo,
  // so frames get a softer duotone in the same palette colour. Every other technique processes photos as on the poster.
  const layers = (st.technique === 'construct' ? imgs.map((im, i) => duotone(im, pw, ph, st.palette[i % 3])) : prepare(st.technique, imgs, st, { w: pw, h: ph }, R).layers).map(readable);
  const n = layers.length, glow = glowOf(st.palette), f = st.fused;
  const fs = { kind, layers, glow, tape: st.palette.map((c) => mix(c, '#ffffff', 0.42)), ink: lum(st.paper) > 0.5 ? st.ink : '#f6f1ff' };
  const tilt = (s) => (R() > 0.5 ? 1 : -1) * (0.02 + R() * s);
  if (kind === 'polaroid') {
    fs.frameColor = f.valence > 0.3 && f.arousal > 0.45 ? mix(glow, '#ffffff', 0.68) : '#fbf9f3'; // playful days get a pastel Polaroid
    fs.tilt = tilt(0.035); fs.backTilt = -fs.tilt * 1.8;
  }
  if (kind === 'booth') {
    fs.strip = mix(glow, '#ffffff', 0.28); fs.tilt = tilt(0.02);
    fs.cells = [0, 1, 2, 3].map((i) => ({ src: i % n, zoom: n >= 4 ? 1.02 : 1.02 + Math.floor(i / n) * 0.2 + R() * 0.05, px: n >= 4 ? 0 : (R() - 0.5) * 0.9, py: n >= 4 ? 0 : (R() - 0.5) * 0.7 }));
  }
  if (kind === 'film') fs.base = mix('#1c181f', st.palette[0] || '#1c181f', 0.1);
  if (kind === 'scrapbook') {
    const pieces = [
      n > 2 && { src: 2, cx: 840, cy: 250, w: 270, h: 220, b: 14, rot: 0.17 },
      n > 1 && { src: 1, cx: 800, cy: 1035, w: 330, h: 270, b: 16, rot: 0.11 },
      { src: 0, main: true, cx: 520, cy: 560, w: 640, h: 520, b: 22, rot: -0.045 },
      { note: true, cx: n > 1 ? 330 : 540, cy: 1065, w: 470, h: 210, rot: 0.05 },
    ].filter(Boolean);
    pieces.forEach((p, i) => { p.path = tornPath(R, p.w + 2 * (p.b || 0), p.h + 2 * (p.b || 0), p.note ? 5 : 6); p.tapeColor = fs.tape[i % fs.tape.length]; p.pattern = ['stripes', 'dots', 'grid'][i % 3]; });
    fs.pieces = pieces;
  }
  const spots = { polaroid: [[150, 190], [930, 220], [140, 1120], [950, 1150]], booth: [[170, 260], [905, 430], [160, 900], [915, 1080]], film: [[60, 160], [1020, 520], [60, 980]], scrapbook: [[130, 170], [990, 590], [120, 860], [610, 1215]] }[kind];
  fs.stickers = spots.map(([x, y], i) => ({ x: x + (R() - 0.5) * 30, y: y + (R() - 0.5) * 30, r: 20 + R() * 16, rot: (R() - 0.5) * 0.6, kind: i % 2 ? 'heart' : 'star', fill: mix(glow, '#ff8fc3', 0.5) }));
  return fs;
}

// ---- draw ----
function polaroid(ctx, fs, f, m) {
  const st = f.st, n = fs.layers.length, sway = f.still ? 0 : Math.sin(f.t * 0.8) * 0.012 * st.rhythm.motion;
  grid(ctx, rgba(st.ink, 0.07));
  const card = (cx, cy, rot, i, main) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    shadow(ctx, 34, 16, 0.3); ctx.fillStyle = fs.frameColor; ctx.fillRect(-380, -460, 760, 920); noShadow(ctx);
    const g = ctx.createLinearGradient(-380, -460, 380, 460); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(120,100,140,.06)');
    ctx.fillStyle = g; ctx.fillRect(-380, -460, 760, 920);
    ctx.fillStyle = '#18151c'; ctx.fillRect(-340, -420, 680, 680);
    photo(ctx, fs, main ? f : { ...f, mix: 0, local: 0 }, i, -340, -420, 680, 680, { fade: main });
    ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 2; ctx.strokeRect(-340, -420, 680, 680);
    if (main) {
      ctx.fillStyle = '#3a2f55'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      fit(ctx, m.title, 700, 74, HAND, 640); ctx.fillText(m.title, 0, 352);
      ctx.font = `600 42px ${HAND}`; ctx.fillStyle = '#7a6b98'; ctx.fillText(`${dateDots(m.date)} ♡`, 0, 412);
    }
    ctx.restore();
  };
  if (n > 1) card(575, 665, fs.backTilt, (f.idx + 1) % n, false);
  card(530, 640, fs.tilt + sway, f.idx, true);
  fs.stickers.forEach((s) => sticker(ctx, s, f.pulse));
  footer(ctx, m, st, 'полароид');
}

function booth(ctx, fs, f, m) {
  const st = f.st;
  dots(ctx, rgba(fs.glow, 0.2));
  ctx.save(); ctx.translate(540, 650); ctx.rotate(fs.tilt);
  const sw = 470, sh = 1150, x0 = -sw / 2, y0 = -sh / 2, pad = 28, cw = sw - 2 * pad, ch = 236, gap = 18;
  shadow(ctx, 36, 18, 0.3); ctx.fillStyle = fs.strip; ctx.beginPath(); ctx.roundRect(x0, y0, sw, sh, 22); ctx.fill(); noShadow(ctx);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i++) heart(ctx, x0 + 14, y0 + 70 + i * 120, 5, 'rgba(255,255,255,.7)');
  fs.cells.forEach((c, i) => {
    const cy = y0 + pad + i * (ch + gap);
    ctx.fillStyle = '#18151c'; ctx.fillRect(x0 + pad, cy, cw, ch);
    photo(ctx, fs, { ...f, mix: 0 }, c.src, x0 + pad, cy, cw, ch, { zoom: c.zoom, px: c.px, py: c.py, fade: false });
    if (!f.still && f.beatN % 4 === i && f.pulse > 0.02) { ctx.fillStyle = `rgba(255,255,255,${(f.pulse * 0.6).toFixed(3)})`; ctx.fillRect(x0 + pad, cy, cw, ch); } // the booth flash, on the beat
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.strokeRect(x0 + pad, cy, cw, ch);
  });
  const ly = y0 + pad + 4 * (ch + gap) - gap, ink = lum(fs.strip) > 0.62 ? '#3a2f55' : '#ffffff';
  ctx.fillStyle = ink; ctx.textAlign = 'center';
  ctx.font = `700 30px ${MONO}`; ctx.fillText(dateDots(m.date), 0, ly + 46);
  fit(ctx, m.title, 700, 50, HAND, cw - 40); ctx.fillText(m.title, 0, ly + 102);
  heart(ctx, -cw / 2 + 12, ly + 40, 10, '#ff8fc3'); star(ctx, cw / 2 - 12, ly + 40, 13);
  ctx.restore();
  fs.stickers.forEach((s) => sticker(ctx, s, f.pulse));
  footer(ctx, m, st, 'фотобудка');
}

function film(ctx, fs, f, m) {
  const st = f.st, n = fs.layers.length, x0 = 150, x1 = 930, iw = 620, ih = 413, pitch = ih + 46, ix = (x0 + x1) / 2 - iw / 2;
  shadow(ctx, 30, 0, 0.35); ctx.fillStyle = fs.base; ctx.fillRect(x0, -20, x1 - x0, H + 40); noShadow(ctx);
  // film advances one frame per photo slot, like a projector: hold, then a quick pull
  const ps = st.rhythm.photoSeconds, slot = f.still ? 0 : Math.floor(f.t / ps), off = f.still ? 0 : smooth((f.local - 0.8) / 0.2) * pitch;
  ctx.fillStyle = st.paper;
  for (let y = -64 - (off % 64); y < H + 64; y += 64) {
    ctx.beginPath(); ctx.roundRect(x0 + 18, y, 30, 42, 7); ctx.roundRect(x1 - 48, y, 30, 42, 7); ctx.fill();
  }
  const cy0 = H / 2 - ih / 2 - 50;
  for (let k = -2; k <= 3; k++) {
    const fy = cy0 + k * pitch - off;
    if (fy > H || fy + ih < 0) continue;
    const i = (((slot + k) % n) + n) % n;
    ctx.fillStyle = '#0d0b0f'; ctx.fillRect(ix - 4, fy - 4, iw + 8, ih + 8);
    photo(ctx, fs, { ...f, mix: 0, local: 0 }, i, ix, fy, iw, ih, { zoom: 1.02, fade: false });
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,150,80,.22)'; ctx.fillRect(ix, fy, iw, ih); ctx.restore(); // warm film stock
    ctx.save(); ctx.fillStyle = 'rgba(255,160,70,.75)'; ctx.font = `700 17px ${MONO}`;
    ctx.translate(x0 + 64, fy + ih / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(`GENESIS 400  ▸ ${slot + k + 1}`, 0, 0); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(255,160,70,.75)'; ctx.font = `700 17px ${MONO}`; ctx.translate(x1 - 58, fy + ih / 2); ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(`${slot + k + 1}A`, 0, 0); ctx.restore();
    if (k === 0) { // the classic orange date imprint
      const [yy, mm, dd] = m.date.split('-'); ctx.save(); ctx.font = `700 40px ${MONO}`; ctx.fillStyle = '#ff7b2e'; ctx.shadowColor = '#ff4f12'; ctx.shadowBlur = 14; ctx.textAlign = 'right';
      ctx.fillText(`'${yy.slice(2)} ${mm} ${dd}`, ix + iw - 22, fy + ih - 24); ctx.restore();
    }
  }
  // lab label with the handwritten title
  ctx.save(); ctx.translate(800, 1150); ctx.rotate(-0.06);
  shadow(ctx, 18, 8, 0.3); ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.roundRect(-210, -62, 420, 124, 10); ctx.fill(); noShadow(ctx);
  washi(ctx, -150, -62, 120, 36, -0.25, fs.tape[0], 'stripes');
  ctx.fillStyle = '#3a2f55'; ctx.textAlign = 'center'; fit(ctx, m.title, 700, 50, HAND, 380); ctx.fillText(m.title, 0, 6);
  ctx.font = `600 34px ${HAND}`; ctx.fillStyle = '#7a6b98'; ctx.fillText(dateDots(m.date), 0, 46);
  ctx.restore();
  fs.stickers.forEach((s) => sticker(ctx, s, f.pulse));
  footer(ctx, m, st, 'плёнка 35мм', true);
}

function scrapbook(ctx, fs, f, m) {
  const st = f.st, n = fs.layers.length;
  grid(ctx, rgba(st.ink, 0.07));
  fs.pieces.forEach((p, k) => {
    const bob = f.still ? 0 : Math.sin(f.t * 0.9 + k) * 2 * st.rhythm.motion;
    ctx.save(); ctx.translate(p.cx, p.cy + bob); ctx.rotate(p.rot);
    shadow(ctx, 20, 10, 0.26); ctx.fillStyle = p.note ? '#fff8d9' : '#fffdf8'; ctx.fill(p.path); noShadow(ctx);
    if (p.note) {
      ctx.strokeStyle = 'rgba(160,140,200,.25)'; ctx.lineWidth = 2; for (let y = -p.h / 2 + 50; y < p.h / 2; y += 42) { ctx.beginPath(); ctx.moveTo(-p.w / 2 + 20, y); ctx.lineTo(p.w / 2 - 20, y); ctx.stroke(); }
      ctx.fillStyle = '#3a2f55'; ctx.textAlign = 'center'; fit(ctx, m.title, 700, 58, HAND, p.w - 50); ctx.fillText(m.title, 0, -6);
      ctx.font = `600 38px ${HAND}`; ctx.fillStyle = '#7a6b98'; ctx.fillText(`${dateDots(m.date)} ♡`, 0, 52);
      washi(ctx, -p.w / 2 + 50, -p.h / 2 + 4, 130, 38, -0.45, p.tapeColor, p.pattern);
    } else {
      const i = p.main ? f.idx : (f.idx + p.src) % n;
      ctx.fillStyle = '#18151c'; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      photo(ctx, fs, p.main ? f : { ...f, mix: 0, local: 0 }, i, -p.w / 2, -p.h / 2, p.w, p.h, { fade: !!p.main });
      if (p.main) { washi(ctx, -p.w / 2 + 30, -p.h / 2 - p.b + 6, 180, 46, -0.62, p.tapeColor, p.pattern); washi(ctx, p.w / 2 - 30, -p.h / 2 - p.b + 6, 180, 46, 0.62, fs.tape[1] || p.tapeColor, 'dots'); }
      else washi(ctx, 0, -p.h / 2 - p.b + 4, 140, 40, 0.08 * Math.sign(p.rot), p.tapeColor, p.pattern);
    }
    ctx.restore();
  });
  fs.stickers.forEach((s) => sticker(ctx, s, f.pulse));
  footer(ctx, m, st, 'скрапбук');
}

const DRAW = { polaroid, booth, film, scrapbook };
export function drawFrame(ctx, fs, f, meta) { DRAW[fs.kind](ctx, fs, f, meta); }

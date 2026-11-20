// Optional editorial Y2K stickers on the memory card (max 3). Cards stay clean by default.
// Pure at import time: the server imports cleanStickers() from here, so validation is identical on both sides.
import { glowOf } from './util.js';

export const STICKERS = [['star4', 'Хром-звезда'], ['sparkle', 'Искорки'], ['tape', 'Васи-лента'], ['postage', 'Марка'], ['postmark', 'Штемпель'], ['minidisc', 'Минидиск'], ['cassette', 'Кассета']];
export const STICKER_KINDS = STICKERS.map(([k]) => k);
export const MAX_STICKERS = 3;
const RADIUS = { star4: 72, sparkle: 62, tape: 150, postage: 100, postmark: 92, minidisc: 82, cassette: 106 }; // hit/overlap radius, px at 1080×1350
const W = 1080, H = 1350;
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));

export function cleanStickers(list) {
  return (Array.isArray(list) ? list : []).filter((s) => STICKER_KINDS.includes(s?.kind)).slice(0, MAX_STICKERS)
    .map((s) => ({ kind: s.kind, x: clamp(+s.x, 0.04, 0.96), y: clamp(+s.y, 0.04, 0.96), rot: clamp(+s.rot, -3.2, 3.2), scale: clamp(+s.scale || 1, 0.5, 2) }));
}

// New sticker goes to the first corner/edge spot that isn't taken; rotation is playful but deterministic.
const SPOTS = [[0.84, 0.13], [0.15, 0.86], [0.86, 0.84], [0.14, 0.14], [0.86, 0.48], [0.5, 0.07]];
export function placeSticker(kind, stickers = []) {
  const free = SPOTS.find(([x, y]) => stickers.every((s) => Math.hypot(s.x - x, (s.y - y) * (H / W)) > 0.22)) || SPOTS[stickers.length % SPOTS.length];
  const n = (STICKER_KINDS.indexOf(kind) * 7 + stickers.length * 3) % 11;
  return { kind, x: free[0], y: free[1], rot: ((n / 10) - 0.5) * (kind === 'tape' ? 1 : 0.5), scale: 1 };
}

export function hitSticker(stickers = [], px, py) { // px,py in card pixels; topmost first
  for (let i = stickers.length - 1; i >= 0; i--) {
    const s = stickers[i];
    if (Math.hypot(px - s.x * W, py - s.y * H) < RADIUS[s.kind] * s.scale) return i;
  }
  return -1;
}

// ---- drawing ----
const MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
const mixWhite = (hex, k) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * k).toString(16).padStart(2, '0'); }).join('');
function shadow(ctx, b = 12, y = 5, a = 0.28) { ctx.shadowColor = `rgba(40,28,70,${a})`; ctx.shadowBlur = b; ctx.shadowOffsetY = y; }
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function chrome(ctx, r) {
  const g = ctx.createLinearGradient(-r, -r, r, r);
  [[0, '#ffffff'], [0.22, '#d9dbe6'], [0.42, '#8a8ea3'], [0.52, '#f6f7fc'], [0.72, '#b4b8c8'], [1, '#ffffff']].forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function fourPoint(ctx, r, waist = 0.16) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2, b = a + Math.PI / 4;
    if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.quadraticCurveTo(Math.cos(b) * r * waist, Math.sin(b) * r * waist, Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r);
  }
  ctx.closePath();
}

const DRAW = {
  star4(ctx) {
    const star = (x, y, r) => { ctx.save(); ctx.translate(x, y); shadow(ctx); fourPoint(ctx, r); ctx.fillStyle = chrome(ctx, r); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,90,125,.55)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.42, r * 0.06, r * 0.16, 0.2, 0, 7); ctx.fill(); ctx.restore(); };
    star(0, 0, 66); star(52, -50, 22);
  },
  sparkle(ctx, m, t, still) {
    const tw = still ? 1 : 0.8 + 0.2 * Math.sin(t * 3.1);
    ctx.save(); ctx.globalAlpha = tw; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 18;
    [[0, 0, 44], [-46, 38, 20], [42, -36, 15], [30, 44, 9]].forEach(([x, y, r]) => { ctx.save(); ctx.translate(x, y); fourPoint(ctx, r, 0.12); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(m.glow, 0.6); ctx.stroke(); ctx.restore(); });
    ctx.fillStyle = '#fff'; [[-30, -30, 3.5], [56, 10, 3], [-58, -4, 2.5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    ctx.restore();
  },
  tape(ctx, m) {
    const w = 300, h = 62, col = mixWhite(m.glow, 0.35);
    ctx.save(); ctx.globalAlpha = 0.62;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
    for (let y = -h / 2, i = 0; y <= h / 2; y += 7, i++) ctx.lineTo(w / 2 - (i % 2 ? 5 : 0), y);
    ctx.lineTo(-w / 2, h / 2);
    for (let y = h / 2, i = 0; y >= -h / 2; y -= 7, i++) ctx.lineTo(-w / 2 + (i % 2 ? 5 : 0), y);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.clip();
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff';
    for (let x = -w / 2 - h; x < w / 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2); ctx.lineTo(x + h + 9, -h / 2); ctx.lineTo(x + 9, h / 2); ctx.fill(); }
    ctx.globalAlpha = 0.45; ctx.fillRect(-w / 2, -h / 2 + 6, w, 4); // light catching the tape
    ctx.restore();
  },
  postage(ctx, m) {
    const w = 150, h = 184, bump = 7;
    ctx.save(); shadow(ctx, 10, 4, 0.3);
    ctx.beginPath(); // perforated edge: little bumps all around
    const edge = (x0, y0, x1, y1) => { const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / (bump * 2)); for (let i = 0; i < n; i++) { const k0 = i / n, k1 = (i + 1) / n, mx = x0 + (x1 - x0) * (k0 + k1) / 2, my = y0 + (y1 - y0) * (k0 + k1) / 2; ctx.arc(mx, my, bump, Math.atan2(y1 - y0, x1 - x0) + Math.PI, Math.atan2(y1 - y0, x1 - x0) + Math.PI * 2, false); } };
    edge(-w / 2, -h / 2, w / 2, -h / 2); edge(w / 2, -h / 2, w / 2, h / 2); edge(w / 2, h / 2, -w / 2, h / 2); edge(-w / 2, h / 2, -w / 2, -h / 2);
    ctx.closePath(); ctx.fillStyle = '#fffdf7'; ctx.fill(); noShadow(ctx);
    const ix = -w / 2 + 14, iy = -h / 2 + 14, iw = w - 28, ih = h - 28;
    ctx.fillStyle = mixWhite(m.glow, 0.55); ctx.fillRect(ix, iy, iw, ih);
    (m.palette || []).slice(0, 4).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(ix + (i * iw) / 4, iy + ih * 0.42, iw / 4, ih * 0.32); }); // the day's palette as the stamp's artwork
    ctx.fillStyle = mixWhite(m.glow, 0.1); ctx.beginPath(); ctx.arc(ix + iw * 0.66, iy + ih * 0.3, 18, 0, 7); ctx.fill();
    ctx.strokeStyle = rgba(m.ink, 0.6); ctx.lineWidth = 2; ctx.strokeRect(ix, iy, iw, ih);
    ctx.fillStyle = m.ink; ctx.font = '900 16px Nunito, sans-serif'; ctx.fillText('ГЕНЕЗИС', ix + 8, iy + 22);
    ctx.font = '900 30px Nunito, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(m.date.slice(2, 4), ix + iw - 8, iy + ih - 10);
    ctx.textAlign = 'left'; ctx.font = '700 11px Nunito, sans-serif'; ctx.fillText('почта дневника', ix + 8, iy + ih - 12);
    ctx.restore();
  },
  postmark(ctx, m) {
    const [y, mo, d] = m.date.split('-'), ink = 'rgba(78,60,140,.72)';
    ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.stroke(); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.stroke();
    ctx.font = '800 15px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = 'GENESIS · ДНЕВНИК · ', step = (Math.PI * 1.4) / text.length;
    [...text].forEach((ch, i) => { const a = -Math.PI * 1.2 + i * step; ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, -70); ctx.restore(); });
    ctx.font = '900 30px "JetBrains Mono", monospace'; ctx.fillText(`${+d} ${MONTHS[+mo - 1]}`, 0, -6); ctx.font = '700 20px "JetBrains Mono", monospace'; ctx.fillText(y, 0, 24);
    ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 90; x <= 250; x += 4) ctx.lineTo(x, -22 + k * 22 + Math.sin(x / 14) * 6); ctx.stroke(); } // cancellation waves
    ctx.restore();
  },
  minidisc(ctx, m) {
    const w = 136, h = 146;
    ctx.save(); shadow(ctx);
    ctx.beginPath(); ctx.moveTo(-w / 2 + 14, -h / 2); ctx.lineTo(w / 2 - 22, -h / 2); ctx.lineTo(w / 2, -h / 2 + 22); ctx.lineTo(w / 2, h / 2 - 14); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 14, h / 2);
    ctx.lineTo(-w / 2 + 14, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 14); ctx.lineTo(-w / 2, -h / 2 + 14); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 14, -h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, mixWhite(m.glow, 0.55)); g.addColorStop(1, mixWhite(m.glow, 0.15));
    ctx.fillStyle = g; ctx.fill(); noShadow(ctx); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
    ctx.fillStyle = '#fffdf8'; ctx.fillRect(-w / 2 + 14, -h / 2 + 12, w - 44, 46); ctx.fillStyle = m.ink; ctx.font = '900 24px Nunito, sans-serif'; ctx.fillText('MD', -w / 2 + 22, -h / 2 + 44);
    ctx.fillStyle = rgba(m.ink, 0.35); ctx.fillRect(-w / 2 + 70, -h / 2 + 26, 32, 4); ctx.fillRect(-w / 2 + 70, -h / 2 + 38, 24, 4);
    ctx.fillStyle = chrome(ctx, 40); ctx.fillRect(-36, h / 2 - 66, 72, 54); ctx.fillStyle = 'rgba(70,70,100,.45)'; ctx.fillRect(-20, h / 2 - 54, 40, 8);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-w / 2 + 24, 6, 6, 26, 0, 0, 7); ctx.fill();
    ctx.restore();
  },
  cassette(ctx, m) {
    const w = 200, h = 126;
    ctx.save(); shadow(ctx);
    ctx.fillStyle = '#f6f2fb'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); noShadow(ctx);
    ctx.strokeStyle = 'rgba(110,95,150,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-w / 2 + 14, -h / 2 + 12, w - 28, 56); ctx.fillStyle = mixWhite(m.glow, 0.2); ctx.fillRect(-w / 2 + 14, -h / 2 + 12, w - 28, 10);
    ctx.fillStyle = '#3a2f55'; let fs = 24; do { ctx.font = `700 ${fs}px Caveat, cursive`; fs -= 2; } while (ctx.measureText(m.title).width > w - 44 && fs > 12);
    ctx.fillText(m.title, -w / 2 + 22, -h / 2 + 44);
    ctx.fillStyle = '#2b2436'; ctx.beginPath(); ctx.roundRect(-44, -4, 88, 30, 8); ctx.fill();
    [-24, 24].forEach((x) => { ctx.fillStyle = '#f6f2fb'; ctx.beginPath(); ctx.arc(x, 11, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#2b2436'; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ctx.fillRect(x + Math.cos(a) * 6 - 1.5, 11 + Math.sin(a) * 6 - 1.5, 3, 3); } });
    ctx.fillStyle = 'rgba(110,95,150,.25)'; ctx.beginPath(); ctx.moveTo(-60, h / 2); ctx.lineTo(-48, h / 2 - 22); ctx.lineTo(48, h / 2 - 22); ctx.lineTo(60, h / 2); ctx.fill();
    ctx.restore();
  },
};

// Tray icon: the very same drawing, scaled into a small square (browser only).
export function stickerIcon(kind, m, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), k = size / (RADIUS[kind] * 2.3);
  x.translate(size / 2, size / 2); x.scale(k, k);
  DRAW[kind](x, { ...m, glow: glowOf(m.palette || []), ink: '#3a2f55' }, 0, true);
  return c.toDataURL('image/png');
}

// m = { date, title, palette, ink } ; drawn on top of the finished card (they sit on the print)
export function drawStickers(ctx, stickers, m, t = 0, still = true) {
  if (!stickers?.length) return;
  const meta = { ...m, glow: glowOf(m.palette || []), ink: m.ink || '#3a2f55' };
  for (const s of stickers) {
    if (!DRAW[s.kind]) continue;
    ctx.save(); ctx.translate(s.x * W, s.y * H); ctx.rotate(s.rot || 0); ctx.scale(s.scale || 1, s.scale || 1);
    DRAW[s.kind](ctx, meta, t, still);
    ctx.restore();
  }
}

// Six artistic techniques. Each one: prepare(photo layers, generative props) once, draw(frame) every tick.
// All randomness comes from the day's seed → the same day always renders the same way.

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

export function drawCover(ctx, img, x, y, w, h, zoom = 1, px = 0, py = 0) {
  const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih) * zoom;
  const sw = w / s, sh = h / s;
  const sx = (iw - sw) / 2 + px * (iw - sw) / 2, sy = (ih - sh) / 2 + py * (ih - sh) / 2;
  ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), Math.min(iw, sw), Math.min(ih, sh), x, y, w, h);
}

// Very light photos get a little contrast + colour back so they don't wash out (set per day in prepare()).
let LIFT = '';
function filtered(img, w, h, filter) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.filter = filter + LIFT; drawCover(x, img, 0, 0, w, h, 1.06); return c;
}

// --- Impression: painterly dabs sampled from the photo, oriented along light gradients ---
function paintImpression(img, w, h, palette, R) {
  const c = filtered(img, w, h, 'blur(4px) saturate(1.35) brightness(1.05)'), x = c.getContext('2d');
  const sw = 160, sh = Math.round((sw * h) / w), s = canvas(sw, sh), sx = s.getContext('2d', { willReadFrequently: true });
  drawCover(sx, img, 0, 0, sw, sh, 1.06);
  const d = sx.getImageData(0, 0, sw, sh).data;
  const lum = (i, j) => { const k = (Math.min(sh - 1, Math.max(0, j)) * sw + Math.min(sw - 1, Math.max(0, i))) * 4; return d[k] + d[k + 1] + d[k + 2]; };
  const n = Math.round((w * h) / 150);
  for (let k = 0; k < n; k++) {
    const u = R() * sw, v = R() * sh, i = u | 0, j = v | 0, p = (j * sw + i) * 4;
    const ang = Math.atan2(lum(i, j + 1) - lum(i, j - 1), lum(i + 1, j) - lum(i - 1, j)) + Math.PI / 2 + (R() - 0.5) * 0.6;
    const tint = R() < 0.12 ? palette[(R() * palette.length) | 0] : null;
    x.save(); x.translate((u / sw) * w, (v / sh) * h); x.rotate(ang);
    x.globalAlpha = 0.55 + R() * 0.35;
    x.fillStyle = tint || `rgb(${Math.min(255, d[p] * 1.06)},${Math.min(255, d[p + 1] * 1.04)},${d[p + 2]})`;
    x.beginPath(); x.ellipse(0, 0, 5 + R() * 9, 2 + R() * 2.5, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  return c;
}

function colorize(img, w, h, color, dark) {
  const c = filtered(img, w, h, 'grayscale(1) contrast(1.7) brightness(1.08)'), x = c.getContext('2d');
  x.globalCompositeOperation = 'color'; x.fillStyle = color; x.fillRect(0, 0, w, h);
  if (dark) { x.globalCompositeOperation = 'multiply'; x.fillStyle = '#9aa3b5'; x.fillRect(0, 0, w, h); }
  return c;
}

function blob(R, r, pts = 9) {
  const a = Array.from({ length: pts }, (_, i) => { const t = (i / pts) * Math.PI * 2; const rr = r * (0.6 + R() * 0.55); return [Math.cos(t) * rr, Math.sin(t) * rr]; });
  const p = new Path2D(); const mid = (i) => { const [x1, y1] = a[i % pts], [x2, y2] = a[(i + 1) % pts]; return [(x1 + x2) / 2, (y1 + y2) / 2]; };
  p.moveTo(...mid(0));
  for (let i = 1; i <= pts; i++) p.quadraticCurveTo(...a[i % pts], ...mid(i));
  p.closePath(); return p;
}

// Layout of the photo window per technique, always on the shared 12-column grid.
export function windowFor(tech, W, H, M) {
  const col = (W - 2 * M) / 12, top = M + 74;
  switch (tech) {
    case 'ma': return { x: M + col, y: top + 140, w: col * 5, h: col * 6.4 };
    case 'construct': return { x: M, y: top, w: col * 8, h: H * 0.56 };
    case 'collage': return { x: M, y: top, w: W - 2 * M, h: H * 0.6 };
    default: return { x: M, y: top, w: W - 2 * M, h: H * 0.6 };
  }
}

export function prepare(tech, imgs, st, win, R) {
  const { w, h } = win, pal = st.palette;
  const props = { R2: rng(st.seed ^ 0x9e3779b9) };
  LIFT = st.fused.light > 0.62 ? ' contrast(1.12) saturate(1.2)' : '';
  let layers;
  switch (tech) {
    case 'impression': layers = imgs.map((im) => paintImpression(im, w, h, pal, R)); break;
    case 'construct': layers = imgs.map((im, i) => colorize(im, w, h, pal[i % 3], st.darkPaper)); break;
    case 'nocturne': layers = imgs.map((im) => filtered(im, w, h, `contrast(1.12) saturate(1.05) sepia(${0.08 + st.texture.grain * 0.3}) brightness(0.94)`));
      props.halo = layers.map((l) => { const c = canvas(w / 2, h / 2), x = c.getContext('2d'); x.filter = 'blur(10px) brightness(1.5) contrast(1.6)'; x.drawImage(l, 0, 0, w / 2, h / 2); return c; }); break;
    case 'ma': layers = imgs.map((im) => filtered(im, w, h, 'saturate(0.9) contrast(1) brightness(1.06)')); break;
    case 'field': layers = imgs.map((im) => filtered(im, w, h, 'blur(2px) grayscale(0.15) saturate(1.1)'));
      props.fields = [0, 1, 2].map((i) => { const c = canvas(w, h / 3 + 40), x = c.getContext('2d'); x.filter = 'blur(16px)'; x.fillStyle = pal[i % pal.length]; x.fillRect(30, 30, w - 60, h / 3 - 20); return c; }); break;
    default: layers = imgs.map((im) => filtered(im, w, h, 'saturate(1.35) contrast(1.06) brightness(1.03)'));
  }
  if (tech === 'construct') {
    const n = 7 + Math.round(st.fused.arousal * 9);
    props.shapes = Array.from({ length: n }, (_, i) => ({ kind: ['circle', 'line', 'tri', 'ring', 'line', 'grid'][(R() * 6) | 0], gx: (R() * 12) | 0, gy: (R() * 15) | 0,
      s: 30 + R() * 140, rot: R() * Math.PI, spin: (R() - 0.5) * 0.6, color: pal[i % pal.length], beat: i % 4 }));
  }
  if (tech === 'collage') {
    props.cards = imgs.map(() => ({ dx: (R() - 0.5) * 0.5, dy: (R() - 0.5) * 0.4, rot: (R() - 0.5) * 0.3, s: 0.5 + R() * 0.15 }));
    props.blobs = Array.from({ length: 6 }, (_, i) => ({ path: blob(R, 60 + R() * 90), x: R(), y: R(), color: pal[i % pal.length], ph: R() * 6 }));
  }
  if (tech === 'impression') props.specks = Array.from({ length: 40 }, () => ({ x: R(), y: R(), r: 1.5 + R() * 4, ph: R() * 6, v: 0.2 + R() * 0.6 }));
  if (tech === 'ma') props.enso = { cx: 0.74, cy: 0.33, r: 0.17, start: R() * Math.PI * 2 };
  return { layers, props };
}

// Draw the technique's scene. f = frame info from the renderer.
export function drawScene(ctx, tech, prep, f) {
  const { win, st, t, idx, next, mix, pulse, W, H, local } = f, { layers, props } = prep, { x, y, w, h } = win;
  const m = st.rhythm.motion, ink = st.ink, pal = st.palette;
  const kb = (k, i) => { // slow Ken Burns zoom + pan
    const z = 1 + (0.03 + 0.06 * m) * k, dir = ((st.seed >> (i % 8)) & 3) - 1.5; return [z, dir * 0.15 * k];
  };
  const photo = (i, alpha, k) => { if (alpha <= 0) return; const [z, p] = kb(k, i); ctx.globalAlpha = alpha; drawCover(ctx, layers[i], x, y, w, h, z, p, p * 0.5); ctx.globalAlpha = 1; };

  ctx.save();
  if (tech === 'field') {
    const breath = Math.sin((t * Math.PI * 2) / ((60 / st.rhythm.bpm) * 16));
    prep.props.fields.forEach((fc, i) => { ctx.globalAlpha = 0.85 + 0.1 * breath; ctx.drawImage(fc, x, y + (i * h) / 3 - 10 + breath * 6 * (i - 1), w, h / 3 + 40); });
    ctx.globalAlpha = 0.3 * (1 - mix); ctx.globalCompositeOperation = 'luminosity'; drawCover(ctx, layers[idx], x + 40, y + h / 3, w - 80, h / 3);
    ctx.globalAlpha = 0.3 * mix; drawCover(ctx, layers[next], x + 40, y + h / 3, w - 80, h / 3);
  } else if (tech === 'collage') {
    const order = layers.map((_, i) => i).filter((i) => i !== idx).concat(idx);
    props.blobs.forEach((b, i) => { ctx.save(); ctx.translate(x + b.x * w, y + b.y * h + Math.sin(t * 2 + b.ph) * 8 * m - pulse * 10 * (i % 2)); ctx.rotate(Math.sin(t * 0.5 + b.ph) * 0.2); ctx.fillStyle = b.color; ctx.fill(b.path); ctx.restore(); });
    order.forEach((i) => {
      const c = props.cards[i], front = i === idx, cw = w * (front ? 0.62 + pulse * 0.015 : c.s), ch = cw * 0.78;
      const cx = x + w / 2 + (front ? 0 : c.dx * w), cy = y + h / 2 + (front ? -Math.max(0, 1 - local * 6) * 30 : c.dy * h);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(front ? c.rot * 0.3 : c.rot);
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#fbf8f1'; ctx.fillRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 52); ctx.shadowColor = 'transparent';
      drawCover(ctx, layers[i], -cw / 2, -ch / 2, cw, ch); ctx.restore();
    });
  } else {
    if (tech === 'nocturne') { const j = (prep.props.R2() - 0.5) * 3 * m; ctx.translate(j, (prep.props.R2() - 0.5) * 2 * m); }
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (st.rhythm.transition === 'cut') photo(idx, 1, local); else { photo(idx, 1, local); photo(next, mix, 0); }
    if (tech === 'nocturne') {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = st.texture.halation * (0.8 + pulse * 0.4);
      ctx.drawImage(props.halo[mix > 0.5 ? next : idx], x, y, w, h);
      const lx = x + w * (0.5 + 0.5 * Math.sin(t * 0.13)), g = ctx.createRadialGradient(lx, y, 0, lx, y, w * 0.6);
      g.addColorStop(0, 'rgba(255,120,40,.35)'); g.addColorStop(1, 'rgba(255,60,20,0)'); ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    if (tech === 'impression') {
      ctx.globalCompositeOperation = 'screen';
      props.specks.forEach((s) => { ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * s.v * 2 + s.ph) ** 2; ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(x + ((s.x + t * 0.004 * s.v) % 1) * w, y + s.y * h - t * 2 * s.v % h, s.r, 0, 7); ctx.fill(); });
    }
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = ink; ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
  if (tech !== 'collage' && tech !== 'field') ctx.strokeRect(x, y, w, h); // constant: hairline photo window
  ctx.restore();

  if (tech === 'construct') drawConstruct(ctx, props.shapes, f);
  if (tech === 'ma') drawEnso(ctx, props.enso, f);
}

function drawConstruct(ctx, shapes, { W, H, M, t, beatN, pulse, st }) {
  const col = (W - 2 * M) / 12, row = (H - 2 * M) / 15;
  ctx.save(); ctx.strokeStyle = st.ink; ctx.globalAlpha = 0.12; ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(M + i * col, M); ctx.lineTo(M + i * col, H - M); ctx.stroke(); }
  ctx.restore();
  shapes.forEach((s) => {
    const hit = beatN % 4 === s.beat ? pulse : 0, sc = 1 + hit * 0.25 * st.rhythm.motion;
    ctx.save(); ctx.translate(M + s.gx * col, M + s.gy * row); ctx.rotate(s.rot + t * s.spin * st.rhythm.motion); ctx.scale(sc, sc);
    ctx.fillStyle = s.color; ctx.strokeStyle = s.kind === 'line' ? st.ink : s.color; ctx.lineWidth = s.kind === 'line' ? 6 : 4;
    ctx.globalAlpha = s.kind === 'circle' ? 0.88 : 1; ctx.globalCompositeOperation = st.darkPaper ? 'screen' : 'multiply';
    if (s.kind === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s.s / 2, 0, 7); ctx.fill(); }
    else if (s.kind === 'ring') { for (let r = s.s / 2; r > 6; r -= 14) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); } }
    else if (s.kind === 'line') { ctx.beginPath(); ctx.moveTo(-s.s * 1.6, 0); ctx.lineTo(s.s * 1.6, 0); ctx.stroke(); }
    else if (s.kind === 'tri') { ctx.beginPath(); ctx.moveTo(0, -s.s / 2); ctx.lineTo(s.s / 2, s.s / 2); ctx.lineTo(-s.s / 2, s.s / 2); ctx.closePath(); ctx.fill(); }
    else { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) ctx.fillRect(i * 12 - 24, j * 12 - 24, 12, 12); }
    ctx.restore();
  });
}

function drawEnso(ctx, e, { W, H, t, st, pulse }) {
  const cx = e.cx * W, cy = e.cy * H, r = e.r * W, prog = Math.min(1, t / 3.2), sweep = Math.PI * 1.82 * prog;
  ctx.save(); ctx.strokeStyle = st.palette[0]; ctx.lineCap = 'round';
  for (let a = 0; a < sweep; a += 0.02) {
    const k = a / (Math.PI * 1.82); ctx.lineWidth = (26 - 18 * k) * (1 + pulse * 0.05); ctx.globalAlpha = 0.9 - k * 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, r + Math.sin(a * 3) * 3, e.start + a, e.start + a + 0.03); ctx.stroke();
  }
  ctx.restore();
}

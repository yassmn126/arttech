// Landscape Y2K pearl CD player. Transparent top-hinged lid, iridescent disc that spins one turn per bar,
// green LCD (play state, date, title, seek line, BPM, mood, live levels), paper-tape mood & weather badges,
// glossy keys (prev/play/next/♥/★) and big «Архив» / «+ Новый день» buttons — all clickable via raycasting.
import { THREE, damp, createStage, makeDisc, labelTexture, blankLabel, loadImage, pastel } from './three-kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MOODS } from './util.js';

const BW = 6.8, BH = 4.6, BD = 0.8, FZ = BD / 2;
const WELL = { x: -1.62, y: 0.2, r: 1.55 };
const LCD = { x: 1.75, y: 1.05, w: 2.66, h: 1.28 };
const INK = '#5d4d82', MONO = '"JetBrains Mono", monospace', UI = 'Nunito, sans-serif';
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.canvas = c;
  if (draw) redraw(t, draw);
  return t;
}
function redraw(t, draw) { const c = t.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); draw(x, c.width, c.height); t.needsUpdate = true; }
function fitFont(x, txt, weight, size, family, maxW) { let s = size; do { x.font = `${weight} ${s}px ${family}`; s -= 2; } while (x.measureText(txt).width > maxW && s > 14); }

// ---- little canvas drawings ----
function star(x, cx, cy, r, fill = '#ffd84d') {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fillStyle = fill; x.fill(); x.lineWidth = r * 0.12; x.strokeStyle = '#e8a42a'; x.stroke();
}
function heart(x, cx, cy, s, fill) {
  x.beginPath(); x.moveTo(cx, cy + s * 0.75);
  x.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.05, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.6, cy - s * 1.05, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75);
  x.fillStyle = fill; x.fill();
}
function glyph(x, kind, s, color) {
  x.fillStyle = color; x.strokeStyle = color; x.lineJoin = 'round'; x.lineCap = 'round';
  const tri = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a * s, b * s) : x.moveTo(a * s, b * s))); x.closePath(); x.fill(); };
  if (kind === 'play') tri([[0.38, 0.27], [0.74, 0.5], [0.38, 0.73]]);
  if (kind === 'pause') { x.fillRect(0.33 * s, 0.28 * s, 0.11 * s, 0.44 * s); x.fillRect(0.56 * s, 0.28 * s, 0.11 * s, 0.44 * s); }
  if (kind === 'prev') { x.fillRect(0.26 * s, 0.28 * s, 0.08 * s, 0.44 * s); tri([[0.74, 0.28], [0.38, 0.5], [0.74, 0.72]]); }
  if (kind === 'next') { x.fillRect(0.66 * s, 0.28 * s, 0.08 * s, 0.44 * s); tri([[0.26, 0.28], [0.62, 0.5], [0.26, 0.72]]); }
  if (kind === 'heart') heart(x, 0.5 * s, 0.5 * s, 0.26 * s, color);
  if (kind === 'star') star(x, 0.5 * s, 0.52 * s, 0.3 * s, color);
}
function face(x, cx, cy, r, i, on) {
  x.save();
  if (on) { x.shadowColor = '#ffd84d'; x.shadowBlur = 28; }
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = on ? '#ffe46b' : '#fffdf8'; x.fill();
  x.shadowBlur = 0; x.lineWidth = r * 0.09; x.strokeStyle = '#6b5a86'; x.stroke();
  x.fillStyle = '#4a3d63';
  if (i === 4 && on) { star(x, cx - r * 0.35, cy - r * 0.18, r * 0.22, '#ff8fc3'); star(x, cx + r * 0.35, cy - r * 0.18, r * 0.22, '#ff8fc3'); }
  else { x.beginPath(); x.arc(cx - r * 0.33, cy - r * 0.15, r * 0.1, 0, 7); x.arc(cx + r * 0.33, cy - r * 0.15, r * 0.1, 0, 7); x.fill(); }
  x.beginPath(); x.lineWidth = r * 0.09;
  const my = cy + r * 0.32, curve = [-0.3, -0.08, 0, 0.18, 0.32][i];
  if (i === 4) { x.moveTo(cx - r * 0.4, my - r * 0.05); x.quadraticCurveTo(cx, my + r * 0.5, cx + r * 0.4, my - r * 0.05); x.closePath(); x.fillStyle = '#c2457f'; x.fill(); }
  else { x.moveTo(cx - r * 0.32, my); x.quadraticCurveTo(cx, my + curve * r * 2, cx + r * 0.32, my); x.stroke(); }
  if (on) { x.fillStyle = 'rgba(255,143,195,.55)'; x.beginPath(); x.ellipse(cx - r * 0.58, cy + r * 0.2, r * 0.16, r * 0.1, 0, 0, 7); x.ellipse(cx + r * 0.58, cy + r * 0.2, r * 0.16, r * 0.1, 0, 0, 7); x.fill(); }
  x.restore();
}
function weatherIcon(x, kind, cx, cy, s) {
  const sun = (col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, s * 0.42, 0, 7); x.fill(); x.strokeStyle = col; x.lineWidth = s * 0.1; x.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6); x.lineTo(cx + Math.cos(a) * s * 0.85, cy + Math.sin(a) * s * 0.85); x.stroke(); } };
  const cloud = () => { x.fillStyle = '#dfe6f7'; x.strokeStyle = '#8f9cc4'; x.lineWidth = s * 0.06; x.beginPath(); x.arc(cx - s * 0.3, cy, s * 0.32, Math.PI * 0.5, Math.PI * 1.5); x.arc(cx + s * 0.05, cy - s * 0.2, s * 0.42, Math.PI, 0); x.arc(cx + s * 0.42, cy + s * 0.02, s * 0.3, Math.PI * 1.5, Math.PI * 0.5); x.closePath(); x.fill(); x.stroke(); };
  const flake = (fx, fy, r) => { x.strokeStyle = '#7fb4ea'; x.lineWidth = s * 0.07; for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; x.beginPath(); x.moveTo(fx - Math.cos(a) * r, fy - Math.sin(a) * r); x.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r); x.stroke(); } };
  if (kind === 'rain') { cloud(); x.strokeStyle = '#6aa5e6'; x.lineWidth = s * 0.08; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(cx + i * s * 0.3, cy + s * 0.45); x.lineTo(cx + i * s * 0.3 - s * 0.1, cy + s * 0.75); x.stroke(); } }
  else if (kind === 'snow' || kind === 'frost' || kind === 'winter') { if (kind === 'snow') { cloud(); flake(cx - s * 0.25, cy + s * 0.62, s * 0.14); flake(cx + s * 0.25, cy + s * 0.62, s * 0.14); } else flake(cx, cy, s * 0.7); }
  else if (kind === 'fog' || kind === 'wind') { x.strokeStyle = '#8f9cc4'; x.lineWidth = s * 0.1; x.lineCap = 'round'; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(cx - s * 0.7, cy + i * s * 0.32); x.quadraticCurveTo(cx, cy + i * s * 0.32 - (kind === 'wind' ? s * 0.2 : 0), cx + s * 0.7, cy + i * s * 0.32); x.stroke(); } }
  else if (kind === 'night') { x.fillStyle = '#ffd84d'; x.beginPath(); x.arc(cx, cy, s * 0.6, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(cx + s * 0.28, cy - s * 0.2, s * 0.5, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over'; }
  else if (kind === 'autumn') { x.fillStyle = '#f29a3d'; x.beginPath(); x.ellipse(cx, cy, s * 0.36, s * 0.66, 0.7, 0, 7); x.fill(); x.strokeStyle = '#b8611d'; x.lineWidth = s * 0.06; x.beginPath(); x.moveTo(cx - s * 0.45, cy + s * 0.45); x.lineTo(cx + s * 0.35, cy - s * 0.4); x.stroke(); }
  else if (kind === 'spring') { x.fillStyle = '#ff9fcb'; for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5; x.beginPath(); x.arc(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34, s * 0.3, 0, 7); x.fill(); } x.fillStyle = '#ffd84d'; x.beginPath(); x.arc(cx, cy, s * 0.22, 0, 7); x.fill(); }
  else sun(kind === 'heat' ? '#ff9a4d' : '#ffc93c');
}
function tape(x, X, Y, W, H, col, rot) {
  x.save(); x.translate(X + W / 2, Y + H / 2); x.rotate(rot); x.globalAlpha = 0.9; x.fillStyle = col; x.fillRect(-W / 2, -H / 2, W, H);
  x.globalAlpha = 0.35; x.fillStyle = '#fff'; for (let i = -W / 2; i < W / 2; i += 22) x.fillRect(i, -H / 2, 10, H); x.restore();
}

export async function createPlayer3D(canvas, { onAction }) {
  await Promise.allSettled(['700 60px "JetBrains Mono"', '800 40px Nunito', '900 40px Nunito', '400 60px Pacifico'].map((f) => document.fonts.load(f, 'Ая')));
  const { renderer, scene, camera, key, dispose } = createStage(canvas, { fov: 24 });
  const rig = new THREE.Group(); scene.add(rig);
  let tint = pastel('#d9c8ff', 0.5);
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf0e9f6, envMapIntensity: 1.15, roughness: 0.26, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.55, iridescenceIOR: 1.4, iridescenceThicknessRange: [300, 900], sheen: 0.6, sheenColor: tint.clone() });
  const pearlDeep = new THREE.MeshPhysicalMaterial({ color: 0xeae2f3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, iridescence: 0.4, sheen: 0.5, sheenColor: tint.clone() });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf3f1f8, metalness: 1, roughness: 0.12, clearcoat: 1 });
  const clickables = [];
  const act = (o, name) => { o.userData.act = name; o.userData.press = 0; o.userData.hover = 0; o.userData.baseZ = o.position.z; clickables.push(o); return o; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); rig.add(o); return o; };
  const decal = (w, h, map, opts = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ map, transparent: true, roughness: 0.4, clearcoat: 0.5, ...opts }));

  // body, hinge housing, engraved logo, "CD PLAYER"
  at(new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 8, 0.55), pearl), 0, 0, 0);
  at(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.34, 0.26, 4, 0.12), pearlDeep), -1.25, WELL.y + WELL.r + 0.2, FZ + 0.06);
  at(decal(1.35, 0.42, tex(512, 160, (x, w, h) => {
    x.font = '400 92px Pacifico, cursive'; x.textBaseline = 'middle';
    const g = x.createLinearGradient(0, 20, 0, 140); g.addColorStop(0, '#efe3ff'); g.addColorStop(1, '#b896f2');
    x.lineWidth = 10; x.strokeStyle = 'rgba(160,130,220,.55)'; x.strokeText('genesis', 24, 82); x.fillStyle = g; x.fillText('genesis', 24, 78);
    star(x, 470, 46, 20, '#fff6c9');
  })), -2.62, 1.98, FZ + 0.004);
  at(decal(1.5, 0.3, tex(512, 100, (x, w, h) => {
    x.font = '900 46px Nunito, sans-serif'; x.fillStyle = '#9c93b3'; x.letterSpacing = '5px'; x.textBaseline = 'middle'; x.fillText('CD PLAYER', 8, 52);
    const g = x.createConicGradient(0, 455, 50); ['#f6e3ff', '#d4f1ff', '#fff6c9', '#ffd9ec', '#f6e3ff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    x.fillStyle = g; x.beginPath(); x.arc(455, 50, 36, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(455, 50, 9, 0, 7); x.fill(); x.strokeStyle = '#c9bfe0'; x.lineWidth = 3; x.stroke();
  })), 2.3, 1.98, FZ + 0.004);

  // disc well + chrome ring + spindle + the day's disc + top-hinged transparent lid
  const wellMat = new THREE.MeshPhysicalMaterial({ color: 0xe4dcef, roughness: 0.45, clearcoat: 0.6 });
  at(new THREE.Mesh(new THREE.CircleGeometry(WELL.r, 96), wellMat), WELL.x, WELL.y, FZ + 0.004);
  at(new THREE.Mesh(new THREE.TorusGeometry(WELL.r + 0.03, 0.06, 20, 128), chrome), WELL.x, WELL.y, FZ + 0.02);
  const spindle = at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 32), chrome), WELL.x, WELL.y, FZ + 0.07); spindle.rotation.x = Math.PI / 2;
  const disc = makeDisc(blankLabel()); disc.group.scale.setScalar(WELL.r - 0.08); rig.add(disc.group);
  act(disc.group, 'card');
  const discRest = new THREE.Vector3(WELL.x, WELL.y, FZ + 0.06);
  const lidPivot = at(new THREE.Group(), WELL.x, WELL.y + WELL.r + 0.04, FZ + 0.15);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(WELL.r + 0.07, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0.03, clearcoat: 1, iridescence: 0.5, envMapIntensity: 1.6, side: THREE.DoubleSide }));
  lid.position.y = -(WELL.r + 0.04); lidPivot.add(lid);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(WELL.r + 0.07, 0.03, 12, 128), chrome); lidRim.position.y = lid.position.y; lidPivot.add(lidRim);

  // LCD
  at(new THREE.Mesh(new RoundedBoxGeometry(LCD.w + 0.26, LCD.h + 0.24, 0.14, 4, 0.14), pearlDeep), LCD.x, LCD.y, FZ + 0.03);
  const lcdTex = tex(1024, 500);
  const screen = at(new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h), new THREE.MeshPhysicalMaterial({ map: lcdTex, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.32, roughness: 0.1, clearcoat: 1 })), LCD.x, LCD.y, FZ + 0.105);
  act(screen, 'lcd');

  // paper-tape badges
  const moodTex = tex(700, 320), weatherTex = tex(460, 320);
  const moodBadge = at(decal(1.7, 0.78, moodTex), 0.95, -0.36, FZ + 0.004); moodBadge.rotation.z = 0.03;
  const weatherBadge = at(decal(1.12, 0.78, weatherTex), 2.55, -0.36, FZ + 0.004); weatherBadge.rotation.z = -0.03;

  // glossy keys
  const keyGeo = new RoundedBoxGeometry(0.6, 0.5, 0.24, 4, 0.12), roundGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.22, 48);
  const keyMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf8fe, roughness: 0.25, clearcoat: 1, iridescence: 0.3, sheen: 0.4, sheenColor: tint.clone() });
  const playMat = new THREE.MeshPhysicalMaterial({ color: 0xeafff3, roughness: 0.22, clearcoat: 1, emissive: 0x9fe6c4, emissiveIntensity: 0.25 });
  const faces = {};
  const keyFace = (name, kind, color) => { const t = tex(128, 128, (x, w) => glyph(x, kind, w, color)); faces[name] = t; return t; };
  const mkKey = (name, kind, x, geo, mat, color, round) => {
    const g = new THREE.Group(); const body = new THREE.Mesh(geo, mat); if (round) body.rotation.x = Math.PI / 2; g.add(body);
    const f = decal(round ? 0.36 : 0.42, round ? 0.36 : 0.42, keyFace(name, kind, color), { clearcoat: 0 }); f.position.z = round ? 0.112 : 0.122; g.add(f);
    g.userData.face = f; return act(at(g, x, -1.15, FZ + 0.08), name);
  };
  mkKey('prev', 'prev', 0.45, keyGeo, keyMat, '#7d6ca8');
  const playKey = mkKey('play', 'play', 1.1, keyGeo, playMat, '#7d8cf0');
  mkKey('next', 'next', 1.75, keyGeo, keyMat, '#7d6ca8');
  mkKey('card', 'heart', 2.42, roundGeo, new THREE.MeshPhysicalMaterial({ color: 0xffe3ef, roughness: 0.22, clearcoat: 1 }), '#ff6fae', true);
  mkKey('why', 'star', 3.0, roundGeo, new THREE.MeshPhysicalMaterial({ color: 0xfff6d6, roughness: 0.22, clearcoat: 1 }), '#ffd84d', true);

  // big glossy buttons
  const bigGeo = new RoundedBoxGeometry(1.5, 0.55, 0.26, 4, 0.2);
  const bigLabel = (text, icon) => tex(512, 180, (x, w, h) => {
    x.textBaseline = 'middle'; fitFont(x, text, 900, 70, UI, w - 150); x.shadowColor = 'rgba(80,40,120,.45)'; x.shadowBlur = 8; x.shadowOffsetY = 3; x.fillStyle = '#fff';
    const tw = x.measureText(text).width, ix = (w - tw - 90) / 2;
    if (icon === 'folder') { x.fillStyle = '#ffd36e'; x.beginPath(); x.roundRect(ix, 58, 70, 60, 8); x.fill(); x.fillStyle = '#ffc24a'; x.fillRect(ix, 50, 30, 14); x.fillStyle = '#fff'; }
    else { x.fillRect(ix + 26, 52, 14, 70); x.fillRect(ix + 0, 80, 66, 14); }
    x.fillText(text, ix + 90, 92);
  });
  const mkBig = (name, text, icon, xPos, color) => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(bigGeo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.5, sheenColor: 0xffffff })));
    const l = decal(1.4, 0.49, bigLabel(text, icon), { clearcoat: 0 }); l.position.z = 0.132; g.add(l);
    return act(at(g, xPos, -1.88, FZ + 0.08), name);
  };
  mkBig('archive', 'Архив', 'folder', 0.9, 0xb49cff);
  mkBig('new', 'Новый день', 'plus', 2.5, 0xff8fc3);

  // volume knob + line-art cat sticker
  const knob = act(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 40), chrome), -3.0, -1.86, FZ + 0.06), 'vol'); knob.rotation.x = Math.PI / 2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.3), new THREE.MeshBasicMaterial({ color: 0x8e86a3 })); grip.position.set(0, 0.11, 0); knob.add(grip);
  at(decal(1.0, 0.72, tex(300, 216, (x) => {
    x.lineWidth = 6; x.strokeStyle = '#6b5a86'; x.lineJoin = 'round'; x.lineCap = 'round'; x.fillStyle = 'rgba(255,255,255,.7)';
    x.beginPath(); x.moveTo(70, 110); x.lineTo(62, 40); x.lineTo(110, 72); x.quadraticCurveTo(150, 60, 190, 72); x.lineTo(238, 40); x.lineTo(230, 110);
    x.quadraticCurveTo(250, 190, 150, 196); x.quadraticCurveTo(50, 190, 70, 110); x.fill(); x.stroke();
    star(x, 150, 42, 18, '#ffe36e');
    x.fillStyle = '#4a3d63'; x.beginPath(); x.arc(118, 128, 7, 0, 7); x.arc(182, 128, 7, 0, 7); x.fill();
    x.beginPath(); x.moveTo(140, 150); x.quadraticCurveTo(150, 160, 160, 150); x.stroke();
    x.beginPath(); x.moveTo(40, 140); x.lineTo(95, 146); x.moveTo(42, 162); x.lineTo(96, 156); x.moveTo(260, 140); x.lineTo(205, 146); x.moveTo(258, 162); x.lineTo(204, 156); x.stroke();
    x.fillStyle = 'rgba(255,143,195,.55)'; x.beginPath(); x.ellipse(100, 152, 14, 8, 0, 0, 7); x.ellipse(200, 152, 14, 8, 0, 0, 7); x.fill();
  }), { clearcoat: 0 }), -1.95, -1.82, FZ + 0.004);

  // ---- state ----
  const ptr = { x: 0, y: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let day = null, playing = false, vel = 0, volume = 1, drop = 1, turn = 2.6, raf = 0, last = 0, hovered = null, t0 = performance.now();

  function drawLcd({ progress = null, level = 0 } = {}) {
    redraw(lcdTex, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d6f7e2'); g.addColorStop(1, '#a9e3c0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(20,60,40,.05)'; for (let y = 0; y < h; y += 5) x.fillRect(0, y, w, 2);
      const ink = '#1f4330'; x.fillStyle = ink; x.strokeStyle = ink; x.textBaseline = 'alphabetic';
      if (!day) { x.font = `700 58px ${MONO}`; x.fillText('вставьте диск', 50, 190); x.font = `700 40px ${MONO}`; x.fillText('+ запишите первый день', 50, 300); return; }
      x.save(); x.translate(26, 52); glyph(x, playing ? 'play' : 'pause', 92, ink); x.restore();
      x.font = `700 66px ${MONO}`; x.fillText(day.date, 130, 120);
      for (let i = 0; i < 8; i++) { const bh = 18 + i * 11; x.globalAlpha = i < Math.round(level * 8) ? 1 : 0.18; x.fillRect(w - 250 + i * 28, 128 - bh, 18, bh); } x.globalAlpha = 1;
      fitFont(x, `${day.title} ♡`, 700, 58, MONO, w - 100); x.fillText(`${day.title} ♡`, 50, 225);
      x.globalAlpha = 0.35; x.fillRect(50, 262, w - 100, 5); x.globalAlpha = 1;
      if (progress != null) { x.fillRect(50, 258, (w - 100) * Math.max(0, Math.min(1, progress)), 13); }
      x.font = `700 60px ${MONO}`; x.fillText(`♫ ${day.bpm} BPM`, 50, 380);
      const word = day.moodWord || MOODS[day.mood].word; fitFont(x, word, 700, 54, MONO, 330); const tw = x.measureText(word).width;
      x.fillText(word, w - 50 - tw, 380); x.lineWidth = 6; x.beginPath(); x.arc(w - 50 - tw - 52, 362, 28, 0, 7); x.stroke();
      x.beginPath(); x.arc(w - 50 - tw - 62, 354, 4, 0, 7); x.arc(w - 50 - tw - 42, 354, 4, 0, 7); x.fill();
      x.beginPath(); x.moveTo(w - 50 - tw - 66, 372); x.quadraticCurveTo(w - 50 - tw - 52, 372 + (day.mood - 2) * 6, w - 50 - tw - 38, 372); x.stroke();
    });
  }
  function drawBadges() {
    redraw(moodTex, (x, w, h) => {
      x.fillStyle = '#fffdf8'; x.shadowColor = 'rgba(90,60,140,.25)'; x.shadowBlur = 14; x.shadowOffsetY = 4; x.beginPath(); x.roundRect(14, 92, w - 28, h - 112, 22); x.fill(); x.shadowBlur = 0; x.shadowOffsetY = 0;
      tape(x, 26, 22, 400, 74, day ? `#${pastel(day.glow, 0.45).getHexString()}` : '#ffc7de', -0.04);
      x.fillStyle = INK; x.font = `800 44px ${UI}`; x.fillText('Моё настроение:', 48, 74);
      for (let i = 0; i < 5; i++) { const on = day && i === day.mood; face(x, 92 + i * 129, 214, on ? 54 : 42, i, on); }
    });
    redraw(weatherTex, (x, w, h) => {
      x.fillStyle = '#fffdf8'; x.shadowColor = 'rgba(90,60,140,.25)'; x.shadowBlur = 14; x.shadowOffsetY = 4; x.beginPath(); x.roundRect(14, 92, w - 28, h - 112, 22); x.fill(); x.shadowBlur = 0; x.shadowOffsetY = 0;
      tape(x, 24, 24, 230, 70, '#d9ccff', 0.04);
      x.fillStyle = INK; x.font = `800 44px ${UI}`; x.fillText('Погода:', 44, 74);
      const wthr = day?.weather || { kind: 'sun', text: '—' };
      weatherIcon(x, wthr.kind, 100, 212, 62);
      x.fillStyle = INK; const words = wthr.text.split(' · ');
      words.slice(0, 2).forEach((wd, i) => { fitFont(x, wd, 800, 42, UI, w - 210); x.fillText(wd, 182, words.length > 1 ? 196 + i * 48 : 226); });
    });
  }
  drawLcd(); drawBadges();

  const fit = () => {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight), t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max((BH * 1.1) / (2 * t), (BW * 1.08) / (2 * t * a));
  };
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const t = (now - t0) / 1000;
    fit();
    rig.rotation.y = damp(rig.rotation.y, ptr.x * 0.14, 4, dt);
    rig.rotation.x = damp(rig.rotation.x, ptr.y * 0.09 + Math.sin(t * 0.7) * 0.012, 4, dt);
    rig.position.y = Math.sin(t * 0.9) * 0.04;
    drop = Math.min(1, drop + dt / 1.05); // disc drops in, lid closes
    const e = easeOutBack(drop);
    disc.group.position.set(discRest.x, discRest.y + (1 - e) * 3.4, discRest.z + (1 - e) * 1.6);
    disc.group.rotation.x = (1 - e) * 1.1;
    const lidT = Math.max(0, Math.min(1, (drop - 0.55) / 0.45)), open = drop < 1 ? Math.min(1, drop * 6) : 0;
    lidPivot.rotation.x = -1.45 * Math.max(open * (1 - lidT * lidT * (3 - 2 * lidT)), 0);
    vel = damp(vel, playing ? turn : 0, playing ? 2.2 : 1.1, dt);
    disc.spin.rotation.z -= vel * dt;
    knob.rotation.y = damp(knob.rotation.y, -volume * 4, 8, dt);
    clickables.forEach((o) => {
      if (o === disc.group) return;
      o.userData.press = damp(o.userData.press, 0, 9, dt);
      o.userData.hover = damp(o.userData.hover, o === hovered ? 1 : 0, 10, dt);
      o.position.z = o.userData.baseZ - o.userData.press * 0.1 + o.userData.hover * 0.03;
    });
    playKey.children[0].material.emissiveIntensity = 0.25 + (playing ? 0.25 + Math.sin(t * 5) * 0.08 : 0);
    key.position.set(3 + ptr.x * 4, 4 - ptr.y * 3, 7);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickables, true)[0];
    let o = hit?.object; while (o && !o.userData.act) o = o.parent;
    return o ? { o, uv: hit.uv } : null;
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ptr.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    const p = e.target === canvas ? pick(e.clientX, e.clientY) : null;
    hovered = p?.o || null; canvas.style.cursor = hovered ? 'pointer' : 'default';
  };
  const onClick = (e) => {
    const p = pick(e.clientX, e.clientY); if (!p) return;
    p.o.userData.press = 1;
    const name = p.o.userData.act;
    if (name === 'lcd') { const u = p.uv?.x ?? 0.5; if (day) onAction?.('seek', Math.max(0, Math.min(1, (u - 0.05) / 0.9))); return; }
    onAction?.(name);
  };
  window.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  return {
    setDay(d) { // d = { posterUrl, glow, bpm, date, title, mood, weather } | null
      day = d; drop = 0; turn = d ? (2 * Math.PI) / (240 / d.bpm) : 2.6;
      tint = pastel(d?.glow || '#d9c8ff', 0.5);
      [pearl, pearlDeep, keyMat].forEach((m) => m.sheenColor.copy(tint));
      wellMat.color.set(0xe4dcef).lerp(tint, 0.35);
      if (d?.posterUrl) { const url = d.posterUrl; loadImage(url).then((img) => { if (day?.posterUrl === url) disc.setLabel(labelTexture(img)); }).catch(() => {}); }
      else disc.setLabel(blankLabel());
      drawBadges(); drawLcd();
    },
    setPlaying(on) { if (on === playing) return; playing = on; redraw(faces.play, (x, w) => glyph(x, on ? 'pause' : 'play', w, '#7d8cf0')); },
    setVolume(v) { volume = v; },
    lcd: drawLcd,
    press(name) { const o = clickables.find((c) => c.userData.act === name); if (o) o.userData.press = 1; },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); dispose(); },
  };
}

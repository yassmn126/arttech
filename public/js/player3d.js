// Sleek dark-metal CD player. Polished chrome shell around a brushed-graphite face, a smoked transparent lid on a
// top hinge, the day's iridescent disc (one turn per bar), a luminous progress ring around the well (click = seek),
// a silver knurled volume dial and glowing ⏮ ▶ ⏭ ↻ keys — all clickable via raycasting.
// API (used by home.js): setDay, setPlaying, setVolume, setPoster, lcd, press, dispose.
import { THREE, damp, createStage, makeDisc, labelTexture, blankLabel, loadImage } from './three-kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BW = 5.7, BH = 6.0, BD = 0.6, FZ = BD / 2 + 0.03; // FZ = front of the graphite face
const WELL = { x: 0, y: 0.5, r: 1.95 };
const RING = { r0: WELL.r + 0.1, r1: WELL.r + 0.24 };
const KY = -2.27, TILT = -0.3, TAU = Math.PI * 2;
const DISPLAY = 'Prata, Georgia, serif', UI = 'Manrope, "Segoe UI", sans-serif';
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.canvas = c;
  if (draw) redraw(t, draw);
  return t;
}
function redraw(t, draw) { const c = t.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); draw(x, c.width, c.height); t.needsUpdate = true; }
const rand = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// brushed metal: fine horizontal grain for the face, concentric (spun) grain for the disc well and the dial cap
function brushed(concentric) {
  return tex(1024, 1024, (x, w, h) => {
    const r = rand(concentric ? 11 : 5);
    x.fillStyle = '#8a8d98'; x.fillRect(0, 0, w, h);
    if (concentric) {
      for (let rad = 1; rad < w * 0.71; rad += 1.25) { const v = (96 + r() * 90) | 0; x.strokeStyle = `rgba(${v},${v},${v + 8},${0.25 + r() * 0.4})`; x.lineWidth = 1.1; x.beginPath(); x.arc(w / 2, h / 2, rad, 0, TAU); x.stroke(); }
    } else {
      for (let y = 0; y < h; y++) { const v = (90 + r() * 90) | 0; x.fillStyle = `rgba(${v},${v},${v + 10},${0.2 + r() * 0.45})`; x.fillRect(0, y, w, 1); }
      for (let i = 0; i < 2600; i++) { const v = r() > 0.5 ? 220 : 40; x.fillStyle = `rgba(${v},${v},${v},${r() * 0.12})`; x.fillRect(r() * w, r() * h, 40 + r() * 260, 1); }
    }
  });
}
// knurled grip around the VOL dial
function knurl() {
  const t = tex(1024, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2f3f8'); g.addColorStop(0.5, '#b9bcc8'); g.addColorStop(1, '#eceef4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 8) { x.fillStyle = 'rgba(40,44,60,.35)'; x.fillRect(i, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(i + 3, 0, 1, h); }
  });
  return t;
}

// luminous key glyphs (white core + soft glow in the day's accent)
function glyph(x, kind, s, glow) {
  const draw = () => {
    x.fillStyle = '#f7f6ff'; x.strokeStyle = '#f7f6ff'; x.lineJoin = 'round'; x.lineCap = 'round';
    const tri = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a * s, b * s) : x.moveTo(a * s, b * s))); x.closePath(); x.lineWidth = s * 0.05; x.fill(); x.stroke(); };
    const bar = (a, w = 0.075) => { x.beginPath(); x.roundRect(a * s, 0.31 * s, w * s, 0.38 * s, w * s * 0.4); x.fill(); };
    if (kind === 'play') tri([[0.41, 0.3], [0.72, 0.5], [0.41, 0.7]]);
    if (kind === 'pause') { bar(0.36, 0.1); bar(0.54, 0.1); }
    if (kind === 'prev') { bar(0.3); tri([[0.7, 0.32], [0.42, 0.5], [0.7, 0.68]]); }
    if (kind === 'next') { bar(0.625); tri([[0.3, 0.32], [0.58, 0.5], [0.3, 0.68]]); }
    if (kind === 'repeat') {
      x.lineWidth = s * 0.055; x.beginPath(); x.arc(0.5 * s, 0.5 * s, 0.2 * s, -0.25 * Math.PI, 1.55 * Math.PI); x.stroke();
      tri([[0.6, 0.24], [0.72, 0.36], [0.56, 0.4]]);
    }
  };
  x.save(); x.shadowColor = glow; x.shadowBlur = s * 0.09; draw(); x.shadowBlur = s * 0.03; x.shadowColor = '#ffffff'; draw(); x.restore();
}

// reflections: a dark night studio with a few softbox strips placed off the face's mirror angle,
// so chrome edges and the disc catch light while the graphite face stays deep
function nightStudio() {
  const s = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1), mats = [];
  s.background = new THREE.Color(0x05060c);
  const strip = (color, power, pos, scale) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) }); mats.push(m);
    const o = new THREE.Mesh(box, m); o.position.set(...pos); o.scale.set(...scale); s.add(o);
  };
  strip(0xffffff, 5, [0, 16, -8], [16, 0.2, 7]);      // overhead softbox, behind the player: top bevels glint
  strip(0xe4e9ff, 6, [-13, 5, 3], [0.2, 12, 2.2]);    // tall strip on the left
  strip(0xfff3ea, 4, [13, 6, -3], [0.2, 12, 2.2]);    // tall strip on the right
  strip(0xa9b8ff, 0.7, [0, 9, 13], [18, 6, 0.2]);     // faint front-top wash: the face and keys get a soft sheen, never a flash
  strip(0x8a7dff, 1.2, [0, -10, 6], [20, 0.2, 10]);   // violet floor bounce
  s.dispose = () => { box.dispose(); mats.forEach((m) => m.dispose()); };
  return s;
}

export async function createPlayer3D(canvas, { onAction }) {
  await Promise.allSettled(['400 60px Prata', '700 40px Manrope'].map((f) => document.fonts.load(f, 'genesis ЗВУК')));
  const { renderer, scene, camera, key, dispose } = createStage(canvas, { fov: 24, exposure: 1.05, envScene: nightStudio });
  scene.traverse((o) => { if (o.isHemisphereLight) o.intensity = 0.32; });
  key.intensity = 1.1;
  const rig = new THREE.Group(); scene.add(rig);
  let accent = new THREE.Color('#b7a6ff'), accentCss = '#b7a6ff';

  // mood-coloured light from below (the "floor glow") + a cool rim light from the upper left
  const under = new THREE.PointLight(accent.clone(), 28, 12, 2); under.position.set(0, -4.2, 2.6); scene.add(under);
  const rimLight = new THREE.PointLight(0xa9c2ff, 20, 14, 2); rimLight.position.set(-4.5, 4, 3); scene.add(rimLight);

  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xdfe2ea, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xa3a8b8, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x3a3d49, map: brushed(false), metalness: 0.88, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.32, envMapIntensity: 0.62 });
  const spun = brushed(true);
  const keyGlass = new THREE.MeshPhysicalMaterial({ color: 0x181a24, metalness: 0.45, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false, transparent: true, opacity: 0.85 });
  const clickables = [];
  const act = (o, name) => { o.userData.act = name; o.userData.press = 0; o.userData.hover = 0; o.userData.baseZ = o.position.z; clickables.push(o); return o; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); rig.add(o); return o; };
  const glowPlane = (w, h, map, opacity = 1) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, opacity, toneMapped: false, depthWrite: false }));

  // chrome shell + brushed graphite face + luminous strips along the bottom edge
  at(new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 10, 0.62), shell), 0, 0, 0);
  at(new THREE.Mesh(new RoundedBoxGeometry(BW - 0.24, BH - 0.24, 0.12, 8, 0.52), graphite), 0, 0, BD / 2 - 0.03);
  [-1.45, 1.45].forEach((x) => at(new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.07, 0.1, 2, 0.03), glowMat), x, -BH / 2 + 0.035, BD / 2 - 0.08));

  // disc well (spun metal) + chrome lip + glowing progress ring + spindle
  at(new THREE.Mesh(new THREE.CircleGeometry(WELL.r, 160), new THREE.MeshPhysicalMaterial({ color: 0x2b2e38, map: spun, metalness: 0.9, roughness: 0.3, clearcoat: 0.5, envMapIntensity: 0.8 })), WELL.x, WELL.y, FZ + 0.002);
  at(new THREE.Mesh(new THREE.TorusGeometry(WELL.r + 0.02, 0.045, 20, 180), chrome), WELL.x, WELL.y, FZ + 0.02);
  const ringTex = tex(768, 768);
  const ring = at(new THREE.Mesh(new THREE.RingGeometry(RING.r0, RING.r1, 200, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, toneMapped: false, depthWrite: false })), WELL.x, WELL.y, FZ + 0.006);
  act(ring, 'lcd');
  const spindle = at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 40), chrome), WELL.x, WELL.y, FZ + 0.07); spindle.rotation.x = Math.PI / 2;

  // the day's disc
  const disc = makeDisc(blankLabel()); disc.group.scale.setScalar(WELL.r - 0.08); rig.add(disc.group);
  act(disc.group, 'card');
  const discRest = new THREE.Vector3(WELL.x, WELL.y, FZ + 0.06);
  // CD rainbow: two diffraction streaks that stay put while the print spins underneath
  const sheen = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.99, 128), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    map: tex(512, 512, (x, w) => {
      const c = w / 2, g = x.createConicGradient(-0.55, c, c);
      [[0, 0], [0.07, 0], [0.095, 'rgba(255,130,200,.55)'], [0.115, 'rgba(255,226,140,.6)'], [0.135, 'rgba(120,255,205,.55)'], [0.155, 'rgba(110,170,255,.55)'], [0.185, 0],
        [0.57, 0], [0.595, 'rgba(255,130,200,.4)'], [0.615, 'rgba(255,226,140,.45)'], [0.635, 'rgba(120,255,205,.4)'], [0.655, 'rgba(110,170,255,.4)'], [0.685, 0], [1, 0]]
        .forEach(([o, col]) => g.addColorStop(o, col || 'rgba(0,0,0,0)'));
      x.fillStyle = g; x.fillRect(0, 0, w, w);
      x.globalCompositeOperation = 'destination-in';
      const r = x.createRadialGradient(c, c, 0, c, c, c); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.3, 'rgba(0,0,0,.55)'); r.addColorStop(0.92, '#000'); r.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = r; x.fillRect(0, 0, w, w);
    }) }));
  sheen.position.z = 0.021; disc.group.add(sheen);

  // smoked transparent lid on a chrome hinge plate engraved with the wordmark
  const LID_R = RING.r1 + 0.03;
  const hinge = at(new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.3, 0.2, 4, 0.1), chrome), 0, WELL.y + LID_R + 0.14, FZ + 0.1);
  const brand = glowPlane(1.2, 0.28, tex(600, 140, (x, w, h) => {
    x.font = `400 96px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(40,44,62,.85)'; x.fillText('genesis', w / 2, h / 2 + 4);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText('genesis', w / 2, h / 2 + 7);
  }));
  brand.material.toneMapped = true; brand.position.set(0, 0, 0.101); hinge.add(brand);
  const lidPivot = at(new THREE.Group(), WELL.x, WELL.y + LID_R, FZ + 0.17);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(LID_R, 160), new THREE.MeshPhysicalMaterial({ color: 0xc9cfff, transparent: true, opacity: 0.13, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.45, iridescenceIOR: 1.35, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false }));
  lid.position.y = -LID_R; lidPivot.add(lid);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(LID_R, 0.032, 14, 180), chrome); lidRim.position.y = lid.position.y; lidPivot.add(lidRim);

  // status LED (top right)
  const led = at(new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), glowMat.clone()), 2.25, 2.48, FZ + 0.004);

  // luminous keys: smoked-glass caps in chrome bezels, glyphs glow in the day's accent
  const faces = {};
  const mkKey = (name, kind, x, r) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, 0.16, 72), keyGlass); body.rotation.x = Math.PI / 2; g.add(body);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.036, 16, 120), chrome); bezel.position.z = 0.062; g.add(bezel);
    const t = tex(256, 256, (cx, w) => glyph(cx, kind, w, accentCss)); faces[name] = { t, kind };
    const f = glowPlane(r * 1.5, r * 1.5, t); f.position.z = 0.085; g.add(f); g.userData.face = f;
    return act(at(g, x, KY, FZ + 0.08), name);
  };
  mkKey('prev', 'prev', -0.95, 0.32);
  const playKey = mkKey('play', 'play', 0, 0.43);
  mkKey('next', 'next', 0.95, 0.32);
  mkKey('random', 'repeat', 2.08, 0.29);
  const playHalo = new THREE.Mesh(new THREE.TorusGeometry(0.43 + 0.075, 0.022, 12, 140), glowMat.clone()); playHalo.position.z = 0.07; playKey.add(playHalo);

  // silver «ЗВУК» (volume) dial: knurled chrome body, spun cap, accent dot; engraved scale on the face
  const knobG = act(at(new THREE.Group(), -2.08, KY, FZ), 'vol');
  const knob = new THREE.Group(); knobG.add(knob);
  const kBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.32, 96), new THREE.MeshPhysicalMaterial({ color: 0xe9ebf2, map: knurl(), metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.6 }));
  kBody.rotation.x = Math.PI / 2; kBody.position.z = 0.16; knob.add(kBody);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.385, 96), new THREE.MeshPhysicalMaterial({ color: 0xf4f5fa, map: spun, metalness: 0.3, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.6 })); cap.position.z = 0.321; knob.add(cap);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), glowMat.clone()); dot.position.set(0, 0.27, 0.323); knob.add(dot);
  at(glowPlane(1.36, 1.36, tex(512, 512, (x, w) => {
    const c = w / 2; x.strokeStyle = 'rgba(214,218,240,.55)'; x.lineCap = 'round';
    for (let i = 0; i <= 20; i++) { const a = (0.75 + (i / 20) * 1.5) * Math.PI, big = i % 5 === 0, r0 = 182, r1 = big ? 214 : 202; x.lineWidth = big ? 5 : 3; x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke(); }
    x.fillStyle = 'rgba(214,218,240,.7)'; x.font = `700 34px ${UI}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ЗВУК', c, c + 232); x.fillText('−', c - 196, c + 196); x.fillText('+', c + 196, c + 196);
  }), 0.9), -2.08, KY, FZ + 0.004);

  // ---- state ----
  const ptr = { x: 0, y: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let day = null, playing = false, vel = 0, volume = 1, drop = 1, turn = 2.6, raf = 0, last = 0, hovered = null, level = 0;
  const t0 = performance.now();

  function drawRing({ progress = null, level: lv = 0 } = {}) {
    level = lv;
    redraw(ringTex, (x, S) => {
      const c = S / 2, rr = (r) => (r / RING.r1) * c, mid = rr((RING.r0 + RING.r1) / 2);
      x.lineCap = 'round';
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU - Math.PI / 2, big = i % 10 === 0, r0 = rr(RING.r0 + 0.03), r1 = rr(RING.r1 - (big ? 0.02 : 0.06));
        x.strokeStyle = `rgba(222,226,255,${big ? 0.5 : 0.18})`; x.lineWidth = big ? 3 : 1.6;
        x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke();
      }
      if (progress == null) return;
      const p = clamp01(progress), end = -Math.PI / 2 + TAU * p;
      x.shadowColor = accentCss; x.shadowBlur = 18; x.strokeStyle = accentCss; x.lineWidth = 7;
      x.beginPath(); x.arc(c, c, mid, -Math.PI / 2, end); x.stroke();
      x.shadowBlur = 16 + lv * 26; x.shadowColor = '#fff'; x.fillStyle = '#fff';
      x.beginPath(); x.arc(c + Math.cos(end) * mid, c + Math.sin(end) * mid, 7 + lv * 5, 0, TAU); x.fill();
    });
  }
  drawRing();

  const fit = () => {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight), t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max((BH * 1.13) / (2 * t), (BW * 1.12) / (2 * t * a));
  };
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const t = (now - t0) / 1000;
    fit();
    rig.rotation.y = damp(rig.rotation.y, ptr.x * 0.16, 4, dt);
    rig.rotation.x = damp(rig.rotation.x, TILT + ptr.y * 0.08 + Math.sin(t * 0.7) * 0.012, 4, dt);
    rig.position.y = Math.sin(t * 0.9) * 0.04;
    drop = Math.min(1, drop + dt / 1.05); // disc drops in, lid closes
    const e = easeOutBack(drop);
    disc.group.position.set(discRest.x, discRest.y + (1 - e) * 3.4, discRest.z + (1 - e) * 1.6);
    disc.group.rotation.x = (1 - e) * 1.1;
    const lidT = clamp01((drop - 0.55) / 0.45), open = drop < 1 ? Math.min(1, drop * 6) : 0;
    lidPivot.rotation.x = -1.45 * Math.max(open * (1 - lidT * lidT * (3 - 2 * lidT)), 0);
    vel = damp(vel, playing ? turn : 0, playing ? 2.2 : 1.1, dt);
    disc.spin.rotation.z -= vel * dt;
    knob.rotation.z = damp(knob.rotation.z, (0.75 - volume * 1.5) * Math.PI, 8, dt);
    clickables.forEach((o) => {
      if (o === disc.group) return;
      o.userData.press = damp(o.userData.press, 0, 9, dt);
      o.userData.hover = damp(o.userData.hover, o === hovered ? 1 : 0, 10, dt);
      o.position.z = o.userData.baseZ - o.userData.press * 0.08 + o.userData.hover * 0.03;
      if (o.userData.face) o.userData.face.material.opacity = 0.82 + o.userData.hover * 0.18;
    });
    const pulse = playing ? 0.55 + 0.25 * Math.sin(t * 4) + level * 0.35 : 0.3;
    playHalo.material.opacity = Math.min(1, pulse + playKey.userData.hover * 0.3);
    led.material.opacity = playing ? 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * (turn / TAU))) : 0.25;
    under.intensity = 24 + (playing ? 10 + level * 30 : 0);
    key.position.set(-5 + ptr.x * 1.5, 5.5, 3); // off the mirror angle of the tilted face, so flat metal never flashes white
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
    if (name === 'lcd') { // the ring: angle from 12 o'clock, clockwise → position in the song
      if (day && p.uv) { const a = Math.atan2(p.uv.x - 0.5, p.uv.y - 0.5); onAction?.('seek', ((a + TAU) % TAU) / TAU); }
      return;
    }
    onAction?.(name);
  };
  window.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  const recolor = (hex) => {
    const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
    accent = new THREE.Color().setHSL(hsl.h, Math.max(0.6, hsl.s), 0.68); accentCss = `#${accent.getHexString()}`;
    [glowMat, playHalo.material, led.material, dot.material].forEach((m) => m.color.copy(accent));
    under.color.copy(accent);
    Object.values(faces).forEach((f) => redraw(f.t, (x, w) => glyph(x, f.kind === 'play' && playing ? 'pause' : f.kind, w, accentCss)));
  };

  return {
    setDay(d) { // d = { posterUrl, glow, bpm, date, title, mood, weather } | null
      day = d; drop = 0; turn = d ? TAU / (240 / d.bpm) : 2.6;
      recolor(d?.glow || '#b7a6ff');
      if (d?.posterUrl) { const url = d.posterUrl; loadImage(url).then((img) => { if (day?.posterUrl === url) disc.setLabel(labelTexture(img, '#0d0e1a')); }).catch(() => {}); }
      else disc.setLabel(blankLabel());
      drawRing();
    },
    setPlaying(on) { if (on === playing) return; playing = on; redraw(faces.play.t, (x, w) => glyph(x, on ? 'pause' : 'play', w, accentCss)); },
    setVolume(v) { volume = v; },
    setPoster(url) { loadImage(url).then((img) => { if (day) { day.posterUrl = url; disc.setLabel(labelTexture(img, '#0d0e1a')); } }).catch(() => {}); }, // re-print the disc after a frame change
    lcd: drawRing,
    press(name) { const o = clickables.find((c) => c.userData.act === name); if (o) o.userData.press = 1; },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); dispose(); },
  };
}

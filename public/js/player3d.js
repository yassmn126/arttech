// A cute 3D CD player: pastel body, glass lid, chrome ring, pressable keys, tiny LCD.
// The day's disc drops in, the lid closes, and it spins once per bar of the song while playing.
import { THREE, damp, createStage, makeDisc, labelTexture, loadImage, pastel } from './three-kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const ICONS = {
  prev: (x, s) => { x.fillRect(s * 0.28, s * 0.3, s * 0.08, s * 0.4); x.beginPath(); x.moveTo(s * 0.72, s * 0.3); x.lineTo(s * 0.4, s * 0.5); x.lineTo(s * 0.72, s * 0.7); x.fill(); },
  next: (x, s) => { x.fillRect(s * 0.64, s * 0.3, s * 0.08, s * 0.4); x.beginPath(); x.moveTo(s * 0.28, s * 0.3); x.lineTo(s * 0.6, s * 0.5); x.lineTo(s * 0.28, s * 0.7); x.fill(); },
  play: (x, s) => { x.beginPath(); x.moveTo(s * 0.4, s * 0.3); x.lineTo(s * 0.7, s * 0.5); x.lineTo(s * 0.4, s * 0.7); x.fill(); },
  pause: (x, s) => { x.fillRect(s * 0.36, s * 0.3, s * 0.1, s * 0.4); x.fillRect(s * 0.54, s * 0.3, s * 0.1, s * 0.4); },
};

function iconTexture(kind, dot) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#3a3150'; ICONS[kind](x, S);
  if (dot) { x.fillStyle = dot; x.beginPath(); x.arc(S * 0.5, S * 0.88, S * 0.05, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function createPlayer3D(canvas, { posterUrl, palette = [], bpm = 100, onKey }) {
  const { renderer, scene, camera, key, dispose } = createStage(canvas, { fov: 26 });
  camera.position.set(0, 0, 13.6);
  const tint = pastel(palette[0] || '#ffd6e8', 0.55), accent = pastel(palette[1] || palette[0] || '#ff7fae', 0.2);

  const rig = new THREE.Group(); scene.add(rig);
  const W = 3.4, H = 4.6, Dp = 0.64, FZ = Dp / 2, WY = 0.42, R = 1.34;
  const shell = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#fbf8fd').lerp(tint, 0.18), roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: tint });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f0f8, metalness: 1, roughness: 0.12, clearcoat: 1 });
  rig.add(new THREE.Mesh(new RoundedBoxGeometry(W, H, Dp, 8, 0.36), shell));

  // disc well, chrome ring, spindle
  const well = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#ece7f4').lerp(tint, 0.25), roughness: 0.55 }));
  well.position.set(0, WY, FZ + 0.004); rig.add(well);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.055, 20, 128), chrome); ring.position.set(0, WY, FZ + 0.02); rig.add(ring);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 32), chrome); spindle.rotation.x = Math.PI / 2; spindle.position.set(0, WY, FZ + 0.07); rig.add(spindle);

  // the day's disc
  const disc = makeDisc(labelTexture(null, tint.getStyle()));
  if (posterUrl) loadImage(posterUrl).then((img) => disc.setLabel(labelTexture(img))).catch(() => {});
  const discRest = new THREE.Vector3(0, WY, FZ + 0.06);
  disc.group.scale.setScalar(R - 0.1); rig.add(disc.group);

  // glass lid on a side hinge
  const lidPivot = new THREE.Group(); lidPivot.position.set(-R - 0.12, WY, FZ + 0.12); rig.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(R + 0.06, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide }));
  lid.position.x = R + 0.12; lidPivot.add(lid);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.025, 12, 128), chrome); lidRim.position.x = R + 0.12; lidPivot.add(lidRim);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 24), chrome); hinge.position.set(-R - 0.12, WY, FZ + 0.1); rig.add(hinge);

  // tiny LCD + engraved brand
  const lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 512; lcdCanvas.height = 168;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.45), new THREE.MeshPhysicalMaterial({ map: lcdTex, roughness: 0.15, clearcoat: 1, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.35 }));
  lcd.position.set(0.82, 2.0, FZ + 0.003); rig.add(lcd);
  const brandC = document.createElement('canvas'); brandC.width = 512; brandC.height = 128;
  { const x = brandC.getContext('2d'); x.fillStyle = 'rgba(70,55,100,.55)'; x.font = '700 64px Comfortaa, Nunito, sans-serif'; x.fillText('genesis', 6, 78); x.font = '700 30px Nunito, sans-serif'; x.fillStyle = 'rgba(70,55,100,.35)'; x.fillText('memory player', 10, 118); }
  const brandTex = new THREE.CanvasTexture(brandC); brandTex.colorSpace = THREE.SRGBColorSpace;
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true }));
  brand.position.set(-0.98, 1.98, FZ + 0.003); rig.add(brand);

  // three pressable keys
  const keyGeo = new RoundedBoxGeometry(0.9, 0.7, 0.28, 4, 0.13);
  const keyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.9, sheen: 0.4, sheenColor: tint });
  const playMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#ffffff').lerp(accent, 0.45), roughness: 0.3, clearcoat: 0.9 });
  const keys = ['prev', 'play', 'next'].map((act, i) => {
    const g = new THREE.Group(); g.position.set((i - 1) * 1.02, -1.62, FZ + 0.08); g.userData.act = act;
    const body = new THREE.Mesh(keyGeo, act === 'play' ? playMat : keyMat); body.userData.act = act; g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: iconTexture(act, act === 'play' ? accent.getStyle() : null), transparent: true }));
    face.position.z = 0.142; face.userData.act = act; g.add(face);
    g.userData.face = face; g.userData.press = 0; g.userData.hover = 0; g.userData.baseZ = g.position.z;
    rig.add(g);
    return g;
  });
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 40), chrome);
  knob.rotation.z = Math.PI / 2; knob.position.set(W / 2 + 0.12, -1.62, 0); rig.add(knob);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0x8e86a3 }));
  grip.position.z = 0.2; knob.add(grip); // turns with the knob, so volume is visible on the 3D player

  // state + loop
  const ptr = { x: 0, y: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let playing = false, vel = 0, volume = 1, t0 = performance.now(), raf = 0, last = 0, drop = 0, hovered = null;
  const turn = (2 * Math.PI) / (240 / bpm); // one revolution per bar (4 beats)

  function drawLcd({ line1 = '', line2 = '', level = 0 } = {}) {
    const x = lcdCanvas.getContext('2d'), w = lcdCanvas.width, h = lcdCanvas.height;
    x.fillStyle = '#3b3352'; x.fillRect(0, 0, w, h);
    const fit = (txt, weight, size, maxW) => { // shrink long lines (e.g. "Цветовое поле") instead of overlapping the meter
      let s = size; do { x.font = `${weight} ${s}px Nunito, sans-serif`; s -= 2; } while (x.measureText(txt).width > maxW && s > 16);
    };
    x.fillStyle = '#b8f5dc'; fit(line1, 800, 54, w - 52); x.fillText(line1, 26, 70);
    x.fillStyle = 'rgba(184,245,220,.7)'; fit(line2, 700, 36, w - 240); x.fillText(line2, 26, 130);
    for (let i = 0; i < 10; i++) { x.fillStyle = i < Math.round(level * 10) ? (i > 7 ? '#ffb3cf' : '#b8f5dc') : 'rgba(184,245,220,.15)'; x.fillRect(w - 190 + i * 17, 98, 12, 34); }
    lcdTex.needsUpdate = true;
  }
  drawLcd({ line1: `${bpm} BPM`, line2: 'вставлен диск' });

  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const t = (now - t0) / 1000;
    rig.rotation.y = damp(rig.rotation.y, ptr.x * 0.3, 4, dt);
    rig.rotation.x = damp(rig.rotation.x, ptr.y * 0.18 + Math.sin(t * 0.7) * 0.015, 4, dt);
    rig.position.y = Math.sin(t * 0.9) * 0.05;
    // drop the disc in, then close the lid
    drop = Math.min(1, drop + dt / 1.1);
    const e = easeOutBack(drop);
    disc.group.position.set(discRest.x, discRest.y + (1 - e) * 3.6, discRest.z + (1 - e) * 1.8);
    disc.group.rotation.x = (1 - e) * 1.1;
    const lidT = Math.max(0, Math.min(1, (drop - 0.55) / 0.45));
    lidPivot.rotation.y = -1.75 * (1 - lidT * lidT * (3 - 2 * lidT));
    // spin: spin up / coast down smoothly
    vel = damp(vel, playing ? turn : 0, playing ? 2.2 : 1.1, dt);
    disc.spin.rotation.z -= vel * dt;
    knob.rotation.x = damp(knob.rotation.x, -volume * 4, 8, dt);
    keys.forEach((k) => {
      k.userData.press = damp(k.userData.press, 0, 9, dt);
      k.userData.hover = damp(k.userData.hover, k === hovered ? 1 : 0, 10, dt);
      k.position.z = k.userData.baseZ - k.userData.press * 0.11 + k.userData.hover * 0.02;
    });
    key.position.set(3 + ptr.x * 4, 4 - ptr.y * 3, 6);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const pickKey = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(keys, true)[0];
    let o = hit?.object; while (o && !o.userData.act) o = o.parent;
    return o ? keys.find((k) => k.userData.act === o.userData.act) : null;
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ptr.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    hovered = pickKey(e.clientX, e.clientY);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  };
  const onClick = (e) => { const k = pickKey(e.clientX, e.clientY); if (k) { k.userData.press = 1; onKey?.(k.userData.act); } };
  window.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  return {
    setPlaying(on) {
      if (on === playing) return;
      playing = on;
      const play = keys[1], face = play.userData.face, old = face.material.map;
      face.material.map = iconTexture(on ? 'pause' : 'play', accent.getStyle()); face.material.needsUpdate = true; old?.dispose();
    },
    setVolume(v) { volume = v; },
    press(act) { const k = keys.find((x) => x.userData.act === act); if (k) k.userData.press = 1; },
    display: drawLcd,
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); dispose(); },
  };
}

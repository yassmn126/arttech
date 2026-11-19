// Shared Three.js pieces: a tone-mapped stage with studio reflections, and a glossy CD whose
// label is the day's memory poster (iridescent rim + hub, clearcoat label).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const damp = THREE.MathUtils.damp;

export function createStage(canvas, { fov = 30, exposure = 1.05 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the art's colours true (ACES greys pastels out)
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.035).texture;
  room.dispose?.();
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xfff0f6, 0xdfeaff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(3, 4, 6); scene.add(key);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const dispose = () => {
    ro.disconnect();
    scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      [].concat(o.material || []).forEach((m) => {
        if (m.userData.shared) return;
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      });
    });
    env.dispose(); pmrem.dispose(); renderer.dispose();
  };
  return { renderer, scene, camera, key, dispose };
}

export const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

// ---- disc ----
const shared = (o) => { o.userData.shared = true; return o; };
let G = null, M = null;
function parts() {
  G ||= {
    label: shared(new THREE.RingGeometry(0.31, 0.955, 128, 1)), rim: shared(new THREE.RingGeometry(0.955, 1, 128, 1)),
    hub: shared(new THREE.RingGeometry(0.115, 0.31, 96, 1)), back: shared(new THREE.RingGeometry(0.115, 1, 128, 1)),
    edge: shared(new THREE.CylinderGeometry(1, 1, 0.03, 128, 1, true)),
  };
  M ||= {
    // pearly rainbow silver: half-metal so it stays bright on a light background
    silver: shared(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 780], clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, side: THREE.DoubleSide })),
    hub: shared(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.78, iridescence: 1, iridescenceThicknessRange: [220, 620], clearcoat: 1 })),
  };
  return { G, M };
}

export function makeDisc(texture) {
  const { G, M } = parts();
  const group = new THREE.Group(), spin = new THREE.Group();
  group.add(spin);
  const labelMat = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.06, iridescence: 0.12, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 700], envMapIntensity: 0.65 });
  const label = new THREE.Mesh(G.label, labelMat); label.position.z = 0.0151;
  const rim = new THREE.Mesh(G.rim, M.silver); rim.position.z = 0.0151;
  const hub = new THREE.Mesh(G.hub, M.hub); hub.position.z = 0.016;
  const back = new THREE.Mesh(G.back, M.silver); back.rotation.y = Math.PI; back.position.z = -0.0151;
  const edge = new THREE.Mesh(G.edge, M.silver); edge.rotation.x = Math.PI / 2;
  spin.add(label, rim, hub, back, edge);
  return {
    group, spin, label,
    setLabel(tex) { const old = labelMat.map; labelMat.map = tex; labelMat.needsUpdate = true; old?.dispose(); },
  };
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// The day's poster becomes the disc print (square crop from the upper part, where photos and shapes live).
export function labelTexture(img, paper = '#fff4f8') {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = paper; x.fillRect(0, 0, S, S);
  if (img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, side = Math.min(iw, ih);
    x.drawImage(img, (iw - side) / 2, Math.max(0, (ih - side) * 0.3), side, side, 0, 0, S, S);
  }
  return toTexture(c);
}

// Blank pastel CD-R with a plus, for "Записать новый день".
export function blankLabel() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createConicGradient ? x.createConicGradient(0.6, S / 2, S / 2) : null;
  if (g) { ['#ffd6e8', '#d8ecff', '#fff3c4', '#d7f6e9', '#e9ddff', '#ffd6e8'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col)); x.fillStyle = g; }
  else x.fillStyle = '#ffe6f0';
  x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#2c2542'; x.lineWidth = 22; x.lineCap = 'round';
  x.beginPath(); x.moveTo(S * 0.5, S * 0.69); x.lineTo(S * 0.5, S * 0.87); x.moveTo(S * 0.41, S * 0.78); x.lineTo(S * 0.59, S * 0.78); x.stroke();
  x.fillStyle = '#2c2542'; x.font = '700 34px Comfortaa, Nunito, sans-serif'; x.textAlign = 'center';
  x.fillText('новый день', S / 2, S * 0.2);
  return toTexture(c);
}

let glowTex = null;
export function glowSprite() {
  if (!glowTex) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    glowTex = new THREE.CanvasTexture(c); glowTex.userData.shared = true;
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.85 }));
}

// pastel version of a palette colour: lighter and a little more saturated, never grey
export function pastel(hex, mixWhite = 0.45) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.max(0.45, hsl.s), Math.min(0.9, hsl.l + (1 - hsl.l) * mixWhite));
}

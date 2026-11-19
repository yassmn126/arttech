// 3D disc shelf for the archive: one glossy CD per day. The XMB list (archive-xmb.js) owns layout in
// screen pixels; this scene maps those pixels onto the z=0 plane so 3D discs and HTML labels line up.
import { THREE, damp, createStage, makeDisc, labelTexture, blankLabel, glowSprite, loadImage, pastel } from './three-kit.js';

export function createShelf(canvas, items) {
  const { renderer, scene, camera, key, dispose } = createStage(canvas, { fov: 30 });
  camera.position.set(0, 0, 12);
  const discs = items.map((it, i) => {
    const d = makeDisc(it.kind === 'new' ? blankLabel() : labelTexture(null, pastel(it.glow || '#ffd6e8').getStyle()));
    d.group.userData.index = i;
    d.group.visible = false;
    if (it.posterUrl) loadImage(it.posterUrl).then((img) => d.setLabel(labelTexture(img))).catch(() => {});
    scene.add(d.group);
    return d;
  });
  const glow = glowSprite(); glow.renderOrder = -1; scene.add(glow);
  const glowColor = new THREE.Color('#ffffff'), targetGlow = new THREE.Color();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ptr = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };

  const worldPerPx = () => (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / (canvas.clientHeight || 1);

  return {
    setPointer(nx, ny) { ptr.x = nx; ptr.y = ny; },

    // states[i] = { cx, cy, diam, d, visible } in CSS px relative to the canvas; active = centred index
    render(states, active, dt) {
      const k = worldPerPx(), W = canvas.clientWidth, H = canvas.clientHeight;
      tilt.x = damp(tilt.x, ptr.y, 5, dt); tilt.y = damp(tilt.y, ptr.x, 5, dt);
      states.forEach((s, i) => {
        const g = discs[i].group;
        g.visible = s.visible;
        if (!s.visible) return;
        const a = Math.min(1, Math.abs(s.d)), on = 1 - a;
        g.position.set((s.cx - W / 2) * k, -(s.cy - H / 2) * k, on * 0.4);
        g.scale.setScalar((s.diam / 2) * k);
        // neighbours lean like a rolodex toward the centre; the active disc follows the cursor
        g.rotation.x = THREE.MathUtils.clamp(-s.d * 0.55, -1.15, 1.15) * a + on * (tilt.x * 0.45);
        g.rotation.y = 0.38 * a + on * (tilt.y * 0.55);
        discs[i].spin.rotation.z -= dt * (0.12 + on * 0.7);
      });
      const act = discs[active]?.group;
      if (act && states[active]) {
        glow.position.set(act.position.x, act.position.y, -0.8);
        glow.scale.setScalar(act.scale.x * 3.1);
        targetGlow.copy(pastel(items[active].glow || '#e9ddff', 0.35));
        glowColor.lerp(targetGlow, 1 - Math.exp(-dt * 4));
        glow.material.color.copy(glowColor);
      }
      key.position.set(3 + ptr.x * 5, 4 - ptr.y * 4, 6); // the highlight slides over the gloss as you move
      renderer.render(scene, camera);
    },

    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(discs.filter((d) => d.group.visible).map((d) => d.group), true)[0];
      let o = hit?.object;
      while (o && o.userData.index === undefined) o = o.parent;
      return o ? o.userData.index : -1;
    },

    dispose,
  };
}

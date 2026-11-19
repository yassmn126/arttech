// Archive: a vertical XMB-style shelf of glossy 3D discs. The centred day grows, glows in its own
// palette and tilts toward the cursor; Enter/click opens it and starts the music.
import { icon } from './icons.js';
import { esc, api, fmtDate } from './util.js';
import { TECHNIQUES } from './style-engine.js';

const STEP = 124, GAP = 64, KEY = 'genesis.xmb.active';
const remember = { get() { try { return sessionStorage.getItem(KEY); } catch { return null; } }, set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* private mode */ } } };

// The glow uses the day's most luminous, colourful swatch, so dark days still glow instead of casting a shadow.
export function glowOf(palette = []) {
  let best = '#ffd6e8', score = -1;
  for (const hex of palette) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    const sc = s * 0.7 + (1 - Math.abs(l - 0.62)) * 0.5;
    if (sc > score) { score = sc; best = hex; }
  }
  return best;
}

function labelHtml(it, i) {
  if (it.kind === 'new') {
    return `<div class="xi" data-i="${i}" role="option"><div class="xi-t">Записать новый день</div><div class="xi-s">текст · фото · песня</div>
      <div class="xi-d">система соберёт воспоминание и придумает ему название</div>
      <div class="xi-extra"><span class="chip">${icon.write} Enter — начать запись</span></div></div>`;
  }
  const song = [it.song?.artist, it.song?.title].filter(Boolean).join(' — ') || 'песня дня';
  const tech = TECHNIQUES[it.technique]?.label;
  return `<div class="xi" data-i="${i}" role="option">
    <div class="xi-t">${esc(it.title)}</div><div class="xi-s">♪ ${esc(song)}</div>
    <div class="xi-d">${fmtDate(it.date)}${it.moodLabel ? ` · ${esc(it.moodLabel)}` : ''}</div>
    <div class="xi-extra"><span class="swatches">${(it.palette || []).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      ${tech ? `<span class="chip">${esc(tech)}</span>` : ''}<span class="chip">Enter ▶ открыть и слушать</span></div></div>`;
}

export async function renderArchive(view) {
  const days = await api('/api/days');
  const items = [{ kind: 'new', glow: '#d9c8ff' }, ...days.map((d) => ({ kind: 'day', ...d, glow: glowOf(d.palette) }))];
  const saved = items.findIndex((it) => it.id && it.id === remember.get());
  let target = saved > 0 ? saved : days.length ? 1 : 0, pos = target, raf = 0, last = 0, acc = 0, active = -1, drag = null, dragged = false;

  view.innerHTML = `
  <div class="xmb" tabindex="0" aria-label="Архив дней">
    <canvas class="three" aria-hidden="true"></canvas>
    <nav class="rail" aria-label="Разделы">
      <a href="#/new"><span>${icon.write}</span><span>Записать</span></a>
      <a href="#/" class="on" aria-current="page"><span>${icon.disc}</span><span>Дни · ${days.length}</span></a>
    </nav>
    ${items.map((it, i) => `<div class="xi-disc" data-i="${i}" aria-hidden="true">${it.posterUrl ? `<img src="${it.posterUrl}" alt="" draggable="false">` : ''}</div>`).join('')}
    <div class="xmb-list" role="listbox" aria-label="Дни">${items.map(labelHtml).join('')}</div>
    <div class="xmb-hint">${days.length ? '↑ ↓ или колесо — листать · Enter — открыть' : 'Пока пусто · Enter — записать первый день'}</div>
  </div>`;

  const root = view.firstElementChild, xmb = root, canvas = root.querySelector('canvas');
  const labels = [...root.querySelectorAll('.xi')], flats = [...root.querySelectorAll('.xi-disc')];

  let shelf = null;
  layout(0); // place the labels right away; the discs appear as soon as Three.js has loaded
  try {
    const { createShelf } = await import('./shelf3d.js'); // Three.js from CDN; offline → flat discs
    if (!root.isConnected) return () => {};
    shelf = createShelf(canvas, items);
  } catch (err) {
    console.warn('3D shelf unavailable, using flat discs:', err);
    xmb.classList.add('flat');
  }
  if (!root.isConnected) { shelf?.dispose(); return () => {}; }

  function layout(dt) {
    const W = xmb.clientWidth, H = xmb.clientHeight, small = W < 680, D = small ? 160 : 230, k = D / 230;
    const cx = (small ? 84 : 118) + D / 2 + 18;
    const states = items.map((_, i) => {
      const d = i - pos, a = Math.abs(d), s = 0.5 + 0.5 * Math.max(0, 1 - a);
      return { d, cx, cy: H / 2 + (d * STEP + Math.sign(d) * Math.min(1, a) * GAP) * k, diam: D * s, visible: a < 6.5 };
    });
    states.forEach((st, i) => {
      const a = Math.abs(st.d), ts = 0.6 + 0.4 * Math.max(0, 1 - a);
      const el = labels[i];
      el.style.transform = `translate3d(${(st.cx + st.diam / 2 + 26).toFixed(1)}px, ${st.cy.toFixed(1)}px, 0) translateY(-50%) scale(${ts.toFixed(3)})`;
      el.style.opacity = a > 6 ? 0 : Math.max(0.16, 1 - Math.max(0, a - 0.3) * 0.25).toFixed(3);
      el.style.visibility = st.visible ? 'visible' : 'hidden';
      if (!shelf) {
        const f = flats[i];
        f.style.cssText = `left:${st.cx - st.diam / 2}px;top:${st.cy - st.diam / 2}px;width:${st.diam}px;height:${st.diam}px;visibility:${st.visible ? 'visible' : 'hidden'}`;
      }
    });
    const on = Math.round(pos);
    if (on !== active) {
      labels[active]?.classList.remove('on'); labels[active]?.removeAttribute('aria-selected');
      labels[on]?.classList.add('on'); labels[on]?.setAttribute('aria-selected', 'true');
      active = on;
      xmb.style.setProperty('--tint', items[on].glow);
      if (items[on].id) remember.set(items[on].id);
    }
    shelf?.render(states, active, dt);
  }

  function frame(now) { // runs continuously: discs keep spinning and following the cursor
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    pos += (target - pos) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - pos) < 0.001) pos = target;
    layout(dt);
    raf = requestAnimationFrame(frame);
  }
  const go = (i) => { target = Math.max(0, Math.min(items.length - 1, i)); xmb.dataset.target = target; };
  const open = (i) => {
    const it = items[i];
    if (it.kind === 'new') { location.hash = '#/new'; return; }
    remember.set(it.id);
    location.hash = `#/day/${encodeURIComponent(it.id)}?play`;
  };
  const indexAt = (e) => {
    const el = e.target.closest?.('.xi, .xi-disc');
    if (el) return Number(el.dataset.i);
    return shelf ? shelf.pick(e.clientX, e.clientY) : -1;
  };

  const onWheel = (e) => {
    e.preventDefault();
    acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    if (Math.abs(acc) >= 45) { go(target + Math.sign(acc)); acc = 0; }
  };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowDown') go(target + 1); else if (k === 'ArrowUp') go(target - 1);
    else if (k === 'PageDown') go(target + 3); else if (k === 'PageUp') go(target - 3);
    else if (k === 'Home') go(0); else if (k === 'End') go(items.length - 1);
    else if (k === 'Enter' || k === ' ') open(target);
    else return;
    e.preventDefault();
  };
  const onDown = (e) => { if (e.button === 0 && !e.target.closest('.rail')) { drag = { y: e.clientY, t: target }; dragged = false; } };
  const onMove = (e) => {
    const r = xmb.getBoundingClientRect();
    shelf?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    if (drag) {
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 8) dragged = true;
      if (dragged) go(Math.round(drag.t - dy / (STEP + 30)));
    } else if (shelf && e.target === canvas) {
      canvas.style.cursor = shelf.pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'default';
    }
  };
  const onUp = () => { drag = null; };
  const onClick = (e) => {
    if (dragged || e.target.closest('.rail')) return;
    const i = indexAt(e);
    if (i < 0) return;
    if (i === target) open(i); else go(i);
  };

  xmb.addEventListener('wheel', onWheel, { passive: false });
  xmb.addEventListener('pointerdown', onDown);
  xmb.addEventListener('click', onClick);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  go(target);
  raf = requestAnimationFrame(frame);
  xmb.focus({ preventScroll: true });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKey);
    shelf?.dispose();
  };
}

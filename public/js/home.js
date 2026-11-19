// Home: jewel-case list of days (XMB glide) on the left, the 3D CD player with the selected day in the middle,
// sticky note + stickers on the right. Side tabs open the song, "why", the live memory card, a random day, the entry.
import { Player, speak, voiceFor } from './player.js';
import { icon } from './icons.js';
import { esc, api, fmtDate, dotDate, glowOf, pastelCss, moodOf, weatherOf } from './util.js';
import { TECHNIQUES } from './style-engine.js';
import { analyzeText } from './analyze-text.js';
import { MemoryRenderer } from './renderer.js';

const STEP = 124, GAP = 26, KEY = 'genesis.active';
const remember = { get() { try { return sessionStorage.getItem(KEY); } catch { return null; } }, set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* private mode */ } } };
const TABS = [['song', icon.music, 'Песня дня'], ['why', icon.star, 'Почему такой стиль?'], ['card', icon.heart, 'Открытка дня'], ['random', icon.planet, 'Случайный день'], ['entry', icon.smile, 'Запись дня']];
const caption = (t) => { const s = t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s/)[0]; return s.length > 110 ? `${s.slice(0, 106).replace(/\s*\S*$/, '')}…` : s; };

const jc = (d, i) => `<div class="jc" data-i="${i}" role="option" aria-label="${esc(d.title)}, ${fmtDate(d.date)}">
  <div class="jc-case"><img src="${d.posterUrl}" alt="" draggable="false" loading="${i < 8 ? 'eager' : 'lazy'}"><i class="jc-spine"></i><i class="jc-gloss"></i></div>
  <div class="jc-text"><div class="jc-date">${dotDate(d.date)}</div><div class="jc-title">${esc(d.title)}</div>
  <div class="jc-meta">♪ ${d.bpm || '—'} BPM · ${moodOf(d.mood || {}).emoji} ♡</div></div></div>`;

export async function renderHome(view, { id = null, autoplay = false } = {}) {
  const items = await api('/api/days'); // newest first
  let target = Math.max(0, items.findIndex((d) => d.id === (id || remember.get()))), pos = target, selected = -1, settledAt = 0;
  let current = null, p3d = null, raf = 0, last = 0, acc = 0, drag = null, dragged = false, loadToken = 0, lcdAt = 0, card = null, drawerKind = null;

  view.innerHTML = `
  <div class="home">
    <section class="list" tabindex="0" role="listbox" aria-label="Архив дней: ↑ ↓ — листать, Enter — играть">
      <div class="rail" aria-hidden="true"><i style="top:12%;background:#ffb3d1"></i><i style="top:34%;background:#c9b0ff"></i><i style="top:58%;background:#9fe6c4"></i><i style="top:80%;background:#ffd84d"></i></div>
      <svg class="pointer" viewBox="0 0 34 40" aria-hidden="true"><defs><linearGradient id="ptrG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6dcff"/><stop offset="1" stop-color="#8f74f0"/></linearGradient></defs><path d="M5 5 30 20 5 35z" fill="url(#ptrG)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>
      <button class="arrow up" data-act="up" aria-label="Выше по списку">${icon.up}</button>
      ${items.length ? items.map(jc).join('') : `<div class="list-empty"><div class="entry-text">Здесь будут твои дни ♡</div><p class="hint">Запиши первый: текст, фото и песню.</p><a class="btn btn-pink" href="#/new">${icon.plus} Новый день</a></div>`}
      <button class="arrow down" data-act="down" aria-label="Ниже по списку">${icon.down}</button>
    </section>
    <section class="stage">
      <div class="p3d">
        <canvas aria-hidden="true"></canvas>
        <div class="lcd-html" aria-live="polite"></div>
        <div class="hud" role="toolbar" aria-label="Плеер">
          <button data-act="prev" aria-label="Предыдущий день">${icon.prev}</button><button class="btn-lav" data-act="play" aria-label="Играть">${icon.play}</button>
          <button data-act="next" aria-label="Следующий день">${icon.next}</button><button data-act="card">${icon.heart} Открытка</button>
          <button data-act="why">${icon.star} Почему такой стиль?</button><button class="btn-lav" data-act="archive">${icon.folder} Архив</button>
          <button class="btn-pink" data-act="new">${icon.plus} Новый день</button>
        </div>
        <nav class="tabs-side" aria-label="Вкладки дня">${TABS.map(([k, ic, label]) => `<button class="tab" data-act="${k}" title="${label}" aria-label="${label}">${ic}</button>`).join('')}</nav>
      </div>
    </section>
    <aside class="notes" aria-label="Заметки дня">
      <div class="sticky"></div>
      <div class="cd-sticker" aria-hidden="true"></div>
      <div class="heart"><svg viewBox="0 0 170 150" aria-hidden="true"><defs><linearGradient id="hG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe0f0"/><stop offset=".5" stop-color="#f6c6ff"/><stop offset="1" stop-color="#ffb3d4"/></linearGradient></defs><path d="M85 142C30 108 8 80 8 50 8 24 28 8 50 8c16 0 28 9 35 22 7-13 19-22 35-22 22 0 42 16 42 42 0 30-22 58-77 92z" fill="url(#hG)" stroke="#fff" stroke-width="5"/></svg><span></span></div>
    </aside>
  </div>
  <div class="scrim"></div>
  <aside class="drawer" aria-hidden="true"><header><h2></h2><button class="round" data-act="close" aria-label="Закрыть">${icon.close}</button></header><div class="dbody"></div></aside>
  <div class="modal" hidden role="dialog" aria-label="Открытка дня"><div class="card-wrap"><canvas></canvas></div><button class="round close" data-act="closecard" aria-label="Закрыть">${icon.close}</button></div>`;

  const nodes = [...view.children], root = nodes[0], $ = (s) => view.querySelector(s);
  const list = $('.list'), cases = [...view.querySelectorAll('.jc')], box = $('.p3d'), drawer = $('.drawer'), scrim = $('.scrim'), modal = $('.modal');

  // ---- list glide (same mechanics as the XMB archive) ----
  function layout() {
    const H = list.clientHeight;
    cases.forEach((el, i) => {
      const d = i - pos, a = Math.abs(d), s = 0.72 + 0.28 * Math.max(0, 1 - a);
      const y = H / 2 + d * STEP + Math.sign(d) * Math.min(1, a) * GAP;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) translateY(-50%) scale(${s.toFixed(3)})`;
      el.style.opacity = a > 4.5 ? 0 : Math.max(0.25, 1 - Math.max(0, a - 0.4) * 0.2).toFixed(3);
      el.style.visibility = a > 5 ? 'hidden' : 'visible';
      el.classList.toggle('on', Math.round(pos) === i);
    });
  }
  const go = (i) => { if (!items.length) return; target = Math.max(0, Math.min(items.length - 1, i)); list.dataset.target = target; settledAt = 0; };

  // ---- the player ----
  const isPlaying = () => !!current && (current.player.hasAudio ? current.player.playing : current.spinning);
  function sync() {
    const on = isPlaying();
    p3d?.setPlaying(on); box.querySelector('.flat-disc')?.classList.toggle('on', on);
    const b = $('.hud [data-act=play]'); b.innerHTML = on ? icon.pause : icon.play; b.setAttribute('aria-label', on ? 'Пауза' : 'Играть');
    if (current) $('.lcd-html').textContent = `${on ? '▶' : '❚❚'} ${dotDate(current.day.date)} · ${current.day.title} · ${current.st.rhythm.bpm} BPM · ${current.mood.word} · ${current.weather.text}`;
  }
  async function toggle() {
    if (!current) return;
    if (isPlaying()) { current.player.pause(); current.spinning = false; current.renderer?.pause(); }
    else if (current.player.hasAudio) { await current.player.play().catch(() => {}); current.renderer?.resume(); }
    else { current.spinning = true; current.renderer?.resume(); if (!current.toldLink) { current.toldLink = true; openDrawer('song'); } } // link songs play in the service's own player
    sync();
  }
  function setMood(palette, glow) {
    const b = document.body.style;
    b.setProperty('--m1', pastelCss(palette[0], 0.87)); b.setProperty('--m2', pastelCss(palette[1] || glow, 0.89)); b.setProperty('--m3', pastelCss(palette[2] || glow, 0.9));
    b.setProperty('--accent', pastelCss(glow, 0.78, 0.6));
    view.querySelectorAll('.tab').forEach((t, i) => t.style.setProperty('--c', pastelCss(palette[i % palette.length] || glow, 0.7, 0.6)));
  }
  async function select(i, { play } = {}) {
    const sum = items[i]; if (!sum) return;
    const token = ++loadToken, wasPlaying = play ?? isPlaying();
    selected = i;
    const day = await api(`/api/days/${encodeURIComponent(sum.id)}`);
    if (token !== loadToken || !root.isConnected) return;
    closeCard(); current?.player.destroy();
    const st = day.style, facts = analyzeText(day.text, day.date), song = { ...day.song, clipUrl: day.clipUrl };
    const player = new Player(song, null), embed = document.createElement('div'); embed.className = 'embed'; player.mount(embed);
    current = { day, st, song, player, embed, facts, index: i, spinning: false, mood: moodOf(st.fused), weather: weatherOf(facts), glow: glowOf(st.palette) };
    player.audio?.addEventListener('play', sync); player.audio?.addEventListener('pause', sync);
    setMood(st.palette, current.glow);
    p3d?.setDay({ posterUrl: day.posterUrl, glow: current.glow, bpm: st.rhythm.bpm, date: dotDate(day.date), title: day.title, mood: current.mood.index, moodWord: current.mood.word, weather: current.weather });
    const fd = box.querySelector('.flat-disc'); if (fd) { fd.style.backgroundImage = `url('${day.posterUrl}')`; fd.style.setProperty('--spin', `${(240 / st.rhythm.bpm).toFixed(3)}s`); }
    $('.sticky').textContent = `${caption(day.text)} ♡`;
    $('.heart span').textContent = `${current.mood.word} ♡`;
    history.replaceState(null, '', `#/day/${encodeURIComponent(day.id)}`);
    remember.set(day.id);
    if (drawerKind) openDrawer(drawerKind, false);
    if (wasPlaying) { if (player.hasAudio) await player.play().catch(() => {}); else current.spinning = true; }
    sync();
  }

  // ---- drawers: song / why / entry ----
  function openDrawer(kind, focus = true) {
    if (!current) return;
    const { day, st, song } = current, T = TECHNIQUES[st.technique];
    drawerKind = kind;
    const songLine = [[song.artist, song.title].filter(Boolean).join(' — '), song.year].filter(Boolean).join(' · ') || 'песня дня';
    const source = song.previewUrl ? 'Официальный 30-секундный фрагмент iTunes: звучит здесь, но не сохраняется в папку.' : song.clipFile ? 'Фрагмент до 30 секунд вашего файла (права подтверждены при записи).' : 'Ссылка на музыкальный сервис: песня играет в его плеере ниже.';
    const body = drawer.querySelector('.dbody');
    if (kind === 'why') {
      drawer.querySelector('h2').textContent = 'Почему такой стиль?';
      body.innerHTML = `<div class="tech-card"><b>${esc(T.label)}</b><div class="hint">${esc(T.ref)}</div><p style="margin:.4em 0 0">${esc(T.why)}.</p></div>
        <ul class="why">${st.reasons.map((x) => `<li><b>${esc(x.k)}</b><span>${esc(x.v)}</span></li>`).join('')}<li><b>Голос</b><span>${esc(voiceFor(st).label)}</span></li></ul>`;
    } else if (kind === 'song') {
      drawer.querySelector('h2').textContent = 'Песня дня';
      body.innerHTML = `<div class="tech-card"><b>♪ ${esc(songLine)}</b><div class="hint">${st.rhythm.bpm} BPM · ${esc(st.moodLabel)}</div></div><p class="hint">${esc(source)}</p><div class="slot"></div>`;
      body.querySelector('.slot').append(current.embed);
      if (!current.embed.innerHTML) body.querySelector('.slot').innerHTML = '<p class="hint">Нажмите ▶ на плеере, чтобы песня зазвучала.</p>';
    } else {
      drawer.querySelector('h2').textContent = 'Запись дня';
      body.innerHTML = `<div class="label">${fmtDate(day.date)}</div><div class="entry-text">${esc(day.text)}</div>
        <div class="row"><button data-act="voice" aria-pressed="false">${icon.voice} Озвучить</button><button data-act="restyle">${icon.repeat} Перерисовать</button></div>
        <p class="hint">«Перерисовать» обновит палитру, технику и постер по нынешним правилам; текст, фото, песня и название останутся.</p>
        <div class="folder">Папка: archive/${esc(day.id)}/</div>`;
    }
    drawer.classList.add('open'); scrim.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    if (focus) drawer.querySelector('[data-act=close]').focus({ preventScroll: true });
  }
  function closeDrawer() { drawerKind = null; drawer.classList.remove('open'); scrim.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }

  // ---- the live 4:5 memory card ----
  async function openCard() {
    if (!current) return;
    closeDrawer(); modal.hidden = false;
    const c = current, r = new MemoryRenderer(modal.querySelector('canvas'), { ...c.day, photos: c.day.photoUrls, song: c.song, dayNumber: items.length - c.index });
    card = r; await r.load();
    if (card !== r || modal.hidden) return;
    c.player.attach(r); c.renderer = r; r.start(); // the card is always alive while open; ❚❚ freezes it
    modal.querySelector('.close').focus({ preventScroll: true });
  }
  function closeCard() { if (card) { card.stop(); card = null; } if (current) current.renderer = null; modal.hidden = true; }

  const actions = {
    play: toggle, up: () => go(target - 1), down: () => go(target + 1), prev: () => go(target - 1), next: () => go(target + 1),
    card: openCard, closecard: closeCard, why: () => openDrawer('why'), song: () => openDrawer('song'), entry: () => openDrawer('entry'), close: closeDrawer,
    random: () => { if (items.length > 1) { let j; do j = Math.floor(Math.random() * items.length); while (j === target); go(j); } },
    archive: () => { list.focus({ preventScroll: true }); list.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); list.animate([{ filter: 'drop-shadow(0 0 0 #fff)' }, { filter: 'drop-shadow(0 0 18px #fff)' }, { filter: 'drop-shadow(0 0 0 #fff)' }], 900); },
    new: () => { location.hash = '#/new'; },
    vol: () => { if (!current) return; const v = current.player.volume; current.player.setVolume(v <= 0.15 ? 1 : v - 0.25); p3d?.setVolume(current.player.volume); },
    seek: (f) => { const a = current?.player.audio; if (a?.duration) a.currentTime = f * a.duration; },
    voice: (b) => {
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); b?.setAttribute('aria-pressed', 'false'); return; }
      const u = speak(current.day.text, current.st, current.player); b?.setAttribute('aria-pressed', 'true'); u.addEventListener('end', () => b?.setAttribute('aria-pressed', 'false'));
    },
    restyle: async (b) => {
      b.disabled = true; b.lastChild.textContent = ' Перерисовываю…';
      try { const { restyleDay } = await import('./restyle.js'); await restyleDay(current.day.id, items.length - current.index); window.dispatchEvent(new HashChangeEvent('hashchange')); }
      catch (err) { b.disabled = false; b.lastChild.textContent = ` Не вышло: ${err.message}`; }
    },
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) { if (['play', 'prev', 'next', 'card', 'why', 'archive', 'new'].includes(b.dataset.act)) p3d?.press(b.dataset.act); actions[b.dataset.act]?.(b); return; }
    const el = e.target.closest('.jc');
    if (el && !dragged) { const i = Number(el.dataset.i); if (i === target && selected === i) toggle(); else go(i); }
  };
  nodes.forEach((n) => n.addEventListener('click', onClick));
  scrim.addEventListener('click', closeDrawer);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCard(); });

  // ---- input: wheel / drag on the list, keyboard everywhere on this screen ----
  const onWheel = (e) => { if (e.target.closest('.drawer, .modal')) return; e.preventDefault(); acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; if (Math.abs(acc) >= 45) { go(target + Math.sign(acc)); acc = 0; } };
  root.addEventListener('wheel', onWheel, { passive: false });
  list.addEventListener('pointerdown', (e) => { if (e.button === 0 && !e.target.closest('button')) { drag = { y: e.clientY, t: target }; dragged = false; } });
  const onMove = (e) => { if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 8) dragged = true; if (dragged) go(Math.round(drag.t - dy / (STEP + 20))); };
  const onUp = () => { drag = null; setTimeout(() => { dragged = false; }, 0); };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'Escape') { if (!modal.hidden) closeCard(); else if (drawerKind) closeDrawer(); else return; }
    else if (drawerKind || !modal.hidden) { if (k !== ' ') return; toggle(); }
    else if (k === 'ArrowDown' || k === 'PageDown') go(target + (k === 'PageDown' ? 3 : 1));
    else if (k === 'ArrowUp' || k === 'PageUp') go(target - (k === 'PageUp' ? 3 : 1));
    else if (k === 'Home') go(0); else if (k === 'End') go(items.length - 1);
    else if (k === 'Enter' || k === ' ') { if (e.target.closest?.('button, a')) return; p3d?.press('play'); toggle(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { const a = current?.player.audio; if (a?.duration) a.currentTime = Math.max(0, Math.min(a.duration - 0.2, a.currentTime + (k === 'ArrowLeft' ? -5 : 5))); }
    else if (k === '+' || k === '=' || k === '-') { if (current) { current.player.setVolume(current.player.volume + (k === '-' ? -0.1 : 0.1)); p3d?.setVolume(current.player.volume); } }
    else return;
    e.preventDefault();
  };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('keydown', onKey);

  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    pos += (target - pos) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - pos) < 0.001) pos = target;
    layout();
    if (pos === target && target !== selected && items.length) { settledAt ||= now; if (now - settledAt > 220) select(target); } // swap the disc once the list settles
    if (current && now - lcdAt > 140) {
      lcdAt = now;
      const a = current.player.hasAudio && current.player.audio.duration ? current.player.audio : null, bar = 240 / current.st.rhythm.bpm;
      const level = current.player.level() ?? (current.spinning ? Math.exp(-(((now / 1000) % (bar / 4)) / (bar / 4)) * 5) * 0.8 : 0);
      p3d?.lcd({ progress: a ? a.currentTime / a.duration : current.spinning ? ((now / 1000) % (bar * 4)) / (bar * 4) : null, level: Math.min(1, level) });
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- 3D player (Three.js from CDN) or a flat fallback ----
  layout();
  try {
    const { createPlayer3D } = await import('./player3d.js');
    if (!root.isConnected) return () => {};
    p3d = await createPlayer3D(box.querySelector('canvas'), { onAction: (name, arg) => actions[name]?.(arg) });
  } catch (err) {
    console.warn('3D player unavailable, using a flat disc:', err);
    box.classList.add('flat'); box.querySelector('canvas').remove();
    box.insertAdjacentHTML('afterbegin', '<div class="flat-body"><div class="flat-disc" aria-hidden="true"></div></div>');
    box.querySelector('.flat-body').append(box.querySelector('.lcd-html'));
  }
  if (!root.isConnected) { p3d?.dispose(); return () => {}; }
  if (items.length) await select(target, { play: autoplay }); else { p3d?.setDay(null); setMood(['#e9ddff', '#ffd9ec', '#fff1c4'], '#c9b0ff'); }
  raf = requestAnimationFrame(frame);
  list.focus({ preventScroll: true });

  return () => {
    cancelAnimationFrame(raf); loadToken++;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey);
    closeCard(); current?.player.destroy(); p3d?.dispose(); speechSynthesis.cancel();
  };
}

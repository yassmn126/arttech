// Home: jewel-case list of days (XMB glide) on the left, the 3D metal CD player with the selected day in the middle,
// a dark glass day panel on the right (date, title, live waveform = seek bar, BPM, mood, weather, note, tilted card print).
// Panel tabs open the song, "why", the live memory card, a random day, the entry.
import { Player, speak, voiceFor } from './player.js';
import { icon, moodFace, weatherIcon, weatherKind } from './icons.js';
import { esc, api, fmtDate, dotDate, glowOf, pastelCss, moodOf, weatherOf } from './util.js';
import { TECHNIQUES } from './style-engine.js';
import { analyzeText } from './analyze-text.js';
import { MemoryRenderer } from './renderer.js';
import { pickerHtml, bindPicker } from './frame-picker.js';
import { frameLabel } from './frames.js';
import { STICKERS, MAX_STICKERS, placeSticker, hitSticker, stickerIcon } from './stickers.js';

const STEP = 124, GAP = 26, KEY = 'genesis.active';
const remember = { get() { try { return sessionStorage.getItem(KEY); } catch { return null; } }, set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* private mode */ } } };
const TABS = [['song', icon.music, 'Песня дня', 'Песня'], ['why', icon.star, 'Почему такой стиль?', 'Почему?'], ['card', icon.heart, 'Открытка дня', 'Открытка'], ['random', icon.planet, 'Случайный день', 'Случайный'], ['entry', icon.write, 'Запись дня', 'Запись']];
// a waveform silhouette that belongs to the day (seeded by its id + tempo), lit up to the playhead
const seeded = (str) => { let a = 2166136261; for (const ch of str) a = Math.imul(a ^ ch.charCodeAt(0), 16777619); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const waveShape = (seed, n = 64) => { const r = seeded(seed); let prev = 0.5; return Array.from({ length: n }, (_, i) => { prev = prev * 0.45 + r() * 0.55; return Math.min(1, (0.3 + 0.7 * Math.sin((Math.PI * (i + 0.5)) / n) ** 0.5) * (0.25 + 0.75 * prev)); }); };
const caption = (t) => { const s = t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s/)[0]; return s.length > 110 ? `${s.slice(0, 106).replace(/\s*\S*$/, '')}…` : s; };

const jc = (d, i) => `<div class="jc" data-i="${i}" role="option" aria-label="${esc(d.title)}, ${fmtDate(d.date)}">
  <div class="jc-case"><img src="${d.posterUrl}" alt="" draggable="false" loading="${i < 8 ? 'eager' : 'lazy'}"><i class="jc-spine"></i><i class="jc-gloss"></i></div>
  <div class="jc-text"><div class="jc-date">${dotDate(d.date)}</div><div class="jc-title">${esc(d.title)}</div>
  <div class="jc-meta">${d.bpm || '—'} BPM <span title="${esc(moodOf(d.mood || {}).word)}">${icon.heartLine}</span></div></div></div>`;

export async function renderHome(view, { id = null, autoplay = false } = {}) {
  const items = await api('/api/days'); // newest first
  let target = Math.max(0, items.findIndex((d) => d.id === (id || remember.get()))), pos = target, selected = -1, settledAt = 0;
  let current = null, p3d = null, raf = 0, last = 0, acc = 0, drag = null, dragged = false, loadToken = 0, lcdAt = 0, card = null, drawerKind = null;
  let pendingPlay = false, stickerSaveT = 0, stickerDrag = null;

  view.innerHTML = `
  <div class="home">
    <section class="list" tabindex="0" role="listbox" aria-label="Архив дней: ↑ ↓ — листать, Enter — играть">
      <div class="rail" aria-hidden="true"><i style="top:14%"></i><i style="top:32%"></i><i style="top:68%"></i><i style="top:86%"></i></div>
      <i class="pointer" aria-hidden="true"></i>
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
      </div>
    </section>
    <aside class="panel" aria-label="День">
      <article class="day-card">
        <div class="pd-date"></div>
        <h2 class="pd-title"><span></span>${icon.heartLine}</h2>
        <canvas class="wave" title="Нажмите, чтобы перемотать" aria-hidden="true"></canvas>
        <div class="pd-badges"><span class="badge bpm">${icon.clock}<b></b> BPM</span><span class="badge mood"></span></div>
        <div class="pd-lower">
          <div class="pd-info"><div class="pd-weather"></div><div class="pd-note"><span class="label">Моя заметка</span><p></p></div></div>
          <button class="polaroid" data-act="card" aria-label="Открытка дня" title="Открытка дня"><img alt="" draggable="false"><i class="clip" aria-hidden="true"></i></button>
        </div>
        <nav class="pd-tabs" aria-label="Вкладки дня">${TABS.map(([k, ic, label, short]) => `<button class="tab" data-act="${k}" title="${label}" aria-label="${label}">${ic}<span>${short}</span></button>`).join('')}</nav>
      </article>
      <div class="pd-actions"><button class="btn-glow" data-act="new"><svg class="gold" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.8 5 3.2 7.6 8.5 8.5-5.3.9-7.7 3.5-8.5 8.5-.8-5-3.2-7.6-8.5-8.5 5.3-.9 7.7-3.5 8.5-8.5z" fill="currentColor"/></svg> Новый день</button><button data-act="archive">${icon.folder} Архив</button></div>
    </aside>
  </div>
  <div class="scrim"></div>
  <aside class="drawer" aria-hidden="true"><header><h2></h2><button class="round" data-act="close" aria-label="Закрыть">${icon.close}</button></header><div class="dbody"></div></aside>
  <div class="modal" hidden role="dialog" aria-label="Открытка дня">
    <div class="modal-inner"><div class="picker-slot"></div><div class="card-wrap"><canvas></canvas></div>
      <div class="card-tools"><button class="btn-pink" data-act="download">${icon.down} Скачать открытку</button><button class="btn-lav" data-act="video">${icon.film} Видео</button>
        <span class="video-links"></span><span class="card-status" aria-live="polite"></span></div>
      <div class="sticker-bar" role="group" aria-label="Стикеры на открытке"><span class="label">Стикеры · по желанию, до ${MAX_STICKERS}</span><div class="tray"></div><div class="placed"></div></div></div>
    <button class="round close" data-act="closecard" aria-label="Закрыть">${icon.close}</button></div>`;

  const nodes = [...view.children], root = nodes[0], $ = (s) => view.querySelector(s);
  const list = $('.list'), cases = [...view.querySelectorAll('.jc')], box = $('.p3d'), drawer = $('.drawer'), scrim = $('.scrim'), modal = $('.modal');
  const panel = $('.panel'), waveCv = $('.wave');

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
  // the night sky takes the day's colours: deep glows for the backdrop, a luminous accent for light & borders
  function setMood(palette, glow, poster) {
    const b = document.body.style;
    b.setProperty('--m1', pastelCss(palette[0] || glow, 0.34, 0.6)); b.setProperty('--m2', pastelCss(palette[1] || glow, 0.32, 0.6)); b.setProperty('--m3', pastelCss(palette[2] || glow, 0.3, 0.6));
    b.setProperty('--accent', pastelCss(glow, 0.74, 0.7));
    b.setProperty('--poster', poster ? `url("${poster}")` : 'none');
    view.querySelectorAll('.tab').forEach((t, i) => t.style.setProperty('--c', pastelCss(palette[i % palette.length] || glow, 0.78, 0.65)));
  }
  function fillPanel(c) {
    const { day, st, mood, weather } = c, [w1, ...wRest] = weather.text.split(' · ');
    panel.classList.remove('empty');
    $('.pd-date').textContent = dotDate(day.date);
    $('.pd-title span').textContent = day.title;
    $('.pd-badges .bpm b').textContent = st.rhythm.bpm;
    $('.pd-badges .mood').innerHTML = `${moodFace(mood.index, mood.word === 'напряжённо')}<b>${esc(mood.word)}</b>`;
    $('.pd-weather').innerHTML = `<i class="wx wx-${weatherKind(weather.kind)}">${weatherIcon(weather.kind)}</i><div><b>${esc(w1)}</b><small>${esc(wRest.join(' · ') || 'по записи дня')}</small></div>`;
    $('.pd-note p').textContent = caption(day.text);
    $('.polaroid img').src = day.posterUrl;
    c.wave = waveShape(`${day.id}|${st.rhythm.bpm}`); c.waveInk = pastelCss(c.glow, 0.8, 0.75);
    $('.day-card').animate([{ opacity: 0.35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function drawWave(progress, level, now) {
    const w = waveCv.clientWidth, h = waveCv.clientHeight, shape = current?.wave; if (!w || !h || !shape) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (waveCv.width !== W || waveCv.height !== H) { waveCv.width = W; waveCv.height = H; }
    const x = waveCv.getContext('2d'), n = shape.length, step = w / n, bw = Math.max(1.6, step * 0.4), on = isPlaying();
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const lit = progress != null && (i + 0.5) / n <= progress;
      const live = on ? 0.62 + 0.38 * Math.min(1, level * 1.5 + 0.18 * Math.sin(now / 150 + i * 1.9)) : 0.8;
      const bh = Math.max(2, shape[i] * live * (h - 2)), bx = i * step + (step - bw) / 2;
      x.fillStyle = lit ? current.waveInk : 'rgba(225, 228, 255, .3)';
      x.shadowColor = lit ? current.waveInk : 'transparent'; x.shadowBlur = lit ? 8 : 0;
      x.beginPath(); if (x.roundRect) x.roundRect(bx, h - bh, bw, bh, bw / 2); else x.rect(bx, h - bh, bw, bh); x.fill();
    }
  }
  waveCv.addEventListener('click', (e) => { const r = waveCv.getBoundingClientRect(); actions.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); });
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
    setMood(st.palette, current.glow, day.posterUrl);
    p3d?.setDay({ posterUrl: day.posterUrl, glow: current.glow, bpm: st.rhythm.bpm, date: dotDate(day.date), title: day.title, mood: current.mood.index, moodWord: current.mood.word, weather: current.weather });
    const fd = box.querySelector('.flat-disc'); if (fd) { fd.style.backgroundImage = `url('${day.posterUrl}')`; fd.style.setProperty('--spin', `${(240 / st.rhythm.bpm).toFixed(3)}s`); }
    fillPanel(current);
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
    const status = modal.querySelector('.card-status'); status.textContent = '';
    showVideo(c); renderStickerBar(c);
    const slot = modal.querySelector('.picker-slot'); slot.innerHTML = pickerHtml(r.frame);
    let saveT = 0;
    bindPicker(slot.firstElementChild, (kind) => { // live switch, then save the choice + re-rendered card
      r.setFrame(kind); status.textContent = `${frameLabel(kind)} · сохраняю…`;
      clearTimeout(saveT); saveT = setTimeout(() => saveLook(c, r, 'frame', { frame: kind }, frameLabel(kind)), 450);
    });
    card = r; await r.load();
    if (card !== r || modal.hidden) return;
    c.player.attach(r); c.renderer = r; r.start(); // the card is always alive while open; ❚❚ freezes it
    modal.querySelector('[role=radio][aria-checked=true]')?.focus({ preventScroll: true });
  }
  // frame style or stickers changed: save the choice + the re-rendered card, then refresh the cover and the disc print
  async function saveLook(c, r, endpoint, payload, label) {
    const status = modal.querySelector('.card-status');
    try {
      const saved = await api(`/api/days/${encodeURIComponent(c.day.id)}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, poster: r.poster() }) });
      c.day.frame = saved.frame; c.day.stickers = saved.stickers || [];
      c.day.posterUrl = saved.posterUrl; items[c.index].posterUrl = saved.posterUrl;
      const img = cases[c.index]?.querySelector('img'); if (img) img.src = saved.posterUrl; // jewel case cover
      if (current === c) { p3d?.setPoster(saved.posterUrl); $('.polaroid img').src = saved.posterUrl; document.body.style.setProperty('--poster', `url("${saved.posterUrl}")`); } // disc label, card print, backdrop
      if (status.isConnected) status.textContent = `${label} · сохранено ♡`;
    } catch (err) { if (status.isConnected) status.textContent = `Не сохранилось: ${err.message}`; }
  }

  // ---- optional Y2K stickers (max 3): add from the tray, drag on the card, remove with × ----
  function renderStickerBar(c) {
    const list = c.day.stickers || [], meta = { date: c.day.date, title: c.day.title, palette: c.st.palette };
    modal.querySelector('.tray').innerHTML = STICKERS.map(([k, label]) => `<button class="stk" data-sticker="${k}" title="${label}" aria-label="Добавить стикер: ${label}" ${list.length >= MAX_STICKERS ? 'disabled' : ''}><img src="${stickerIcon(k, meta)}" alt=""></button>`).join('');
    modal.querySelector('.placed').innerHTML = list.map((s, i) => `<button class="chip" data-unstick="${i}" aria-label="Убрать стикер: ${(STICKERS.find(([k]) => k === s.kind) || [])[1]}">${(STICKERS.find(([k]) => k === s.kind) || [])[1]} ×</button>`).join('')
      || '<span class="hint">открытка чистая — добавьте стикер или оставьте так ♡</span>';
  }
  function saveStickersSoon(c) {
    modal.querySelector('.card-status').textContent = 'Стикеры · сохраняю…';
    clearTimeout(stickerSaveT); const r = card;
    stickerSaveT = setTimeout(() => r && saveLook(c, r, 'stickers', { stickers: c.day.stickers || [] }, 'Стикеры'), 500);
  }
  function addSticker(kind) {
    const c = current; if (!c || !card) return;
    const list = (c.day.stickers ||= []);
    if (list.length >= MAX_STICKERS) return;
    list.push(placeSticker(kind, list)); card.setStickers(list); renderStickerBar(c); saveStickersSoon(c);
  }
  function removeSticker(i) {
    const c = current; if (!c?.day.stickers) return;
    c.day.stickers.splice(i, 1); card?.setStickers(c.day.stickers); renderStickerBar(c); saveStickersSoon(c);
  }
  const cardCv = modal.querySelector('canvas');
  const toCard = (e) => { const b = cardCv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * 1080, ((e.clientY - b.top) / b.height) * 1350]; };
  cardCv.addEventListener('pointerdown', (e) => {
    const list = current?.day.stickers; if (!card || !list?.length) return;
    const [x, y] = toCard(e), i = hitSticker(list, x, y); if (i < 0) return;
    stickerDrag = { i, ox: x - list[i].x * 1080, oy: y - list[i].y * 1350 }; cardCv.style.cursor = 'grabbing'; e.preventDefault();
    try { cardCv.setPointerCapture(e.pointerId); } catch { /* pointer already gone: drag still works while over the card */ }
  });
  cardCv.addEventListener('pointermove', (e) => {
    const list = current?.day.stickers; if (!list?.length) return;
    const [x, y] = toCard(e);
    if (!stickerDrag) { cardCv.style.cursor = hitSticker(list, x, y) >= 0 ? 'grab' : 'default'; return; }
    const s = list[stickerDrag.i]; s.x = Math.max(0.04, Math.min(0.96, (x - stickerDrag.ox) / 1080)); s.y = Math.max(0.04, Math.min(0.96, (y - stickerDrag.oy) / 1350));
    card?.setStickers(list);
  });
  cardCv.addEventListener('pointerup', () => { if (stickerDrag) { stickerDrag = null; cardCv.style.cursor = 'grab'; saveStickersSoon(current); } });

  // ---- time capsule: glide to a random other day and start its music on arrival ----
  function capsule() {
    if (!items.length) { location.hash = '#/new'; return; }
    let j = 0; if (items.length > 1) do j = Math.floor(Math.random() * items.length); while (j === target);
    closeCard(); closeDrawer();
    pendingPlay = true;
    if (j === selected) { pendingPlay = false; select(j, { play: true }); } else go(j);
    const fx = document.createElement('div'); fx.className = 'capsule-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = `<span>капсула времени ✦</span><b>${dotDate(items[j].date)}</b>${'<svg><use href="#sparkle"/></svg>'.repeat(6)}`;
    view.querySelector('.stage')?.append(fx); setTimeout(() => fx.remove(), 2200);
  }
  const onCapsule = () => capsule();
  window.addEventListener('genesis:capsule', onCapsule);
  const AUDIO_NOTE = { clip: 'звук — фрагмент вашего файла', synth: 'звук — подложка дня по темпу и ладу песни', none: 'без звука' };
  function showVideo(c) {
    const box = modal.querySelector('.video-links'), v = c.day.video;
    modal.querySelector('[data-act=video]').lastChild.textContent = v ? ' Пересобрать видео' : ' Видео';
    box.innerHTML = v ? `<a class="btn" href="${c.day.videoUrl}" target="_blank" rel="noopener">▶ смотреть</a><a class="btn" href="${c.day.videoUrl}" download="${esc(`${c.day.date} — ${c.day.title}.mp4`)}">⬇ ${v.seconds ?? ''} с</a>` : '';
    box.title = v ? `${frameLabel(v.frame)} · ${AUDIO_NOTE[v.audio] || ''}` : '';
  }
  async function makeVideo(b) {
    if (!card || !current) return;
    const c = current, status = modal.querySelector('.card-status');
    b.disabled = true;
    try {
      const { exportVideo } = await import('./video-export.js');
      const v = await exportVideo(c.day, { frame: card.frame, dayNumber: items.length - c.index,
        onProgress: (k, stage) => { if (status.isConnected) status.textContent = `🎬 ${stage} ${Math.round(k * 100)}%`; } });
      if (status.isConnected) status.textContent = '🎬 сохраняю в папку дня…';
      const q = new URLSearchParams({ seconds: v.seconds, audio: v.audio, frame: card.frame, codecs: v.codecs });
      const r = await fetch(`/api/days/${encodeURIComponent(c.day.id)}/video?${q}`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: v.blob });
      const saved = await r.json(); if (!r.ok) throw new Error(saved.error || r.statusText);
      c.day.video = saved.video; c.day.videoUrl = saved.videoUrl;
      if (status.isConnected) { showVideo(c); status.textContent = `Видео готово ♡ ${v.seconds} с · ${AUDIO_NOTE[v.audio]}`; }
    } catch (err) { if (status.isConnected) status.textContent = `Видео не получилось: ${err.message}`; console.error(err); }
    finally { b.disabled = false; }
  }
  function download() {
    if (!card || !current) return;
    const a = document.createElement('a');
    a.href = card.poster(0.95); a.download = `${current.day.date} — ${current.day.title} (${frameLabel(card.frame)}).jpg`;
    document.body.append(a); a.click(); a.remove();
  }
  function closeCard() { if (card) { card.stop(); card = null; } if (current) current.renderer = null; modal.hidden = true; }

  const actions = {
    play: toggle, up: () => go(target - 1), down: () => go(target + 1), prev: () => go(target - 1), next: () => go(target + 1),
    card: openCard, closecard: closeCard, download, video: makeVideo, why: () => openDrawer('why'), song: () => openDrawer('song'), entry: () => openDrawer('entry'), close: closeDrawer,
    random: capsule,
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
    const stk = e.target.closest('[data-sticker]'); if (stk && !stk.disabled) { addSticker(stk.dataset.sticker); return; }
    const un = e.target.closest('[data-unstick]'); if (un) { removeSticker(Number(un.dataset.unstick)); return; }
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
    if (e.target.closest?.('input, textarea, select, .framepick') || e.altKey || e.ctrlKey || e.metaKey) return;
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
    if (pos === target && target !== selected && items.length) { settledAt ||= now; if (now - settledAt > 220) { select(target, pendingPlay ? { play: true } : undefined); pendingPlay = false; } } // swap the disc once the list settles (the capsule also presses play)
    if (current) {
      const a = current.player.hasAudio && current.player.audio.duration ? current.player.audio : null, bar = 240 / current.st.rhythm.bpm;
      const level = Math.min(1, current.player.level() ?? (current.spinning ? Math.exp(-(((now / 1000) % (bar / 4)) / (bar / 4)) * 5) * 0.8 : 0));
      const progress = a ? a.currentTime / a.duration : current.spinning ? ((now / 1000) % (bar * 4)) / (bar * 4) : null;
      drawWave(progress, level, now);
      if (now - lcdAt > 140) { lcdAt = now; p3d?.lcd({ progress, level }); }
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
  if (items.length) await select(target, { play: autoplay });
  else {
    p3d?.setDay(null); setMood(['#6c5ce7', '#b05ac9', '#3a7bd5'], '#b7a6ff', null); panel.classList.add('empty');
    $('.pd-date').textContent = '—'; $('.pd-title span').textContent = 'Здесь будет твой день';
    $('.pd-note p').textContent = 'Запиши первый: текст, фото и песню, а дневник соберёт из них воспоминание.';
  }
  raf = requestAnimationFrame(frame);
  list.focus({ preventScroll: true });

  return () => {
    cancelAnimationFrame(raf); loadToken++;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('genesis:capsule', onCapsule);
    closeCard(); current?.player.destroy(); p3d?.dispose(); speechSynthesis.cancel();
  };
}

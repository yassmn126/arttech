// "New day" screen: text + photos + song → live preview → save to its own folder.
import { analyzeText } from './analyze-text.js';
import { loadPhoto, mergePhotoFeatures } from './analyze-photo.js';
import { GENRE_OPTIONS, musicVector, analyzePreview, decodeAudio, analyzeAudioBuffer, makeExcerptWav } from './analyze-music.js';
import { buildStyle } from './style-engine.js';
import { MemoryRenderer } from './renderer.js';
import { Player, voiceFor } from './player.js';
import { esc, api } from './util.js';
import { icon } from './icons.js';

const genreSelect = (id) => `<select id="${id}">${GENRE_OPTIONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;

export async function renderCompose(view) {
  const days = await api('/api/days').catch(() => []);
  const dayNumber = days.length + 1;
  view.innerHTML = `
  <div class="desk compose">
   <section class="win">
    <header class="titlebar"><span class="tt">Новый день</span><span class="tsub">запись</span>
      <div class="wbtns"><a class="bv wb" href="#/" title="Закрыть" aria-label="Закрыть">${icon.close}</a></div></header>
    <div class="wbody">
    <form novalidate>
      <div><h1>Как прошёл день?</h1><p class="lede">Напишите, как прошёл день, приложите фото и песню. Система соберёт из этого страницу дневника и придумает ей название.</p></div>
      <fieldset><label class="label" for="date">Дата</label><input type="date" id="date" value="${new Date().toISOString().slice(0, 10)}"></fieldset>
      <fieldset><label class="label" for="text">Как прошёл день</label>
        <textarea id="text" placeholder="Гуляли по парку, всё в жёлтых листьях, было холодно, но мы пили какао и долго разговаривали"></textarea>
        <span class="hint">Погода, свет, звуки, люди рядом, время суток. Чем конкретнее, тем точнее воспоминание.</span></fieldset>
      <fieldset><label class="label" for="photos">Фото дня (одно или несколько)</label>
        <input type="file" id="photos" accept="image/*" multiple><div class="thumbs"></div></fieldset>
      <fieldset><span class="label">Песня дня</span>
        <div class="tabs"><button type="button" data-tab="search" class="on">Поиск</button><button type="button" data-tab="link">Ссылка</button><button type="button" data-tab="file">Свой файл</button></div>
        <div data-pane="search">
          <div class="row"><input type="text" id="q" placeholder="Исполнитель и название"><button type="button" id="qbtn" style="flex:0">Найти</button></div>
          <div class="results"></div>
          <div class="row" id="syearRow" hidden><label class="hint" for="syear" style="flex:2">Год оригинала: самая ранняя версия песни в iTunes, можно поправить</label><input type="number" id="syear" min="1900" max="2030"></div>
          <span class="hint">Официальный 30-секундный фрагмент iTunes звучит при просмотре и анализируется на лету, но в папку не сохраняется.</span>
        </div>
        <div data-pane="link" hidden>
          <input type="url" id="url" placeholder="YouTube, Spotify, Яндекс Музыка…">
          <div class="row"><input type="text" id="lartist" placeholder="Исполнитель"><input type="text" id="ltitle" placeholder="Название"></div>
          <div class="row">${genreSelect('lgenre')}<input type="number" id="lyear" placeholder="Год" min="1900" max="2030"></div>
        </div>
        <div data-pane="file" hidden>
          <input type="file" id="audio" accept="audio/*">
          <label class="check"><input type="checkbox" id="consent"> Это моя запись или трек со свободной лицензией. В папку сохранится только фрагмент до 30 с.</label>
          <div class="row"><input type="text" id="fartist" placeholder="Исполнитель"><input type="text" id="ftitle" placeholder="Название"></div>
          ${genreSelect('fgenre')}
        </div>
        <details><summary class="label">Как звучит песня (необязательно)</summary>
          <div class="row" style="margin-top:8px"><select id="vtempo"><option value="">темп: авто</option><option value="slow">медленно</option><option value="mid">средне</option><option value="fast">быстро</option></select>
          <select id="vmode"><option value="">лад: авто</option><option value="major">светло / мажор</option><option value="minor">тёмно / минор</option></select></div>
        </details>
        <div class="status" id="mstatus"></div>
      </fieldset>
      <button type="submit">Собрать воспоминание</button>
      <div id="after" hidden>
        <fieldset><label class="label" for="title">Название папки (придумано системой, можно поправить)</label><input type="text" id="title"></fieldset>
        <button type="button" id="save">Сохранить в архив</button>
      </div>
      <div class="status" id="status"></div>
    </form>
    </div>
   </section>
   <section class="win stagewin">
    <header class="titlebar"><span class="tt">Предпросмотр</span><span class="tsub">4:5 · живое воспоминание</span></header>
    <div class="wbody stage">
      <div class="frame sunken"><div class="placeholder">Здесь появится воспоминание дня: палитра из ваших фото, ритм из песни, форма из настроения текста.</div></div>
      <div class="controls" hidden><button type="button" class="bv play">▶ музыка</button></div>
      <div class="cplayer"></div>
      <ul class="why"></ul>
    </div>
   </section>
  </div>`;

  const $ = (s) => view.querySelector(s);
  const status = (m) => { $('#status').textContent = m; }, mstatus = (m) => { $('#mstatus').textContent = m; };
  let photos = [], tab = 'search', picked = null, fileSong = null, renderer = null, player = null, built = null;

  // photos
  $('#photos').onchange = async (e) => {
    status('Читаю фото…');
    photos = await Promise.all([...e.target.files].slice(0, 8).map(loadPhoto));
    $('.thumbs').innerHTML = photos.map((p) => `<img src="${p.dataUrl}" alt="">`).join('');
    status('');
  };

  // song tabs
  view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    tab = b.dataset.tab; mstatus('');
    view.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    view.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  }));

  const search = async () => {
    const q = $('#q').value.trim(); if (!q) return;
    mstatus('Ищу…');
    try {
      const list = await api(`/api/music/search?term=${encodeURIComponent(q)}`);
      $('.results').innerHTML = list.map((t, i) => `<button type="button" class="result" data-i="${i}">${t.artwork ? `<img src="${t.artwork}" alt="">` : ''}<span>${esc(t.title)}<small>${esc(t.artist)} · ${esc(t.genre || '')} · ${t.year || ''}${t.releaseYear && t.releaseYear !== t.year ? ` (издание ${t.releaseYear})` : ''}</small></span></button>`).join('') || '<span class="hint">Ничего не нашлось. Попробуйте вкладку «Ссылка».</span>';
      mstatus('');
      $('.results').querySelectorAll('.result').forEach((el) => (el.onclick = async () => {
        $('.results').querySelectorAll('.result').forEach((x) => x.classList.toggle('on', x === el));
        picked = { ...list[el.dataset.i], audio: null };
        $('#syear').value = picked.year || ''; $('#syearRow').hidden = false;
        if (!picked.previewUrl) return mstatus('У трека нет фрагмента: оформление по жанру и году.');
        mstatus('Слушаю фрагмент: темп, энергия…');
        try { picked.audio = await analyzePreview(picked.previewUrl); mstatus(`Фрагмент: ${picked.audio.bpm} BPM, энергия ${Math.round(picked.audio.energy * 100)}%`); }
        catch { mstatus('Фрагмент недоступен: оформление по жанру и году.'); }
      }));
    } catch (e) { mstatus(`Поиск недоступен (${e.message}). Используйте «Ссылку».`); }
  };
  $('#qbtn').onclick = search;
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } };

  $('#audio').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    mstatus('Анализирую аудио в браузере…');
    try {
      const buf = await decodeAudio(await f.arrayBuffer());
      const audio = analyzeAudioBuffer(buf), clip = await makeExcerptWav(buf, 30);
      const base = f.name.replace(/\.[^.]+$/, '');
      if (!$('#ftitle').value) $('#ftitle').value = base;
      fileSong = { audio, clipDataUrl: clip.dataUrl, clipSeconds: Math.round(clip.seconds) };
      mstatus(`${audio.bpm} BPM, энергия ${Math.round(audio.energy * 100)}%. Сохранится фрагмент ${Math.round(clip.seconds)} с (с ${Math.round(clip.startSec)} с).`);
    } catch (err) { fileSong = null; mstatus(`Не удалось прочитать файл: ${err.message}`); }
  };

  function currentSong() {
    const vibe = { tempo: $('#vtempo').value, mode: $('#vmode').value };
    if (tab === 'search') return picked && { source: 'itunes', ...picked, year: Number($('#syear').value) || picked.year, vibe };
    if (tab === 'link') {
      const url = $('#url').value.trim(), title = $('#ltitle').value.trim(), artist = $('#lartist').value.trim();
      if (!url && !title) return null;
      return { source: 'link', url, title, artist, genreKey: $('#lgenre').value, genre: $('#lgenre').selectedOptions[0].text, year: Number($('#lyear').value) || null, vibe, audio: null };
    }
    return fileSong && { source: 'file', ...fileSong, title: $('#ftitle').value.trim(), artist: $('#fartist').value.trim(), genreKey: $('#fgenre').value, genre: $('#fgenre').selectedOptions[0].text, vibe };
  }

  // build: analysis → style → live preview
  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('#text').value.trim(), date = $('#date').value, song = currentSong();
    if (!text) return status('Напишите пару строк о дне.');
    if (!photos.length) return status('Добавьте хотя бы одно фото.');
    if (!song) return status('Выберите песню: поиск, ссылка или свой файл.');
    status('Собираю…');
    const textF = analyzeText(text, date);
    const photoF = mergePhotoFeatures(photos.map((p) => p.features));
    const music = musicVector({ genre: song.genre, genreKey: song.genreKey, year: song.year }, song.audio, song.vibe);
    const style = buildStyle({ text: textF, photo: photoF, music, date });
    built = { text, date, textF, photoF, music, style, song };

    renderer?.stop(); player?.destroy();
    $('.frame').innerHTML = '<canvas></canvas>';
    renderer = await new MemoryRenderer($('.frame canvas'), { title: textF.title, date, text, photos: photos.map((p) => p.dataUrl), song, style, dayNumber }).load();
    renderer.start();
    player = new Player(song, renderer); player.mount($('.cplayer'));
    const ctl = $('.stage .controls'), pb = $('.play');
    ctl.hidden = !player.hasAudio;
    pb.onclick = async () => { player.playing ? player.pause() : (renderer.restart(), await player.play()); pb.textContent = player.playing ? '❚❚ пауза' : '▶ музыка'; };
    $('.why').innerHTML = style.reasons.map((r) => `<li><b>${esc(r.k)}</b><span>${esc(r.v)}</span></li>`).join('') + `<li><b>Голос</b><span>${esc(voiceFor(style).label)}</span></li>`;
    $('#title').value = textF.title; $('#after').hidden = false;
    $('#title').oninput = () => { renderer.day.title = $('#title').value || textF.title; };
    status(`${style.techniqueLabel} · ${style.moodLabel}`);
  };

  $('#save').onclick = async () => {
    if (!built) return;
    const s = built.song;
    if (s.source === 'file' && !$('#consent').checked) return status('Подтвердите права на аудиофайл (галочка во вкладке «Свой файл»).');
    $('#save').disabled = true; status('Сохраняю папку дня…');
    const songOut = {
      source: s.source, artist: s.artist || '', title: s.title || '', album: s.album || '', genre: s.genre || '', genreKey: built.music.genreKey,
      year: s.year || null, url: s.url || '', previewUrl: s.previewUrl || '', artwork: s.artwork || '', vibe: s.vibe, features: s.audio || null, clipSeconds: s.clipSeconds || null,
      ...(s.source === 'file' ? { clip: s.clipDataUrl, clipConsent: $('#consent').checked } : {}),
    };
    try {
      renderer.day.title = $('#title').value.trim() || built.textF.title;
      const poster = renderer.poster(); renderer.restart();
      const entry = await api('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        text: built.text, title: renderer.day.title, date: built.date, photos: photos.map((p) => p.dataUrl), poster, song: songOut,
        analysis: { text: built.textF, photo: built.photoF, music: built.music }, style: built.style,
      }) });
      location.hash = `#/day/${encodeURIComponent(entry.id)}?play`;
    } catch (err) { status(`Не сохранилось: ${err.message}`); $('#save').disabled = false; }
  };

  return () => { renderer?.stop(); player?.destroy(); };
}

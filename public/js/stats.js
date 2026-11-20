// "Vibe Wrapped" — a Y2K mini-report of the saved days. computeStats() is pure (tested in Node).
import { esc, api, dotDate, moodOf, glowOf } from './util.js';
import { TECHNIQUES } from './style-engine.js';
import { frameLabel } from './frames.js';

const count = (arr) => arr.reduce((m, k) => (k == null || k === '' ? m : m.set(k, (m.get(k) || 0) + 1)), new Map());
const ranked = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ru'));
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

export function computeStats(days = []) {
  const n = days.length;
  if (!n) return { n: 0 };
  const byDate = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const bpms = days.map((d) => d.bpm).filter(Number.isFinite);
  const avgBpm = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null;
  const tempoWord = avgBpm == null ? '—' : avgBpm < 80 ? 'медленный' : avgBpm < 105 ? 'размеренный' : avgBpm < 125 ? 'бодрый' : 'быстрый';
  const moodsOf = days.map((d) => moodOf(d.mood || {}));
  const [moodWord, moodN] = ranked(count(moodsOf.map((m) => m.word)))[0];
  // mood labels read "warmth · energy[ · light]" — the typical vibe is the most common word in each of the first two slots
  const slot = (i) => ranked(count(days.map((d) => (d.moodLabel || '').split(' · ')[i]?.trim())))[0]?.[0];
  const vibes = [slot(0), slot(1)].filter(Boolean);
  const techCount = count(days.map((d) => d.technique));
  const techniques = Object.keys(TECHNIQUES).map((key) => ({ key, label: TECHNIQUES[key].label, ref: TECHNIQUES[key].ref, n: techCount.get(key) || 0 }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'ru'));
  const [frameKey, frameN] = ranked(count(days.map((d) => d.frame || 'poster')))[0];
  const artist = ranked(count(days.map((d) => d.song?.artist)))[0] || null;
  return {
    n, from: byDate.at(-1).date, to: byDate[0].date,
    avgBpm, minBpm: bpms.length ? Math.min(...bpms) : null, maxBpm: bpms.length ? Math.max(...bpms) : null, tempoWord,
    mood: { word: moodWord, n: moodN, emoji: moodsOf.find((m) => m.word === moodWord).emoji }, vibes,
    techniques, topTechnique: techniques[0],
    topFrame: { key: frameKey, label: frameLabel(frameKey), n: frameN },
    topArtist: artist ? { name: artist[0], n: artist[1] } : null,
    videos: days.filter((d) => d.hasVideo).length,
    recent: byDate.slice(0, 12).reverse().map((d) => ({ id: d.id, date: d.date, title: d.title, palette: d.palette || [] })),
  };
}

export async function renderStats(view) {
  const s = computeStats(await api('/api/days'));
  if (!s.n) {
    view.innerHTML = `<div class="stats"><article class="wcard empty"><h1 class="wrap-title">Vibe Wrapped</h1><p class="entry-text">Здесь появится твой дневник в цифрах ♡</p><a class="btn btn-pink" href="#/new">+ Записать первый день</a></article></div>`;
    return;
  }
  const maxN = Math.max(1, ...s.techniques.map((t) => t.n)), t = s.topTechnique;
  const ribbon = s.recent.map((d) => glowOf(d.palette)).join(', ');
  view.innerHTML = `
  <div class="stats">
    <header class="wrap-head"><h1 class="wrap-title">Vibe Wrapped</h1><span class="tagline">твой дневник в цифрах ♡</span>
      <span class="chip">${s.n} ${plural(s.n, 'день', 'дня', 'дней')} · ${dotDate(s.from)} — ${dotDate(s.to)}</span></header>
    <div class="wrap-grid">
      <article class="wcard palette-card"><h2>Твоя палитра</h2><p class="hint">последние ${s.recent.length} ${plural(s.recent.length, 'день', 'дня', 'дней')}, по порядку — нажми, чтобы открыть</p>
        <div class="pal-strip">${s.recent.map((d) => `<a class="pal-day" href="#/day/${encodeURIComponent(d.id)}" title="${esc(d.title)} · ${dotDate(d.date)}" aria-label="${esc(d.title)}, ${dotDate(d.date)}">${d.palette.map((c) => `<i style="background:${c}"></i>`).join('')}</a>`).join('')}</div>
        <div class="pal-ribbon" style="background:linear-gradient(90deg, ${s.recent.length > 1 ? ribbon : `${ribbon}, ${ribbon}`})" aria-hidden="true"></div></article>
      <article class="wcard"><h2>Средний темп</h2><div class="big">${s.avgBpm ?? '—'}<small>BPM</small></div>
        <p><b>${s.tempoWord}</b>${s.minBpm != null ? ` · от ${s.minBpm} до ${s.maxBpm}` : ''}</p><div class="mini-cd" style="--spin:${s.avgBpm ? (240 / s.avgBpm).toFixed(2) : 3}s" title="один оборот — один такт среднего темпа"></div></article>
      <article class="wcard"><h2>Главное настроение</h2><div class="big emoji" aria-hidden="true">${s.mood.emoji}</div>
        <p><b>${esc(s.mood.word)}</b> — ${s.mood.n} из ${s.n}</p><p class="hint">чаще всего: ${s.vibes.map(esc).join(' · ')}</p></article>
      <article class="wcard tech"><h2>Любимая техника</h2><div class="big word">${esc(t.label)}</div><p class="hint">${esc(t.ref)}</p>
        <ul class="bars" aria-label="Дни по художественным техникам">${s.techniques.map((x) => `<li title="${esc(x.label)}: ${x.n} ${plural(x.n, 'день', 'дня', 'дней')}"><span>${esc(x.label)}</span><i><u style="width:${((x.n / maxN) * 100).toFixed(1)}%"></u></i><b>${x.n}</b></li>`).join('')}</ul></article>
      <article class="wcard"><h2>Ещё немного</h2><ul class="facts">
        <li>любимый стиль фото: <b>${esc(s.topFrame.label)}</b></li>
        <li>чаще всех звучит: <b>${s.topArtist ? `${esc(s.topArtist.name)} (${s.topArtist.n})` : '—'}</b></li>
        <li>видео собрано: <b>${s.videos}</b></li></ul>
        <button class="btn-pink" data-capsule>✦ Открыть капсулу времени</button></article>
    </div>
  </div>`;
}

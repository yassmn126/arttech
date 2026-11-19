// Re-render a saved day by the current visual rules (e.g. after the palette got brighter).
// Inputs are the day's own saved data: text, stored photo features, song genre/year/audio features.
// The title and folder are kept: a day's name is part of its identity once saved.
import { analyzeText } from './analyze-text.js';
import { musicVector } from './analyze-music.js';
import { buildStyle } from './style-engine.js';
import { MemoryRenderer } from './renderer.js';
import { api } from './util.js';

export async function restyleDay(id, dayNumber = 1) {
  const e = await api(`/api/days/${encodeURIComponent(id)}`);
  const s = e.song || {};
  const text = { ...analyzeText(e.text, e.date), title: e.title };
  const music = musicVector({ genre: s.genre, genreKey: s.genreKey, year: s.year }, s.features || null, s.vibe || {});
  const style = buildStyle({ text, photo: e.analysis.photo, music, date: e.date });

  const r = await new MemoryRenderer(document.createElement('canvas'), { ...e, photos: e.photoUrls, song: s, style, dayNumber }).load();
  const poster = r.poster();
  const saved = await api(`/api/days/${encodeURIComponent(id)}/restyle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style, poster, analysis: { text, music } }),
  });
  return { id, title: e.title, before: e.style, after: saved.style };
}

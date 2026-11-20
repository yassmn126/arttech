// Vibe Wrapped stats + sticker rules (the server validates stickers with the same cleanStickers()).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../public/js/stats.js';
import { cleanStickers, placeSticker, hitSticker, MAX_STICKERS } from '../public/js/stickers.js';

const day = (date, bpm, technique, mood, extra = {}) => ({ id: date, date, title: `day ${date}`, bpm, technique, mood, moodLabel: 'тёплый · спокойный', palette: ['#c0965b', '#e0747f'], frame: 'poster', song: { artist: 'A', title: 'T' }, ...extra });
const calm = { valence: 0.4, arousal: 0.3, tension: 0 }, tense = { valence: -0.1, arousal: 0.9, tension: 0.9 };
const days = [
  day('2026-10-12', 125, 'impression', calm), day('2026-10-20', 125, 'impression', calm, { frame: 'scrapbook', hasVideo: true }),
  day('2026-11-03', 138, 'construct', tense, { moodLabel: 'холодный · напряжённый', song: { artist: 'B', title: 'N' } }),
  day('2026-11-15', 70, 'field', { valence: -0.4, arousal: 0.15, tension: 0.1 }, { moodLabel: 'ровный · тихий · грустный' }),
];

test('stats: count, span, BPM', () => {
  const s = computeStats(days);
  assert.equal(s.n, 4); assert.equal(s.from, '2026-10-12'); assert.equal(s.to, '2026-11-15');
  assert.equal(s.avgBpm, Math.round((125 + 125 + 138 + 70) / 4)); assert.equal(s.minBpm, 70); assert.equal(s.maxBpm, 138);
  assert.equal(s.tempoWord, 'бодрый');
});

test('stats: top mood, vibe words, technique ranking with all six listed', () => {
  const s = computeStats(days);
  assert.equal(s.mood.n, 2); assert.ok(s.mood.emoji);
  assert.deepEqual(s.vibes, ['тёплый', 'спокойный']);
  assert.equal(s.topTechnique.key, 'impression'); assert.equal(s.topTechnique.n, 2);
  assert.equal(s.techniques.length, 6); assert.ok(s.techniques.every((t, i, a) => i === 0 || a[i - 1].n >= t.n));
  assert.equal(s.topArtist.name, 'A'); assert.equal(s.videos, 1);
});

test('stats: tense days count as tense, not calm', () => {
  const s = computeStats([day('2026-11-03', 138, 'construct', tense), day('2026-11-04', 140, 'construct', tense)]);
  assert.equal(s.mood.word, 'напряжённо');
});

test('stats: palette strip is the recent days in chronological order; empty archive is safe', () => {
  const s = computeStats(days);
  assert.deepEqual(s.recent.map((d) => d.date), ['2026-10-12', '2026-10-20', '2026-11-03', '2026-11-15']);
  assert.deepEqual(computeStats([]), { n: 0 });
});

test('stickers: max 3, known kinds only, positions clamped onto the card', () => {
  const dirty = [{ kind: 'star4', x: 2, y: -1, rot: 99 }, { kind: 'evil', x: 0.5, y: 0.5 }, { kind: 'tape', x: 0.5, y: 0.5 }, { kind: 'postmark' }, { kind: 'cassette', x: 0.3, y: 0.3 }];
  const clean = cleanStickers(dirty);
  assert.equal(clean.length, MAX_STICKERS); assert.ok(clean.every((s) => s.kind !== 'evil'));
  assert.deepEqual(clean[0], { kind: 'star4', x: 0.96, y: 0.04, rot: 3.2, scale: 1 });
  assert.deepEqual(cleanStickers('nope'), []);
});

test('stickers: new ones go to free spots and can be picked up again', () => {
  const list = [];
  for (const k of ['star4', 'tape', 'postmark']) list.push(placeSticker(k, list));
  const spots = new Set(list.map((s) => `${s.x},${s.y}`)); assert.equal(spots.size, 3);
  assert.equal(hitSticker(list, list[1].x * 1080, list[1].y * 1350), 1);
  assert.equal(hitSticker(list, 540, 675), -1);
});

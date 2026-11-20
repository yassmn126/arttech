// Rules of the synthesized "day soundtrack" used in exported videos (when the song itself may not be saved).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText } from '../public/js/analyze-text.js';
import { musicVector } from '../public/js/analyze-music.js';
import { buildStyle } from '../public/js/style-engine.js';
import { scoreFor, soundtrackSeconds } from '../public/js/soundtrack.js';

const photo = (lum, sat, warmth, rgb) => ({ count: 2, luminance: lum, contrast: 0.3, saturation: sat, warmth, palette: [{ rgb, weight: 0.6 }, { rgb: rgb.map((c) => Math.min(255, c + 40)), weight: 0.4 }] });
const day = (text, date, ph, meta, audio, vibe) => {
  const music = musicVector(meta, audio, vibe);
  return { style: buildStyle({ text: analyzeText(text, date), photo: ph, music, date }), music };
};
const party = day('День рождения! Танцевали с друзьями, смеялись до слёз!', '2026-07-05', photo(0.6, 0.6, 0.1, [230, 80, 90]), { genreKey: 'pop', year: 2024 }, null, { tempo: 'fast' });
const rainy = day('Весь день шёл дождь. Сидела дома одна, грустно и тихо…', '2026-11-15', photo(0.4, 0.2, -0.05, [110, 125, 140]), { genreKey: 'classical' }, { bpm: 70, energy: 0.2, brightness: 0.25 }, { mode: 'minor' });

test('the soundtrack keeps the song tempo', () => {
  assert.equal(scoreFor(party.style, party.music).bpm, party.style.rhythm.bpm);
  assert.equal(scoreFor(rainy.style, rainy.music).bpm, 70);
});

test('mode follows the song mood: minor song → minor progression', () => {
  const s = scoreFor(rainy.style, rainy.music);
  assert.equal(s.minor, true); assert.match(s.key, /минор/); assert.equal(s.prog[0][1], 'm');
  assert.equal(scoreFor(party.style, party.music).minor, false);
});

test('energy decides the drums; a quiet day gets no hats', () => {
  const p = scoreFor(party.style, party.music), r = scoreFor(rainy.style, rainy.music);
  assert.ok(p.layers.kick && p.layers.hats && p.kickEvery === 1);
  assert.ok(!r.layers.hats);
  assert.ok(p.cutoff > r.cutoff, 'bright song → brighter filter');
});

test('same day → same score; every choice has a reason', () => {
  assert.deepEqual(scoreFor(party.style, party.music), scoreFor(party.style, party.music));
  assert.ok(scoreFor(party.style, party.music).reasons.length >= 4);
  const root = scoreFor(rainy.style, rainy.music).root; assert.ok(root >= 45 && root < 57);
});

test('video length is whole bars between 12 and 30 seconds', () => {
  for (const d of [party, rainy]) for (const n of [1, 3, 8]) {
    const s = soundtrackSeconds(d.style, n), bars = s / (240 / d.style.rhythm.bpm);
    assert.ok(s >= 12 && s <= 30, `${s}`); assert.ok(Math.abs(bars - Math.round(bars)) < 1e-6 || s === 30 || s === 12, `${bars} bars`);
  }
});

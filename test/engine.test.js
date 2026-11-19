// Rules test: six archetypal days must each land on their own technique,
// and the brief's example days must get the brief's titles.  Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText } from '../public/js/analyze-text.js';
import { musicVector } from '../public/js/analyze-music.js';
import { buildStyle } from '../public/js/style-engine.js';

const photo = (count, luminance, contrast, saturation, warmth, rgb) => ({ count, luminance, contrast, saturation, warmth, palette: [{ rgb, weight: 0.5 }, { rgb: rgb.map((c) => Math.min(255, c + 40)), weight: 0.3 }] });

export const DAYS = [
  { expect: 'impression', date: '2026-10-12', text: 'Гуляли по парку, всё в жёлтых листьях, было холодно, но мы пили какао и долго разговаривали.',
    photo: photo(3, 0.58, 0.35, 0.42, 0.12, [196, 150, 70]), music: [{ genre: 'Vocal Jazz', year: 1964 }, { bpm: 125, energy: 0.46, brightness: 0.4 }, {}] },
  { expect: 'construct', date: '2026-11-03', text: 'Срочная сдача проекта, всю ночь в офисе с командой. В наушниках электронная музыка, кофе остыл, не успеваем! Стресс.',
    photo: photo(2, 0.22, 0.5, 0.3, -0.08, [40, 60, 110]), music: [{ genreKey: 'electronic', year: 2021 }, null, { tempo: 'fast' }] },
  { expect: 'field', date: '2026-11-15', text: 'Весь день шёл дождь. Сидела дома одна, грустно и тихо, пересматривала старые фото и скучала по тем, кто далеко…',
    photo: photo(2, 0.45, 0.25, 0.18, -0.04, [110, 125, 140]), music: [{ genreKey: 'classical' }, { bpm: 70, energy: 0.4, brightness: 0.3 }, { mode: 'minor' }] },
  // same rainy day, darker photos and a 1990s song: sadness must still beat nostalgia
  { expect: 'field', date: '2026-11-15', text: 'Весь день шёл дождь. Сидела дома одна, грустно и тихо, пересматривала старые фото и скучала по тем, кто далеко…',
    photo: photo(2, 0.37, 0.2, 0.25, -0.11, [95, 105, 120]), music: [{ genreKey: 'classical', year: 1998 }, null, { tempo: 'slow', mode: 'minor' }] },
  { expect: 'nocturne', date: '2026-08-20', text: 'Ночью бродили по старому городу под фонарями, вспоминали детство, говорили вполголоса до трёх утра.',
    photo: photo(3, 0.2, 0.45, 0.35, 0.12, [150, 90, 40]), music: [{ genre: 'Soul', year: 1978 }, null, {}] },
  { expect: 'ma', date: '2026-05-02', text: 'Тихое утро. Чай у окна.',
    photo: photo(1, 0.72, 0.2, 0.12, 0.02, [220, 215, 205]), music: [{ genreKey: 'lofi', year: 2020 }, null, { tempo: 'slow' }] },
  { expect: 'collage', date: '2026-07-05', text: 'День рождения! Танцевали с друзьями, смеялись до слёз, торт и шарики, было так весело!',
    photo: photo(5, 0.6, 0.45, 0.62, 0.1, [230, 80, 90]), music: [{ genreKey: 'pop', year: 2024 }, null, { tempo: 'fast' }] },
];

export const styleOf = (d) => {
  const text = analyzeText(d.text, d.date);
  return { text, style: buildStyle({ text, photo: d.photo, music: musicVector(...d.music), date: d.date }) };
};

for (const d of DAYS) {
  test(`${d.expect}: ${d.text.slice(0, 40)}…`, () => {
    const { style } = styleOf(d);
    const table = Object.entries(style.scores).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');
    assert.equal(style.technique, d.expect, table);
  });
}

test('the same day always renders the same way', () => {
  assert.deepEqual(styleOf(DAYS[0]).style, styleOf(DAYS[0]).style);
});

test('brief examples get brief-like titles (3–7 words)', () => {
  const t = (s, date = '2026-10-12') => analyzeText(s, date).title;
  assert.equal(t(DAYS[0].text), 'Осенний парк и какао');
  assert.equal(t('Срочная сдача проекта, ночь в офисе, в наушниках электронная музыка.'), 'Ночь в офисе перед сдачей');
  assert.equal(t('Вечером сидели с девушкой у пруда, было тихо и тепло, осень'), 'Вечер осенью с девушкой у пруда');
  assert.equal(t(DAYS[2].text), 'Дождливый день дома наедине с собой');
  for (const d of DAYS) { const n = t(d.text, d.date).split(' ').length; assert.ok(n >= 3 && n <= 7, `${t(d.text, d.date)}: ${n} words`); }
});

test('"ни один" is not loneliness', () => {
  const f = analyzeText('Ни один человек не пришёл, но было солнечно в парке', '2026-06-02');
  assert.ok(!f.people.includes('наедине с собой'));
  assert.ok(!f.hits.includes('одиночество'));
});

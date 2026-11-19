// Fusion: text + photos + music → one explainable visual style.
// Every decision pushes a human-readable reason so the day can answer "why do I look like this?".

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pct = (v) => `${Math.round(v * 100)}%`;
const sgn = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

export const TECHNIQUES = {
  impression: { label: 'Импрессия', ref: 'мазки и свет Клода Моне', why: 'мягкие мазки растворяют контуры — день вспоминается как свет и тепло, а не детали' },
  construct: { label: 'Конструкция', ref: 'геометрия Кандинского, конструктивизм', why: 'линии, круги и жёсткая сетка передают напряжение, ритм и собранность' },
  nocturne: { label: 'Ноктюрн', ref: 'плёночная фотография, ночные кадры', why: 'зерно, ореол света и виньетка делают кадр воспоминанием с налётом времени' },
  ma: { label: 'Ма', ref: 'японская минималистичная графика, пустота «ма»', why: 'много воздуха и одна деталь — тишина становится видимой' },
  field: { label: 'Цветовое поле', ref: 'цветовые поля Марка Ротко', why: 'крупные мягкие плоскости цвета держат тихую, тяжёлую эмоцию без лишних слов' },
  collage: { label: 'Коллаж', ref: 'вырезки Анри Матисса, коллаж', why: 'наклонённые снимки и цветные вырезки прыгают в ритм — много событий и людей' },
};

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- colour helpers ----
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToHex([h, s, l]) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const hueToward = (h, target, amt) => { const d = ((target - h + 540) % 360) - 180; return h + d * clamp(amt); };

export function buildStyle({ text, photo, music, date }) {
  const reasons = [];
  const tod = text.timeOfDay;

  // ---- 1. fuse the three signals ----
  const photoVal = clamp((photo.luminance - 0.45) * 1.2 + (photo.saturation - 0.3) * 0.8, -1, 1);
  const tempoN = clamp((music.bpm - 60) / 110);
  const valence = clamp(0.55 * text.valence + 0.25 * music.valence + 0.2 * photoVal, -1, 1);
  const arousal = clamp(0.45 * text.arousal + 0.4 * (music.energy * 0.6 + tempoN * 0.4) + 0.15 * photo.contrast);
  const seasonWarm = { autumn: 0.35, summer: 0.4, spring: 0.1, winter: -0.35 }[text.season] || 0;
  const textWarm = clamp(seasonWarm + (text.hits.includes('тепло') || text.hits.includes('горячий напиток') ? 0.3 : 0) - (text.hits.includes('холод') ? 0.15 : 0), -1, 1);
  const warmth = clamp(0.45 * clamp(photo.warmth * 3, -1, 1) + 0.3 * music.warmth + 0.25 * textWarm, -1, 1);
  const light = clamp(photo.luminance + ({ night: -0.3, evening: -0.1, morning: 0.1 }[tod] ?? 0));
  const tension = clamp(text.tension * 0.75 + (['electronic', 'rock'].includes(music.genreKey) ? 0.15 : 0) + (warmth < -0.15 ? 0.1 : 0));
  const nostalgia = clamp(text.nostalgia + music.eraAge * 0.6 + (tod === 'night' ? 0.15 : 0));
  const fused = { valence, arousal, warmth, light, tension, nostalgia };

  // ---- 2. technique by score ----
  const kinds = new Set(text.places.map((p) => p.kind));
  const sad = ['грусть', 'одиночество', 'скучание', 'слёзы'].some((h) => text.hits.includes(h));
  const scores = {
    impression: Math.max(0, valence) + (1 - arousal) * 0.8 + warmth * 0.5 + (1 - tension) * 0.3 + (kinds.has('nature') || kinds.has('water') ? 0.35 : 0),
    construct: arousal + tension * 1.2 + (music.genreKey === 'electronic' ? 0.5 : 0) + (kinds.has('work') ? 0.3 : 0) - Math.max(0, warmth) * 0.3,
    // Nocturne = night and darkness. Nostalgia (which already includes the song's era) mostly
    // shows up as grain on any technique, so it only nudges this score.
    nocturne: nostalgia * 0.8 + (1 - light) * 0.9 + (tod === 'night' ? 0.45 : tod === 'evening' ? 0.15 : 0),
    // Ma = serene emptiness: really sparse writing, and sadness pulls away from it
    ma: (1 - arousal) + (text.words < 12 ? 0.45 : text.words < 25 ? 0.15 : 0) + (photo.count === 1 ? 0.3 : 0) + (1 - photo.saturation) * 0.4 - Math.abs(valence) * 0.4 - Math.max(0, -valence) * 0.4,
    // Rothko = held, heavy feeling: low valence, slow minor music, explicit words of sadness
    field: -valence * 1.1 + (1 - arousal) * 0.8 + (music.valence < 0 ? 0.3 : 0) + (sad ? 0.25 : 0),
    collage: valence * 0.9 + arousal * 0.9 + Math.min(photo.count, 5) * 0.1 + photo.saturation * 0.4 + (text.people.length ? 0.2 : 0) - tension * 0.6,
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const technique = ranked[0][0], accent = ranked[1][0], T = TECHNIQUES[technique];
  const moodLabel = `${warmth > 0.15 ? 'тёплый' : warmth < -0.15 ? 'холодный' : 'ровный'} · ${tension > 0.55 ? 'напряжённый' : arousal > 0.6 ? 'живой' : arousal < 0.3 ? 'тихий' : 'спокойный'}${valence < -0.3 ? ' · грустный' : valence > 0.45 ? ' · светлый' : ''}`;
  reasons.push({ k: 'Техника', v: `${T.label} (${T.ref}) — ${T.why}. Настроение ${sgn(valence)}, энергия ${pct(arousal)}, напряжение ${pct(tension)}.` });

  // ---- 3. palette from photos, bent by mood ----
  const sw = photo.palette.map((p) => rgbToHsl(p.rgb));
  const hueTarget = warmth >= 0 ? 32 : 215, hueAmt = Math.abs(warmth) * 0.35;
  const quiet = technique === 'field' || technique === 'ma' || technique === 'nocturne';
  // Vibrancy: energy scales saturation, but a floor keeps light photos from washing out into grey.
  const satK = clamp(0.8 + arousal * 0.5 + valence * 0.2 - (quiet ? 0.12 : 0), 0.6, 1.45);
  const minSat = (quiet ? 0.24 : 0.36) + Math.max(0, warmth) * 0.08;
  const colourful = sw.find(([, s]) => s > 0.12);
  const tone = (h, s) => (s < 0.08 ? (colourful ? colourful[0] : hueTarget) : h); // greys borrow the photo's real hue
  let cols = sw.map(([h, s, l]) => [hueToward(tone(h, s), hueTarget, hueAmt), Math.max(minSat, clamp(s * satK + (technique === 'construct' ? 0.25 : 0))), l > 0.82 ? 0.7 : l]);
  cols.sort((a, b) => b[1] - a[1]);
  const dom = sw[0] ? [tone(sw[0][0], sw[0][1]), sw[0][1], sw[0][2]] : [30, 0.3, 0.5];
  const darkPaper = technique === 'nocturne' || (technique === 'construct' && light < 0.45);
  const ph = hueToward(dom[0], hueTarget, hueAmt);
  // luminous pastel paper (cream / blush / sky) by day, a deep coloured night instead of black
  const paper = darkPaper ? hslToHex([ph, 0.38, 0.11]) : hslToHex([ph, 0.42 + Math.max(0, warmth) * 0.25, clamp(0.935 + valence * 0.02, 0.9, 0.965)]);
  const ink = hslToHex([ph, darkPaper ? 0.35 : 0.32, darkPaper ? 0.92 : 0.16]);
  if (technique === 'construct') { const h0 = cols[0]?.[0] ?? 210; cols = [[h0, 0.85, 0.5], [h0 + 150, 0.85, 0.55], [h0 + 210, 0.8, 0.45], ...cols]; }
  // too few photo colours: add shades of the photo's own hue, never invented hues
  while (cols.length < 4) cols.push([dom[0] + (cols.length % 2 ? 10 : -10), Math.max(minSat, clamp(dom[1] * satK)), 0.32 + cols.length * 0.12]);
  const accents = cols.slice(0, 5).map((c) => hslToHex([c[0], c[1], darkPaper ? clamp(c[2], 0.45, 0.78) : clamp(c[2], 0.34, 0.7)]));
  const domHex = photo.palette[0] ? hslToHex(rgbToHsl(photo.palette[0].rgb)) : accents[0];
  reasons.push({ k: 'Палитра', v: `Из ${photo.count} фото (доминирует ${domHex}) → сдвиг к ${warmth >= 0 ? 'охре' : 'сине-серому'} на ${pct(hueAmt)}, насыщенность ×${satK.toFixed(2)}, не ниже ${pct(minSat)}; ${darkPaper ? 'тёмная цветная бумага: ночь/низкий свет' : 'светящаяся пастельная бумага'}.` });

  // ---- 4. typography (one family, mood-driven axes) ----
  const weight = Math.round((300 + arousal * 420 + tension * 180) / 100) * 100;
  const italic = valence > 0.15 && arousal < 0.6 && technique !== 'construct';
  const caps = technique === 'construct';
  const tracking = caps ? 0.08 : technique === 'ma' ? 0.18 : -0.01;
  const caption = technique === 'construct' || tension > 0.55 ? 'mono' : warmth > 0.05 && valence > 0 ? 'hand' : 'serif';
  reasons.push({ k: 'Типографика', v: `Fraunces ${weight}${italic ? ' курсив' : ''}${caps ? ', капслок' : ''}: вес растёт с энергией и напряжением; подпись ${{ mono: 'моноширинная — собранность', hand: 'от руки — тёплый личный день', serif: 'тихим курсивом' }[caption]}.` });

  // ---- 5. rhythm from music ----
  const beatsPerPhoto = arousal > 0.65 ? 4 : arousal > 0.35 ? 8 : 12;
  const photoSeconds = clamp((beatsPerPhoto * 60) / music.bpm, 2.2, 12);
  const transition = technique === 'construct' ? 'cut' : technique === 'collage' ? 'slide' : 'dissolve';
  const motion = clamp(0.12 + arousal * 0.88);
  reasons.push({ k: 'Ритм', v: `${music.bpm} BPM × ${beatsPerPhoto} долей → кадр ${photoSeconds.toFixed(1)} с, переход «${{ cut: 'резкая склейка в долю', slide: 'сдвиг в такт', dissolve: 'медленное растворение' }[transition]}», амплитуда движения ${pct(motion)}.` });
  reasons.push({ k: 'Музыка', v: music.sources.join('; ') + (music.valence < 0 ? ' → больше воздуха, приглушённые цвета.' : '.') });

  // ---- 6. texture ----
  const grain = clamp(0.06 + nostalgia * 0.45 + (1 - light) * 0.2 + (technique === 'nocturne' ? 0.15 : 0));
  const halation = technique === 'nocturne' ? 0.6 : light > 0.55 && warmth > 0.15 ? 0.22 : 0.05;
  const vignette = clamp(0.15 + (1 - light) * 0.45);
  reasons.push({ k: 'Фактура', v: `Зерно ${pct(grain)} (ностальгия ${pct(nostalgia)}${music.year ? `, песня ${music.year} г.` : ''}${tod ? `, время: ${tod}` : ''}), ореол ${pct(halation)}, виньетка ${pct(vignette)}.` });
  const found = [...text.places.map((p) => p.nom), ...text.people, ...text.objects];
  reasons.push({ k: 'Название', v: `Собрано из найденного в тексте: ${found.length ? found.join(', ') : 'настроение и время'}; сезон — ${{ autumn: 'осень', winter: 'зима', spring: 'весна', summer: 'лето' }[text.season]}${text.seasonFromText ? '' : ' (по дате)'}.` });

  return {
    technique, accent, techniqueLabel: T.label, techniqueRef: T.ref, moodLabel, fused, scores,
    palette: accents, paper, ink, darkPaper,
    type: { weight, italic, caps, tracking, caption },
    rhythm: { bpm: music.bpm, beatsPerPhoto, photoSeconds, transition, motion },
    texture: { grain, halation, vignette },
    seed: hashSeed(`${date}|${text.title}|${photo.palette.map((p) => p.rgb.join()).join()}`),
    reasons,
  };
}

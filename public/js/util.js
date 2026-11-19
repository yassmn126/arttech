export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function api(url, opts) {
  const r = await fetch(url, opts), j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const dotDate = (d) => d.split('-').reverse().join('.');

// ---- colour helpers (plain JS, no Three.js) ----
const hex2rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

// The day's most luminous, colourful swatch: used for glows, so dark days still glow instead of casting a shadow.
export function glowOf(palette = []) {
  let best = '#d9c8ff', score = -1;
  for (const hex of palette) {
    const [, s, l] = hsl(hex2rgb(hex));
    const sc = s * 0.7 + (1 - Math.abs(l - 0.62)) * 0.5;
    if (sc > score) { score = sc; best = hex; }
  }
  return best;
}

// A soft pastel of a palette colour for backgrounds, tape and tabs: light, never grey.
export function pastelCss(hex = '#d9c8ff', light = 0.86, minSat = 0.55) {
  const [h, s] = hsl(hex2rgb(hex));
  return `hsl(${Math.round(h)} ${Math.round(Math.max(minSat, s) * 100)}% ${Math.round(light * 100)}%)`;
}

// Five-step mood scale used by the player's mood badge and the list.
export const MOODS = [
  { word: 'грусть', emoji: '☹' }, { word: 'тихо', emoji: '😶' }, { word: 'спокойно', emoji: '🙂' },
  { word: 'хорошо', emoji: '😊' }, { word: 'восторг', emoji: '🤩' },
];
export function moodIndex({ valence = 0, arousal = 0.4 } = {}) {
  return Math.max(0, Math.min(4, Math.round(((valence + 1) / 2) * 4 + (arousal - 0.45) * 0.8)));
}
// Face + word for the mood badge. Tension is its own state: a deadline night is not "calm".
export function moodOf(f = {}) {
  if ((f.tension ?? 0) > 0.55) return { index: 1, word: 'напряжённо', emoji: '😬' };
  const index = moodIndex(f);
  return { index, ...MOODS[index] };
}

// Weather badge from the day's own text (no location data is collected): weather word, else season + time of day.
const WEATHER_TEXT = { rain: 'дождь', snow: 'снег', fog: 'туман', frost: 'мороз', wind: 'ветер', heat: 'жара', sun: 'солнечно' };
const SEASON_TEXT = { autumn: 'осень', winter: 'зима', spring: 'весна', summer: 'лето' };
const TIME_TEXT = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' };
export function weatherOf(facts = {}) {
  if (facts.weather) return { kind: facts.weather, text: WEATHER_TEXT[facts.weather] || facts.weather };
  const kind = facts.timeOfDay === 'night' ? 'night' : facts.season || 'sun';
  return { kind, text: [SEASON_TEXT[facts.season], TIME_TEXT[facts.timeOfDay]].filter(Boolean).join(' · ') || 'ясно' };
}

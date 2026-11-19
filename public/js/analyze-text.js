// Text → mood vector + facts (season, time, places, people) + short folder title.
// Rule-based RU/EN lexicon: explainable, offline, deterministic.
// This is a design signal, not a psychological assessment.

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');

// [pattern, valence -1..1, arousal 0..1, tension 0..1, label]
const MOOD = [
  [/счаст|радост|\bрада?\b|весел|happy|joy/, 0.8, 0.6, 0, 'радость'],
  [/любл|любов|нежн|обним|поцел|\blove/, 0.8, 0.4, 0, 'нежность'],
  [/тепл|уют|cozy|warm/, 0.6, 0.2, 0, 'тепло'],
  [/спокой|тихо|тишин|умиротвор|calm|quiet|peace/, 0.25, 0.05, 0, 'покой'], // quiet ≠ happy: only mildly positive
  [/смея|смех|хохот|laugh/, 0.8, 0.8, 0, 'смех'],
  [/красив|прекрасн|волшебн|beautiful|magic/, 0.6, 0.4, 0, 'красота'],
  [/разговар|болтал|talk/, 0.4, 0.3, 0, 'разговоры'],
  [/танц|вечеринк|праздн|dance|party|festival/, 0.8, 0.9, 0, 'праздник'],
  [/концерт|concert/, 0.7, 0.9, 0, 'концерт'],
  [/победил|получилось|успех|наконец-то|\bwin\b|success/, 0.8, 0.7, 0, 'успех'],
  [/устал|вымот|tired|exhaust/, -0.4, 0.2, 0.3, 'усталость'],
  [/груст|печал|тоск|\bsad/, -0.7, 0.2, 0.1, 'грусть'],
  [/одино|(?<!ни )\bодна\b|(?<!ни )\bодин\b(?! из| раз)|lonely|alone/, -0.5, 0.15, 0.1, 'одиночество'],
  [/плак|слез|\bcry|tears/, -0.7, 0.5, 0.3, 'слёзы'],
  [/скучал|скучаю|\bmiss/, -0.3, 0.2, 0, 'скучание'],
  [/тревог|волнов|страшн|боюсь|anxious|fear|scared/, -0.6, 0.7, 0.7, 'тревога'],
  [/злюсь|злой|бесит|раздраж|angry|annoy/, -0.7, 0.8, 0.6, 'злость'],
  [/дедлайн|сдач|срочн|не успева|аврал|экзамен|deadline|urgent|exam/, -0.2, 0.9, 0.9, 'дедлайн'],
  [/стресс|напряж|stress|tense/, -0.5, 0.8, 0.8, 'напряжение'],
  [/бегом|спешил|суета|суетн|\brush/, -0.1, 0.8, 0.5, 'спешка'],
  [/ностальг|вспомина|детств|стар[а-я]* фот|пересматрива|как раньше|nostalg|memor/, 0.1, 0.2, 0, 'ностальгия'],
  [/холодн|мерзл|замерз|\bcold|freez/, -0.1, 0.3, 0.1, 'холод'],
  [/дожд|ливен|\brain/, -0.1, 0.2, 0, 'дождь'],
  [/солнц|солнечн|\bsun/, 0.5, 0.4, 0, 'солнце'],
  [/какао|кофе|\bча[йюя]\b|coffee|cocoa|\btea\b/, 0.4, 0.1, 0, 'горячий напиток'],
];

const SEASONS = {
  autumn: { re: /осен|листопад|желт[а-я]* лист|сентябр|октябр|ноябр|autumn|\bfall\b/, adj: { m: 'осенний', f: 'осенняя', n: 'осеннее', pl: 'осенние' }, adv: 'осенью' },
  winter: { re: /\bзим|снег|снеж|мороз|декабр|январ|феврал|winter|snow/, adj: { m: 'зимний', f: 'зимняя', n: 'зимнее', pl: 'зимние' }, adv: 'зимой' },
  spring: { re: /весн|весен|\bмарт|апрел|\bма[яй]\b|цветен|цветущ|spring|blossom/, adj: { m: 'весенний', f: 'весенняя', n: 'весеннее', pl: 'весенние' }, adv: 'весной' },
  summer: { re: /\bлет(о|ом|а)\b|летн|\bжар[аы]?\b|пляж|\bиюн|\bиюл|август|summer/, adj: { m: 'летний', f: 'летняя', n: 'летнее', pl: 'летние' }, adv: 'летом' },
};
const MONTH_SEASON = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

const TIMES = [
  ['night', /\bноч|полноч|до утра|\bnight|midnight/, { w: 'Ночь', g: 'f' }],
  ['evening', /вечер|закат|sunset|evening/, { w: 'Вечер', g: 'm' }],
  ['morning', /\bутр|рассвет|проснул|morning|sunrise/, { w: 'Утро', g: 'n' }],
  ['day', /\bднем\b|обед|полдень|afternoon|noon/, { w: 'День', g: 'm' }],
];

// pattern, nominative, locative phrase, gender, kind
const PLACES = [
  [/\bпарк/, 'парк', 'в парке', 'm', 'nature'], [/\bпруд/, 'пруд', 'у пруда', 'm', 'water'],
  [/озер/, 'озеро', 'у озера', 'n', 'water'], [/\bмор[еяю]|пляж|\bsea\b|beach/, 'море', 'у моря', 'n', 'water'],
  [/\bгор[ыах]|поход|mountain/, 'горы', 'в горах', 'pl', 'nature'], [/\bлес[ау]?\b|\bлесу|forest/, 'лес', 'в лесу', 'm', 'nature'],
  [/набережн/, 'набережная', 'на набережной', 'f', 'water'], [/\bкрыш/, 'крыша', 'на крыше', 'f', 'city'],
  [/\bдач[аеу]/, 'дача', 'на даче', 'f', 'home'], [/офис|\boffice/, 'офис', 'в офисе', 'm', 'work'],
  [/универ|кампус|лекци|university|campus/, 'универ', 'в универе', 'm', 'work'],
  [/кафе|кофейн|ресторан|\bcafe/, 'кафе', 'в кафе', 'n', 'city'], [/концерт|concert/, 'концерт', 'на концерте', 'm', 'city'],
  [/аэропорт|самолет|перелет|airport/, 'аэропорт', 'в аэропорту', 'm', 'road'],
  [/поезд|дорог[аеу]|трасс|road trip|\btrain/, 'дорога', 'в дороге', 'f', 'road'],
  [/\bкухн/, 'кухня', 'на кухне', 'f', 'home'], [/\bдома\b|квартир|\bhome\b/, 'дом', 'дома', 'm', 'home'],
  [/город|улиц|проспект|\bcity|street/, 'город', 'в городе', 'm', 'city'],
];

const PEOPLE = [
  [/девушк|girlfriend/, 'с девушкой'], [/\bпарн[еяю]|бойфренд|boyfriend/, 'с парнем'],
  [/\bмуж[ае]?м?\b|husband/, 'с мужем'], [/\bжен[ао]й?\b|\bwife/, 'с женой'],
  [/друз|подруг|\bдруг\b|friends?/, 'с друзьями'], [/\bмам|\bпап|родител|\bсемь|бабуш|дедуш|family/, 'с семьёй'],
  [/коллег|команд|colleague|\bteam/, 'с командой'], [/(?<!ни )\bодин\b(?! из| раз)|(?<!ни )\bодна\b|одиночеств|\balone/, 'наедине с собой'],
];

const OBJECTS = [
  [/какао|cocoa/, 'какао'], [/кофе|coffee/, 'кофе'], [/\bчай|\bчаю|\btea\b/, 'чай'], [/разговор|разговар/, 'разговоры'],
  [/закат|sunset/, 'закат'], [/звезд|\bstars/, 'звёзды'], [/костер|костр/, 'костёр'], [/\bснег|snow/, 'снег'],
  [/дожд|\brain/, 'дождь'], [/желт[а-я]* лист|листь|листопад|leaves/, 'листья'], [/кино|фильм|movie/, 'кино'],
  [/книг|читал|\bbook/, 'книги'], [/танц|dance/, 'танцы'], [/пицц|pizza/, 'пицца'], [/мороженое|ice cream/, 'мороженое'],
];

// weather words become the title's adjective: "Дождливый день дома наедине с собой"
const WEATHER = [
  ['rain', /дожд|ливен|ливн|\brain/, { m: 'Дождливый', f: 'Дождливая', n: 'Дождливое', pl: 'Дождливые' }],
  ['snow', /\bснег|снегопад|снежн|метел|\bsnow/, { m: 'Снежный', f: 'Снежная', n: 'Снежное', pl: 'Снежные' }],
  ['fog', /туман|\bfog/, { m: 'Туманный', f: 'Туманная', n: 'Туманное', pl: 'Туманные' }],
  ['frost', /мороз|\bfrost/, { m: 'Морозный', f: 'Морозная', n: 'Морозное', pl: 'Морозные' }],
  ['wind', /\bветер|\bветр|ветрен|\bwind/, { m: 'Ветреный', f: 'Ветреная', n: 'Ветреное', pl: 'Ветреные' }],
  ['heat', /\bжар[аы]?\b|духот|\bhot\b/, { m: 'Жаркий', f: 'Жаркая', n: 'Жаркое', pl: 'Жаркие' }],
  ['sun', /солнечн|солнце светил|\bsunny/, { m: 'Солнечный', f: 'Солнечная', n: 'Солнечное', pl: 'Солнечные' }],
];

const MOOD_ADJ = {
  calm: { m: 'Тихий', f: 'Тихая', n: 'Тихое', pl: 'Тихие' }, warm: { m: 'Тёплый', f: 'Тёплая', n: 'Тёплое', pl: 'Тёплые' },
  bright: { m: 'Яркий', f: 'Яркая', n: 'Яркое', pl: 'Яркие' }, tense: { m: 'Напряжённый', f: 'Напряжённая', n: 'Напряжённое', pl: 'Напряжённые' },
  blue: { m: 'Грустный', f: 'Грустная', n: 'Грустное', pl: 'Грустные' },
};

// JS `\b` is ASCII-only, so Cyrillic words never hit it. Swap in a Cyrillic-aware boundary.
const B = '(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))';
const fix = (re) => new RegExp(re.source.replaceAll('\\b', B), re.flags);
MOOD.forEach((r) => { r[0] = fix(r[0]); });
Object.values(SEASONS).forEach((s) => { s.re = fix(s.re); });
TIMES.forEach((r) => { r[1] = fix(r[1]); });
[PLACES, PEOPLE, OBJECTS].forEach((list) => list.forEach((r) => { r[0] = fix(r[0]); }));
WEATHER.forEach((r) => { r[1] = fix(r[1]); });
const NEG = fix(/\b(не|not|no)\s*$/);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function analyzeText(raw, dateStr) {
  const t = norm(raw);
  const words = t.split(/[^a-zа-я-]+/).filter(Boolean);
  let vSum = 0, aSum = 0, tension = 0, hits = [];
  for (const [re, v, a, ten, label] of MOOD) {
    const m = new RegExp(re.source, 'g');
    let match;
    while ((match = m.exec(t))) {
      const negated = NEG.test(t.slice(Math.max(0, match.index - 5), match.index));
      vSum += negated ? -v * 0.5 : v; aSum += a; tension = Math.max(tension, negated ? 0 : ten);
      hits.push(negated ? `не ${label}` : label);
    }
  }
  const n = Math.max(1, hits.length);
  const exclaim = (raw.match(/!/g) || []).length, ellipsis = (raw.match(/…|\.\.\./g) || []).length;
  const valence = clamp(Math.tanh(vSum / Math.sqrt(n)), -1, 1);
  const arousal = clamp(hits.length ? aSum / n + exclaim * 0.06 - ellipsis * 0.05 : 0.4);
  const nostalgia = clamp((hits.includes('ностальгия') ? 0.6 : 0) + ellipsis * 0.1);

  const month = Number((dateStr || '').slice(5, 7)) || new Date().getMonth() + 1;
  let season = Object.keys(SEASONS).find((k) => SEASONS[k].re.test(t));
  const seasonFromText = Boolean(season);
  season ||= MONTH_SEASON[month - 1];

  const timeHit = TIMES.find(([, re]) => re.test(t));
  const timeOfDay = timeHit ? timeHit[0] : null;
  const places = PLACES.filter(([re]) => re.test(t)).map(([, nom, loc, g, kind]) => ({ nom, loc, g, kind }));
  const people = PEOPLE.filter(([re]) => re.test(t)).map(([, p]) => p);
  const objects = OBJECTS.filter(([re]) => re.test(t)).map(([, o]) => o);
  const deadline = /дедлайн|сдач|экзамен|deadline|exam/.test(t) ? (/экзамен|exam/.test(t) ? 'перед экзаменом' : 'перед сдачей') : null;

  const weather = WEATHER.find(([, re]) => re.test(t))?.[0] || null;
  const facts = {
    valence, arousal, tension, nostalgia, season, seasonFromText, timeOfDay, places, people, objects, deadline, weather,
    words: words.length, exclaim, hits: [...new Set(hits)],
  };
  facts.title = makeTitle(facts);
  return facts;
}

function moodKey({ valence, arousal, tension }) {
  if (tension > 0.6) return 'tense';
  if (valence < -0.25) return 'blue';
  if (arousal > 0.65) return 'bright';
  return valence > 0.35 ? 'warm' : 'calm';
}

export function makeTitle(f) {
  const S = SEASONS[f.season];
  const time = (TIMES.find(([k]) => k === f.timeOfDay) || [null, null, { w: 'День', g: 'm' }])[2];
  const place = f.places[0], person = f.people[0], obj = f.objects.find((o) => o !== place?.nom);
  const W = WEATHER.find(([k]) => k === f.weather)?.[2];
  const mood = W || MOOD_ADJ[moodKey(f)]; // weather is more concrete than mood, so it wins
  const who = (p, loc) => (p === 'наедине с собой' ? [loc, p] : [p, loc]); // "дома наедине с собой", "с девушкой у пруда"
  let parts;
  if (f.deadline) parts = [f.timeOfDay ? time.w : 'День', place?.loc, f.deadline];
  else if (place && person) parts = W ? [W[time.g], time.w.toLowerCase(), ...who(person, place.loc)] : [time.w, f.seasonFromText ? S.adv : null, ...who(person, place.loc)];
  else if (place && obj) parts = [cap(S.adj[place.g]), place.nom, 'и', obj];
  else if (place) parts = [mood[time.g], time.w.toLowerCase(), place.loc];
  else if (person && obj) parts = [cap(S.adj[time.g]), time.w.toLowerCase(), person, 'и', obj];
  else if (obj) parts = [cap(S.adj[time.g]), time.w.toLowerCase(), 'и', obj];
  else if (person) parts = [mood[time.g], time.w.toLowerCase(), person];
  else parts = [mood[time.g], S.adj[time.g], time.w.toLowerCase()];
  let words = parts.filter(Boolean).join(' ').split(' ');
  if (words.length < 3) words = [mood[time.g], ...words.map((w, i) => (i === 0 ? w.toLowerCase() : w))];
  return cap(words.slice(0, 7).join(' '));
}

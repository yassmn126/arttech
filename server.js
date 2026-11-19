// Genesis memory diary — local server (no dependencies).
// Serves the app, stores each day in its own folder under ./archive,
// and proxies Apple's public iTunes Search API + official 30s previews
// (previews are streamed for playback/analysis only, never written to disk).
import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
// node server.js [--port 5173] [--archive ./archive]   (or env PORT / GENESIS_ARCHIVE)
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ARCHIVE = path.resolve(arg('archive') || process.env.GENESIS_ARCHIVE || path.join(ROOT, 'archive'));
const PORT = Number(arg('port') || process.env.PORT) || 5173;
const MAX_BODY = 80 * 1024 * 1024;
const MAX_CLIP = 4 * 1024 * 1024; // ~30 s mono 22 kHz WAV is ~1.3 MB

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.ico': 'image/x-icon',
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const safeName = (s) => String(s || '')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim().slice(0, 80) || 'День';

const isSafeId = (id) => id && !id.includes('..') && !/[\\/]/.test(id);

function decodeDataUrl(d) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(d || '');
  if (!m) throw Object.assign(new Error('Bad data URL'), { status: 400 });
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function uniqueDir(base) {
  let name = base, i = 2;
  while (await exists(path.join(ARCHIVE, name))) name = `${base} (${i++})`;
  return name;
}

const fileUrl = (id, f) => `/archive/${encodeURIComponent(id)}/${f.split('/').map(encodeURIComponent).join('/')}`;

function withUrls(entry) {
  return {
    ...entry,
    photoUrls: entry.photos.map((f) => fileUrl(entry.id, f)),
    posterUrl: fileUrl(entry.id, entry.poster) + (entry.restyledAt ? `?v=${Date.parse(entry.restyledAt)}` : ''), // bust cache after a re-render
    clipUrl: entry.song?.clipFile ? fileUrl(entry.id, entry.song.clipFile) : null,
  };
}

async function readEntry(id) {
  const raw = await fs.readFile(path.join(ARCHIVE, id, 'entry.json'), 'utf8');
  return withUrls({ ...JSON.parse(raw), id });
}

async function listDays() {
  await fs.mkdir(ARCHIVE, { recursive: true });
  const dirs = (await fs.readdir(ARCHIVE, { withFileTypes: true })).filter((d) => d.isDirectory());
  const days = [];
  for (const d of dirs) {
    try {
      const e = await readEntry(d.name);
      days.push({
        id: e.id, title: e.title, date: e.date, createdAt: e.createdAt, posterUrl: e.posterUrl,
        technique: e.style?.technique, moodLabel: e.style?.moodLabel, palette: e.style?.palette?.slice(0, 5),
        bpm: e.style?.rhythm?.bpm ?? null,
        mood: e.style?.fused ? { valence: e.style.fused.valence, arousal: e.style.fused.arousal, tension: e.style.fused.tension } : null,
        song: e.song ? { artist: e.song.artist, title: e.song.title } : null,
      });
    } catch { /* folder without a valid entry: skip */ }
  }
  return days.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}

// Re-render a saved day with the current visual rules: only the style and the poster change.
// Text, photos, song, title and folder stay exactly as they were saved.
async function restyleDay(id, body) {
  const dir = path.join(ARCHIVE, id);
  const entry = JSON.parse(await fs.readFile(path.join(dir, 'entry.json'), 'utf8'));
  if (!body?.style?.technique || !Array.isArray(body.style.palette)) throw Object.assign(new Error('Нужен новый стиль'), { status: 400 });
  await fs.writeFile(path.join(dir, entry.poster || 'memory.jpg'), decodeDataUrl(body.poster).buf);
  const next = { ...entry, style: body.style, analysis: { ...entry.analysis, ...(body.analysis || {}) }, restyledAt: new Date().toISOString() };
  await fs.writeFile(path.join(dir, 'entry.json'), JSON.stringify(next, null, 2));
  return withUrls({ ...next, id });
}

async function createDay(body) {
  const { text, title, date, photos, poster, song, analysis, style } = body;
  if (!text?.trim()) throw Object.assign(new Error('Нужен текст о дне'), { status: 400 });
  if (!Array.isArray(photos) || !photos.length) throw Object.assign(new Error('Нужно хотя бы одно фото'), { status: 400 });
  if (!song || (!song.title && !song.url && !song.clip)) throw Object.assign(new Error('Нужна песня'), { status: 400 });

  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const id = await uniqueDir(`${day} — ${safeName(title)}`);
  const dir = path.join(ARCHIVE, id);
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });

  const photoFiles = [];
  for (let i = 0; i < photos.length; i++) {
    const f = `photos/${String(i + 1).padStart(2, '0')}.jpg`;
    await fs.writeFile(path.join(dir, f), decodeDataUrl(photos[i]).buf);
    photoFiles.push(f);
  }
  await fs.writeFile(path.join(dir, 'memory.jpg'), decodeDataUrl(poster).buf);

  // Song: metadata always; audio only as a short excerpt of the user's own / free-licensed file.
  const { clip, clipConsent, ...songMeta } = song;
  if (clip) {
    if (!clipConsent) throw Object.assign(new Error('Подтвердите права на аудиофайл'), { status: 400 });
    const { buf } = decodeDataUrl(clip);
    if (buf.length > MAX_CLIP) throw Object.assign(new Error('Фрагмент длиннее 30 секунд'), { status: 400 });
    await fs.writeFile(path.join(dir, 'song-clip.wav'), buf);
    songMeta.clipFile = 'song-clip.wav';
  }
  await fs.writeFile(path.join(dir, 'song.json'), JSON.stringify(songMeta, null, 2));

  const entry = {
    version: 1, title: safeName(title), date: day, createdAt: new Date().toISOString(),
    text: text.trim(), photos: photoFiles, poster: 'memory.jpg', song: songMeta, analysis, style,
  };
  await fs.writeFile(path.join(dir, 'entry.txt'), `${entry.title}\n${day}\n\n${entry.text}\n`);
  await fs.writeFile(path.join(dir, 'entry.json'), JSON.stringify(entry, null, 2));
  return withUrls({ ...entry, id });
}

// "Fly Me to the Moon (feat. …) - Remastered 2008" → "fly me to the moon"
const songKey = (artist = '', title = '') => [artist.split(/\s+(?:&|feat\.?|ft\.?|and)\s+/i)[0], title]
  .map((s) => s.toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
  .join('|');

async function musicSearch(term, res) {
  if (!term.trim()) return json(res, 200, []);
  // Ask for many versions: iTunes dates reissues/compilations by the reissue,
  // so the song's real era is the earliest release among versions of the same song.
  const u = `https://itunes.apple.com/search?media=music&entity=song&limit=50&term=${encodeURIComponent(term)}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return json(res, 502, { error: 'iTunes search failed' });
  const all = ((await r.json()).results || []).filter((t) => t.kind === 'song');
  const earliest = new Map();
  for (const t of all) {
    const y = Number(t.releaseDate?.slice(0, 4)), k = songKey(t.artistName, t.trackName);
    if (y && !(earliest.get(k) <= y)) earliest.set(k, y);
  }
  const seen = new Set(), out = [];
  for (const t of all) { // iTunes order = relevance; keep one row per song
    const k = songKey(t.artistName, t.trackName);
    if (seen.has(k)) continue;
    seen.add(k);
    const releaseYear = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : null;
    out.push({
      artist: t.artistName, title: t.trackName, album: t.collectionName, genre: t.primaryGenreName,
      year: earliest.get(k) || releaseYear, releaseYear, durationMs: t.trackTimeMillis,
      artwork: t.artworkUrl100?.replace('100x100', '300x300'), previewUrl: t.previewUrl, url: t.trackViewUrl,
      source: 'itunes',
    });
    if (out.length === 8) break;
  }
  json(res, 200, out);
}

// Byte ranges let the player's progress bar seek inside audio.
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(size - 1, end);
  return start <= end ? { start, end } : null;
}
function sendRanged(req, res, size, type, body, extra = {}) {
  const r = parseRange(req.headers.range, size);
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', ...extra };
  if (!r) { res.writeHead(200, { ...head, 'Content-Length': size }); return body(0, size - 1); }
  res.writeHead(206, { ...head, 'Content-Length': r.end - r.start + 1, 'Content-Range': `bytes ${r.start}-${r.end}/${size}` });
  return body(r.start, r.end);
}

// Official previews are held in memory only (a few, for seeking) and never written to disk.
const previewCache = new Map();
async function musicPreview(req, res, url) {
  let host;
  try { const p = new URL(url); host = p.hostname; if (p.protocol !== 'https:') throw 0; } catch { return json(res, 400, { error: 'bad url' }); }
  if (!/(\.apple\.com|\.mzstatic\.com)$/.test(host)) return json(res, 403, { error: 'only official Apple previews' });
  let hit = previewCache.get(url);
  if (!hit) {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return json(res, 502, { error: 'preview fetch failed' });
    hit = { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'audio/mp4' };
    previewCache.set(url, hit);
    if (previewCache.size > 6) previewCache.delete(previewCache.keys().next().value);
  }
  sendRanged(req, res, hit.buf.length, hit.type, (s, e) => res.end(hit.buf.subarray(s, e + 1)), { 'Cache-Control': 'no-store' });
}

async function serveFile(req, res, base, rel) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) return json(res, 403, { error: 'forbidden' });
  try {
    const st = await fs.stat(p);
    if (!st.isFile()) throw 0;
    const type = MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
    sendRanged(req, res, st.size, type, (s, e) => createReadStream(p, { start: s, end: e }).pipe(res));
  } catch { json(res, 404, { error: 'not found' }); }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = decodeURIComponent(url.pathname);

    if (p === '/api/days' && req.method === 'GET') return json(res, 200, await listDays());
    if (p === '/api/days' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      return json(res, 201, await createDay(body));
    }
    if (p.startsWith('/api/days/') && p.endsWith('/restyle') && req.method === 'POST') {
      const id = p.slice('/api/days/'.length, -'/restyle'.length);
      if (!isSafeId(id) || !(await exists(path.join(ARCHIVE, id, 'entry.json')))) return json(res, 404, { error: 'not found' });
      return json(res, 200, await restyleDay(id, JSON.parse((await readBody(req)).toString('utf8'))));
    }
    if (p.startsWith('/api/days/') && req.method === 'GET') {
      const id = p.slice('/api/days/'.length);
      if (!isSafeId(id)) return json(res, 400, { error: 'bad id' });
      try { return json(res, 200, await readEntry(id)); } catch { return json(res, 404, { error: 'not found' }); }
    }
    // `return await` keeps rejections (e.g. an iTunes timeout) inside this try instead of crashing the process
    if (p === '/api/music/search') return await musicSearch(url.searchParams.get('term') || '', res);
    if (p === '/api/music/preview') return await musicPreview(req, res, url.searchParams.get('url') || '');
    if (p.startsWith('/archive/')) return await serveFile(req, res, ARCHIVE, p.slice('/archive/'.length));
    return await serveFile(req, res, PUBLIC, p === '/' ? 'index.html' : p.slice(1));
  } catch (err) {
    const offline = err.name === 'TimeoutError' || err.cause?.code?.startsWith?.('UND_ERR') || err.message === 'fetch failed';
    console.error(offline ? `network: ${err.cause?.code || err.name}` : err);
    if (!res.headersSent) json(res, offline ? 504 : err.status || 500, { error: offline ? 'Музыкальный сервис недоступен (нет сети?)' : err.message || 'server error' });
    else res.destroy();
  }
});

await fs.mkdir(ARCHIVE, { recursive: true });
server.listen(PORT, '127.0.0.1', () => console.log(`Genesis diary → http://localhost:${PORT}  (archive: ${ARCHIVE})`));

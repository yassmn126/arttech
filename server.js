// Genesis memory diary — local server (no dependencies).
// Serves the app, stores each day in its own folder under ./archive,
// and proxies Apple's public iTunes Search API + official 30s previews
// (previews are streamed for playback/analysis only, never written to disk).
import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const ARCHIVE = path.join(ROOT, 'archive');
const PORT = Number(process.env.PORT) || 5173;
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
    posterUrl: fileUrl(entry.id, entry.poster),
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
        song: e.song ? { artist: e.song.artist, title: e.song.title } : null,
      });
    } catch { /* folder without a valid entry: skip */ }
  }
  return days.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
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

async function musicSearch(term, res) {
  const u = `https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(term)}`;
  const r = await fetch(u);
  if (!r.ok) return json(res, 502, { error: 'iTunes search failed' });
  const data = await r.json();
  json(res, 200, (data.results || []).map((t) => ({
    artist: t.artistName, title: t.trackName, album: t.collectionName, genre: t.primaryGenreName,
    year: t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : null, durationMs: t.trackTimeMillis,
    artwork: t.artworkUrl100?.replace('100x100', '300x300'), previewUrl: t.previewUrl, url: t.trackViewUrl,
    source: 'itunes',
  })));
}

async function musicPreview(url, res) {
  let host;
  try { const p = new URL(url); host = p.hostname; if (p.protocol !== 'https:') throw 0; } catch { return json(res, 400, { error: 'bad url' }); }
  if (!/(\.apple\.com|\.mzstatic\.com)$/.test(host)) return json(res, 403, { error: 'only official Apple previews' });
  const r = await fetch(url);
  if (!r.ok || !r.body) return json(res, 502, { error: 'preview fetch failed' });
  res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Cache-Control': 'no-store' });
  Readable.fromWeb(r.body).pipe(res);
}

async function serveFile(res, base, rel) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) return json(res, 403, { error: 'forbidden' });
  try {
    const st = await fs.stat(p);
    if (!st.isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
    createReadStream(p).pipe(res);
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
    if (p.startsWith('/api/days/') && req.method === 'GET') {
      const id = p.slice('/api/days/'.length);
      if (!isSafeId(id)) return json(res, 400, { error: 'bad id' });
      try { return json(res, 200, await readEntry(id)); } catch { return json(res, 404, { error: 'not found' }); }
    }
    if (p === '/api/music/search') return musicSearch(url.searchParams.get('term') || '', res);
    if (p === '/api/music/preview') return musicPreview(url.searchParams.get('url') || '', res);
    if (p.startsWith('/archive/')) return serveFile(res, ARCHIVE, p.slice('/archive/'.length));
    return serveFile(res, PUBLIC, p === '/' ? 'index.html' : p.slice(1));
  } catch (err) {
    console.error(err);
    json(res, err.status || 500, { error: err.message || 'server error' });
  }
});

await fs.mkdir(ARCHIVE, { recursive: true });
server.listen(PORT, '127.0.0.1', () => console.log(`Genesis diary → http://localhost:${PORT}`));

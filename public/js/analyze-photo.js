// Photo → stored JPEG (max 1600px) + visual features:
// dominant palette (k-means in RGB), luminance, contrast, saturation, warmth.

const MAX_SIDE = 1600;

export async function loadPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const dataUrl = c.toDataURL('image/jpeg', 0.86);
  return { dataUrl, width: w, height: h, features: photoFeatures(c) };
}

function photoFeatures(src) {
  const S = 72, c = document.createElement('canvas');
  c.width = S; c.height = Math.max(1, Math.round((S * src.height) / src.width));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const px = [];
  let lum = 0, lum2 = 0, sat = 0, warm = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    lum += L; lum2 += L * L; sat += mx ? (mx - mn) / mx : 0; warm += (r - b) / 255;
    px.push([r, g, b]);
  }
  const n = px.length;
  const luminance = lum / n;
  return {
    luminance,
    contrast: Math.sqrt(Math.max(0, lum2 / n - luminance * luminance)) * 2, // ~0..1
    saturation: sat / n,
    warmth: warm / n, // -1 (blue) .. 1 (orange)
    palette: kmeans(px, 5),
  };
}

function kmeans(px, k, iters = 10) {
  // deterministic init: spread seeds across luminance-sorted pixels
  const sorted = [...px].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let cents = Array.from({ length: k }, (_, i) => [...sorted[Math.floor(((i + 0.5) / k) * sorted.length)]]);
  let counts = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const sums = cents.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const p of px) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const c = cents[j], dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (dd < bd) { bd = dd; best = j; }
      }
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; counts[best]++;
    }
    cents = cents.map((c, j) => (counts[j] ? sums[j].map((s) => s / counts[j]) : c));
  }
  return cents
    .map((c, j) => ({ rgb: c.map(Math.round), weight: counts[j] / px.length }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

// Merge features of all photos of the day into one description.
export function mergePhotoFeatures(list) {
  const n = list.length || 1;
  const avg = (key) => list.reduce((s, f) => s + f[key], 0) / n;
  const all = list.flatMap((f) => f.palette.map((p) => ({ ...p, weight: p.weight / n })));
  // collapse near-identical swatches
  const merged = [];
  for (const sw of all.sort((a, b) => b.weight - a.weight)) {
    const near = merged.find((m) => Math.hypot(m.rgb[0] - sw.rgb[0], m.rgb[1] - sw.rgb[1], m.rgb[2] - sw.rgb[2]) < 38);
    if (near) near.weight += sw.weight; else merged.push({ ...sw });
  }
  return {
    count: list.length,
    luminance: avg('luminance'), contrast: avg('contrast'), saturation: avg('saturation'), warmth: avg('warmth'),
    palette: merged.slice(0, 6),
  };
}

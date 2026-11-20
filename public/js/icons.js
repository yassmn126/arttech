// Soft, rounded icons (inline SVG, currentColor).
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const s = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

export const icon = {
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>'),
  prev: svg('<rect x="4.5" y="5" width="3" height="14" rx="1.5" fill="currentColor"/><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l8.25-5.8A1 1 0 0 1 19 6.2z" fill="currentColor"/>'),
  next: svg('<rect x="16.5" y="5" width="3" height="14" rx="1.5" fill="currentColor"/><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8.25-5.8a1 1 0 0 0 0-1.66L6.55 5.37A1 1 0 0 0 5 6.2z" fill="currentColor"/>'),
  rew: svg('<path d="M11 7l-6 5 6 5M19 7l-6 5 6 5" ' + s + '/>'),
  ff: svg('<path d="M5 7l6 5-6 5M13 7l6 5-6 5" ' + s + '/>'),
  shuffle: svg('<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8C14.3 15 15.5 17 17.5 17H21M3 17h3.5c1.2 0 2.1-.4 2.9-1.1M14.6 8.1C15.4 7.4 16.3 7 17.5 7H21M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" ' + s + '/>'),
  repeat: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M17.5 3.5v3.7h-3.7" ' + s + '/>'),
  voice: svg('<path d="M4 9.5h3l4.5-3.8a.6.6 0 0 1 1 .46v11.7a.6.6 0 0 1-1 .46L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.8 6.5a8 8 0 0 1 0 11" ' + s + '/>'),
  plus: svg('<path d="M12 5v14M5 12h14" ' + s + '/>'),
  minus: svg('<path d="M5 12h14" ' + s + '/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18" ' + s + '/>'),
  sparkle: svg('<path d="M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6zM18.5 14.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5z" fill="currentColor"/>'),
  music: svg('<path d="M9 18.5V6.2a1 1 0 0 1 .78-.98l9-2A1 1 0 0 1 20 4.2v11.3" ' + s + '/><circle cx="6.5" cy="18.5" r="2.8" fill="currentColor"/><circle cx="17.5" cy="15.5" r="2.8" fill="currentColor"/>'),
  star: svg('<path d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.3L12 16.7l-5.6 3.2 1.3-6.3L3 9.3l6.3-.7z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'),
  heart: svg('<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.9-8 10.6-8 10.6z" fill="currentColor"/>'),
  planet: svg('<circle cx="12" cy="12" r="5.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)" ' + s + '/>'),
  smile: svg('<circle cx="12" cy="12" r="9" ' + s + '/><circle cx="9" cy="10" r="1.3" fill="currentColor"/><circle cx="15" cy="10" r="1.3" fill="currentColor"/><path d="M8.2 14.2c2.1 2.4 5.5 2.4 7.6 0" ' + s + '/>'),
  film: svg('<rect x="3" y="5" width="13" height="14" rx="3" fill="currentColor"/><path d="M16.5 10.2 21 7.5v9l-4.5-2.7z" fill="currentColor"/>'),
  folder: svg('<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" fill="currentColor"/>'),
  up: svg('<path d="M5 15l7-7 7 7" ' + s + '/>'),
  down: svg('<path d="M5 9l7 7 7-7" ' + s + '/>'),
  disc: svg('<circle cx="12" cy="12" r="8.5" ' + s + '/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 6.8a5.2 5.2 0 0 1 5.2 5.2" ' + s + '/>'),
  write: svg('<path d="M5 19l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L9.2 18 5 19zM14 7l3 3" ' + s + '/>'),
};

// ---- day panel: thin-line glyphs ----
const t = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
icon.clock = svg(`<circle cx="12" cy="12" r="8.6" ${t}/><path d="M12 7.4V12l3.2 2" ${t}/>`);
icon.heartLine = svg(`<path d="M12 20s-7.6-4.5-7.6-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.6 2.5C19.6 15.5 12 20 12 20z" ${t}/>`);
icon.wave = svg(`<path d="M3 12h2M7 8v8M10.5 5v14M14 9v6M17.5 7v10M21 12h0" ${t}/>`);

// mood face: 0 sad … 4 delighted; tense days get a zig-zag mouth
export function moodFace(i = 2, tense = false) {
  const c = [-3, -1.2, 0.6, 2.3, 3.6][i] ?? 0.6;
  const mouth = tense ? 'M7.8 15.2l1.4-1 1.4 1 1.4-1 1.4 1 1.4-1 1.4 1' : `M8 14.4Q12 ${(14.4 + c).toFixed(1)} 16 14.4`;
  return svg(`<circle cx="12" cy="12" r="9" ${t}/><circle cx="9" cy="10" r="1.15" fill="currentColor"/><circle cx="15" cy="10" r="1.15" fill="currentColor"/><path d="${mouth}" ${t}/>`);
}

// weather from the entry's own words (see util.weatherOf): sun / rain / snow / fog / wind / night / seasons
const WX = {
  sun: `<circle cx="12" cy="12" r="4.4" fill="currentColor"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6" ${t}/>`,
  rain: `<path d="M7.2 15.5a4 4 0 0 1-.4-8 5.3 5.3 0 0 1 10.1 1.3 3.4 3.4 0 0 1 .4 6.7z" ${t}/><path d="M8.5 18.2l-.8 2M12.3 18.2l-.8 2M16.1 18.2l-.8 2" ${t}/>`,
  snow: `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 6.8l2.4-2.2M9.6 19.4 12 17.2l2.4 2.2" ${t}/>`,
  fog: `<path d="M4 9h16M3 13h18M5 17h14" ${t}/>`,
  wind: `<path d="M3 9h11.5a2.6 2.6 0 1 0-2.5-3.3M3 13.5h15.5a2.6 2.6 0 1 1-2.5 3.3M3 18h7" ${t}/>`,
  night: `<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5 8 8 0 1 0 19.5 14.6z" fill="currentColor"/>`,
  autumn: `<path d="M5 19C5 10 10 5 19.5 4.5 19 14 14 19 5 19zM5 19l8-8" ${t}/>`,
  spring: `<circle cx="12" cy="12" r="2.1" fill="currentColor"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.4" rx="2.4" ry="3.3" transform="rotate(${a} 12 12)" ${t}/>`).join('')}`,
};
const WX_KIND = { heat: 'sun', summer: 'sun', frost: 'snow', winter: 'snow' };
export const weatherKind = (kind) => (WX[kind] ? kind : WX_KIND[kind] || 'sun');
export const weatherIcon = (kind) => svg(WX[weatherKind(kind)]);

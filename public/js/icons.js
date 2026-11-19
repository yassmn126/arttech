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
  disc: svg('<circle cx="12" cy="12" r="8.5" ' + s + '/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 6.8a5.2 5.2 0 0 1 5.2 5.2" ' + s + '/>'),
  write: svg('<path d="M5 19l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L9.2 18 5 19zM14 7l3 3" ' + s + '/>'),
};

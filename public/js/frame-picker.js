// Y2K pill picker for the photo frame style (New Day preview + "Открытка дня" card view).
import { FRAMES } from './frames.js';

const s = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"';
const ICONS = {
  poster: `<rect x="5" y="3" width="14" height="18" rx="2" ${s}/><circle cx="10" cy="10" r="2.6" fill="currentColor"/><path d="M12.5 17l3-5 3 5z" fill="currentColor"/>`,
  polaroid: `<rect x="4.5" y="3" width="15" height="18" rx="1.5" ${s}/><rect x="7" y="5.5" width="10" height="9" fill="currentColor"/>`,
  booth: `<rect x="8" y="2" width="8" height="20" rx="1.5" ${s}/><rect x="9.6" y="3.8" width="4.8" height="3.2" fill="currentColor"/><rect x="9.6" y="8.4" width="4.8" height="3.2" fill="currentColor"/><rect x="9.6" y="13" width="4.8" height="3.2" fill="currentColor"/>`,
  film: `<rect x="3" y="4" width="18" height="16" rx="1.5" fill="currentColor"/><rect x="7" y="8" width="10" height="8" fill="#fff"/><path d="M5 5.6h1.6M9 5.6h1.6M13 5.6h1.6M17 5.6h1.6M5 18.4h1.6M9 18.4h1.6M13 18.4h1.6M17 18.4h1.6" stroke="#fff" stroke-width="1.6"/>`,
  scrapbook: `<rect x="5" y="7" width="14" height="13" rx="1" transform="rotate(-6 12 13)" ${s}/><rect x="3" y="4" width="9" height="4" rx="1" transform="rotate(-30 7 6)" fill="currentColor" opacity=".7"/><path d="M17.5 3.5l.8 1.7 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z" fill="currentColor"/>`,
};

export function pickerHtml(current = 'poster') {
  return `<div class="framepick" role="radiogroup" aria-label="Стиль фото">${FRAMES.map(([k, label]) =>
    `<button type="button" role="radio" data-frame="${k}" aria-checked="${k === current}" tabindex="${k === current ? 0 : -1}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg><span>${label}</span></button>`).join('')}</div>`;
}

// onChange(kind) is called on click or ←/→ (radio-group keyboard pattern)
export function bindPicker(root, onChange) {
  const btns = [...root.querySelectorAll('[data-frame]')];
  const select = (b, focus) => {
    btns.forEach((x) => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    if (focus) b.focus();
    onChange(b.dataset.frame);
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (d) { e.preventDefault(); e.stopPropagation(); select(btns[(i + d + btns.length) % btns.length], true); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.stopPropagation(); select(btns[e.key === 'Home' ? 0 : btns.length - 1], true); }
    });
  });
  return { set(kind) { const b = btns.find((x) => x.dataset.frame === kind); if (b) { btns.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; }); } } };
}

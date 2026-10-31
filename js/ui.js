// Ortak görsel parçalar: simgeler, kartlar, düğmeler, sayı alanları, pencere (sheet).
import { html, useState, useEffect, useRef, createContext, useContext } from '../vendor/preact-htm.js';
import { groupTyping, parseNumber, editable, dateLong } from './format.js';
import { DateX } from './finance.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// --- Simgeler (24px, çizgi) ---

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  add: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  bookmark: 'M6 3h12v18l-6-4.5L6 21z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  back: 'M15 18l-6-6 6-6',
  forward: 'M9 18l6-6-6-6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  table: 'M4 4h16v16H4zM4 9.5h16M4 15h16M10 4v16',
  bank: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7',
  printer: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  check: 'M5 12.5l4.5 4.5L19 7',
  car: 'M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2M3 11h18M7.5 13.5h.01M16.5 13.5h.01',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  house: 'M3 10.5 12 3l9 7.5M5 9v12h14V9M10 21v-6h4v6',
  close: 'M6 6l12 12M18 6L6 18',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  download: 'M12 3v12M7 10l5 5 5-5M5 20h14',
  upload: 'M12 15V3M7 8l5-5 5 5M5 20h14',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
};

export const Icon = ({ name, size = 20, stroke = 2, cls = '' }) => html`
  <svg class=${'ic ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name]} /></svg>`;

// --- Düğmeler ve kartlar ---

export const IconButton = ({ icon, label, onClick, disabled, cls = '', size = 20 }) => html`
  <button class=${'icon-btn ' + cls} onClick=${onClick} disabled=${disabled} title=${label} aria-label=${label}>
    <${Icon} name=${icon} size=${size} />
  </button>`;

export const GradientButton = ({ children, onClick, disabled, grad = 'logo', icon, trailing, cls = '', type = 'button' }) => html`
  <button type=${type} class=${`btn btn-grad grad-${grad} ${cls}`} onClick=${onClick} disabled=${disabled}>
    ${icon && html`<${Icon} name=${icon} size=${18} />`}<span>${children}</span>${trailing && html`<${Icon} name=${trailing} size=${18} />`}
  </button>`;

export const OutlineButton = ({ children, onClick, icon, cls = '', color, disabled }) => html`
  <button class=${'btn btn-outline ' + cls} style=${color ? `--btn-c:${color}` : ''} onClick=${onClick} disabled=${disabled}>
    ${icon && html`<${Icon} name=${icon} size=${18} />`}<span>${children}</span>
  </button>`;

export const TextAction = ({ children, onClick, icon, color }) => html`
  <button class="text-action" style=${color ? `color:${color}` : ''} onClick=${onClick}>
    ${icon && html`<${Icon} name=${icon} size=${16} stroke=${2.4} />`}${children}
  </button>`;

export const Card = ({ children, cls = '', onClick }) => html`
  <div class=${'card ' + cls + (onClick ? ' clickable' : '')} onClick=${onClick}>${children}</div>`;

export const SectionCard = ({ title, trailing, children }) => html`
  <div class="card section-card">
    <div class="section-head"><span class="section-title">${title}</span>${trailing && html`<span class="caption">${trailing}</span>`}</div>
    ${children}
  </div>`;

export const Chip = ({ label, selected, onClick, color }) => html`
  <button class=${'chip' + (selected ? ' on' : '')} style=${selected && color ? `--chip-c:${color}` : ''} onClick=${onClick}>${label}</button>`;

export const Segmented = ({ options, index, onChange, grad = 'logo' }) => html`
  <div class="segmented">
    ${options.map((o, i) => html`<button class=${i === index ? `on grad-${grad}` : ''} onClick=${() => onChange(i)}>${o}</button>`)}
  </div>`;

export const Switch = ({ checked, onChange, disabled }) => html`
  <button role="switch" aria-checked=${checked} class=${'switch' + (checked ? ' on' : '')} disabled=${disabled}
    onClick=${(e) => { e.stopPropagation(); onChange(!checked); }}><span /></button>`;

export const SwitchRow = ({ title, caption, checked, onChange, disabled }) => html`
  <div class=${'switch-row' + (disabled ? ' disabled' : '')} onClick=${() => !disabled && onChange(!checked)}>
    <div class="grow"><div class="row-title">${title}</div>${caption && html`<div class="caption">${caption}</div>`}</div>
    <${Switch} checked=${checked} onChange=${onChange} disabled=${disabled} />
  </div>`;

export const IconTile = ({ icon, tone = 'blue', size = 'md' }) => html`
  <span class=${`icon-tile tone-${tone} tile-${size}`}><${Icon} name=${icon} size=${size === 'lg' ? 24 : 20} /></span>`;

export const Badge = ({ children, tone = 'blue' }) => html`<span class=${'badge tone-' + tone}>${children}</span>`;

export const Logo = ({ small }) => html`
  <div class=${'brand' + (small ? ' small' : '')}>
    <img src="img/logo.png" alt="" />
    <span class="brand-text"><span class="wordmark">Ratemi</span><span class="byline">Nazım Beşirli tarafından geliştirildi</span></span>
  </div>`;

// --- Sayı alanları ---

/** Dışarıdan gelen değerle yerel yazıyı eşitler; odaktayken kullanıcının yazdığına dokunmaz. */
function useFieldText(value, format, resetKey) {
  const [text, setText] = useState(value == null ? '' : format(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value == null ? '' : format(value)); }, [value, resetKey]);
  return [text, setText, focused];
}

/**
 * Sayı alanı. grouping: yazarken binlik nokta (1.250.000). Boş → null.
 * Yazarken imleç aynı rakamın arkasında kalır.
 */
export function NumberField({ value, onChange, placeholder = '', grouping = false, cls = '', resetKey, autoFocus, inputMode = 'decimal', id, onEnter }) {
  const fmt = (v) => (grouping ? groupTyping(String(Math.round(v * 100) / 100).replace('.', ',')) : editable(v).replace(/\./g, ''));
  const [text, setText, focused] = useFieldText(value, fmt, resetKey);
  const ref = useRef();
  useEffect(() => { if (autoFocus && ref.current) setTimeout(() => ref.current && ref.current.focus(), 60); }, []);
  const onInput = (e) => {
    const el = e.target;
    let t = el.value.replace(/\./g, grouping ? '' : '.');
    if (grouping) {
      const caret = el.selectionStart;
      const digitsBefore = el.value.slice(0, caret).replace(/[^\d,]/g, '').length;
      t = groupTyping(el.value);
      el.value = t;
      let pos = 0, seen = 0;
      while (pos < t.length && seen < digitsBefore) { if (/[\d,]/.test(t[pos])) seen++; pos++; }
      el.setSelectionRange(pos, pos);
    } else {
      t = el.value.replace(/[^\d,.\-]/g, '');
      if (t !== el.value) el.value = t;
    }
    setText(t);
    onChange(parseNumber(t));
  };
  return html`<input ref=${ref} id=${id} class=${'num-input ' + cls} type="text" inputmode=${inputMode} autocomplete="off"
    value=${text} placeholder=${placeholder}
    onFocus=${(e) => { focused.current = true; e.target.select(); }}
    onBlur=${() => { focused.current = false; setText(value == null ? '' : fmt(value)); }}
    onKeyDown=${(e) => { if (e.key === 'Enter' && onEnter) { e.target.blur(); onEnter(); } }}
    onInput=${onInput} />`;
}

/** Büyük tutar alanı (liste fiyatı, peşin tutar). */
export const BigAmountField = ({ label, value, onChange, tone = 'blue', resetKey, autoFocus }) => html`
  <label class=${'card big-amount tone-' + tone}>
    <span class="field-label">${label}</span>
    <span class="big-row"><span class="cur">₺</span>
      <${NumberField} value=${value} onChange=${onChange} grouping placeholder="0" cls="big" resetKey=${resetKey} autoFocus=${autoFocus} inputMode="numeric" />
    </span>
  </label>`;

export const FieldBox = ({ label, children, cls = '' }) => html`
  <label class=${'field-box ' + cls}><span class="field-label">${label}</span><span class="field-row">${children}</span></label>`;

/** Oran ⇄ tutar alanları (iskonto, peşinat): biri yazılınca diğeri hesaplanır. Boş gelir. */
export function AmountPercentFields({ value, base, onChange }) {
  const amount = value.percent ? base * value.amount / 100 : value.amount;
  const pct = base > 0 ? amount / base * 100 : 0;
  const empty = !(value.amount > 0);
  return html`
    <div class="ap-fields">
      <${FieldBox} label="Oran">
        <span class="unit">%</span>
        <${NumberField} value=${empty ? null : Math.round(pct * 100) / 100} placeholder="0" onChange=${(v) => onChange({ amount: v ?? 0, percent: true })} />
      </${FieldBox}>
      <${FieldBox} label="Tutar">
        <span class="unit">₺</span>
        <${NumberField} value=${empty ? null : Math.round(amount)} grouping placeholder="0" inputMode="numeric" onChange=${(v) => onChange({ amount: v ?? 0, percent: false })} />
      </${FieldBox}>
    </div>`;
}

/** Ay / oran / tutar alanı: üstte ▲ altta ▼; odakta değilken birimli gösterim. */
export function StepperField({ value, onChange, step, display, min = 0, max = Infinity, grouping, tone = 'blue', label }) {
  const [focus, setFocus] = useState(false);
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return html`
    <div class=${'stepper tone-' + tone} aria-label=${label}>
      <button class="st-btn" tabindex="-1" onClick=${() => onChange(clamp(Math.round((value + step) * 100) / 100))} aria-label="Artır"><${Icon} name="up" size=${14} stroke=${2.6} /></button>
      <div class="st-val" onFocusIn=${() => setFocus(true)} onFocusOut=${() => setFocus(false)}>
        ${focus
          ? html`<${NumberField} value=${value} grouping=${grouping} autoFocus onChange=${(v) => v != null && onChange(clamp(v))} />`
          : html`<button class="st-show" onClick=${() => setFocus(true)}>${display(value)}</button>`}
      </div>
      <button class="st-btn" tabindex="-1" onClick=${() => onChange(clamp(Math.round((value - step) * 100) / 100))} aria-label="Azalt"><${Icon} name="down" size=${14} stroke=${2.6} /></button>
    </div>`;
}

/** Tarih satırı: tarayıcının kendi takvimi. */
export const DateRow = ({ label, value, onChange, min }) => html`
  <label class="card date-row">
    <${IconTile} icon="calendar" />
    <span class="grow"><span class="field-label">${label}</span><span class="row-title">${dateLong(value)}</span></span>
    <input type="date" value=${DateX.iso(value)} min=${min != null ? DateX.iso(min) : undefined}
      onChange=${(e) => e.target.value && onChange(DateX.fromIso(e.target.value))} />
  </label>`;

// --- Pencere ---

/** Telefonda alttan açılan, bilgisayarda ortada duran pencere. */
export function Sheet({ onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('modal-open'); };
  }, []);
  return html`
    <div class="sheet-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class=${'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div class="sheet-grip" />
        <button class="sheet-close icon-btn" onClick=${onClose} aria-label="Kapat"><${Icon} name="close" /></button>
        <div class="sheet-body">${children}</div>
        ${footer && html`<div class="sheet-footer">${footer}</div>`}
      </div>
    </div>`;
}

export const SheetTitle = ({ children, caption }) => html`
  <div class="sheet-title"><h2>${children}</h2>${caption && html`<p class="caption">${caption}</p>`}</div>`;

export const GradHeader = ({ title, caption, value, grad = 'logo' }) => html`
  <div class=${'grad-header grad-' + grad}>
    <div class="grow"><div class="gh-title">${title}</div>${caption && html`<div class="gh-caption">${caption}</div>`}</div>
    ${value && html`<div class="gh-value">${value}</div>`}
  </div>`;

/** Üst çubuk (alt ekranlar). */
export const TopBar = ({ title, subtitle, onBack, onHome, children }) => html`
  <header class="topbar">
    ${onBack && html`<${IconButton} icon="back" label="Geri" onClick=${onBack} />`}
    <div class="grow tb-text"><h1>${title}</h1>${subtitle && html`<div class="caption ellipsis">${subtitle}</div>`}</div>
    <div class="tb-actions">${children}${onHome && html`<${IconButton} icon="home" label="Ana sayfa" onClick=${onHome} />`}</div>
  </header>`;

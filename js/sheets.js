// Pencereler: baz oran, tutar, blok, tek ödeme, satır düzenleme, hedef maliyet, ad, çakışma, şablondan plan, PDF.
import { html, useState } from '../vendor/preact-htm.js';
import { Finance, Kind, RowEdits, sortRows, payDate, DateX } from './finance.js';
import { money, moneyShort, percent, dateShort, dayShift, editable } from './format.js';
import {
  Sheet, SheetTitle, GradHeader, GradientButton, OutlineButton, NumberField, FieldBox, Chip, Segmented,
  SwitchRow, StepperField, DateRow, Badge, useApp,
} from './ui.js';

const monthlyFromAnnual = (a) => Math.pow(1 + a, 1 / 12) - 1;

/** Oran penceresi: aylık / yıllık basit / yıllık bileşik; biri yazılınca diğerleri hesaplanır. */
export function RateSheet({ title, caption, rate, onDone, onClose, grad = 'logo' }) {
  const [r, setR] = useState(rate);
  const [src, setSrc] = useState(0);
  const set = (i, v) => { if (v == null) return; setSrc(i); setR(i === 0 ? v / 100 : i === 1 ? v / 1200 : monthlyFromAnnual(v / 100)); };
  const vals = [r * 100, r * 1200, Finance.annualCompound(r) * 100];
  const nudge = (d) => setR(Math.max(0, Math.round((r + d) * 1e6) / 1e6));
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} grad=${grad} cls="full" onClick=${() => onDone(r)}>Tamam</${GradientButton}>`}>
      <${GradHeader} grad=${grad} title=${title} caption=${caption} value=${percent(r)} />
      <div class="rate-boxes">
        ${['Aylık', 'Yıllık basit', 'Yıllık bileşik'].map((l, i) => html`
          <${FieldBox} label=${l} cls=${src === i ? 'active' : ''}>
            <span class="unit">%</span>
            <${NumberField} value=${Math.round(vals[i] * 10000) / 10000} resetKey=${src === i ? 'self' : r} autoFocus=${i === 0} onChange=${(v) => set(i, v)} onEnter=${() => onDone(r)} />
          </${FieldBox}>`)}
      </div>
      <div class="nudges">
        ${[-0.001, -0.0001, 0.0001, 0.001].map((d) => html`<button class="chip" onClick=${() => { setSrc(-1); nudge(d); }}>${d > 0 ? '+' : '−'}${editable(Math.abs(d) * 100)}</button>`)}
      </div>
      <div class="chips-wrap">
        ${[0.0199, 0.0249, 0.0299, 0.0349, 0.0399, 0.0449].map((v) => html`<${Chip} label=${percent(v)} selected=${Math.abs(r - v) < 1e-9} onClick=${() => { setSrc(-1); setR(v); }} />`)}
      </div>
    </${Sheet}>`;
}

/** Tek tutar penceresi (peşinat, şablon liste fiyatı). Boş gelir. */
export function AmountSheet({ title, caption, value, onDone, onClose, grad = 'logo', button = 'Tamam' }) {
  const [v, setV] = useState(null);
  const done = () => onDone(v ?? (value || null));
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} grad=${grad} cls="full" onClick=${done}>${button}</${GradientButton}>`}>
      <${GradHeader} grad=${grad} title=${title} caption=${caption} value=${value > 0 ? moneyShort(value) : null} />
      <${FieldBox} label="Tutar">
        <span class="unit">₺</span>
        <${NumberField} value=${null} grouping placeholder=${value > 0 ? moneyShort(value).slice(1) : '0'} inputMode="numeric" autoFocus onChange=${setV} onEnter=${done} />
      </${FieldBox}>
    </${Sheet}>`;
}

/** Blok ödeme: "X.–Y. ay arası aylık tutar". */
export function BlockSheet({ from, to, amount, onDone, onDelete, onClose }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [a, setA] = useState(amount ?? null);
  const ok = a > 0 && f >= 1 && t >= f;
  return html`
    <${Sheet} onClose=${onClose} footer=${html`
      <div class="btn-row">
        ${onDelete && html`<${OutlineButton} color="var(--red)" icon="trash" onClick=${onDelete}>Sil</${OutlineButton}>`}
        <${GradientButton} cls="grow" disabled=${!ok} onClick=${() => onDone(f, t, a)}>${onDelete ? 'Kaydet' : 'Ekle'}</${GradientButton}>
      </div>`}>
      <${SheetTitle} caption=${ok ? `${t - f + 1} ay × ${money(a)} = ${money((t - f + 1) * a)}` : 'Bu aylardaki taksitlerin yerine geçer.'}>Blok ödeme</${SheetTitle}>
      <div class="two-col">
        <${FieldBox} label="Başlangıç ayı"><${StepperField} value=${f} step=${1} min=${1} max=${360} display=${(v) => `${v}. ay`} onChange=${(v) => { setF(v); if (t < v) setT(v); }} /></${FieldBox}>
        <${FieldBox} label="Bitiş ayı"><${StepperField} value=${t} step=${1} min=${1} max=${360} display=${(v) => `${v}. ay`} onChange=${(v) => setT(Math.max(v, f))} /></${FieldBox}>
      </div>
      <${FieldBox} label="Aylık tutar"><span class="unit">₺</span><${NumberField} value=${a} grouping placeholder="0" inputMode="numeric" autoFocus=${!amount} onChange=${setA} /></${FieldBox}>
    </${Sheet}>`;
}

/** Tek ödeme (teklif / dizi). */
export function SingleSheet({ month, amount, onDone, onDelete, onClose }) {
  const [m, setM] = useState(month ?? 6);
  const [a, setA] = useState(amount ?? null);
  return html`
    <${Sheet} onClose=${onClose} footer=${html`
      <div class="btn-row">
        ${onDelete && html`<${OutlineButton} color="var(--red)" icon="trash" onClick=${onDelete}>Sil</${OutlineButton}>`}
        <${GradientButton} cls="grow" disabled=${!(a > 0)} onClick=${() => onDone(m, a)}>${onDelete ? 'Kaydet' : 'Ekle'}</${GradientButton}>
      </div>`}>
      <${SheetTitle} caption="Belirli bir aydaki tek seferlik ödeme">Tek ödeme</${SheetTitle}>
      <div class="two-col">
        <${FieldBox} label="Ay"><${StepperField} value=${m} step=${1} min=${0} max=${360} tone="teal" display=${(v) => `${v}. ay`} onChange=${setM} /></${FieldBox}>
        <${FieldBox} label="Tutar"><span class="unit">₺</span><${NumberField} value=${a} grouping placeholder="0" inputMode="numeric" autoFocus=${!amount} onChange=${setA} /></${FieldBox}>
      </div>
    </${Sheet}>`;
}

export function NameSheet({ title, value, button = 'Kaydet', onDone, onClose }) {
  const [v, setV] = useState(value || '');
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} cls="full" disabled=${!v.trim()} onClick=${() => onDone(v.trim())}>${button}</${GradientButton}>`}>
      <${SheetTitle}>${title}</${SheetTitle}>
      <${FieldBox} label="Ad">
        <input class="text-input" value=${v} autofocus onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && v.trim() && onDone(v.trim())} ref=${(el) => el && setTimeout(() => el.focus(), 60)} />
      </${FieldBox}>
    </${Sheet}>`;
}

export function ConflictSheet({ skip, onDone, onClose }) {
  const Opt = ({ val, title, caption }) => html`
    <button class=${'option' + (skip === val ? ' on' : '')} onClick=${() => onDone(val)}>
      <span class="grow"><span class="row-title">${title}</span><span class="caption">${caption}</span></span><span class="radio" />
    </button>`;
  return html`
    <${Sheet} onClose=${onClose}>
      <${SheetTitle} caption="Ara ödeme bir taksit ayına denk geliyor.">Ara ödeme ayında ne olsun?</${SheetTitle}>
      <${Opt} val=${false} title="Taksit + ara ödeme birlikte" caption="O ay iki ödeme yapılır" />
      <${Opt} val=${true} title="O ayın taksiti pas geçilsin" caption="O ay yalnız ara ödeme yapılır" />
    </${Sheet}>`;
}

export function TargetCostSheet({ current, onDone, onClose }) {
  const [pct, setPct] = useState(Math.round(current * 10000) / 100);
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} cls="full" disabled=${pct == null} onClick=${() => onDone(pct)}>Taksitleri yeniden hesapla</${GradientButton}>`}>
      <${SheetTitle} caption=${`Kilitsiz taksitler bu maliyete göre yeniden hesaplanır; kilitli satırlar değişmez. Şu an ${percent(current)}.`}>Hedef maliyet oranı</${SheetTitle}>
      <${FieldBox} label="Maliyet oranı (%)"><span class="unit">%</span><${NumberField} value=${pct} autoFocus onChange=${setPct} onEnter=${() => pct != null && onDone(pct)} /></${FieldBox}>
    </${Sheet}>`;
}

/** Satır penceresi: tutar, ödeme günü, kilit; değişiklik varsa ikinci adımda kapsam. */
export function RowEditSheet({ p, rows, start, rate, target, onApply, onDelete, onClose }) {
  const [amount, setAmount] = useState(null);
  const [shift, setShift] = useState(p.shiftDays);
  const [locked, setLocked] = useState(p.locked);
  const [choosing, setChoosing] = useState(false);
  const baseDate = DateX.plusMonths(start, p.month);
  const changed = amount != null && amount !== p.amount ? amount : null;
  const edited = { ...p, amount: changed ?? p.amount, shiftDays: shift, locked: locked || changed != null };
  const others = rows.filter((r) => !r.locked && r.id !== p.id && r.kind === Kind.INSTALLMENT).length;
  const title = p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.INTERIM ? `${p.month}. ay ara ödemesi` : p.kind === Kind.GRACE ? `${p.month}. ay (ödemesiz)` : `${p.month}. ay taksiti`;
  const apply = (scope) => onApply(changed, shift, locked || changed != null, scope);

  if (choosing) return html`<${ScopeStep} ...${{ p, rows, rate, target, amount: changed, shift, locked: locked || changed != null, onBack: () => setChoosing(false), onApply: apply, onClose }} />`;

  const freeBefore = rows.find((r) => !r.locked && r.id !== p.id)?.amount;
  const b = Finance.rebalance(rows.map((r) => (r.id === p.id ? edited : r)), rate, target);
  const freeAfter = b.ok ? b.rows.find((r) => !r.locked && r.id !== p.id)?.amount : null;
  const free = rows.filter((r) => !r.locked && r.id !== p.id).length;
  const next = () => {
    if ((p.kind === Kind.INSTALLMENT || p.kind === Kind.GRACE) && others > 0 && (changed != null || shift !== p.shiftDays)) setChoosing(true);
    else apply({ type: 'only' });
  };
  return html`
    <${Sheet} onClose=${onClose} footer=${html`
      <div class="btn-row">
        <${OutlineButton} color="var(--red)" icon="trash" onClick=${onDelete}>Satırı sil</${OutlineButton}>
        <${GradientButton} cls="grow" onClick=${next}>Uygula</${GradientButton}>
      </div>`}>
      <${SheetTitle} caption=${'Baz tarih ' + dateShort(baseDate)}>${title}</${SheetTitle}>
      <${FieldBox} label="Tutar">
        <span class="unit">₺</span>
        <${NumberField} value=${p.amount} grouping cls="strong" onChange=${setAmount} />
        ${!p.locked && changed == null && html`<${Badge}>otomatik</${Badge}>`}
      </${FieldBox}>
      <p class="caption">${changed != null ? 'Tutarı değiştirdin; satır kilitlenecek.' : 'Tutarı değiştirirsen satır kendiliğinden kilitlenir.'}</p>
      <${DateRow} label="Ödeme günü" value=${baseDate + shift} onChange=${(d) => setShift(d - baseDate)} />
      ${shift !== 0 && html`<p class="caption amber">Baz tarihe göre ${dayShift(shift)}</p>`}
      ${!b.ok ? html`<p class="caption red">Bu değişiklikle kilitli ödemeler hedefi aşar.</p>`
        : freeBefore != null && freeAfter != null && free > 0 && freeBefore !== freeAfter
          ? html`<p class="caption amber">Fark diğer ${free} serbest taksite dağılır: her biri ${money(freeBefore)} → ${money(freeAfter)}.</p>` : null}
      <div class="card flat"><${SwitchRow} title="Satırı kilitle" caption="Dengelerken bu tutar değişmez" checked=${locked || changed != null} onChange=${setLocked} /></div>
    </${Sheet}>`;
}

function ScopeStep({ p, rows, rate, target, amount, shift, locked, onBack, onApply, onClose }) {
  const months = rows.filter((r) => r.kind === Kind.INSTALLMENT).map((r) => r.month);
  const last = months.length ? Math.max(...months) : p.month;
  const first = months.length ? Math.min(...months) : p.month;
  const [choice, setChoice] = useState(0);
  const [from, setFrom] = useState(Math.min(p.month + 1, last));
  const [to, setTo] = useState(last);
  const scope = [{ type: 'only' }, { type: 'after' }, { type: 'range', from: Math.min(from, to), to: Math.max(from, to) }, { type: 'all' }][choice];
  const count = (s) => RowEdits.affected(rows, p.id, s).length;
  const changes = [amount != null && `tutar ${money(amount)}`, shift !== p.shiftDays && `ödeme günü ${dayShift(shift - p.shiftDays)}`].filter(Boolean).join(' · ');
  const after = RowEdits.apply(rows, p.id, amount, shift, locked, scope);
  const b = Finance.rebalance(sortRows(after), rate, target);
  const freeLeft = after.filter((r) => !r.locked && r.kind === Kind.INSTALLMENT);
  const affectedIds = new Set(RowEdits.affected(rows, p.id, scope).map((r) => r.id));
  const freeBefore = rows.find((r) => !r.locked && r.kind === Kind.INSTALLMENT && r.id !== p.id && !affectedIds.has(r.id))?.amount;
  const freeAfter = b.ok && freeLeft[0] ? b.rows.find((r) => r.id === freeLeft[0].id)?.amount : null;
  const Opt = ({ i, title, caption }) => html`
    <button class=${'option' + (choice === i ? ' on' : '')} onClick=${() => setChoice(i)}>
      <span class="grow"><span class="row-title">${title}</span><span class="caption">${caption}</span></span><span class="radio" />
    </button>`;
  const affected = count(scope);
  return html`
    <${Sheet} onClose=${onClose} footer=${html`
      <div class="btn-row"><${OutlineButton} icon="back" onClick=${onBack}>Geri</${OutlineButton}><${GradientButton} cls="grow" onClick=${() => onApply(scope)}>Uygula</${GradientButton}></div>`}>
      <${SheetTitle} caption=${`${p.month}. ay: ${changes}`}>Değişiklik nereye uygulansın?</${SheetTitle}>
      <${Opt} i=${0} title="Yalnız bu satır" caption=${`${p.month}. ay`} />
      <${Opt} i=${1} title="Bu taksitten sonrakiler" caption=${`${p.month + 1}.–${last}. ay · ${count({ type: 'after' })} kilitsiz taksit`} />
      <${Opt} i=${2} title="Seçtiğim aralık" caption=${choice === 2 ? `${affected} kilitsiz taksit` : 'Başlangıç ve bitiş ayını seç'} />
      ${choice === 2 && html`
        <div class="range-row">
          <${StepperField} value=${from} step=${1} min=${first} max=${last} display=${(v) => `${v}. ay`} onChange=${setFrom} />
          <span class="arrow">→</span>
          <${StepperField} value=${to} step=${1} min=${first} max=${last} display=${(v) => `${v}. ay`} onChange=${setTo} />
        </div>`}
      <${Opt} i=${3} title="Tüm kilitsiz taksitler" caption=${`${count({ type: 'all' })} kilitsiz taksit`} />
      <div class=${'impact ' + (!freeLeft.length || !b.ok ? 'bad' : 'warn')}>
        <strong>${affected === 0 ? `Yalnız ${p.month}. ay değişir.` : `${p.month}. ay ve ${affected} taksit daha değişir.`}</strong>
        <span>${!b.ok ? 'Bu değişiklikle kilitli ödemeler hedefi aşar.'
          : !freeLeft.length ? 'Dengelenecek kilitsiz taksit kalmıyor; maliyet oranı değişebilir.'
            : freeBefore != null && freeAfter != null && freeBefore !== freeAfter ? `Kalan ${freeLeft.length} serbest taksit: ${money(freeBefore)} → ${money(freeAfter)}`
              : `Kalan ${freeLeft.length} serbest taksit; maliyet oranı aynı kalır.`}</span>
      </div>
    </${Sheet}>`;
}

/** PDF penceresi: isteğe bağlı bilgiler ve maliyet analizi anahtarı; "PDF oluştur" yazdırma penceresini açar. */
export function ShareSheet({ onPrint, onClose, kind = 'plan' }) {
  const app = useApp();
  const [f, setF] = useState(app.shareFields);
  const set = (k) => (e) => { const v = e.target.value; setF((x) => ({ ...x, [k]: v })); };
  const T = ({ k, label, mode }) => html`<label class="field-box"><span class="field-label">${label}</span><input class="text-input" inputmode=${mode} value=${f[k] || ''} onInput=${set(k)} /></label>`;
  const go = () => { app.setShareFields(f); onPrint(f); };
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} cls="full" icon="printer" grad=${kind === 'offer' ? 'offer' : kind === 'conv' ? 'conv' : 'logo'} onClick=${go}>PDF oluştur ve paylaş</${GradientButton}>`}>
      <${SheetTitle} caption="Açılan pencerede “PDF olarak kaydet”i seç. Alanlar isteğe bağlı; yalnız girilenler PDF'te görünür.">PDF</${SheetTitle}>
      <div class="share-grid g2"><${T} k="name" label="Ad soyad" /><${T} k="project" label="Proje" /></div>
      ${kind === 'plan' && html`
        <div class="share-grid g3"><${T} k="block" label="Blok" /><${T} k="floor" label="Kat" /><${T} k="unit" label="Daire no" /></div>
        <div class="share-grid g2"><${T} k="type" label="Daire tipi" /><${T} k="area" label="Brüt m²" mode="decimal" /></div>
        <div class="card flat"><${SwitchRow} title="Maliyet analizini dahil et" caption="NBD, baz oran ve maliyet oranı" checked=${f.analysis !== false} onChange=${(v) => setF({ ...f, analysis: v })} /></div>`}
      <p class="caption">Hazırlayan: ${app.settings.salesRep || '— (Ayarlar › PDF)'}</p>
    </${Sheet}>`;
}

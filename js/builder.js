// Ödeme planı. Telefon ve dar ekranda adım adım (30 Ekim 2026): 1 Ürün ve fiyat, 2 Peşinat ve ara ödemeler, 3 Vade,
// 4 Aylık vade farkı, 5 Plan; üstteki sekmelerle serbest geçiş, 1–4'te altta ince özet ve Geri / İleri.
// Masaüstünde (WIDE ve üstü) tek sayfa: solda dört girdi bölümü alt alta, sağda anında oluşan plan.
// Her değişiklik planı anında yeniden hesaplar; kayıt isteğe bağlı ("Kaydet"), şablon ayrı düğmeyle.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Finance, Kind, Schedules, basePrice, valueOf, firstInstallmentMonth, payDate, period, DateX, isCash, noTerm, creditAmount, SavingsFinance, savingsAmount, customerRows, customerStats, costBreakdown } from './finance.js';
import { money, moneyShort, percent, dateMid, dayShift, editable } from './format.js';
import {
  Icon, IconButton, GradientButton, OutlineButton, TextAction, Chip, Segmented, SwitchRow, Badge,
  NumberField, FieldBox, AmountPercentFields, StepperField, TopBar, useApp,
  Switch,
} from './ui.js';
import { RateSheet, BlockSheet, NameSheet, TargetCostSheet, RowEditSheet, ShareSheet, LoanSheet, SavingsSheet } from './sheets.js';
import { BaseRatePill } from './screens.js';

const priceStep = (v) => (v >= 10e6 ? 50000 : v >= 1e6 ? 10000 : v >= 1e5 ? 1000 : v >= 1e4 ? 100 : 10);
const yearsText = (m) => (m % 12 === 0 ? `${m / 12} yıl` : m > 12 ? `${Math.floor(m / 12)} yıl ${m % 12} ay` : '');
const TYPES = [['HOUSING', 'Konut', false], ['VEHICLE', 'Taşıt', true], ['PERSONAL', 'İhtiyaç', true]];
// Adım adları: geniş ekranda uzun, telefonda kısa (Banka = banka kredisi, Firma = firma kredisi: vade + vade farkı).
const STEPS = ['Ürün', 'Peşinat', 'Banka kredisi', 'Tahsisat', 'Firma kredisi', 'Firma kredisi', 'Plan'];
const STEPS_SHORT = ['Ürün', 'Peşinat', 'Banka', 'Tahsisat', 'Firma', 'Firma', 'Plan'];
const PLAN = 6;
// Adım sekmelerindeki simgeler (bölüm başlıklarıyla aynı); 6 = plan.
const STEP_ICON = ['house', 'download', 'bank', 'savings', 'building', 'building', 'table'];
const WIDE = '(min-width: 1100px)';

/** Ekran masaüstü genişliğinde mi (pencere boyutu değişince güncellenir). */
function useWide() {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const m = matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export function PlanBuilderScreen() {
  const app = useApp();
  const plan = app.plan;
  const input = plan.input;
  const ready = input.listPrice > 0;
  const a = app.analyzePlan(plan);
  const set = (patch) => app.updateInput({ ...input, ...patch });
  const ops = app.planOps;

  const save = () => app.sheet(html`<${NameSheet} title=${plan.id ? 'Planı farklı kaydet' : 'Planı kaydet'} value=${plan.name || app.autoName(input)}
    onClose=${app.closeSheet} onDone=${(n) => { app.closeSheet(); app.savePlan(n, true); }} />`);
  const saveTpl = () => app.sheet(html`<${NameSheet} title="Şablon olarak kaydet"
    value=${`${input.months} ay ${percent(input.rate)}` + (input.down.amount > 0 && input.down.percent ? ` · %${editable(input.down.amount)} peşinat` : '')}
    onClose=${app.closeSheet} onDone=${(n) => { app.closeSheet(); ops.saveTemplate(n); }} />`);
  const share = () => app.sheet(html`<${ShareSheet} kind="plan" onClose=${app.closeSheet} onPrint=${(f) => { app.closeSheet(); app.print({ kind: 'plan', plan, a, fields: f }); }} />`);
  const status = !plan.id ? 'Kaydedilmedi' : app.dirty ? 'Kaydedilmemiş değişiklik var' : 'Kayıtlı';

  const wide = useWide();
  // Masaüstünde aç-kapa bölümler: tek bölüm açık (başta Ürün).
  const [openSec, setOpenSec] = useState(0);
  // Peşin satışta vade ve oran adımları yok: Ürün → Peşinat → Plan.
  const cash = isCash(input);
  // Peşin satışta kredi / vade / oran yok; kredi kalanı karşılıyorsa vade / oran yok; Ayarlar'da kredi kapalıysa Kredi adımı yok.
  // Ayarlar'da kredi / tahsisat kapalıysa o adım yok (girilmiş planda kaldırılabilsin diye kalır).
  const visible = cash ? [0, 1, PLAN] : [
    0, 1,
    ...(app.settings.creditEnabled !== false || input.credit ? [2] : []),
    ...(app.settings.savingsEnabled !== false || input.savings ? [3] : []),
    ...(noTerm(input) ? [] : [4]),
    PLAN,
  ];
  const step = visible.includes(app.planStep) ? app.planStep : PLAN;
  const goStep = app.setPlanStep;
  const at = Math.max(0, visible.indexOf(step));
  const next = visible[at + 1] ?? PLAN;

  // Plan bölümü (5. adım ya da masaüstünde sağ sütun).
  const result = !ready ? html`
      <div class="empty-result card">
        <span class="icon-tile tile-lg tone-blue"><${Icon} name="table" size=${24} /></span>
        <div class="row-title">Liste fiyatını gir</div>
        <p class="caption">${wide ? 'Plan burada anında oluşur. Oranı, vadeyi, peşinatı değiştirdikçe tablo ve maliyet kendiliğinden güncellenir.' : 'Plan, 1. adımda liste fiyatı girilince oluşur.'}</p>
      </div>`
    : html`
      <div class="b-actions">
        <${GradientButton} cls="grow" icon="check" disabled=${!!plan.id && !app.dirty} onClick=${() => (plan.id ? app.savePlan(plan.name, false) : save())}>
          ${!plan.id ? 'Kaydet' : app.dirty ? 'Değişiklikleri kaydet' : 'Kaydedildi'}
        </${GradientButton}>
        ${plan.id ? html`<${OutlineButton} onClick=${save}>Farklı kaydet</${OutlineButton}>` : null}
        <${IconButton} icon="bookmark" label="Şablon olarak kaydet" cls="filled" onClick=${saveTpl} />
        <${IconButton} icon="printer" label="PDF" cls="filled" onClick=${share} />
      </div>
      <${ResultPanel} plan=${plan} a=${a} />`;

  if (wide) {
    return html`
      <div class="screen builder">
        <${TopBar} title="Ödeme planı" subtitle=${plan.id ? `${plan.name} · ${status}` : status} onBack=${app.back}>
          <${IconButton} icon="undo" label="Geri al" disabled=${!ops.canUndo} onClick=${ops.undo} />
          <${IconButton} icon="restore" label="Yeni plan (sıfırla)" onClick=${app.resetPlan} />
        </${TopBar}>
        <div class="content builder-wide">
          <section class="b-inputs">
            ${visible.filter((i) => i < PLAN).map((i, pos, list) => html`<${Accordion} key=${i} i=${i} pos=${pos} a=${a} input=${input} set=${set}
              open=${openSec === i} onOpen=${() => setOpenSec(openSec === i ? -1 : i)} />`)}
          </section>
          <section class="b-result">${result}</section>
        </div>
      </div>`;
  }

  return html`
    <div class="screen builder">
      <${TopBar} title="Ödeme planı" subtitle=${plan.id ? `${plan.name} · ${status}` : status} onBack=${app.back}>
        <${IconButton} icon="undo" label="Geri al" disabled=${!ops.canUndo} onClick=${ops.undo} />
        <${IconButton} icon="restore" label="Yeni plan (sıfırla)" onClick=${app.resetPlan} />
      </${TopBar}>
      <div class="step-tabs">
        ${visible.map((i, pos) => html`
          <button key=${i} class=${'st-tab' + (i === step ? ' on' : i < step ? ' done' : '')} disabled=${i > 0 && !ready} onClick=${() => i !== step && goStep(i)}>
            <span class="st-no"><${Icon} name=${STEP_ICON[i]} size=${15} /></span><span class="st-name"><span class="st-long">${STEPS[i]}</span><span class="st-short">${STEPS_SHORT[i]}</span></span>
          </button>`)}
      </div>
      <div class="content builder">
        ${step < PLAN ? html`
          ${step < 5 && html`<${SecHead} i=${step} pos=${visible.indexOf(step)} a=${a} input=${input} set=${set} chevron=${false} />`}
          <${InputsPanel} input=${input} set=${set} step=${step} />
          <div class="step-footer">
            ${ready && (a.schedule.overflow
              ? html`<div class="alert small">Peşinat ve ara ödemelerin bugünkü değeri hedefi ${moneyShort(a.schedule.overflow.excess)} aşıyor.</div>`
              : step === 3 && a.savings ? html`<div class="step-summary two">
                  <span class="w"><small>Tahsisat</small><strong>${a.savings.allocationMonth}. ay · ${dateMid(DateX.plusMonths(input.startDate, a.savings.allocationMonth))}</strong></span>
                  <span><small>Tahsisat maliyeti</small><strong>${percent(a.savings.amount > 0 ? a.allocationCost / a.savings.amount : 0)}</strong></span>
                  <span class="w"><small>Müşteri taksiti</small><strong>${moneyShort(a.savings.firstPayment)} × ${a.savings.months} ay${a.savings.growth > 0 ? ' ↑' : ''}</strong></span>
                  <span><small>Plan maliyeti</small><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong></span>
                </div>`
              : cash ? html`<div class="step-summary">
                  <span><small>Peşin satış</small><strong>${moneyShort(basePrice(input))}</strong></span>
                  <span><small>Maliyet</small><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong></span>
                  <span><small>Vade</small><strong>Yok</strong></span>
                </div>`
              : html`<div class="step-summary">
                  <span><small>Maliyet</small><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong></span>
                  ${a.installmentCount > 0 ? html`<span><small>${a.installmentCount} × taksit</small><strong>${a.installment != null ? moneyShort(a.installment) : '—'}</strong></span>`
                    : a.savings && !a.loan ? html`<span><small>Tahsisat (${a.savings.allocationMonth}. ay)</small><strong>${moneyShort(a.savings.amount)}</strong></span>`
                    : html`<span><small>Banka kredisi</small><strong>${a.loan ? moneyShort(a.loan.principal) : '—'}</strong></span>`}
                  <span><small>Toplam</small><strong>${moneyShort(a.total)}</strong></span>
                </div>`)}
            <div class="btn-row">
              ${at > 0 && html`<${OutlineButton} icon="back" onClick=${() => goStep(visible[at - 1])}>Geri</${OutlineButton}>`}
              <${GradientButton} cls="grow" trailing="forward" disabled=${!ready} onClick=${() => goStep(next)}>${next === PLAN ? 'Planı göster' : 'İleri'}</${GradientButton}>
            </div>
          </div>`
        : result}
      </div>
    </div>`;
}

// --- Bölümler: başlık (masaüstünde aç-kapa, telefonda adımın üstünde) ve simgeli bloklar ---

const SEC_TITLES = ['Ürün ve fiyat', 'Peşinat ve ara ödemeler', 'Banka kredisi', 'Tahsisat', 'Firma kredisi'];
const SEC_COST = ['discount', 'downInterim', 'bank', 'allocation', 'firm'];
// Her bölümün tonu (mavi ailesi): ince sol çizgi, blok simgesi, açık bölümün zemini.
const SEC_TONE = ['indigo', 'sky', 'blue', 'turq', 'petrol'];
const SEC_ICON = ['house', 'download', 'bank', 'savings', 'building'];
const pctOf = (v, base) => (base > 0 ? '%' + editable(Math.round(v / base * 10000) / 100) : '—');

/** Başlıktaki iki satırlık gruplu özet; değerler vurgulu. */
function secLines(i, a, input) {
  const base = basePrice(input);
  if (!(input.listPrice > 0)) return i === 0 ? [html`Liste fiyatını gir`, ''] : ['', ''];
  const em = (t) => html`<em>${t}</em>`;
  const b = a.schedule.overflow ? null : costBreakdown(a);
  const down = valueOf(input.down, base);
  const sv = a.savings, loan = a.loan;
  const typeName = TYPES.find((x) => x[0] === input.loanType)?.[1] || '';
  switch (i) {
    case 0: return [html`${typeName} · liste ${em(moneyShort(input.listPrice))}`,
      input.discountOn && input.listPrice - base > 0.5 ? html`İskonto ${pctOf(input.listPrice - base, input.listPrice)} → kampanyalı ${em(moneyShort(base))}` : 'İskonto yok'];
    case 1: {
      const total = input.interims.reduce((t, x) => t + valueOf(x.value, base), 0);
      return [html`Peşinat ${em(`${pctOf(down, base)} · ${moneyShort(down)}`)}`,
        input.interims.length ? html`${input.interims.length} ara ödeme · ${em(moneyShort(total))}` : 'Ara ödeme yok'];
    }
    case 2: return loan ? [html`Kredi ${em(`${pctOf(loan.principal, base)} · ${moneyShort(loan.principal)}`)}`, html`${em(`${loan.months} × ${moneyShort(loan.payment)}`)} · kâr payı ${percent(loan.rate)}`] : ['Kapalı', 'Açınca kampanyalı fiyatın %20’si'];
    case 3: if (sv && sv.existing) return [html`Mevcut tahsisat ${em(moneyShort(sv.amount))} · ${em(`${sv.allocationMonth}. ay`)}`, `${dateMid(DateX.plusMonths(input.startDate, sv.allocationMonth))} · firmaya tek seferde`];
      return sv ? [html`Sözleşme ${em(moneyShort(sv.amount))} · ${em(`${sv.allocationMonth}. ay`)} (${dateMid(DateX.plusMonths(input.startDate, sv.allocationMonth))})`, html`${em(`${sv.months} × ${moneyShort(sv.firstPayment)}`)}${sv.growth > 0 ? ' ↑' : ''} · tasarruf şirketine`] : ['Kapalı', 'Açınca kampanyalı fiyatın %20’si'];
    default: return b ? [html`Kalan ${em(`${pctOf(b.firmFinanced, base)} · ${moneyShort(b.firmFinanced)}`)}`, a.installmentCount ? html`${em(`${a.installmentCount} × ${a.installment != null ? moneyShort(a.installment) : '—'}`)} · vade farkı ${percent(input.rate)}` : 'Taksit yok'] : ['', ''];
  }
}

/** Bölüm başlığı (sabit yükseklik): sol ton çizgisi, simge (açıkken ters: beyaz zeminde koyu), ad + iki satır özet, maliyet hapı, anahtar, ok. */
function SecHead({ i, pos, a, input, set, open, onOpen, chevron = true }) {
  const ready = input.listPrice > 0;
  const b = ready && !a.schedule.overflow ? costBreakdown(a) : null;
  const cost = b ? b[SEC_COST[i]] : 0;
  const [l1, l2] = secLines(i, a, input);
  const toggle = chevron && (i === 2 || i === 3);
  const on = i === 2 ? !!input.credit : !!input.savings;
  const setOn = (v) => {
    if (i === 2) set({ credit: v ? { amount: { amount: 20, percent: true }, months: input.loanType === 'HOUSING' ? 120 : 36, rate: 0.0249, subsidized: false, bankRate: 0.0249 } : null });
    else set({ savings: v ? { amount: { amount: 20, percent: true }, down: { amount: 0, percent: true }, months: 53, feeRate: 0.07, feeInstallments: 4, growth: 0, allocationMonth: null } : null });
    if (onOpen && v !== open) onOpen();
  };
  const Tag = onOpen ? 'button' : 'div';
  return html`
    <${Tag} class=${'sec-head tone-' + SEC_TONE[i] + (open ? ' open' : '')} onClick=${onOpen} aria-expanded=${onOpen ? open : undefined}>
      <span class="sh-bar" />
      <span class="sh-ic"><${Icon} name=${SEC_ICON[i]} size=${18} /></span>
      <span class="sh-t"><strong>${SEC_TITLES[i]}</strong><span>${l1}</span><span>${l2}</span></span>
      ${b && (Math.abs(cost) >= 1 || i === 4) && html`<span class="sh-cost">maliyet ${cost < -0.5 ? '−' : ''}${percent(Math.abs(b.ratio(cost)))}</span>`}
      ${toggle && html`<span class="sh-switch" onClick=${(e) => e.stopPropagation()}><${Switch} checked=${on} onChange=${setOn} /></span>`}
      ${chevron && html`<span class="sh-chev"><${Icon} name=${open ? 'up' : 'down'} size=${18} /></span>`}
    </${Tag}>`;
}

/** Masaüstü aç-kapa bölüm: başlık + (açıksa) bölümün tonlu zemininde simgeli bloklar. */
function Accordion({ i, pos, a, input, set, open, onOpen }) {
  const ref = useRef(null);
  // Açılınca başlık, girdi sütununun en üstünde görünsün (içerik altına doğru açılır).
  useEffect(() => {
    if (!open || !ref.current) return;
    const col = ref.current.closest('.b-inputs');
    // Önceki bölüm kapanıp yerleşim oturduktan sonra (sütun, bölümün konum kökü).
    const t = setTimeout(() => {
      if (!ref.current) return;
      if (col) col.scrollTop = ref.current.offsetTop - 2;
      else ref.current.scrollIntoView({ block: 'start' });
    }, 30);
    return () => clearTimeout(t);
  }, [open]);
  return html`
    <div ref=${ref} class=${'acc tone-' + SEC_TONE[i] + (open ? ' open' : '')}>
      <${SecHead} i=${i} pos=${pos} a=${a} input=${input} set=${set} open=${open} onOpen=${onOpen} />
      ${open && html`<div class="acc-body"><${InputsPanel} input=${input} set=${set} step=${i} /></div>`}
    </div>`;
}

/** Simgeli blok: tonlu simge, başlık, kısa açıklama, sağda isteğe bağlı öğe (anahtar), altında içerik. */
function Blk({ icon, title, caption, right, children }) {
  return html`
    <div class="blk">
      <div class="blk-h"><span class="blk-ic"><${Icon} name=${icon} size=${16} /></span><span class="blk-t"><strong>${title}</strong>${caption && html`<small>${caption}</small>`}</span>${right}</div>
      ${children}
    </div>`;
}

/** − değer + kutusu (vade, oran, ödemesiz dönem). */
const Stepper = ({ value, onMinus, onPlus, onValue, caption, unit }) => html`
  <div class="b-ctl">
    <div class="b-stepper">
      <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${onMinus} />
      ${onValue ? html`<button class="bs-rate" onClick=${onValue} title="Klavyeyle gir">${value}</button>` : html`<span class="bs-plain">${value}${unit && html`<small>${unit}</small>`}</span>`}
      <${IconButton} icon="add" label="Artır" cls="filled" onClick=${onPlus} />
    </div>
    ${caption && html`<div class="caption center">${caption}</div>`}
  </div>`;

// --- Girdi adımları (yalnız [step] adımı çizilir) ---

function InputsPanel({ input, set, step }) {
  const app = useApp();
  const base = basePrice(input);
  const housing = input.loanType === 'HOUSING';
  const t = app.settings.taxes[input.loanType];
  const discount = input.discountOn ? valueOf(input.discount, input.listPrice) : 0;
  const effective = Schedules.rate(input, app.settings.taxes);
  const first = firstInstallmentMonth(input);
  const conflict = Schedules.hasConflict(input);
  const setInterim = (i, x) => set({ interims: input.interims.map((y, j) => (j === i ? x : y)) });
  const rateSheet = () => app.sheet(html`<${RateSheet} title="Aylık vade farkı oranı" rate=${input.rate} onClose=${app.closeSheet}
    onDone=${(r) => { app.closeSheet(); set({ rate: r }); }} />`);
  const wrap = (body) => html`<div class=${'sec-body tone-' + SEC_TONE[step === 5 ? 4 : step]}>${body}</div>`;

  if (step === 0) return wrap(html`
    <${Blk} icon="house" title="Ürün türü" caption="vergi ve yasal sınırlar buna göre">
      <${Segmented} options=${TYPES.map((x) => x[1])} index=${TYPES.findIndex((x) => x[0] === input.loanType)}
        onChange=${(i) => set({ loanType: TYPES[i][0], taxOn: TYPES[i][2] })} />
      ${!housing && html`<${SwitchRow} title="BSMV ve KKDF dahil" caption=${`KKDF ${percent(t.kkdf, 0)} + BSMV ${percent(t.bsmv, 0)} orana eklenir`} checked=${input.taxOn} onChange=${(v) => set({ taxOn: v })} />`}
    </${Blk}>
    <${Blk} icon="tag" title="Liste fiyatı" caption="ürünün etiket fiyatı">
      <label class="price-line">
        <span class="unit">₺</span><${NumberField} value=${input.listPrice > 0 ? input.listPrice : null} grouping placeholder="0" cls="price" inputMode="numeric" autoFocus=${!(input.listPrice > 0)} onChange=${(v) => set({ listPrice: v ?? 0 })} />
      </label>
    </${Blk}>
    <${Blk} icon="percent" title="Peşin iskonto" caption="liste fiyatından düşülür"
      right=${html`<${Switch} checked=${input.discountOn} onChange=${(v) => set({ discountOn: v })} />`}>
      ${input.discountOn && html`<${AmountPercentFields} value=${input.discount} base=${input.listPrice} onChange=${(v) => set({ discount: v })} />`}
      <div class="camp-price grad-logo"><small>${discount > 0 ? 'Kampanyalı fiyat' : 'Satış fiyatı'}</small><strong>${money(base)}</strong>${discount > 0 && html`<em>İskonto ${moneyShort(discount)} · ${pctOf(discount, input.listPrice)}</em>`}</div>
    </${Blk}>`);

  if (step === 1) {
    const total = input.interims.reduce((s, x) => s + valueOf(x.value, base), 0);
    return wrap(html`
    <${Blk} icon="download" title="Peşinat" caption=${input.discountOn ? 'kampanyalı fiyatın' : 'fiyatın'}>
      <${AmountPercentFields} value=${input.down} base=${base} onChange=${(v) => set({ down: v })} />
      ${isCash(input) && html`<div class="cash-note"><${Icon} name="check" size=${20} /><div><strong>Peşin satış</strong><p class="caption">Kampanyalı fiyatın tamamı peşin ödenir; vade, vade farkı ve ara ödeme yok.</p></div></div>`}
    </${Blk}>
    ${!isCash(input) && html`
    <${Blk} icon="calendar" title="Ara ödemeler" caption=${input.interims.length ? `${input.interims.length} ödeme · toplam ${moneyShort(total)}` : 'yılbaşı, teslim gibi toplu ödemeler'}>
      ${input.interims.length > 0 && html`<div class="interim-head"><span>Ay</span><span>Oran</span><span>Tutar</span><span /></div>`}
      ${input.interims.map((x, i) => {
        const amount = valueOf(x.value, base);
        return html`<div class="interim-row" key=${i}>
          <${StepperField} tone="teal" value=${x.month} step=${1} min=${1} max=${360} display=${(v) => `${v}. ay`} onChange=${(v) => setInterim(i, { ...x, month: v })} />
          <${StepperField} tone="teal" value=${Math.round((base > 0 ? amount / base * 100 : 0) * 100) / 100} step=${0.5} max=${100} display=${(v) => '%' + editable(v)} onChange=${(v) => setInterim(i, { ...x, value: { amount: v, percent: true } })} />
          <${StepperField} tone="teal" value=${Math.round(amount)} step=${priceStep(base)} max=${base} grouping display=${moneyShort} onChange=${(v) => setInterim(i, { ...x, value: { amount: v, percent: false } })} />
          <${IconButton} icon="trash" label="Ara ödemeyi sil" cls="red" onClick=${() => set({ interims: input.interims.filter((_, j) => j !== i) })} />
        </div>`;
      })}
      <${GradientButton} cls="full add-interim" icon="add" onClick=${() => {
        const month = (input.interims.length ? Math.max(...input.interims.map((x) => x.month)) : 0) + 6;
        set({ interims: [...input.interims, { month, value: { amount: 10, percent: true } }] });
      }}>Ara ödeme ekle</${GradientButton}>
    </${Blk}>
    ${input.interims.length > 0 && html`
    <${Blk} icon="restore" title="Ara ödeme ayında" caption="taksit ve maliyetin firmaya yansıması">
      ${conflict && html`<${Segmented} options=${['Taksit de ödenir', 'Taksit pas geçilir']} index=${input.skipOnInterim ? 1 : 0} onChange=${(i) => set({ skipOnInterim: i === 1 })} />`}
      ${!noTerm(input) && html`<${SwitchRow} title="Ara ödemelerin maliyetini firma kredisine yansıt"
        caption=${input.interimToFirm !== false ? `Taksitler ara ödemelerin geç gelmesini aylık vade farkıyla (${percent(input.rate)}) telafi eder.` : 'Taksitler ara ödemeleri nominal tutarıyla düşer; gecikme maliyeti firmaya kalır.'}
        checked=${input.interimToFirm !== false} onChange=${(v) => set({ interimToFirm: v })} />`}
    </${Blk}>`}`}`);
  }

  if (step === 2) return wrap(html`<${CreditStep} input=${input} set=${set} />`);
  if (step === 3) return wrap(html`<${SavingsStep} input=${input} set=${set} />`);

  // 4. adım (firma kredisi): özet, vade, aylık vade farkı.
  return wrap(html`
    <${FirmSummary} input=${input} />
    <${Blk} icon="calendar" title="Vade" caption=${yearsText(input.months) || `${input.months} ay`}>
      <div class="b-ctl">
        <div class="b-stepper">
          <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ months: Math.max(1, input.months - 1) })} />
          <div class="bs-val"><${NumberField} value=${input.months} inputMode="numeric" onChange=${(v) => v >= 1 && set({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
          <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ months: Math.min(360, input.months + 1) })} />
        </div>
      </div>
      <div class="chips-wrap">${[6, 12, 18, 24, 36, 48, 60, 72, 84, 120].map((m) => html`<${Chip} label=${`${m} ay`} selected=${input.months === m} onClick=${() => set({ months: m })} />`)}</div>
      <div class="blk-sub">
        <span class="field-label">Ödemesiz dönem</span>
        <${Stepper} value=${input.graceMonths ? `${input.graceMonths} ay` : 'Yok'} caption=${input.graceMonths ? `taksitler ${input.graceMonths} ay ötelenir` : 'taksitler hemen başlar'}
          onMinus=${() => set({ graceMonths: Math.max(0, (input.graceMonths || 0) - 1) })} onPlus=${() => set({ graceMonths: Math.min(60, (input.graceMonths || 0) + 1) })} />
      </div>
      <label class="b-ctl b-date row">
        <span class="field-label">İlk taksit</span>
        <span class="b-date-val">${dateMid(DateX.plusMonths(input.startDate, first))}<${Icon} name="calendar" size=${16} /></span>
        <input type="date" value=${DateX.iso(DateX.plusMonths(input.startDate, first))}
          onChange=${(e) => e.target.value && set({ startDate: DateX.plusMonths(DateX.fromIso(e.target.value), -first) })} />
      </label>
    </${Blk}>
    <${Blk} icon="percent" title="Aylık vade farkı" caption="ortadaki orana dokun: klavyeyle yaz">
      <${Stepper} value=${percent(input.rate)} onValue=${rateSheet}
        caption=${`${input.taxOn && !housing ? `vergili aylık ${percent(effective)} · ` : ''}yıllık basit ${percent(effective * 12)} · bileşik ${percent(Finance.annualCompound(effective))}`}
        onMinus=${() => set({ rate: Math.max(0, Math.round((input.rate - 0.0001) * 1e6) / 1e6) })} onPlus=${() => set({ rate: Math.round((input.rate + 0.0001) * 1e6) / 1e6 })} />
      <div class="chips-wrap">${[0, 0.0099, 0.0149, 0.0199, 0.0249, 0.0299, 0.0349, 0.0399].map((r) => html`<${Chip} label=${r === 0 ? 'Vade farksız' : percent(r)} selected=${Math.abs(input.rate - r) < 1e-9} onClick=${() => set({ rate: r })} />`)}</div>
    </${Blk}>`);
}

/** Firma kredisi özeti: vadelendirilen tutar ve oranı (kalan, otomatik), taksitlerin yeri, toplam, bölüm maliyeti. */
function FirmSummary({ input }) {
  const app = useApp();
  const a = app.analyzePlan(app.plan);
  if (!(input.listPrice > 0) || a.schedule.overflow) return null;
  const b = costBreakdown(a);
  const base = basePrice(input);
  return html`
    <${Blk} icon="building" title="Firmanın vadelendirdiği" caption="kalan · otomatik hesaplanır">
      <div class="firm-boxes"><div><small>Oran</small><strong>${pctOf(b.firmFinanced, base)}</strong></div><div><small>Tutar</small><strong>${moneyShort(b.firmFinanced)}</strong></div></div>
      ${b.first && html`<div class="kv">
        <span><small>${a.installmentCount} × taksit</small><strong>${a.installment != null ? money(a.installment) : '—'}</strong></span>
        <span><small>Toplam geri dönüş</small><strong>${moneyShort(b.installmentTotal)}</strong></span>
        <span><small>İlk taksit</small><strong>${dateMid(payDate(b.first, input.startDate))}</strong></span>
        <span><small>Son taksit</small><strong>${dateMid(payDate(b.last, input.startDate))}</strong></span>
      </div>`}
    </${Blk}>`;
}

// --- Kredi adımı ---

const QUICK_CREDIT_MONTHS = [12, 24, 36, 48, 60, 120];
const QUICK_CREDIT_RATES = [0.0099, 0.0149, 0.0199, 0.0249, 0.0299, 0.0349];
const round6 = (v) => Math.round(v * 1e6) / 1e6;

/**
 * Banka kredisi: tutar (kampanyalı fiyatın yüzdesi ⇄ TL, "Kalanın tamamı"), vade, müşteriye uygulanan aylık kâr payı,
 * katkılı kredide bankanın oranı; özet: taksit, toplam geri ödeme; katkı yalnız kullanıcıya.
 */
function CreditStep({ input, set }) {
  const app = useApp();
  const base = basePrice(input);
  const c = input.credit;
  const loan = app.analyzePlan(app.plan).loan;
  const t = app.settings.taxes[input.loanType] || { kkdf: 0, bsmv: 0 };
  const taxRate = input.loanType === 'HOUSING' ? 0 : t.kkdf + t.bsmv;
  const rest = Math.max(0, base - valueOf(input.down, base) - input.interims.reduce((s, x) => s + valueOf(x.value, base), 0));
  const setC = (patch) => set({ credit: { ...c, ...patch } });
  const rateSheet = (key, title) => app.sheet(html`<${RateSheet} title=${title} rate=${c[key]} onClose=${app.closeSheet} onDone=${(r) => { app.closeSheet(); setC({ [key]: r }); }} />`);
  return html`
    <div class="sec-toggle"><${SwitchRow} title="Banka kredisi kullan" caption="Kredi peşinat gününde firmaya peşin geçer; müşteri bankaya taksitle öder." checked=${!!c}
      onChange=${(on) => set({ credit: on ? { amount: { amount: 20, percent: true }, months: input.loanType === 'HOUSING' ? 120 : 36, rate: 0.0249, subsidized: false, bankRate: 0.0249 } : null })} /></div>
    ${c && html`
      <${Blk} icon="bank" title="Kredi tutarı" caption="kampanyalı fiyatın · peşinat gününde firmaya geçer">
        <${AmountPercentFields} value=${c.amount} base=${base} onChange=${(v) => setC({ amount: v })} />
        <button class="link-btn" onClick=${() => setC({ amount: { amount: Math.round(rest), percent: false } })}>Kalanın tamamı (${moneyShort(rest)})</button>
      </${Blk}>
      <${Blk} icon="calendar" title="Vade" caption=${yearsText(c.months) || `${c.months} ay`}>
        <div class="b-ctl">
          <div class="b-stepper">
            <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => setC({ months: Math.max(1, c.months - 1) })} />
            <div class="bs-val"><${NumberField} value=${c.months} inputMode="numeric" onChange=${(v) => v >= 1 && setC({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
            <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => setC({ months: Math.min(360, c.months + 1) })} />
          </div>
        </div>
        <div class="chips-wrap">${QUICK_CREDIT_MONTHS.map((m) => html`<${Chip} label=${`${m} ay`} selected=${c.months === m} onClick=${() => setC({ months: m })} />`)}</div>
      </${Blk}>
      <${Blk} icon="trend" title="Aylık kâr payı" caption=${taxRate > 0 ? `müşterinin oranı · KKDF + BSMV ile ${percent(c.rate * (1 + taxRate))}` : 'müşterinin oranı · konutta vergi yok'}>
        <${Stepper} value=${percent(c.rate)} onValue=${() => rateSheet('rate', 'Aylık kâr payı')} onMinus=${() => setC({ rate: Math.max(0, round6(c.rate - 0.0001)) })} onPlus=${() => setC({ rate: round6(c.rate + 0.0001) })} />
        <div class="chips-wrap">${QUICK_CREDIT_RATES.map((r) => html`<${Chip} label=${percent(r)} selected=${Math.abs(c.rate - r) < 1e-9} onClick=${() => setC({ rate: r })} />`)}</div>
      </${Blk}>
      <${Blk} icon="shield" title="Katkılı kredi" caption="banka farkın bugünkü değerini firmadan peşin alır"
        right=${html`<${Switch} checked=${!!c.subsidized} onChange=${(on) => setC({ subsidized: on, bankRate: on && !(c.bankRate > c.rate) ? 0.035 : c.bankRate })} />`}>
        ${c.subsidized && html`<div class="blk-sub"><span class="field-label">Bankanın oranı · katkı bu oranla</span>
          <${Stepper} value=${percent(c.bankRate)} onValue=${() => rateSheet('bankRate', 'Bankanın oranı')} onMinus=${() => setC({ bankRate: Math.max(0, round6(c.bankRate - 0.0001)) })} onPlus=${() => setC({ bankRate: round6(c.bankRate + 0.0001) })} /></div>`}
        ${loan && html`
          <div class="kv">
            <span><small>Aylık taksit</small><strong>${money(loan.payment)}</strong></span>
            <span><small>Toplam geri ödeme</small><strong>${moneyShort(loan.totalPayment)}</strong></span>
            <span><small>Toplam kâr payı</small><strong>${moneyShort(loan.totalInterest)}</strong></span>
            <span><small>${loan.taxRate > 0 ? 'KKDF + BSMV' : 'Vergi'}</small><strong>${moneyShort(loan.totalTax)}</strong></span>
          </div>
          ${loan.contribution > 0 && html`<p class="caption amber">Katkı (firma öder): ${moneyShort(loan.contribution)}</p>`}
          <button class="link-btn" onClick=${() => app.sheet(html`<${LoanSheet} loan=${loan} start=${input.startDate} onClose=${app.closeSheet} />`)}>Kredi ödeme planı</button>`}
      </${Blk}>
      ${noTerm(input) && html`<p class="caption">Kredi kalanı karşılıyor: firma vadesi yok.</p>`}`}`;
}

// --- Tahsisat adımı ---

/**
 * Tahsisat (tasarruf finansmanı): sözleşme tutarı (oran ⇄ tutar), şirkete peşinat, vade, taksit modeli (sabit / artan
 * yan yana), organizasyon ücreti, tahsisat ayı ve müşteri taksitleri; her biri simgeli blok. Değişiklik plana anında yansır.
 */
function SavingsStep({ input, set }) {
  const app = useApp();
  const base = basePrice(input);
  const plan = app.analyzePlan(app.plan).savings;
  const s = input.savings;
  const housing = input.loanType === 'HOUSING';
  const rest = Math.max(0, base - valueOf(input.down, base) - creditAmount(input) - input.interims.reduce((t, x) => t + valueOf(x.value, base), 0));
  const pv = (p) => p.amount * Finance.discountFactor(app.settings.baseRate, p.allocationMonth);
  const up = (patch) => set({ savings: { ...s, ...patch } });
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const dateOf = (m) => dateMid(DateX.plusMonths(input.startDate, m));
  const downV = s && (typeof s.down === 'number' ? { amount: s.down, percent: false } : s.down);
  const model = (title, sv, on) => {
    const pl = SavingsFinance.plan({ ...input, savings: sv });
    const cost = pl ? pl.amount - pv(pl) : null;
    return html`<button class=${'model-card' + (on ? ' on' : '')} onClick=${() => up({ growth: sv.growth })}>
      <strong>${title}</strong>
      ${pl && html`<small>Tahsisat</small><b>${pl.allocationMonth}. ay</b><span>${dateOf(pl.allocationMonth)}</span>
        <small>Tahsisat maliyeti</small><span>${moneyShort(cost)} · ${percent(pl.amount > 0 ? cost / pl.amount : 0)}</span>
        <small>${pl.growth > 0 ? 'İlk / son taksit' : 'Aylık taksit'}</small><span>${pl.growth > 0 ? `${moneyShort(pl.firstPayment)} / ${moneyShort(pl.rows[pl.rows.length - 1].saving)}` : moneyShort(pl.firstPayment)}</span>`}
    </button>`;
  };
  const g = s && s.growth > 0 ? s.growth : 0.01;
  const amount = plan ? plan.amount : savingsAmount(input);
  return html`
    <div class="sec-toggle"><${SwitchRow} title="Tahsisat kullan" caption="Tasarruf şirketi tahsisat ayında sözleşme tutarının tamamını firmaya tek seferde öder." checked=${!!s}
      onChange=${(on) => set({ savings: on ? { amount: { amount: 20, percent: true }, down: { amount: 0, percent: true }, months: 53, feeRate: 0.07, feeInstallments: 4, growth: 0, allocationMonth: null } : null })} /></div>
    ${s && html`<${Segmented} options=${['Mevcut tahsisat', 'Yeni tasarruf kampanyası']} index=${s.existing ? 0 : 1}
      onChange=${(i) => up(i === 0 ? { existing: true, allocationMonth: s.allocationMonth ?? plan?.allocationMonth ?? 6 } : { existing: false, allocationMonth: null })} />`}
    ${s && s.existing && html`
      <${Blk} icon="savings" title="Tahsisat tutarı" caption="firmaya tek seferde gelen · kampanyalı fiyatın">
        <${AmountPercentFields} value=${s.amount} base=${base} onChange=${(v) => up({ amount: v })} />
        <button class="link-btn" onClick=${() => up({ amount: { amount: Math.round(rest), percent: false } })}>Kalanın tamamı (${moneyShort(rest)})</button>
      </${Blk}>
      <${Blk} icon="calendar" title="Tahsisat tarihi" caption="tutarın firmaya geçeceği gün">
        <${Stepper} value=${(s.allocationMonth ?? 6) === 0 ? 'Hemen' : `${s.allocationMonth ?? 6}. ay`} caption=${dateOf(s.allocationMonth ?? 6)}
          onMinus=${() => up({ allocationMonth: Math.max(0, (s.allocationMonth ?? 6) - 1) })} onPlus=${() => up({ allocationMonth: Math.min(360, (s.allocationMonth ?? 6) + 1) })} />
        <div class="chips-wrap">${[0, 3, 6, 12, 18, 24].map((m) => html`<${Chip} label=${m === 0 ? 'Hemen' : `${m} ay`} selected=${(s.allocationMonth ?? 6) === m} onClick=${() => up({ allocationMonth: m })} />`)}</div>
        <label class="b-ctl b-date row">
          <span class="field-label">Tarih seç</span>
          <span class="b-date-val">${dateOf(s.allocationMonth ?? 6)}<${Icon} name="calendar" size=${16} /></span>
          <input type="date" value=${DateX.iso(DateX.plusMonths(input.startDate, s.allocationMonth ?? 6))}
            onChange=${(e) => { if (!e.target.value) return; const a = DateX.parts(input.startDate), b = DateX.parts(DateX.fromIso(e.target.value));
              up({ allocationMonth: Math.min(360, Math.max(0, (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0))) }); }} />
        </label>
      </${Blk}>
      ${noTerm(input) && html`<p class="caption">Kalan tutar karşılanıyor: firma vadesi yok.</p>`}`}
    ${s && !s.existing && html`
      <${Blk} icon="bank" title="Sözleşme tutarı" caption="tahsisatta firmaya gelen · kampanyalı fiyatın">
        <${AmountPercentFields} value=${s.amount} base=${base} onChange=${(v) => up({ amount: v })} />
        <button class="link-btn" onClick=${() => up({ amount: { amount: Math.round(rest), percent: false } })}>Kalanın tamamı (${moneyShort(rest)})</button>
      </${Blk}>
      <${Blk} icon="download" title="Şirkete peşinat" caption="müşterinin tasarruf şirketine · sözleşme tutarının">
        <${AmountPercentFields} value=${downV} base=${amount} onChange=${(v) => up({ down: v })} />
        <div class="chips-wrap">${[0, 10, 20, 30, 40].map((x) => html`<${Chip} label=${x === 0 ? 'Peşinatsız' : '%' + x} selected=${!!plan && Math.abs(plan.down - plan.amount * x / 100) < 1} onClick=${() => up({ down: { amount: x, percent: true } })} />`)}</div>
      </${Blk}>
      <${Blk} icon="calendar" title="Sözleşme vadesi" caption=${`azami ${housing ? 120 : 60} ay (BDDK) · ${yearsText(s.months) || s.months + ' ay'}`}>
        <${Stepper} value=${`${s.months}`} unit="ay" onMinus=${() => up({ months: Math.max(2, s.months - 1), allocationMonth: null })} onPlus=${() => up({ months: Math.min(240, s.months + 1), allocationMonth: null })} />
        <div class="chips-wrap">${(housing ? [36, 48, 53, 60, 84, 96, 120] : [24, 36, 48, 53, 60]).map((m) => html`<${Chip} label=${`${m} ay`} selected=${s.months === m} onClick=${() => up({ months: m, allocationMonth: null })} />`)}</div>
      </${Blk}>
      <${Blk} icon="trend" title="Taksit modeli" caption="sabit mi artan mı · dokunarak seç">
        <div class="model-cards">${model('Sabit taksit', { ...s, growth: 0 }, !(s.growth > 0))}${model(`Artan (${percent(g, 1)}/ay)`, { ...s, growth: g }, s.growth > 0)}</div>
        ${s.growth > 0 && html`
          <${Stepper} value=${percent(s.growth)} caption="tahsisattan sonra aylık artış" onMinus=${() => up({ growth: Math.max(0.001, r6(s.growth - 0.001)) })} onPlus=${() => up({ growth: r6(s.growth + 0.001) })} />
          <div class="chips-wrap">${[0.005, 0.01, 0.015, 0.02].map((x) => html`<${Chip} label=${percent(x, 1)} selected=${Math.abs(s.growth - x) < 1e-9} onClick=${() => up({ growth: x })} />`)}</div>`}
      </${Blk}>
      <${Blk} icon="bag" title="Organizasyon ücreti" caption=${`${moneyShort(amount * s.feeRate)} · yarısı peşin, kalanı en fazla 4 taksit`}>
        <${Stepper} value=${percent(s.feeRate)} caption="sözleşme tutarının" onMinus=${() => up({ feeRate: Math.max(0, r6(s.feeRate - 0.0025)) })} onPlus=${() => up({ feeRate: r6(s.feeRate + 0.0025) })} />
        <div class="chips-wrap">${[0.05, 0.06, 0.07, 0.08, 0.10, 0.12].map((x) => html`<${Chip} label=${percent(x, 0)} selected=${Math.abs(s.feeRate - x) < 1e-9} onClick=${() => up({ feeRate: x })} />`)}</div>
        <span class="field-label">Kalan ücret 2. taksitten itibaren kaç taksitte?</span>
        <${Segmented} options=${['1', '2', '3', '4']} index=${(s.feeInstallments || 4) - 1} onChange=${(i) => up({ feeInstallments: i + 1 })} />
      </${Blk}>
      ${plan && html`
        <${Blk} icon="clock" title="Tahsisat ayı" caption=${`kural: birikim ≥ %45 ve vadenin ≥ %45'i → ${plan.computedMonth}. ay`}>
          <${SwitchRow} title="Elle belirle" caption="Çekilişli modelde ya da şirketin verdiği tarih farklıysa" checked=${s.allocationMonth != null}
            onChange=${(on) => up({ allocationMonth: on ? plan.computedMonth : null })} />
          ${s.allocationMonth != null && html`<${Stepper} value=${`${plan.allocationMonth}. ay`} caption=${dateOf(plan.allocationMonth)}
            onMinus=${() => up({ allocationMonth: Math.max(1, plan.allocationMonth - 1) })} onPlus=${() => up({ allocationMonth: Math.min(plan.months, plan.allocationMonth + 1) })} />`}
        </${Blk}>
        <${Blk} icon="person" title="Müşterinin taksitleri" caption="tasarruf şirketine ödenecek">
          <div class="kv">
            <span><small>${plan.growth > 0 ? 'İlk / son taksit' : 'Aylık taksit'}</small><strong>${plan.growth > 0 ? `${moneyShort(plan.firstPayment)} / ${moneyShort(plan.rows[plan.rows.length - 1].saving)}` : money(plan.firstPayment)}</strong></span>
            <span><small>Peşinat</small><strong>${moneyShort(plan.down)}</strong></span>
            <span><small>Birikim (tahsisatta)</small><strong>${moneyShort(plan.savedAtAllocation)}</strong></span>
            <span><small>Finansman</small><strong>${moneyShort(plan.financing)}</strong></span>
            <span><small>Organizasyon ücreti</small><strong>${moneyShort(plan.fee)}</strong></span>
            <span><small>Müşteri toplamı</small><strong>${moneyShort(plan.totalPaid)}</strong></span>
          </div>
          ${plan.warnings.length ? plan.warnings.map((w) => html`<p class="caption amber">⚠ ${w}</p>`) : html`<p class="caption">BDDK sınırları içinde.</p>`}
          <button class="link-btn" onClick=${() => app.sheet(html`<${SavingsSheet} plan=${plan} start=${input.startDate} onClose=${app.closeSheet} />`)}>Tasarruf ödeme planı</button>
        </${Blk}>`}
      ${noTerm(input) && html`<p class="caption">Kalan tutar karşılanıyor: firma vadesi yok.</p>`}`}`;
}

// --- Oluşan plan ---

function ResultPanel({ plan, a }) {
  const app = useApp();
  const ops = app.planOps;
  const rows = a.rows;
  const start = plan.input.startDate;
  // Kredi ya da tahsisat varsa iki plan: Firma (tahsilat, düzenlenebilir) · Müşteri (konsolide ödemeler).
  const [customer, setCustomer] = useState(false);
  if (isCash(plan.input)) return html`<${CashPanel} plan=${plan} a=${a} />`;
  const totalPv = rows.reduce((t, r) => t + a.pv(r), 0);
  const dual = !!(a.loan || a.savings);
  const viewSwitch = dual && html`
    <div class="view-switch">
      <button class=${!customer ? 'on grad-logo' : ''} onClick=${() => setCustomer(false)}><${Icon} name="bank" size=${18} />Firma planı</button>
      <button class=${customer ? 'on grad-customer' : ''} onClick=${() => setCustomer(true)}><${Icon} name="person" size=${18} />Müşteri planı</button>
    </div>`;
  if (dual && customer) return html`${viewSwitch}<${CustomerPanel} a=${a} start=${plan.input.startDate} />${loanSavingsCards(app, a, plan.input.startDate)}`;
  const editRow = (p) => app.sheet(html`<${RowEditSheet} p=${p} rows=${rows} start=${start} rate=${a.schedule.rate} target=${a.schedule.target} onClose=${app.closeSheet}
    onApply=${(amount, shift, locked, scope) => { app.closeSheet(); ops.editRow(p.id, amount, shift, locked, scope); }}
    onDelete=${() => { app.closeSheet(); ops.deleteRow(p.id); }} />`);
  const block = () => {
    const months = rows.filter((r) => r.kind === Kind.INSTALLMENT).map((r) => r.month);
    const f = months.length ? Math.min(...months) : 1;
    app.sheet(html`<${BlockSheet} from=${f} to=${f + 11} onClose=${app.closeSheet} onDone=${(x, y, amt) => { app.closeSheet(); ops.addBlock(x, y, amt); }} />`);
  };
  const target = () => app.sheet(html`<${TargetCostSheet} input=${plan.input} current=${a.costRatio || 0} edited=${!!plan.rows} onClose=${app.closeSheet}
    onRate=${(r) => { app.closeSheet(); app.updateInput({ ...plan.input, rate: r }); }}
    onDiscount=${(d) => { app.closeSheet(); app.updateInput({ ...plan.input, discountOn: d > 0, discount: { amount: d, percent: false } }); }} />`);
  return html`
    ${viewSwitch}
    ${a.schedule.overflow
      ? html`<div class="alert">Peşinat, ara ödemeler ve kilitli satırların bugünkü değeri hedefi ${moneyShort(a.schedule.overflow.excess)} aşıyor. Peşinatı / ara ödemeleri azalt ya da kilitleri aç.</div>`
      : html`<${CostCard} a=${a} onClick=${target} />`}
    ${plan.rows && !rows.some((r) => !r.locked) && html`<p class="caption amber">Dengelenecek kilitsiz taksit yok; maliyet oranı değişebilir.</p>`}
    <div class="list-head">
      <span class="section-label">${dual ? 'Firmanın tahsilatı' : 'Tablo'} · ${rows.length} satır</span>
      <span class="actions"><${TextAction} icon="add" onClick=${ops.addRow}>Satır</${TextAction}><${TextAction} icon="add" onClick=${block}>Blok taksit</${TextAction}></span>
    </div>
    <div class="pill-row"><${BaseRatePill} compact /><span class="caption">NBD bu oranla · satıra dokun: düzenle</span></div>
    <div class="ptable">
      <div class="pt-head"><span class="c-no">Sıra</span><span class="c-date">Tarih</span><span class="c-amt">Tutar</span><span class="c-cum">Tahsilat</span><span class="c-pv">NBD</span><span class="c-pvc">NBD Σ</span><span class="c-lock" /></div>
      ${rows.map((p, i) => html`<${TableRow} key=${p.id} p=${p} start=${start} pv=${a.pv(p)} collected=${a.listPrice > 0 ? rows.slice(0, i + 1).reduce((t, r) => t + r.amount, 0) / a.listPrice : null}
        collectedPv=${totalPv > 0 ? rows.slice(0, i + 1).reduce((t, r) => t + a.pv(r), 0) / totalPv : null} onClick=${() => p.kind !== Kind.CREDIT && p.kind !== Kind.ALLOCATION && editRow(p)} onLock=${() => p.kind !== Kind.CREDIT && p.kind !== Kind.ALLOCATION && ops.toggleLock(p.id)} />`)}
      <div class="pt-total"><span class="c-no">Toplam</span><span class="c-date" /><span class="c-amt">${money(a.total)}</span>${a.listPrice > 0 && html`<span class="c-cum full">Σ ${percent(a.total / a.listPrice, 1)}</span>`}<span class="c-pv">${moneyShort(a.pvAtBase)}</span>${totalPv > 0 && html`<span class="c-pvc">Σ ${percent(1, 1)}</span>`}<span class="c-lock" /></div>
    </div>
    ${loanSavingsCards(app, a, start)}`;
}

/** Plan adımındaki banka kredisi ve tahsisat kartları (dokununca ayrıntı penceresi). */
function loanSavingsCards(app, a, start) {
  return html`
    ${a.loan && html`
      <button class="card loan-card" onClick=${() => app.sheet(html`<${LoanSheet} loan=${a.loan} start=${start} onClose=${app.closeSheet} />`)}>
        <span class="icon-tile tone-teal"><${Icon} name="bank" size=${22} /></span>
        <span class="grow"><span class="row-title">Banka kredisi · ${moneyShort(a.loan.principal)}</span>
          <span class="caption">${a.loan.months} × ${money(a.loan.payment)} · aylık ${percent(a.loan.rate)}${a.loan.taxRate > 0 ? ` (vergili ${percent(a.loan.effectiveRate)})` : ''} · kredi ödeme planı için dokun</span></span>
        <${Icon} name="forward" size=${18} />
      </button>`}
    ${a.savings && html`
      <button class="card loan-card" onClick=${() => !a.savings.existing && app.sheet(html`<${SavingsSheet} plan=${a.savings} start=${start} onClose=${app.closeSheet} />`)}>
        <span class="icon-tile tone-teal"><${Icon} name="clock" size=${22} /></span>
        <span class="grow"><span class="row-title">Tahsisat · ${moneyShort(a.savings.amount)}</span>
          <span class="caption">${a.savings.allocationMonth}. ay (${dateMid(DateX.plusMonths(start, a.savings.allocationMonth))}) · ${a.savings.existing ? 'mevcut tahsisat' : `${a.savings.months} × ${moneyShort(a.savings.firstPayment)}${a.savings.growth > 0 ? ' (artan)' : ''} · tasarruf planı için dokun`}</span></span>
        <${Icon} name="forward" size=${18} />
      </button>`}`;
}

/**
 * Müşteri planı: degrade özet (toplam, peşin gün, en yüksek aylık, firmaya / tasarrufa / bankaya, son ödeme) ve ay ay
 * konsolide tablo (yalnız kullanılan sütunlar). Salt okunur; düzenleme Firma planında.
 */
function CustomerPanel({ a, start }) {
  const rows = customerRows(a, start);
  const st = customerStats(rows);
  const sum = (f) => rows.reduce((t, x) => t + f(x), 0);
  const hasS = rows.some((x) => x.savings > 0), hasB = rows.some((x) => x.bank > 0);
  const last = rows[rows.length - 1];
  const cols = 2 + (hasS ? 1 : 0) + (hasB ? 1 : 0);
  const cell = (v, bold) => html`<span class=${'cv' + (v > 0 ? '' : ' none') + (bold ? ' b' : '')}>${v > 0 ? moneyShort(v) : '—'}</span>`;
  const fact = (l, v, note) => html`<div class="cc-fact"><span>${l}</span><strong>${v}</strong>${note && html`<em>${note}</em>`}</div>`;
  return html`
    <div class="cost-card grad-customer static">
      <div class="r-label">Müşterinin toplam ödemesi</div>
      <div class="r-big">${money(st.total)}</div>
      <div class="cc-facts">
        ${fact('Peşinat', moneyShort(st.down), st.dayZero - st.down >= 1 ? `toplam ${moneyShort(st.dayZero)}` : null)}
        ${fact('Ara ödemeler', st.interimCount ? moneyShort(st.interimTotal) : 'Yok', st.interimCount ? `${st.interimCount} ödeme` : null)}
      </div>
      <div class="cc-facts three">
        ${fact('En düşük aylık', moneyShort(st.minMonthly))}
        ${fact('Ortalama aylık', moneyShort(st.avgMonthly))}
        ${fact('En yüksek aylık', moneyShort(st.maxMonthly), st.maxInterim > 0 ? `+ ara ${moneyShort(st.maxInterim)}` : null)}
      </div>
      <div class=${'cc-facts' + (hasS && hasB ? ' three' : '')}>
        ${fact('Firmaya', moneyShort(sum((x) => x.firm)))}
        ${hasS && fact('Tasarrufa', moneyShort(sum((x) => x.savings)))}
        ${hasB && fact('Bankaya', moneyShort(sum((x) => x.bank)))}
      </div>
      ${last && html`<div class="r-note">Son ödeme ${last.month}. ay · ${dateMid(last.date)}</div>`}
    </div>
    <div class="list-head"><span class="section-label">Müşterinin ödemeleri · ${rows.length} ay</span></div>
    <div class="ctab" style=${`--cols:${cols}`}>
      <div class="ct-row ct-head"><span>Ay</span><span class="h"><i class="dot firm" />Firma</span>${hasS && html`<span class="h"><i class="dot sav" />Tasarruf</span>`}${hasB && html`<span class="h"><i class="dot bank" />Banka</span>`}<span class="h">Toplam</span></div>
      ${rows.map((x) => html`<div class=${'ct-row' + (x.month === 0 ? ' zero' : x.interim > 0 ? ' interim' : '')} key=${x.month}>
        <span class="ct-m"><strong>${x.month === 0 ? 'Peşin' : `${x.month}. ay`}${x.interim > 0 && x.month > 0 ? html`<em>ara</em>` : ''}</strong><small>${dateMid(x.date)}</small></span>
        ${cell(x.firm, x.interim > 0)}${hasS && cell(x.savings)}${hasB && cell(x.bank)}<span class="cv sum">${moneyShort(x.total)}</span></div>`)}
      <div class="ct-row ct-total"><span class="ct-m"><strong>Toplam</strong></span>${cell(sum((x) => x.firm), true)}${hasS && cell(sum((x) => x.savings), true)}${hasB && cell(sum((x) => x.bank), true)}<span class="cv sum">${moneyShort(st.total)}</span></div>
    </div>
    <p class="caption center">Müşteri planı salt okunur · Taksitleri düzenlemek için Firma planına geç</p>`;
}

/** Peşin satış: ödenecek tutar kartı ve tek satırlık tablo. */
function CashPanel({ plan, a }) {
  const i = plan.input;
  const discount = i.listPrice - basePrice(i);
  const facts = [['Liste fiyatı', moneyShort(i.listPrice)]];
  if (discount > 0.5) facts.push(['Peşin iskonto', '−' + moneyShort(discount)]);
  facts.push(['Maliyet oranı', a.costRatio != null ? percent(a.costRatio) : '—'], ['Ödeme günü', dateMid(i.startDate)]);
  return html`
    <div class="cost-card grad-logo static">
      <div class="r-label">Peşin satış</div>
      <div class="r-big">${moneyShort(basePrice(i))}</div>
      <div class="r-note">Tamamı peşin · vade, vade farkı ve ara ödeme yok</div>
      <div class="cc-facts">${facts.map(([l, v]) => html`<div class="cc-fact"><span>${l}</span><strong>${v}</strong></div>`)}</div>
    </div>
    <div class="list-head"><span class="section-label">Tablo · 1 satır</span></div>
    <div class="ptable">
      <div class="pt-head"><span class="c-no">Sıra</span><span class="c-date">Tarih</span><span class="c-amt">Tutar</span><span class="c-pv">NBD</span><span class="c-lock" /></div>
      ${a.rows.map((p) => html`<div class="pt-row down" key=${p.id}>
        <span class="c-no"><strong>Peşin ödeme</strong></span><span class="c-date">${dateMid(payDate(p, i.startDate))}</span>
        <span class="c-amt">${money(p.amount)}</span><span class="c-pv">${moneyShort(a.pv(p))}</span><span class="c-lock" /></div>`)}
      <div class="pt-total"><span class="c-no">Toplam</span><span class="c-date" /><span class="c-amt">${money(a.total)}</span><span class="c-pv">${moneyShort(a.pvAtBase)}</span><span class="c-lock" /></div>
    </div>`;
}

function CostCard({ a, onClick }) {
  const down = a.rows.filter((r) => r.kind === Kind.DOWN).reduce((s, r) => s + r.amount, 0);
  const interims = a.rows.filter((r) => r.kind === Kind.INTERIM);
  // Sıra (kullanıcı isteği): liste, kampanyalı, peşinat, ara ödemeler, banka kredisi, tahsisat, taksit; toplam ayrıca büyük.
  const facts = [['Liste fiyatı', moneyShort(a.listPrice)]];
  if (a.basePrice < a.listPrice - 0.5) facts.push(['Kampanyalı fiyat', moneyShort(a.basePrice)]);
  if (down > 0) facts.push(['Peşinat', moneyShort(down)]);
  if (interims.length) facts.push(['Ara ödemeler', interims.every((r) => r.amount === interims[0].amount) ? `${interims.length} × ${moneyShort(interims[0].amount)}` : `${interims.length} · ${moneyShort(interims.reduce((s, r) => s + r.amount, 0))}`]);
  if (a.loan) facts.push(['Banka kredisi', moneyShort(a.loan.principal)]);
  if (a.savings) facts.push([`Tahsisat (${a.savings.allocationMonth}. ay)`, moneyShort(a.savings.amount)]);
  // Firma vadesi yoksa (kredi kalanı karşılıyor) taksit satırı yok.
  if (a.installmentCount > 0) facts.push([`${a.installmentCount} × taksit`, a.installment != null ? money(a.installment) : '—']);
  const b = costBreakdown(a);
  const parts = [['İskonto', b.discount], ['Ara ödemeler', b.downInterim], ['Banka kredisi', b.bank], ['Tahsisat', b.allocation], ['Firma kredisi', b.firm]].filter(([, v]) => Math.abs(v) >= 1);
  return html`
    <button class="cost-card grad-logo" onClick=${onClick}>
      <div class="cc-top">
        <div><div class="r-label">Maliyet oranı</div><div class="r-big">${a.costRatio != null ? percent(a.costRatio) : '—'}</div></div>
        <div class="right"><div class="r-label">Toplam NBD</div><div class="r-mid">${moneyShort(a.pvAtBase)}</div></div>
      </div>
      ${parts.length > 0 && html`<div class="cc-break">
        <div class="cb-title">Maliyet kırılımı</div>
        ${parts.map(([l, v]) => html`<div class="cb-row"><span>${l}${v < 0 ? ' (kazanç)' : ''}</span><small>${moneyShort(v)}</small><strong>${percent(b.ratio(v))}</strong></div>`)}
        <div class="cb-row total"><span>Toplam maliyet</span><small>${moneyShort(b.total)}</small><strong>${percent(b.ratio(b.total))}</strong></div>
      </div>`}
      <div class="cc-facts">${facts.map(([l, v]) => html`<div class="cc-fact"><span>${l}</span><strong>${v}</strong></div>`)}</div>
      <div class="cc-total"><span>Toplam ödeme</span><strong>${money(a.total)}</strong></div>
      <div class="r-note">Hedef maliyeti değiştirmek için dokun</div>
    </button>`;
}

function TableRow({ p, start, pv, onClick, onLock, collected, collectedPv }) {
  const cls = p.kind === Kind.DOWN ? 'down' : p.kind === Kind.CREDIT || p.kind === Kind.ALLOCATION ? 'credit' : p.kind === Kind.INTERIM ? 'interim' : p.kind === Kind.GRACE ? 'grace' : p.manual ? 'manual' : 'inst';
  const label = p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.CREDIT ? 'Banka kredisi' : p.kind === Kind.ALLOCATION ? `${p.month}. Ay · tahsisat` : p.kind === Kind.INTERIM ? `${p.month}. Ay · ara` : `${p.month}. Ay`;
  return html`
    <div class=${'pt-row ' + cls + (p.locked ? ' locked' : '')} onClick=${onClick} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && onClick()}>
      <span class="c-no"><strong>${label}</strong>${p.shiftDays !== 0 && html`<${Badge} tone="amber">${dayShift(p.shiftDays)}</${Badge}>`}</span>
      <span class="c-date">${dateMid(payDate(p, start))}${p.kind === Kind.GRACE ? ' · ödemesiz' : ''}${p.shiftDays !== 0 ? html`<em> p ${editable(period(p))}</em>` : ''}</span>
      <span class="c-amt">${money(p.amount)}</span>
      ${collected != null && html`<span class=${'c-cum' + (collected >= 1 - 1e-9 ? ' full' : '')}>Σ ${percent(collected, 1)}</span>`}
      <span class="c-pv">${moneyShort(pv)}</span>
      ${collectedPv != null && html`<span class="c-pvc">Σ ${percent(collectedPv, 1)}</span>`}
      ${p.kind === Kind.CREDIT || p.kind === Kind.ALLOCATION ? html`<span class="c-lock" />` : html`<button class="c-lock icon-btn" title=${p.locked ? 'Kilitli, kilidi aç' : 'Serbest, kilitle'} onClick=${(e) => { e.stopPropagation(); onLock(); }}><${Icon} name=${p.locked ? 'lock' : 'unlock'} size=${17} /></button>`}
    </div>`;
}

// Ekranlar: ana sayfa, şablonlar, ödeme planı oluştur (4 adım), plan, teklifin gerçek oranı, değer çevirici, ayarlar.
import { html, useState } from '../vendor/preact-htm.js';
import { Finance, Kind, Schedules, basePrice, valueOf, firstInstallmentMonth, payDate, period, Offers, Conversion, ValueConverter, DateX } from './finance.js';
import { money, moneyShort, percent, dateShort, dateMid, dayShift, editable } from './format.js';
import {
  Icon, IconButton, GradientButton, OutlineButton, TextAction, Card, SectionCard, Chip, Segmented, SwitchRow,
  IconTile, Badge, BigAmountField, AmountPercentFields, StepperField, DateRow, TopBar, NumberField, FieldBox, useApp,
} from './ui.js';
import {
  RateSheet, AmountSheet, BlockSheet, SingleSheet, NameSheet, ConflictSheet, TargetCostSheet, RowEditSheet, ShareSheet,
} from './sheets.js';
import { TRASH_DAYS } from './store.js';

const KIND = {
  SCHEDULE: { label: 'Planlar', icon: 'table', tone: 'blue', color: 'var(--tint)' },
  OFFER: { label: 'Teklifler', icon: 'trend', tone: 'green', color: 'var(--green)' },
  CONVERSION: { label: 'Çevirici', icon: 'clock', tone: 'indigo', color: 'var(--indigo)' },
};

function dayLabel(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const day = DateX.of(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const today = DateX.today();
  if (day === today) return 'bugün';
  if (day === today - 1) return 'dün';
  return dateShort(day).replace(/ \d+$/, '');
}

export const BaseRatePill = ({ compact }) => {
  const app = useApp();
  return html`<button class=${'rate-pill' + (compact ? ' compact' : '')} onClick=${app.editBaseRate}>
    <span>Baz oranım</span><strong>${percent(app.settings.baseRate)}</strong><${Icon} name="edit" size=${14} />
  </button>`;
};

/** Telefonda ekranın üstündeki logo satırı (bilgisayarda yan menüde). */
const MobileHeader = ({ children }) => {
  const app = useApp();
  return html`<header class="app-header mobile-only">
    <div class="ah-row"><${Logo} /><${IconButton} icon="settings" label="Ayarlar" onClick=${() => app.go('settings')} /></div>
    ${children}
  </header>`;
};
const Logo = () => html`<div class="brand"><img src="img/logo.png" alt="" /><span class="wordmark">Ratemi</span></div>`;

// --- Ana sayfa ---

export function HomeScreen() {
  const app = useApp();
  const [filter, setFilter] = useState(null);
  const items = app.records
    .filter((r) => !r.deletedAt && KIND[r.type])
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((r) => ({ r, ...describe(app, r) }));
  const shown = items.filter((x) => !filter || x.r.type === filter);
  return html`
    <div class="screen">
      <${MobileHeader}><div class="ah-pill"><${BaseRatePill} /></div></${MobileHeader}>
      <div class="content home">
        <div class="desk-head desktop-only"><div><h1>Ana sayfa</h1><p class="caption">Ödeme planı, teklif oranı ve değer çevirici</p></div><${BaseRatePill} /></div>
        <div class="home-actions">
          <button class="hero grad-logo" onClick=${app.newPlan}>
            <span class="icon-tile tile-lg on-grad"><${Icon} name="add" size=${26} /></span>
            <span class="grow"><span class="hero-title">Ödeme Planı Oluştur</span><span class="hero-cap">Konut, taşıt, ihtiyaç · iskonto, peşinat, ara ödeme</span></span>
            <${Icon} name="forward" size=${22} />
          </button>
          <div class="tools">
            <button class="tool grad-offer" onClick=${app.newOffer}><span class="icon-tile on-grad"><${Icon} name="trend" /></span><span class="tool-title">Teklifin gerçek oranı</span><span class="tool-cap">IRR analizörü</span></button>
            <button class="tool grad-conv" onClick=${app.newConversion}><span class="icon-tile on-grad"><${Icon} name="clock" /></span><span class="tool-title">Değer çevirici</span><span class="tool-cap">Bugün ↔ gelecek</span></button>
          </div>
        </div>
        <div class="list-head"><span class="section-label">Kayıtlarım · ${shown.length}</span><span class="caption">Kendiliğinden kaydedilir</span></div>
        <div class="filters">
          <${Chip} label="Tümü" selected=${!filter} color="var(--wordmark)" onClick=${() => setFilter(null)} />
          ${Object.entries(KIND).map(([k, v]) => html`<${Chip} label=${v.label} selected=${filter === k} color=${v.color} onClick=${() => setFilter(filter === k ? null : k)} />`)}
        </div>
        ${!shown.length && html`<${Card}><div class="row-title">Henüz kayıt yok</div><p class="caption">Oluşturduğun ödeme planları, teklif oranı ve değer çevirici çalışmaları burada kendiliğinden saklanır.</p></${Card}>`}
        <div class="record-grid">
          ${shown.map(({ r, subtitle, badge }) => html`
            <div class="card record clickable" key=${r.id} onClick=${() => app.openRecord(r)}>
              <${IconTile} icon=${KIND[r.type].icon} tone=${KIND[r.type].tone} />
              <div class="grow min0">
                <div class="row-title clamp2">${r.name || 'Adsız'}</div>
                <div class="caption ellipsis">${[subtitle, dayLabel(r.updatedAt)].filter(Boolean).join(' · ')}</div>
              </div>
              ${badge && html`<${Badge} tone=${KIND[r.type].tone}>${badge}</${Badge}>`}
              <${IconButton} icon="trash" label="Sil" cls="del" onClick=${(e) => { e.stopPropagation(); app.deleteRecord(r.id); }} />
            </div>`)}
        </div>
      </div>
    </div>`;
}

function describe(app, r) {
  if (r.type === 'SCHEDULE') {
    const a = app.analyzePlan(r.data);
    return { subtitle: a.installment != null ? `${a.installmentCount} × ${moneyShort(a.installment)}` : '', badge: a.costRatio != null ? `Maliyet ${percent(a.costRatio)}` : null };
  }
  if (r.type === 'OFFER') {
    const o = r.data.offer, irr = Offers.irr(o);
    return { subtitle: `Peşin ${moneyShort(o.cashPrice)} · ${Offers.rows(o).length} ödeme`, badge: irr ? `IRR ${percent(irr.monthly)}` : null };
  }
  const c = r.data;
  const sub = (c.series ? `Dizi · ${Conversion.targetPeriod(c) === 0 ? 'bugünkü değer' : dateShort(c.to) + ' değeri'}` : c.toFuture ? 'Bugün → gelecek' : 'Gelecek → bugün') + ` · ${percent(c.rate)}`;
  return { subtitle: sub, badge: moneyShort(Conversion.result(c)) };
}

// --- Şablonlar ---

export function templateSummary(t) {
  const i = t.input;
  return [
    `${i.months} ay`,
    i.graceMonths > 0 && `${i.graceMonths} ay ödemesiz`,
    i.rate === 0 ? 'vade farksız' : percent(i.rate),
    i.down.amount > 0 && `peşinat %${editable(Math.round(i.down.amount * 100) / 100)}`,
    i.interims.length && `${i.interims.length} ara ödeme`,
  ].filter(Boolean).join(' · ');
}

export function TemplatesScreen() {
  const app = useApp();
  const list = app.records.filter((r) => r.type === 'TEMPLATE' && !r.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  return html`
    <div class="screen">
      <${MobileHeader} />
      <div class="content">
        <div class="banner grad-logo">
          <h1>Şablonlar</h1>
          <p>Şablon tutarları oran olarak saklar. Liste fiyatını gir; plan anında oluşur ve maliyet oranı şablondakiyle aynı kalır.</p>
        </div>
        <div class="list-head"><span class="section-label">Kayıtlı şablonlar · ${list.length}</span></div>
        ${!list.length && html`<${Card}><div class="row-title">Henüz şablon yok</div><p class="caption">Bir ödeme planında üstteki yer imi simgesine basınca şablon olarak burada saklanır.</p></${Card}>`}
        <div class="record-grid">
          ${list.map((t) => html`
            <div class="card record clickable" key=${t.id} onClick=${() => app.useTemplate(t)}>
              <${IconTile} icon="bookmark" tone="teal" />
              <div class="grow min0">
                <div class="row-title ellipsis">${t.name}</div>
                <div class="caption ellipsis">${templateSummary(t.data)}</div>
                <div class="caption strong tint">Maliyet oranı ${percent(app.templateCost(t.data))} · sabit</div>
              </div>
              <${IconButton} icon="pencil" label="Adını değiştir" cls="del" onClick=${(e) => { e.stopPropagation(); app.renameTemplate(t); }} />
              <${IconButton} icon="trash" label="Sil" cls="del" onClick=${(e) => { e.stopPropagation(); app.deleteRecord(t.id); }} />
            </div>`)}
        </div>
      </div>
    </div>`;
}

// --- Ödeme planı oluştur (4 adım) ---

const STEP_TITLES = ['Kredi ve ürün türü', 'Fiyat ve iskonto', 'Peşinat ve ara ödemeler', 'Taksit, vade farkı ve başlangıç'];

export function WizardScreen() {
  const app = useApp();
  const plan = app.plan;
  const input = plan.input;
  const step = app.step;
  const a = app.analyzePlan({ input });
  const overflow = step >= 2 ? a.schedule.overflow : null;
  const set = (patch) => app.updateInput({ ...input, ...patch });
  return html`
    <div class="screen wizard">
      <${TopBar} title="Ödeme planı oluştur" subtitle=${`Adım ${step + 1} / 4 · ${STEP_TITLES[step]}`} onBack=${app.back} onHome=${() => app.go('home')} />
      <div class="progress">${[0, 1, 2, 3].map((i) => html`<span class=${i <= step ? 'on' : ''} />`)}</div>
      <div class="content narrow">
        ${step === 0 ? html`<${StepType} input=${input} set=${set} />`
          : step === 1 ? html`<${StepPrice} input=${input} set=${set} />`
            : step === 2 ? html`<${StepDown} input=${input} set=${set} />`
              : html`<${StepTerm} input=${input} set=${set} />`}
      </div>
      <div class="bottom-panel">
        <div class="narrow-inner">
          ${overflow && html`<div class="alert">Peşinat ve ara ödemelerin bugünkü değeri (${moneyShort(overflow.lockedPv)}) kampanyalı fiyatı ${moneyShort(overflow.excess)} aşıyor.</div>`}
          <div class="btn-row">
            ${step > 0 && html`<${OutlineButton} icon="back" onClick=${() => app.setStep(step - 1)}>Geri</${OutlineButton}>`}
            ${step < 3
              ? html`<${GradientButton} cls="grow" trailing="forward" disabled=${step === 1 && !(input.listPrice > 0)} onClick=${() => app.setStep(step + 1)}>İleri</${GradientButton}>`
              : html`<${GradientButton} cls="grow" trailing="forward" disabled=${!!overflow} onClick=${app.createPlan}>Planı oluştur</${GradientButton}>`}
          </div>
        </div>
      </div>
    </div>`;
}

function StepType({ input, set }) {
  const app = useApp();
  const t = app.settings.taxes[input.loanType];
  const housing = input.loanType === 'HOUSING';
  const Opt = ({ type, icon, title, caption, tax }) => {
    const on = input.loanType === type;
    return html`<button class=${'type-opt card' + (on ? ' on' : '')} onClick=${() => set({ loanType: type, taxOn: tax })}>
      <span class=${'icon-tile tile-lg ' + (on ? 'tone-strong' : 'tone-blue')}><${Icon} name=${icon} size=${22} /></span>
      <span class="grow"><span class="row-title big">${title}</span><span class="caption">${caption}</span></span>
      ${on && html`<${Icon} name="check" size=${22} cls="tint" />`}
    </button>`;
  };
  return html`
    <div class="type-grid">
      <${Opt} type="HOUSING" icon="house" title="Konut" caption="Daire, arsa, iş yeri" tax=${false} />
      <${Opt} type="VEHICLE" icon="car" title="Taşıt" caption="Otomobil, motosiklet" tax=${true} />
      <${Opt} type="PERSONAL" icon="bag" title="İhtiyaç" caption="Diğer alımlar ve nakit kredi" tax=${true} />
    </div>
    <${Card}>
      <${SwitchRow} title="BSMV ve KKDF dahil et" disabled=${housing} checked=${input.taxOn && !housing} onChange=${(v) => set({ taxOn: v })}
        caption=${housing ? 'Konutta BSMV ve KKDF yok; dahil edilemez.' : `KKDF ${percent(t.kkdf, 0)} + BSMV ${percent(t.bsmv, 0)} vade farkı oranına eklenir.`} />
    </${Card}>
    <p class="caption pad">Kredi tutarını hesaplıyorsan sonraki adımda iskontoyu ve peşinatı kapatman yeterli.</p>`;
}

function StepPrice({ input, set }) {
  const discount = input.discountOn ? valueOf(input.discount, input.listPrice) : 0;
  return html`
    <${BigAmountField} label="Liste fiyatı" value=${input.listPrice > 0 ? input.listPrice : null} autoFocus onChange=${(v) => set({ listPrice: v ?? 0 })} />
    <${SectionCard} title="Peşin iskonto">
      <${SwitchRow} title="İskonto uygula" caption="Varsayılanı Ayarlar'dan değiştirebilirsin" checked=${input.discountOn} onChange=${(v) => set({ discountOn: v })} />
      ${input.discountOn && html`<${AmountPercentFields} value=${input.discount} base=${input.listPrice} onChange=${(v) => set({ discount: v })} />`}
    </${SectionCard}>
    <div class="result grad-logo">
      <div class="r-label">Kampanyalı fiyat</div>
      <div class="r-big">${moneyShort(basePrice(input))}</div>
      <div class="r-note">${discount > 0 ? `Liste fiyatı − peşin iskonto (${moneyShort(discount)})` : 'Peşin iskonto yok; liste fiyatıyla aynı'}</div>
    </div>`;
}

const priceStep = (v) => (v >= 10e6 ? 50000 : v >= 1e6 ? 10000 : v >= 1e5 ? 1000 : v >= 1e4 ? 100 : 10);

function StepDown({ input, set }) {
  const app = useApp();
  const base = basePrice(input);
  const askConflict = (next) => app.sheet(html`<${ConflictSheet} skip=${next.skipOnInterim} onClose=${app.closeSheet}
    onDone=${(skip) => { app.closeSheet(); app.updateInput({ ...next, skipOnInterim: skip }); }} />`);
  const setInterim = (i, x) => set({ interims: input.interims.map((y, j) => (j === i ? x : y)) });
  return html`
    <${SectionCard} title="Peşinat" trailing="kampanyalı fiyatın">
      <${AmountPercentFields} value=${input.down} base=${base} onChange=${(v) => set({ down: v })} />
    </${SectionCard}>
    <${SectionCard} title="Ara ödemeler">
      ${input.interims.length > 0 && html`<div class="interim-head"><span>Ay</span><span>Oran</span><span>Tutar</span><span /></div>`}
      ${input.interims.map((x, i) => {
        const amount = valueOf(x.value, base);
        return html`<div class="interim-row" key=${i}>
          <${StepperField} tone="teal" value=${x.month} step=${1} min=${1} max=${120} display=${(v) => `${v}. ay`} onChange=${(v) => setInterim(i, { ...x, month: v })} />
          <${StepperField} tone="teal" value=${Math.round((base > 0 ? amount / base * 100 : 0) * 100) / 100} step=${0.5} max=${100} display=${(v) => '%' + editable(v)} onChange=${(v) => setInterim(i, { ...x, value: { amount: v, percent: true } })} />
          <${StepperField} tone="teal" value=${Math.round(amount)} step=${priceStep(base)} max=${base} grouping display=${moneyShort} onChange=${(v) => setInterim(i, { ...x, value: { amount: v, percent: false } })} />
          <${IconButton} icon="trash" label="Ara ödemeyi sil" cls="red" onClick=${() => set({ interims: input.interims.filter((_, j) => j !== i) })} />
        </div>`;
      })}
      <${TextAction} icon="add" color="var(--teal)" onClick=${() => {
        const month = Math.min((input.interims.length ? Math.max(...input.interims.map((x) => x.month)) : 0) + 6, Math.max(input.months, 1));
        const next = { ...input, interims: [...input.interims, { month, value: { amount: 10, percent: true } }] };
        app.updateInput(next);
        if (!input.interims.length && Schedules.hasConflict(next)) askConflict(next);
      }}>Ara ödeme ekle</${TextAction}>
      ${input.interims.length > 0 && html`
        <div class="inline-choice">
          <div class="grow"><span class="caption">Ara ödeme ayında</span><div class="row-title">${input.skipOnInterim ? 'O ayın taksiti pas geçilir' : 'Taksit + ara ödeme birlikte'}</div></div>
          <${TextAction} onClick=${() => askConflict(input)}>Değiştir</${TextAction}>
        </div>`}
    </${SectionCard}>`;
}

const yearsText = (m) => (m % 12 === 0 ? `${m / 12} yıl` : m > 12 ? `${Math.floor(m / 12)} yıl ${m % 12} ay` : null);

function StepTerm({ input, set }) {
  const app = useApp();
  const effective = Schedules.rate(input, app.settings.taxes);
  const first = firstInstallmentMonth(input);
  const rateSheet = () => app.sheet(html`<${RateSheet} title="Aylık vade farkı oranı" rate=${input.rate} onClose=${app.closeSheet}
    onDone=${(r) => { app.closeSheet(); set({ rate: r }); }} />`);
  return html`
    <div class="term-grid">
      <${Card} cls="term-card">
        <span class="field-label">Taksit sayısı</span>
        <div class="big-stepper">
          <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ months: Math.max(1, input.months - 1) })} />
          <div class="bs-val"><${NumberField} value=${input.months} inputMode="numeric" onChange=${(v) => v >= 1 && set({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
          <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ months: Math.min(360, input.months + 1) })} />
        </div>
        <div class="caption center">${yearsText(input.months) || ' '}</div>
        <div class="chips-wrap center">${[12, 24, 36, 48, 60, 120].map((m) => html`<${Chip} label=${m} selected=${input.months === m} onClick=${() => set({ months: m })} />`)}</div>
      </${Card}>
      <${Card} cls="term-card">
        <span class="field-label">Aylık vade farkı oranı</span>
        <div class="big-stepper">
          <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ rate: Math.max(0, Math.round((input.rate - 0.0001) * 1e6) / 1e6) })} />
          <button class="bs-rate" onClick=${rateSheet}>${percent(input.rate)}</button>
          <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ rate: Math.round((input.rate + 0.0001) * 1e6) / 1e6 })} />
        </div>
        <div class="caption center">±0,01 puan · dokun: klavyeyle gir</div>
        <div class="chips-wrap center">${[0, 0.0149, 0.0199, 0.0249, 0.0299, 0.0349].map((r) => html`<${Chip} label=${r === 0 ? 'Farksız' : percent(r)} selected=${Math.abs(input.rate - r) < 1e-9} onClick=${() => set({ rate: r })} />`)}</div>
      </${Card}>
    </div>
    <${Card}>
      <div class="grace">
        <div class="grow"><div class="row-title">Ödemesiz dönem</div><div class="caption">${input.graceMonths ? `Taksitler ${input.graceMonths} ay ötelenir` : 'Taksitler hemen başlar'}</div></div>
        <${IconButton} icon="minus" label="Bir ay azalt" cls="filled" onClick=${() => set({ graceMonths: Math.max(0, (input.graceMonths || 0) - 1) })} />
        <span class="grace-val">${input.graceMonths ? `${input.graceMonths} ay` : 'Yok'}</span>
        <${IconButton} icon="add" label="Bir ay artır" cls="filled" onClick=${() => set({ graceMonths: Math.min(60, (input.graceMonths || 0) + 1) })} />
      </div>
      <div class="chips-row">${[0, 3, 6, 12, 24].map((g) => html`<${Chip} label=${g ? `${g} ay` : 'Yok'} selected=${(input.graceMonths || 0) === g} onClick=${() => set({ graceMonths: g })} />`)}</div>
    </${Card}>
    <${Card}>
      <div class="facts3">
        <div><span class="caption">Aylık</span><strong>${percent(effective)}</strong></div>
        <div><span class="caption">Yıllık basit</span><strong>${percent(effective * 12)}</strong></div>
        <div><span class="caption">Yıllık bileşik</span><strong>${percent(Finance.annualCompound(effective))}</strong></div>
      </div>
      ${input.taxOn && effective !== input.rate && html`<p class="caption amber">BSMV ve KKDF dahil (girilen oran ${percent(input.rate)}).</p>`}
    </${Card}>
    <${DateRow} label="İlk taksit" value=${DateX.plusMonths(input.startDate, first)} onChange=${(d) => set({ startDate: DateX.plusMonths(d, -first) })} />`;
}

// --- Plan ---

export function PlanScreen() {
  const app = useApp();
  const plan = app.plan;
  const a = app.analyzePlan(plan);
  const rows = a.rows;
  const start = plan.input.startDate;
  const ops = app.planOps;
  const editRow = (p) => app.sheet(html`<${RowEditSheet} p=${p} rows=${rows} start=${start} rate=${a.schedule.rate} target=${a.schedule.target} onClose=${app.closeSheet}
    onApply=${(amount, shift, locked, scope) => { app.closeSheet(); ops.editRow(p.id, amount, shift, locked, scope); }}
    onDelete=${() => { app.closeSheet(); ops.deleteRow(p.id); }} />`);
  const block = () => {
    const next = Math.min(...rows.filter((r) => r.kind === Kind.INSTALLMENT).map((r) => r.month), 1e9);
    const f = Number.isFinite(next) && next < 1e9 ? next : 1;
    app.sheet(html`<${BlockSheet} from=${f} to=${f + 11} onClose=${app.closeSheet} onDone=${(x, y, amt) => { app.closeSheet(); ops.addBlock(x, y, amt); }} />`);
  };
  const target = () => app.sheet(html`<${TargetCostSheet} current=${a.costRatio || 0} onClose=${app.closeSheet} onDone=${(pct) => { app.closeSheet(); ops.setTargetCost(pct); }} />`);
  const saveTpl = () => {
    const i = plan.input;
    app.sheet(html`<${NameSheet} title="Şablon olarak kaydet" value=${`${i.months} ay ${percent(i.rate)}` + (i.down.amount > 0 && i.down.percent ? ` · %${editable(i.down.amount)} peşinat` : '')}
      onClose=${app.closeSheet} onDone=${(n) => { app.closeSheet(); ops.saveTemplate(n); }} />`);
  };
  const share = () => app.sheet(html`<${ShareSheet} kind="plan" onClose=${app.closeSheet} onPrint=${(f) => { app.closeSheet(); app.print({ kind: 'plan', plan, a, fields: f }); }} />`);
  return html`
    <div class="screen">
      <${TopBar} title="Ödeme planı" subtitle=${plan.name} onBack=${app.back}>
        <${IconButton} icon="undo" label="Geri al" disabled=${!ops.canUndo} onClick=${ops.undo} />
        <${IconButton} icon="edit" label="Girdileri düzenle" onClick=${app.editInputs} />
        <${IconButton} icon="bookmark" label="Şablon olarak kaydet" onClick=${saveTpl} />
        <${IconButton} icon="printer" label="PDF" onClick=${share} />
      </${TopBar}>
      <div class="content plan-layout">
        <aside class="plan-side">
          <div class="pill-row"><${BaseRatePill} compact /><span class="caption">NBD bu oranla hesaplanır</span></div>
          ${a.schedule.overflow
            ? html`<div class="alert">Kilitli ödemelerin bugünkü değeri hedefi ${moneyShort(a.schedule.overflow.excess)} aşıyor. Kilitli satırları azalt ya da girdileri düzenle.</div>`
            : html`<${CostCard} a=${a} onClick=${target} />`}
          ${plan.rows && !rows.some((r) => !r.locked) && html`<p class="caption amber">Dengelenecek kilitsiz taksit yok; maliyet oranı değişebilir.</p>`}
          <div class="legend desktop-only">
            <span><i class="lg-down" />Peşinat</span><span><i class="lg-inst" />Taksit</span><span><i class="lg-interim" />Ara ödeme</span><span><i class="lg-locked" />Elle girilen</span><span><i class="lg-grace" />Ödemesiz</span>
          </div>
        </aside>
        <section class="plan-main">
          <div class="list-head">
            <span class="section-label">Tablo · ${rows.length} satır</span>
            <span class="actions"><${TextAction} icon="add" onClick=${ops.addRow}>Satır</${TextAction}><${TextAction} icon="add" onClick=${block}>Blok taksit</${TextAction}></span>
          </div>
          <div class="ptable">
            <div class="pt-head"><span class="c-no">Sıra</span><span class="c-date">Tarih</span><span class="c-amt">Tutar</span><span class="c-pv">NBD</span><span class="c-lock" /></div>
            ${rows.map((p) => html`<${TableRow} key=${p.id} p=${p} start=${start} pv=${a.pv(p)} onClick=${() => editRow(p)} onLock=${() => ops.toggleLock(p.id)} />`)}
            <div class="pt-total"><span class="c-no">Toplam</span><span class="c-date" /><span class="c-amt">${money(a.total)}</span><span class="c-pv">${moneyShort(a.pvAtBase)}</span><span class="c-lock" /></div>
          </div>
          <p class="caption center pad">Satıra dokun: tutar, ödeme günü, kilit ve silme</p>
        </section>
      </div>
    </div>`;
}

function CostCard({ a, onClick }) {
  const down = a.rows.filter((r) => r.kind === Kind.DOWN).reduce((s, r) => s + r.amount, 0);
  const interims = a.rows.filter((r) => r.kind === Kind.INTERIM);
  const facts = [['Liste fiyatı', moneyShort(a.listPrice)]];
  if (down > 0) facts.push(['Peşinat', moneyShort(down)]);
  if (interims.length) facts.push(['Ara ödemeler', interims.every((r) => r.amount === interims[0].amount) ? `${interims.length} × ${moneyShort(interims[0].amount)}` : `${interims.length} · ${moneyShort(interims.reduce((s, r) => s + r.amount, 0))}`]);
  facts.push([a.installmentCount > 0 ? `${a.installmentCount} × taksit` : 'Taksit', a.installment != null ? money(a.installment) : '—']);
  facts.push(['Toplam ödeme', moneyShort(a.total)]);
  return html`
    <button class="cost-card grad-logo" onClick=${onClick}>
      <div class="cc-top">
        <div><div class="r-label">Maliyet oranı</div><div class="r-big">${a.costRatio != null ? percent(a.costRatio) : '—'}</div></div>
        <div class="right"><div class="r-label">Toplam NBD</div><div class="r-mid">${moneyShort(a.pvAtBase)}</div></div>
      </div>
      <div class="cc-facts">${facts.map(([l, v]) => html`<div class="cc-fact"><span>${l}</span><strong>${v}</strong></div>`)}</div>
      <div class="r-note">Hedef maliyeti değiştirmek için dokun</div>
    </button>`;
}

function TableRow({ p, start, pv, onClick, onLock }) {
  const cls = p.kind === Kind.DOWN ? 'down' : p.kind === Kind.INTERIM ? 'interim' : p.kind === Kind.GRACE ? 'grace' : p.manual ? 'manual' : 'inst';
  const label = p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.INTERIM ? `${p.month}. Ay · ara` : `${p.month}. Ay`;
  return html`
    <div class=${'pt-row ' + cls + (p.locked ? ' locked' : '')} onClick=${onClick} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && onClick()}>
      <span class="c-no"><strong>${label}</strong>${p.shiftDays !== 0 && html`<${Badge} tone="amber">${dayShift(p.shiftDays)}</${Badge}>`}</span>
      <span class="c-date">${dateMid(payDate(p, start))}${p.kind === Kind.GRACE ? ' · ödemesiz' : ''}${p.shiftDays !== 0 ? html`<em> p ${editable(period(p))}</em>` : ''}</span>
      <span class="c-amt">${money(p.amount)}</span>
      <span class="c-pv">${moneyShort(pv)}</span>
      <button class="c-lock icon-btn" title=${p.locked ? 'Kilitli, kilidi aç' : 'Serbest, kilitle'} onClick=${(e) => { e.stopPropagation(); onLock(); }}><${Icon} name=${p.locked ? 'lock' : 'unlock'} size=${17} /></button>
    </div>`;
}

// --- Ödeme dizisi (teklif ve değer çevirici ortak) ---

function PaymentsCard({ offer, onChange, title = 'Ödemeler', grad = 'logo' }) {
  const app = useApp();
  const close = app.closeSheet;
  const downSheet = () => app.sheet(html`<${AmountSheet} grad=${grad} title="Peşinat" caption="Başlangıç günü ödenecek tutar. Peşinat yoksa boş bırak." value=${offer.down}
    onClose=${close} onDone=${(v) => { close(); onChange({ ...offer, down: v ?? 0 }); }} />`);
  const blockSheet = (i) => {
    const b = offer.blocks[i];
    const next = (offer.blocks.length ? Math.max(...offer.blocks.map((x) => x.to)) : 0) + 1;
    app.sheet(html`<${BlockSheet} from=${b ? b.from : next} to=${b ? b.to : next + 11} amount=${b?.amount} onClose=${close}
      onDone=${(f, t, amount) => { close(); const nb = { from: f, to: t, amount }; onChange({ ...offer, blocks: (b ? offer.blocks.map((x, j) => (j === i ? nb : x)) : [...offer.blocks, nb]).sort((x, y) => x.from - y.from) }); }}
      onDelete=${b ? () => { close(); onChange({ ...offer, blocks: offer.blocks.filter((_, j) => j !== i) }); } : null} />`);
  };
  const singleSheet = (i) => {
    const s = offer.singles[i];
    app.sheet(html`<${SingleSheet} month=${s?.month} amount=${s?.amount} onClose=${close}
      onDone=${(m, amount) => { close(); const ns = { month: m, amount }; onChange({ ...offer, singles: (s ? offer.singles.map((x, j) => (j === i ? ns : x)) : [...offer.singles, ns]).sort((x, y) => x.month - y.month) }); }}
      onDelete=${s ? () => { close(); onChange({ ...offer, singles: offer.singles.filter((_, j) => j !== i) }); } : null} />`);
  };
  const Item = ({ t, c, amt, cls, onClick }) => html`
    <button class=${'pay-item ' + cls} onClick=${onClick}><span class="grow"><strong>${t}</strong><span class="caption">${c}</span></span><span class="amt">${amt}</span></button>`;
  return html`
    <${SectionCard} title=${title} trailing=${`Toplam ${moneyShort(Offers.total(offer))}`}>
      <${Item} cls="down" t="Peşinat" c="Başlangıç günü" amt=${moneyShort(offer.down)} onClick=${downSheet} />
      ${offer.blocks.map((b, i) => html`<${Item} cls="block" t=${`${b.from}.–${b.to}. ay · aylık`} c=${`${b.to - b.from + 1} × = ${moneyShort(b.amount * (b.to - b.from + 1))}`} amt=${moneyShort(b.amount)} onClick=${() => blockSheet(i)} />`)}
      ${offer.singles.map((s, i) => html`<${Item} cls="single" t=${`${s.month}. ay`} c="Tek ödeme" amt=${moneyShort(s.amount)} onClick=${() => singleSheet(i)} />`)}
      <div class="btn-row">
        <${OutlineButton} cls="grow" icon="add" onClick=${() => blockSheet(-1)}>Blok ödeme</${OutlineButton}>
        <${OutlineButton} cls="grow" icon="add" color="var(--teal)" onClick=${() => singleSheet(-1)}>Tek ödeme</${OutlineButton}>
      </div>
    </${SectionCard}>`;
}

// --- Teklifin gerçek oranı ---

export function OfferScreen() {
  const app = useApp();
  const rec = app.offer;
  const o = rec.offer;
  const irr = Offers.irr(o);
  const total = Offers.total(o);
  const set = (next) => app.updateOffer({ ...rec, offer: next });
  const share = () => app.sheet(html`<${ShareSheet} kind="offer" onClose=${app.closeSheet} onPrint=${(f) => { app.closeSheet(); app.print({ kind: 'offer', rec, fields: f }); }} />`);
  return html`
    <div class="screen">
      <${TopBar} title="Teklifin gerçek oranı" subtitle="IRR analizörü" onBack=${app.back}>
        ${o.cashPrice > 0 && total > 0 && html`<${IconButton} icon="printer" label="PDF" onClick=${share} />`}
      </${TopBar}>
      <div class="content tool-layout">
        <div class="tool-inputs">
          <${BigAmountField} tone="green" label="Peşin tutar (bugün ödense)" value=${o.cashPrice > 0 ? o.cashPrice : null} onChange=${(v) => set({ ...o, cashPrice: v ?? 0 })} />
          <${PaymentsCard} offer=${o} grad="offer" onChange=${set} />
        </div>
        <div class="tool-result">
          <div class="result grad-offer sticky">
            <div class="two">
              <div><div class="r-label">Aylık IRR</div><div class="r-big">${irr ? percent(irr.monthly) : '—'}</div></div>
              <div><div class="r-label">Yıllık bileşik IRR</div><div class="r-big">${irr ? percent(irr.annual) : '—'}</div></div>
            </div>
            <div class="r-note">${o.cashPrice <= 0 || total <= 0 ? 'Peşin tutarı ve ödemeleri gir; oran burada çıkar.'
              : irr ? `Ödemelerin bugünkü değerini peşin tutara eşitleyen oran · Newton-Raphson, ${irr.steps} adım`
                : 'Ödemeler peşin tutarı karşılamıyor; oran hesaplanamadı.'}</div>
            ${o.cashPrice > 0 && total > 0 && html`<div class="r-note">Toplam ödeme ${money(total)} · fark ${money(total - o.cashPrice)}</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

// --- Değer çevirici ---

export function ConverterScreen() {
  const app = useApp();
  const r = app.conversion;
  const set = (patch) => app.updateConversion({ ...r, ...patch });
  const p = ValueConverter.period(r.from, r.to);
  const nominal = Conversion.nominal(r);
  const ready = nominal > 0;
  const result = Conversion.result(r);
  const base = app.settings.baseRate;
  const today = r.series && r.to === r.from;
  const rateSheet = () => app.sheet(html`<${RateSheet} grad="conv" title="Aylık oran" rate=${r.rate} onClose=${app.closeSheet} onDone=${(v) => { app.closeSheet(); set({ rate: v }); }} />`);
  const share = () => app.sheet(html`<${ShareSheet} kind="conv" onClose=${app.closeSheet} onPrint=${(f) => { app.closeSheet(); app.print({ kind: 'conv', rec: r, fields: f }); }} />`);
  const title = today ? `Bugünkü değeri (${dateShort(r.from)})` : r.series || r.toFuture ? `${dateShort(r.to)} tarihindeki değeri` : `${dateShort(r.from)} tarihindeki karşılığı`;
  return html`
    <div class="screen">
      <${TopBar} title="Değer çevirici" subtitle="Bugünkü değer ↔ gelecek değer" onBack=${app.back}>
        ${ready && html`<${IconButton} icon="printer" label="PDF" onClick=${share} />`}
      </${TopBar}>
      <div class="content tool-layout">
        <div class="tool-inputs">
          <${Segmented} grad="conv" options=${['Tek tutar', 'Ödeme dizisi']} index=${r.series ? 1 : 0}
            onChange=${(i) => set(i === 1 ? { series: true, toFuture: true, to: r.from } : { series: false, toFuture: true })} />
          ${r.series ? html`
            <${DateRow} label="Peşinat tarihi" value=${r.from} onChange=${(d) => set({ from: d, to: Math.max(r.to, d) })} />
            <${PaymentsCard} title="Ödeme dizisi" grad="conv" offer=${r.payments} onChange=${(v) => set({ payments: v })} />
            <${SectionCard} title="Değeri hangi tarihte?">
              <${DateRow} label="Hedef tarih" value=${r.to} min=${r.from} onChange=${(d) => set({ to: Math.max(d, r.from) })} />
              <div class="chips-wrap">
                ${[[0, 'Peşinat günü'], [6, '6 ay sonra'], [12, '1 yıl sonra'], [24, '2 yıl sonra'], [36, '3 yıl sonra'], [48, '4 yıl sonra']].map(([m, l]) => {
                  const d = DateX.plusMonths(r.from, m);
                  return html`<${Chip} label=${l} color="var(--indigo)" selected=${r.to === d} onClick=${() => set({ to: d })} />`;
                })}
              </div>
            </${SectionCard}>`
          : html`
            <${Segmented} options=${['Bugün → Gelecek', 'Gelecek → Bugün']} index=${r.toFuture ? 0 : 1} onChange=${(i) => set({ toFuture: i === 0 })} />
            <${BigAmountField} tone="indigo" label=${r.toFuture ? 'Bugünkü değer' : 'Gelecekteki tutar'} value=${r.amount > 0 ? r.amount : null} resetKey=${r.toFuture} onChange=${(v) => set({ amount: v ?? 0 })} />
            <${DateRow} label=${r.toFuture ? 'Bugünkü tarih' : 'Karşılığı istenen tarih'} value=${r.from} onChange=${(d) => set({ from: d })} />
            <${DateRow} label=${r.toFuture ? 'Hedef tarih' : 'Tutarın tarihi'} value=${r.to} onChange=${(d) => set({ to: d })} />`}
          <button class="card picker-row" onClick=${rateSheet}>
            <span class="grow"><span class="field-label">Aylık oran</span><span class="row-title">${percent(r.rate)}</span></span>
            <span class="caption">${r.rate === base ? 'Baz oran' : `Baz oran ${percent(base)} · bu çalışmaya özel`}</span>
            <${Icon} name="forward" size=${18} />
          </button>
        </div>
        <div class="tool-result">
          <div class="result grad-conv sticky">
            <div class="r-label">${title}</div>
            <div class="r-big">${ready ? money(result) : '—'}</div>
            ${r.series
              ? !ready ? html`<div class="r-note">Ödemeleri gir; sonuç burada çıkar.</div>` : html`
                <div class="r-note">${Offers.rows(r.payments).length} ödeme, toplam ${money(nominal)} · aylık ${percent(r.rate)} bileşik</div>
                ${!today && html`<div class="r-note">Bugünkü değeri ${money(Conversion.seriesPresent(r))} · ${editable(Conversion.targetPeriod(r))} ay sonrası</div>`}
                <div class="r-note">Toplam ödemeye göre fark ${money(result - nominal)}</div>`
              : html`
                <div class="r-note">Dönem ${editable(p)} ay · aylık ${percent(r.rate)} bileşik</div>
                <div class="r-note">${ready ? `Fark ${money(result - r.amount)}` : 'Tutarı gir; sonuç burada çıkar.'}</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

// --- Ayarlar ---

export function SettingsScreen() {
  const app = useApp();
  const s = app.settings;
  const trash = app.records.filter((r) => r.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
  const setTax = (type, key, v) => v != null && app.updateSettings({ ...s, taxes: { ...s.taxes, [type]: { ...s.taxes[type], [key]: v / 100 } } });
  const daysLeft = (r) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - r.deletedAt) / 86400000));
  return html`
    <div class="screen">
      <${TopBar} title="Ayarlar" onBack=${app.back} />
      <div class="content narrow settings">
        <${SectionCard} title="Baz oran">
          <button class="picker-row plain" onClick=${app.editBaseRate}>
            <span class="grow"><span class="row-title">Alternatif maliyet</span><span class="caption">Paranın başka yerde ayda kazandığı · NBD bu oranla hesaplanır</span></span>
            <strong class="tint">${percent(s.baseRate)}</strong><${Icon} name="forward" size=${18} />
          </button>
        </${SectionCard}>
        <${SectionCard} title="Vergiler (KKDF / BSMV)">
          ${[['VEHICLE', 'Taşıt'], ['PERSONAL', 'İhtiyaç']].map(([t, l]) => html`
            <div class="tax-row"><span class="row-title grow">${l}</span>
              <${FieldBox} label="KKDF"><span class="unit">%</span><${NumberField} value=${s.taxes[t].kkdf * 100} onChange=${(v) => setTax(t, 'kkdf', v)} /></${FieldBox}>
              <${FieldBox} label="BSMV"><span class="unit">%</span><${NumberField} value=${s.taxes[t].bsmv * 100} onChange=${(v) => setTax(t, 'bsmv', v)} /></${FieldBox}>
            </div>`)}
          <p class="caption">Konut kredisi muaf. Mevzuat değişirse buradan düzelt.</p>
        </${SectionCard}>
        <${SectionCard} title="Yeni planda peşin iskonto">
          <${SwitchRow} title="Varsayılan olarak açık" checked=${s.discountOn} onChange=${(v) => app.updateSettings({ ...s, discountOn: v })} />
          ${s.discountOn && html`<${FieldBox} label="Varsayılan oran"><span class="unit">%</span><${NumberField} value=${s.discountPercent} onChange=${(v) => v != null && app.updateSettings({ ...s, discountPercent: v })} /></${FieldBox}>`}
        </${SectionCard}>
        <${SectionCard} title="PDF">
          <label class="field-box"><span class="field-label">Hazırlayan</span>
            <input class="text-input" value=${s.salesRep} placeholder="Ad soyad (isteğe bağlı)" onInput=${(e) => app.updateSettings({ ...s, salesRep: e.target.value })} /></label>
        </${SectionCard}>
        <${SectionCard} title="Görünüm">
          <${Segmented} options=${['Sistem', 'Açık', 'Koyu']} index=${['system', 'light', 'dark'].indexOf(s.theme)} onChange=${(i) => app.updateSettings({ ...s, theme: ['system', 'light', 'dark'][i] })} />
        </${SectionCard}>
        <${SectionCard} title="Yedek">
          <p class="caption">Kayıtlar yalnız bu tarayıcıda saklanır. Başka cihaza taşımak ya da korumak için yedek dosyası indir.</p>
          <div class="btn-row">
            <${OutlineButton} cls="grow" icon="download" onClick=${app.exportBackup}>Yedek indir</${OutlineButton}>
            <${OutlineButton} cls="grow" icon="upload" onClick=${app.importBackup}>Yedekten yükle</${OutlineButton}>
          </div>
        </${SectionCard}>
        <${SectionCard} title=${`Çöp kutusu · ${trash.length}`} trailing=${`${TRASH_DAYS} gün saklanır`}>
          ${!trash.length && html`<p class="caption">Çöp kutusu boş.</p>`}
          ${trash.map((r) => html`
            <div class="trash-row" key=${r.id}>
              <div class="grow min0"><div class="row-title ellipsis">${r.name || 'Adsız'}</div><div class="caption">${r.type === 'TEMPLATE' ? 'Şablon' : KIND[r.type]?.label || ''} · ${daysLeft(r)} gün kaldı</div></div>
              <${IconButton} icon="restore" label="Geri getir" onClick=${() => app.restoreRecord(r.id)} />
              <${IconButton} icon="trash" label="Kalıcı sil" cls="red" onClick=${() => app.purgeRecord(r.id)} />
            </div>`)}
          ${trash.length > 0 && html`<${OutlineButton} color="var(--red)" icon="trash" onClick=${app.emptyTrash}>Çöp kutusunu boşalt</${OutlineButton}>`}
        </${SectionCard}>
        <p class="caption center">Ratemi web · hesaplar cihazında yapılır, internete veri gönderilmez.</p>
      </div>
    </div>`;
}

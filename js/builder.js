// Ödeme planı: girdiler ve oluşan plan tek sayfada. Her değişiklik planı anında yeniden hesaplar;
// kayıt isteğe bağlı ("Kaydet"), şablon ayrı düğmeyle.
import { html } from '../vendor/preact-htm.js';
import { Finance, Kind, Schedules, basePrice, valueOf, firstInstallmentMonth, payDate, period, DateX } from './finance.js';
import { money, moneyShort, percent, dateMid, dayShift, editable } from './format.js';
import {
  Icon, IconButton, GradientButton, OutlineButton, TextAction, Chip, Segmented, SwitchRow, Badge,
  NumberField, FieldBox, AmountPercentFields, StepperField, TopBar, useApp,
} from './ui.js';
import { RateSheet, BlockSheet, NameSheet, TargetCostSheet, RowEditSheet, ShareSheet } from './sheets.js';
import { BaseRatePill } from './screens.js';

const priceStep = (v) => (v >= 10e6 ? 50000 : v >= 1e6 ? 10000 : v >= 1e5 ? 1000 : v >= 1e4 ? 100 : 10);
const yearsText = (m) => (m % 12 === 0 ? `${m / 12} yıl` : m > 12 ? `${Math.floor(m / 12)} yıl ${m % 12} ay` : '');
const TYPES = [['HOUSING', 'Konut', false], ['VEHICLE', 'Taşıt', true], ['PERSONAL', 'İhtiyaç', true]];

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

  return html`
    <div class="screen builder">
      <${TopBar} title="Ödeme planı" subtitle=${plan.id ? `${plan.name} · ${status}` : status} onBack=${app.back}>
        <${IconButton} icon="undo" label="Geri al" disabled=${!ops.canUndo} onClick=${ops.undo} />
        <${IconButton} icon="restore" label="Yeni plan (sıfırla)" onClick=${app.resetPlan} />
      </${TopBar}>
      <div class="content builder-layout">
        <section class="b-inputs">
          <${InputsPanel} input=${input} set=${set} />
        </section>
        <section class="b-result" id="plan-result">
          ${!ready ? html`
            <div class="empty-result card">
              <span class="icon-tile tile-lg tone-blue"><${Icon} name="table" size=${24} /></span>
              <div class="row-title">Liste fiyatını gir</div>
              <p class="caption">Plan burada anında oluşur. Oranı, vadeyi, peşinatı değiştirdikçe tablo ve maliyet kendiliğinden güncellenir.</p>
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
            <${ResultPanel} plan=${plan} a=${a} />`}
        </section>
      </div>
      ${ready && !a.schedule.overflow && html`
        <button class="mini-summary grad-logo mobile-only" onClick=${() => document.getElementById('plan-result')?.scrollIntoView({ behavior: 'smooth' })}>
          <span><small>Maliyet</small><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong></span>
          <span><small>${a.installmentCount} × taksit</small><strong>${a.installment != null ? moneyShort(a.installment) : '—'}</strong></span>
          <span><small>Toplam</small><strong>${moneyShort(a.total)}</strong></span>
          <${Icon} name="down" size=${18} />
        </button>`}
    </div>`;
}

// --- Girdiler (eski 4 adım, sıkışık) ---

function InputsPanel({ input, set }) {
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

  return html`
    <div class="card b-sec">
      <div class="b-head"><span class="b-no">1</span>Ürün ve fiyat</div>
      <${Segmented} options=${TYPES.map((x) => x[1])} index=${TYPES.findIndex((x) => x[0] === input.loanType)}
        onChange=${(i) => set({ loanType: TYPES[i][0], taxOn: TYPES[i][2] })} />
      ${!housing && html`<${SwitchRow} title="BSMV ve KKDF dahil" caption=${`KKDF ${percent(t.kkdf, 0)} + BSMV ${percent(t.bsmv, 0)} orana eklenir`} checked=${input.taxOn} onChange=${(v) => set({ taxOn: v })} />`}
      <label class="field-box price-box">
        <span class="field-label">Liste fiyatı</span>
        <span class="field-row"><span class="unit">₺</span><${NumberField} value=${input.listPrice > 0 ? input.listPrice : null} grouping placeholder="0" cls="price" inputMode="numeric" autoFocus=${!(input.listPrice > 0)} onChange=${(v) => set({ listPrice: v ?? 0 })} /></span>
      </label>
      <${SwitchRow} title="Peşin iskonto" caption=${discount > 0 ? `Kampanyalı fiyat ${moneyShort(base)} (−${moneyShort(discount)})` : 'Liste fiyatından düşülür'} checked=${input.discountOn} onChange=${(v) => set({ discountOn: v })} />
      ${input.discountOn && html`<${AmountPercentFields} value=${input.discount} base=${input.listPrice} onChange=${(v) => set({ discount: v })} />`}
    </div>

    <div class="card b-sec">
      <div class="b-head"><span class="b-no">2</span>Peşinat ve ara ödemeler<span class="caption grow right">${input.discountOn ? 'kampanyalı fiyatın' : 'fiyatın'}</span></div>
      <${AmountPercentFields} value=${input.down} base=${base} onChange=${(v) => set({ down: v })} />
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
      <div class="b-row">
        <${TextAction} icon="add" color="var(--teal)" onClick=${() => {
          const month = (input.interims.length ? Math.max(...input.interims.map((x) => x.month)) : 0) + 6;
          set({ interims: [...input.interims, { month, value: { amount: 10, percent: true } }] });
        }}>Ara ödeme ekle</${TextAction}>
      </div>
      ${conflict && html`
        <div class="b-inline">
          <span class="caption">Ara ödeme ayında</span>
          <${Segmented} options=${['Taksit de ödenir', 'Taksit pas geçilir']} index=${input.skipOnInterim ? 1 : 0} onChange=${(i) => set({ skipOnInterim: i === 1 })} />
        </div>`}
    </div>

    <div class="card b-sec">
      <div class="b-head"><span class="b-no">3</span>Vade</div>
      <div class="b-two">
        <div class="b-ctl">
          <span class="field-label">Taksit sayısı</span>
          <div class="b-stepper">
            <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ months: Math.max(1, input.months - 1) })} />
            <div class="bs-val"><${NumberField} value=${input.months} inputMode="numeric" onChange=${(v) => v >= 1 && set({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
            <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ months: Math.min(360, input.months + 1) })} />
          </div>
          <div class="caption center">${yearsText(input.months) || ' '}</div>
        </div>
        <div class="b-ctl">
          <span class="field-label">Ödemesiz dönem</span>
          <div class="b-stepper">
            <${IconButton} icon="minus" label="Bir ay azalt" cls="filled" onClick=${() => set({ graceMonths: Math.max(0, (input.graceMonths || 0) - 1) })} />
            <span class="grace-val">${input.graceMonths ? `${input.graceMonths} ay` : 'Yok'}</span>
            <${IconButton} icon="add" label="Bir ay artır" cls="filled" onClick=${() => set({ graceMonths: Math.min(60, (input.graceMonths || 0) + 1) })} />
          </div>
          <div class="caption center">${input.graceMonths ? 'taksitler ötelenir' : 'taksitler hemen başlar'}</div>
        </div>
      </div>
      <label class="b-ctl b-date row">
        <span class="field-label">İlk taksit</span>
        <span class="b-date-val">${dateMid(DateX.plusMonths(input.startDate, first))}<${Icon} name="calendar" size=${16} /></span>
        <input type="date" value=${DateX.iso(DateX.plusMonths(input.startDate, first))}
          onChange=${(e) => e.target.value && set({ startDate: DateX.plusMonths(DateX.fromIso(e.target.value), -first) })} />
      </label>
      <span class="field-label">Hızlı vade</span>
      <div class="chips-wrap">${[6, 12, 18, 24, 36, 48, 60, 120].map((m) => html`<${Chip} label=${`${m} ay`} selected=${input.months === m} onClick=${() => set({ months: m })} />`)}</div>
    </div>

    <div class="card b-sec">
      <div class="b-head"><span class="b-no">4</span>Aylık vade farkı</div>
      <div class="b-ctl">
        <div class="b-stepper">
          <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ rate: Math.max(0, Math.round((input.rate - 0.0001) * 1e6) / 1e6) })} />
          <button class="bs-rate" onClick=${rateSheet} title="Klavyeyle gir">${percent(input.rate)}</button>
          <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ rate: Math.round((input.rate + 0.0001) * 1e6) / 1e6 })} />
        </div>
        <div class="caption center">${input.taxOn && !housing ? `vergili aylık ${percent(effective)} · ` : ''}yıllık basit ${percent(effective * 12)} · bileşik ${percent(Finance.annualCompound(effective))}</div>
      </div>
      <span class="field-label">Hızlı oran · ortadaki orana dokun: klavyeyle yaz</span>
      <div class="chips-wrap">${[0, 0.0099, 0.0149, 0.0199, 0.0249, 0.0299, 0.0349, 0.0399].map((r) => html`<${Chip} label=${r === 0 ? 'Vade farksız' : percent(r)} selected=${Math.abs(input.rate - r) < 1e-9} onClick=${() => set({ rate: r })} />`)}</div>
    </div>`;
}

// --- Oluşan plan ---

function ResultPanel({ plan, a }) {
  const app = useApp();
  const ops = app.planOps;
  const rows = a.rows;
  const start = plan.input.startDate;
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
    ${a.schedule.overflow
      ? html`<div class="alert">Peşinat, ara ödemeler ve kilitli satırların bugünkü değeri hedefi ${moneyShort(a.schedule.overflow.excess)} aşıyor. Peşinatı / ara ödemeleri azalt ya da kilitleri aç.</div>`
      : html`<${CostCard} a=${a} onClick=${target} />`}
    ${plan.rows && !rows.some((r) => !r.locked) && html`<p class="caption amber">Dengelenecek kilitsiz taksit yok; maliyet oranı değişebilir.</p>`}
    <div class="list-head">
      <span class="section-label">Tablo · ${rows.length} satır</span>
      <span class="actions"><${TextAction} icon="add" onClick=${ops.addRow}>Satır</${TextAction}><${TextAction} icon="add" onClick=${block}>Blok taksit</${TextAction}></span>
    </div>
    <div class="pill-row"><${BaseRatePill} compact /><span class="caption">NBD bu oranla · satıra dokun: düzenle</span></div>
    <div class="ptable">
      <div class="pt-head"><span class="c-no">Sıra</span><span class="c-date">Tarih</span><span class="c-amt">Tutar</span><span class="c-pv">NBD</span><span class="c-lock" /></div>
      ${rows.map((p) => html`<${TableRow} key=${p.id} p=${p} start=${start} pv=${a.pv(p)} onClick=${() => editRow(p)} onLock=${() => ops.toggleLock(p.id)} />`)}
      <div class="pt-total"><span class="c-no">Toplam</span><span class="c-date" /><span class="c-amt">${money(a.total)}</span><span class="c-pv">${moneyShort(a.pvAtBase)}</span><span class="c-lock" /></div>
    </div>`;
}

function CostCard({ a, onClick }) {
  const down = a.rows.filter((r) => r.kind === Kind.DOWN).reduce((s, r) => s + r.amount, 0);
  const interims = a.rows.filter((r) => r.kind === Kind.INTERIM);
  const facts = [['Liste fiyatı', moneyShort(a.listPrice)]];
  if (a.basePrice !== a.listPrice) facts.push(['Kampanyalı fiyat', moneyShort(a.basePrice)]);
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

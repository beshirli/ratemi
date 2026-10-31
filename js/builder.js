// Ödeme planı. Telefon ve dar ekranda adım adım (30 Ekim 2026): 1 Ürün ve fiyat, 2 Peşinat ve ara ödemeler, 3 Vade,
// 4 Aylık vade farkı, 5 Plan; üstteki sekmelerle serbest geçiş, 1–4'te altta ince özet ve Geri / İleri.
// Masaüstünde (WIDE ve üstü) tek sayfa: solda dört girdi bölümü alt alta, sağda anında oluşan plan.
// Her değişiklik planı anında yeniden hesaplar; kayıt isteğe bağlı ("Kaydet"), şablon ayrı düğmeyle.
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { Finance, Kind, Schedules, basePrice, valueOf, firstInstallmentMonth, payDate, period, DateX, isCash, noTerm, creditAmount, SavingsFinance, savingsAmount } from './finance.js';
import { money, moneyShort, percent, dateMid, dayShift, editable } from './format.js';
import {
  Icon, IconButton, GradientButton, OutlineButton, TextAction, Chip, Segmented, SwitchRow, Badge,
  NumberField, FieldBox, AmountPercentFields, StepperField, TopBar, useApp,
} from './ui.js';
import { RateSheet, BlockSheet, NameSheet, TargetCostSheet, RowEditSheet, ShareSheet, LoanSheet, SavingsSheet } from './sheets.js';
import { BaseRatePill } from './screens.js';

const priceStep = (v) => (v >= 10e6 ? 50000 : v >= 1e6 ? 10000 : v >= 1e5 ? 1000 : v >= 1e4 ? 100 : 10);
const yearsText = (m) => (m % 12 === 0 ? `${m / 12} yıl` : m > 12 ? `${Math.floor(m / 12)} yıl ${m % 12} ay` : '');
const TYPES = [['HOUSING', 'Konut', false], ['VEHICLE', 'Taşıt', true], ['PERSONAL', 'İhtiyaç', true]];
const STEPS = ['Ürün', 'Peşinat', 'Kredi', 'Tahsisat', 'Vade', 'Oran', 'Plan'];
const PLAN = 6;
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
  // Peşin satışta vade ve oran adımları yok: Ürün → Peşinat → Plan.
  const cash = isCash(input);
  // Peşin satışta kredi / vade / oran yok; kredi kalanı karşılıyorsa vade / oran yok; Ayarlar'da kredi kapalıysa Kredi adımı yok.
  // Ayarlar'da kredi / tahsisat kapalıysa o adım yok (girilmiş planda kaldırılabilsin diye kalır).
  const visible = cash ? [0, 1, PLAN] : [
    0, 1,
    ...(app.settings.creditEnabled !== false || input.credit ? [2] : []),
    ...(app.settings.savingsEnabled !== false || input.savings ? [3] : []),
    ...(noTerm(input) ? [] : [4, 5]),
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
            ${visible.filter((i) => i < PLAN).map((i, pos) => html`<${InputsPanel} key=${i} input=${input} set=${set} step=${i} number=${pos + 1} />`)}
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
            <span class="st-no">${i < step ? html`<${Icon} name="check" size=${14} />` : pos + 1}</span><span class="st-name">${STEPS[i]}</span>
          </button>`)}
      </div>
      <div class="content builder">
        ${step < PLAN ? html`
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

// --- Girdi adımları (yalnız [step] adımı çizilir) ---

function InputsPanel({ input, set, step, number }) {
  const no = number ? html`<span class="b-no">${number}</span>` : null;
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

  const steps = [
    () => html`
    <div class="card b-sec">
      <div class="b-head">${no}Ürün ve fiyat</div>
      <${Segmented} options=${TYPES.map((x) => x[1])} index=${TYPES.findIndex((x) => x[0] === input.loanType)}
        onChange=${(i) => set({ loanType: TYPES[i][0], taxOn: TYPES[i][2] })} />
      ${!housing && html`<${SwitchRow} title="BSMV ve KKDF dahil" caption=${`KKDF ${percent(t.kkdf, 0)} + BSMV ${percent(t.bsmv, 0)} orana eklenir`} checked=${input.taxOn} onChange=${(v) => set({ taxOn: v })} />`}
      <label class="field-box price-box">
        <span class="field-label">Liste fiyatı</span>
        <span class="field-row"><span class="unit">₺</span><${NumberField} value=${input.listPrice > 0 ? input.listPrice : null} grouping placeholder="0" cls="price" inputMode="numeric" autoFocus=${!(input.listPrice > 0)} onChange=${(v) => set({ listPrice: v ?? 0 })} /></span>
      </label>
      <${SwitchRow} title="Peşin iskonto" caption=${discount > 0 ? `Kampanyalı fiyat ${moneyShort(base)} (−${moneyShort(discount)})` : 'Liste fiyatından düşülür'} checked=${input.discountOn} onChange=${(v) => set({ discountOn: v })} />
      ${input.discountOn && html`<${AmountPercentFields} value=${input.discount} base=${input.listPrice} onChange=${(v) => set({ discount: v })} />`}
    </div>`,

    () => html`
    <div class="card b-sec">
      <div class="b-head">${no}Peşinat ve ara ödemeler<span class="caption grow right">${input.discountOn ? 'kampanyalı fiyatın' : 'fiyatın'}</span></div>
      <${AmountPercentFields} value=${input.down} base=${base} onChange=${(v) => set({ down: v })} />
      ${isCash(input) ? html`
      <div class="cash-note"><${Icon} name="check" size=${20} /><div><strong>Peşin satış</strong><p class="caption">Kampanyalı fiyatın tamamı peşin ödenir; vade, vade farkı ve ara ödeme yok.</p></div></div>` : html`
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
      ${conflict && html`
        <div class="b-inline">
          <span class="caption">Ara ödeme ayında</span>
          <${Segmented} options=${['Taksit de ödenir', 'Taksit pas geçilir']} index=${input.skipOnInterim ? 1 : 0} onChange=${(i) => set({ skipOnInterim: i === 1 })} />
        </div>`}`}
    </div>`,

    () => html`<${CreditStep} input=${input} set=${set} no=${no} />`,
    () => html`<${SavingsStep} input=${input} set=${set} no=${no} />`,

    () => html`
    <div class="card b-sec">
      <div class="b-head">${no}Vade</div>
      <div class="b-ctl">
        <span class="field-label">Taksit sayısı</span>
        <div class="b-stepper">
          <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => set({ months: Math.max(1, input.months - 1) })} />
          <div class="bs-val"><${NumberField} value=${input.months} inputMode="numeric" onChange=${(v) => v >= 1 && set({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
          <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => set({ months: Math.min(360, input.months + 1) })} />
        </div>
        <div class="caption center">${yearsText(input.months) || ' '}</div>
      </div>
      <span class="field-label">Hızlı vade</span>
      <div class="chips-wrap">${[6, 12, 18, 24, 36, 48, 60, 72, 84, 120].map((m) => html`<${Chip} label=${`${m} ay`} selected=${input.months === m} onClick=${() => set({ months: m })} />`)}</div>
      <div class="b-ctl">
        <span class="field-label">Ödemesiz dönem</span>
        <div class="b-stepper">
          <${IconButton} icon="minus" label="Bir ay azalt" cls="filled" onClick=${() => set({ graceMonths: Math.max(0, (input.graceMonths || 0) - 1) })} />
          <span class="grace-val">${input.graceMonths ? `${input.graceMonths} ay` : 'Yok'}</span>
          <${IconButton} icon="add" label="Bir ay artır" cls="filled" onClick=${() => set({ graceMonths: Math.min(60, (input.graceMonths || 0) + 1) })} />
        </div>
        <div class="caption center">${input.graceMonths ? `taksitler ${input.graceMonths} ay ötelenir` : 'taksitler hemen başlar'}</div>
      </div>
      <label class="b-ctl b-date row">
        <span class="field-label">İlk taksit</span>
        <span class="b-date-val">${dateMid(DateX.plusMonths(input.startDate, first))}<${Icon} name="calendar" size=${16} /></span>
        <input type="date" value=${DateX.iso(DateX.plusMonths(input.startDate, first))}
          onChange=${(e) => e.target.value && set({ startDate: DateX.plusMonths(DateX.fromIso(e.target.value), -first) })} />
      </label>
    </div>`,

    () => html`
    <div class="card b-sec">
      <div class="b-head">${no}Aylık vade farkı</div>
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
    </div>`,
  ];
  return steps[step]();
}

// --- Kredi adımı ---

const QUICK_CREDIT_MONTHS = [12, 24, 36, 48, 60, 120];
const QUICK_CREDIT_RATES = [0.0099, 0.0149, 0.0199, 0.0249, 0.0299, 0.0349];
const round6 = (v) => Math.round(v * 1e6) / 1e6;

/**
 * Banka kredisi: tutar (kampanyalı fiyatın yüzdesi ⇄ TL, "Kalanın tamamı"), vade, müşteriye uygulanan aylık oran,
 * katkılı kredide bankanın oranı. Canlı özet: taksit, toplam geri ödeme; katkı yalnız kullanıcıya.
 */
function CreditStep({ input, set, no }) {
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
    <div class="card b-sec">
      <div class="b-head">${no}Banka kredisi${c && html`<span class="caption grow right">kampanyalı fiyatın</span>`}</div>
      <${SwitchRow} title="Banka kredisi kullan" caption="Kredi peşinat gününde firmaya peşin geçer; müşteri bankaya taksitle öder." checked=${!!c}
        onChange=${(on) => set({ credit: on ? { amount: { amount: Math.round(rest), percent: false }, months: input.loanType === 'HOUSING' ? 120 : 36, rate: 0.0249, subsidized: false, bankRate: 0.0249 } : null })} />
      ${c && html`
        <${AmountPercentFields} value=${c.amount} base=${base} onChange=${(v) => setC({ amount: v })} />
        <${OutlineButton} cls="full" icon="check" color="var(--teal)" onClick=${() => setC({ amount: { amount: Math.round(rest), percent: false } })}>Kalanın tamamı (${moneyShort(rest)})</${OutlineButton}>
        <div class="b-ctl">
          <span class="field-label">Kredi vadesi</span>
          <div class="b-stepper">
            <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => setC({ months: Math.max(1, c.months - 1) })} />
            <div class="bs-val"><${NumberField} value=${c.months} inputMode="numeric" onChange=${(v) => v >= 1 && setC({ months: Math.min(360, Math.round(v)) })} /><span>ay</span></div>
            <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => setC({ months: Math.min(360, c.months + 1) })} />
          </div>
          <div class="caption center">${yearsText(c.months) || ' '}</div>
        </div>
        <div class="chips-wrap">${QUICK_CREDIT_MONTHS.map((m) => html`<${Chip} label=${`${m} ay`} selected=${c.months === m} color="var(--teal)" onClick=${() => setC({ months: m })} />`)}</div>
        <div class="b-ctl">
          <span class="field-label">Aylık kredi oranı (müşteri)</span>
          <div class="b-stepper">
            <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => setC({ rate: Math.max(0, round6(c.rate - 0.0001)) })} />
            <button class="bs-rate" onClick=${() => rateSheet('rate', 'Aylık kredi oranı')} title="Klavyeyle gir">${percent(c.rate)}</button>
            <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => setC({ rate: round6(c.rate + 0.0001) })} />
          </div>
          <div class="caption center">${taxRate > 0 ? `KKDF + BSMV ile ${percent(c.rate * (1 + taxRate))}` : 'konut kredisinde vergi yok'}</div>
        </div>
        <div class="chips-wrap">${QUICK_CREDIT_RATES.map((r) => html`<${Chip} label=${percent(r)} selected=${Math.abs(c.rate - r) < 1e-9} color="var(--teal)" onClick=${() => setC({ rate: r })} />`)}</div>
        <${SwitchRow} title="Katkılı kredi" caption="Banka kendi oranıyla hesaplar; farkın bugünkü değerini firmadan peşin alır (maliyete eklenir, müşteri görmez)."
          checked=${!!c.subsidized} onChange=${(on) => setC({ subsidized: on, bankRate: on && !(c.bankRate > c.rate) ? 0.035 : c.bankRate })} />
        ${c.subsidized && html`
          <div class="b-ctl">
            <span class="field-label">Bankanın oranı</span>
            <div class="b-stepper">
              <${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${() => setC({ bankRate: Math.max(0, round6(c.bankRate - 0.0001)) })} />
              <button class="bs-rate" onClick=${() => rateSheet('bankRate', 'Bankanın oranı')} title="Klavyeyle gir">${percent(c.bankRate)}</button>
              <${IconButton} icon="add" label="Artır" cls="filled" onClick=${() => setC({ bankRate: round6(c.bankRate + 0.0001) })} />
            </div>
            <div class="caption center">katkı bu oranla hesaplanır</div>
          </div>`}
        ${loan && html`
          <div class="loan-sum">
            <span><small>Aylık taksit</small><strong>${money(loan.payment)}</strong></span>
            <span><small>Toplam geri ödeme</small><strong>${moneyShort(loan.totalPayment)}</strong></span>
            <span><small>Toplam kâr payı</small><strong>${moneyShort(loan.totalInterest)}</strong></span>
            <span><small>${loan.taxRate > 0 ? 'KKDF + BSMV' : 'Vergi'}</small><strong>${moneyShort(loan.totalTax)}</strong></span>
            ${loan.contribution > 0 && html`<em>Katkı (firma öder): ${moneyShort(loan.contribution)}</em>`}
          </div>
          <${OutlineButton} cls="full" icon="table" color="var(--teal)" onClick=${() => app.sheet(html`<${LoanSheet} loan=${loan} start=${input.startDate} onClose=${app.closeSheet} />`)}>Kredi ödeme planı</${OutlineButton}>`}
        ${noTerm(input) && html`<p class="caption teal">Kredi kalanı karşılıyor: firma vadesi yok, plan peşinat + kredi (+ ara ödemeler).</p>`}`}
    </div>`;
}

// --- Tahsisat adımı ---

/**
 * Tahsisat adımı = tek sayfalık sihirbaz (tasarruf finansmanı). Üstte sonuç: tahsisat ayı ve tarihi, gelecek tutar,
 * bugünkü değeri, tahsisatın kendi maliyeti (tutar − baz oranla bugünkü değeri; firma vadesine yedirilmez) ve maliyet
 * oranına katkısı. Altında sözleşme, şirkete peşinat, vade, taksit modeli (sabit / artan yan yana), organizasyon ücreti,
 * tahsisat ayı ve müşteri taksitleri. Her değişiklik plana anında yansır.
 */
function SavingsStep({ input, set, no }) {
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
  const stepper = (label, value, caption, minus, plus) => html`
    <div class="b-ctl">${label && html`<span class="field-label">${label}</span>`}
      <div class="b-stepper"><${IconButton} icon="minus" label="Azalt" cls="filled" onClick=${minus} /><span class="grace-val">${value}</span><${IconButton} icon="add" label="Artır" cls="filled" onClick=${plus} /></div>
      ${caption && html`<div class="caption center">${caption}</div>`}</div>`;
  // Renkli bölüm kartı: simge, başlık, kısa açıklama; altında içerik.
  const block = (tone, icon, title, caption, body) => html`
    <div class=${'sv-block tone-' + tone}>
      <div class="sv-head"><span class="sv-icon"><${Icon} name=${icon} size=${18} /></span><span><strong>${title}</strong><small>${caption}</small></span></div>
      ${body}
    </div>`;
  const downV = s && (typeof s.down === 'number' ? { amount: s.down, percent: false } : s.down);
  const model = (title, sv, on) => {
    const pl = SavingsFinance.plan({ ...input, savings: sv });
    const cost = pl ? pl.amount - pv(pl) : null;
    return html`<button class=${'model-card' + (on ? ' on' : '')} onClick=${() => up({ growth: sv.growth })}>
      <strong>${title}</strong>
      ${pl && html`<small>Tahsisat</small><b class="teal">${pl.allocationMonth}. ay</b><span>${dateOf(pl.allocationMonth)}</span>
        <small>Tahsisat maliyeti</small><span>${moneyShort(cost)} · ${percent(pl.amount > 0 ? cost / pl.amount : 0)}</span>
        <small>${pl.growth > 0 ? 'İlk / son taksit' : 'Aylık taksit'}</small><span>${pl.growth > 0 ? `${moneyShort(pl.firstPayment)} / ${moneyShort(pl.rows[pl.rows.length - 1].saving)}` : moneyShort(pl.firstPayment)}</span>`}
    </button>`;
  };
  const g = s && s.growth > 0 ? s.growth : 0.01;
  // Tutar silinip yeniden yazılırken (0) de alanlar yerinde kalır; sonuçlar tutar girilince çıkar.
  const amount = plan ? plan.amount : savingsAmount(input);
  const cost = plan ? plan.amount - pv(plan) : 0;
  return html`
    <div class="card b-sec">
      <div class="b-head">${no}Tahsisat (tasarruf finansmanı)</div>
      <${SwitchRow} title="Tahsisat kullan" caption="Tasarruf şirketi tahsisat ayında sözleşme tutarının tamamını firmaya tek seferde öder." checked=${!!s}
        onChange=${(on) => set({ savings: on ? { amount: { amount: Math.round(rest), percent: false }, down: { amount: 0, percent: true }, months: housing ? 120 : 60, feeRate: 0.07, feeInstallments: 4, growth: 0, allocationMonth: null } : null })} />
      ${s && html`
        <div class="alloc-result grad-logo">
          <small>Tahsisat</small>
          ${plan ? html`
            <strong class="big">${plan.allocationMonth}. ay · ${dateOf(plan.allocationMonth)}</strong>
            <small>${plan.manual ? `Elle belirlendi (kurala göre ${plan.computedMonth}. ay)` : "Birikim %45 ve vadenin %45'i kuralıyla"}</small>
            <div class="ar-grid">
              <span><small>Gelecek tutar</small><strong>${moneyShort(plan.amount)}</strong></span>
              <span><small>Bugünkü değeri</small><strong>${moneyShort(pv(plan))}</strong></span>
              <span><small>Tahsisat maliyeti</small><strong>${moneyShort(cost)}<br />${percent(plan.amount > 0 ? cost / plan.amount : 0)} (tutarın)</strong></span>
              <span><small>Maliyet oranına katkı</small><strong>${percent(input.listPrice > 0 ? cost / input.listPrice : 0)}</strong></span>
            </div>
            <small>Baz oran ${percent(app.settings.baseRate)} / ay ile; firma taksitlerine yedirilmez.</small>`
          : html`<strong class="big">Sözleşme tutarını gir</strong><small>Tahsisat ayı, tutarı ve maliyeti burada hesaplanır.</small>`}
        </div>
        ${block('teal', 'bank', 'Sözleşme tutarı', 'tahsisatta firmaya gelen · kampanyalı fiyatın', html`
          <${AmountPercentFields} value=${s.amount} base=${base} onChange=${(v) => up({ amount: v })} />
          <${OutlineButton} cls="full" icon="check" color="var(--teal)" onClick=${() => up({ amount: { amount: Math.round(rest), percent: false } })}>Kalanın tamamı (${moneyShort(rest)})</${OutlineButton}>`)}
        ${block('navy', 'download', 'Şirkete peşinat', 'müşterinin tasarruf şirketine · sözleşme tutarının', html`
          <${AmountPercentFields} value=${downV} base=${amount} onChange=${(v) => up({ down: v })} />
          <div class="chips-wrap">${[0, 10, 20, 30, 40].map((x) => html`<${Chip} label=${x === 0 ? 'Peşinatsız' : '%' + x} color="var(--wordmark)" selected=${!!plan && Math.abs(plan.down - plan.amount * x / 100) < 1} onClick=${() => up({ down: { amount: x, percent: true } })} />`)}</div>`)}
        ${block('blue', 'calendar', 'Sözleşme vadesi', `azami ${housing ? 120 : 60} ay (BDDK)`, html`
          ${stepper(null, `${s.months} ay`, yearsText(s.months) || ' ', () => up({ months: Math.max(2, s.months - 1), allocationMonth: null }), () => up({ months: Math.min(240, s.months + 1), allocationMonth: null }))}
          <div class="chips-wrap">${(housing ? [36, 48, 60, 84, 96, 120] : [24, 36, 48, 60]).map((m) => html`<${Chip} label=${`${m} ay`} selected=${s.months === m} onClick=${() => up({ months: m, allocationMonth: null })} />`)}</div>`)}
        ${block('indigo', 'trend', 'Taksit modeli', 'sabit mi artan mı · dokunarak seç', html`
          <div class="model-cards">${model('Sabit taksit', { ...s, growth: 0 }, !(s.growth > 0))}${model(`Artan (${percent(g, 1)}/ay)`, { ...s, growth: g }, s.growth > 0)}</div>
          ${s.growth > 0 && html`
            ${stepper('Tahsisattan sonra aylık artış', percent(s.growth), 'kira destekli / endeksli model', () => up({ growth: Math.max(0.001, r6(s.growth - 0.001)) }), () => up({ growth: r6(s.growth + 0.001) }))}
            <div class="chips-wrap">${[0.005, 0.01, 0.015, 0.02].map((x) => html`<${Chip} label=${percent(x, 1)} color="var(--indigo)" selected=${Math.abs(s.growth - x) < 1e-9} onClick=${() => up({ growth: x })} />`)}</div>`}`)}
        ${block('amber', 'bag', 'Organizasyon ücreti', `${moneyShort(amount * s.feeRate)} · yarısı peşin, kalanı en fazla 4 taksit`, html`
          ${stepper(null, percent(s.feeRate), 'sözleşme tutarının', () => up({ feeRate: Math.max(0, r6(s.feeRate - 0.0025)) }), () => up({ feeRate: r6(s.feeRate + 0.0025) }))}
          <div class="chips-wrap">${[0.05, 0.06, 0.07, 0.08, 0.10, 0.12].map((x) => html`<${Chip} label=${percent(x, 0)} color="var(--amber)" selected=${Math.abs(s.feeRate - x) < 1e-9} onClick=${() => up({ feeRate: x })} />`)}</div>
          <p class="caption">Kalan ücret 2. taksitten itibaren kaç taksitte?</p>
          <${Segmented} options=${['1', '2', '3', '4']} index=${(s.feeInstallments || 4) - 1} onChange=${(i) => up({ feeInstallments: i + 1 })} />`)}
        ${plan && block('green', 'clock', 'Tahsisat ayı', `kural: birikim ≥ %45 ve vadenin ≥ %45'i → ${plan.computedMonth}. ay`, html`
          <${SwitchRow} title="Elle belirle" caption="Çekilişli modelde ya da şirketin verdiği tarih farklıysa" checked=${s.allocationMonth != null}
            onChange=${(on) => up({ allocationMonth: on ? plan.computedMonth : null })} />
          ${s.allocationMonth != null && stepper(null, `${plan.allocationMonth}. ay`, dateOf(plan.allocationMonth),
            () => up({ allocationMonth: Math.max(1, plan.allocationMonth - 1) }), () => up({ allocationMonth: Math.min(plan.months, plan.allocationMonth + 1) }))}`)}
        ${plan && block('teal', 'house', 'Müşterinin taksitleri', 'tasarruf şirketine ödenecek', html`
          <div class="loan-sum">
            <span><small>${plan.growth > 0 ? 'İlk / son taksit' : 'Aylık taksit'}</small><strong>${plan.growth > 0 ? `${moneyShort(plan.firstPayment)} / ${moneyShort(plan.rows[plan.rows.length - 1].saving)}` : money(plan.firstPayment)}</strong></span>
            <span><small>Peşinat</small><strong>${moneyShort(plan.down)}</strong></span>
            <span><small>Birikim (tahsisatta)</small><strong>${moneyShort(plan.savedAtAllocation)}</strong></span>
            <span><small>Finansman</small><strong>${moneyShort(plan.financing)}</strong></span>
            <span><small>Organizasyon ücreti</small><strong>${moneyShort(plan.fee)}</strong></span>
            <span><small>Müşteri toplamı</small><strong>${moneyShort(plan.totalPaid)}</strong></span>
          </div>
          ${plan.warnings.length ? plan.warnings.map((w) => html`<p class="caption amber">⚠ ${w}</p>`) : html`<p class="caption teal">BDDK sınırları içinde.</p>`}
          <${OutlineButton} cls="full" icon="table" color="var(--teal)" onClick=${() => app.sheet(html`<${SavingsSheet} plan=${plan} start=${input.startDate} onClose=${app.closeSheet} />`)}>Tasarruf ödeme planı</${OutlineButton}>`)}
        ${noTerm(input) && html`<p class="caption teal">Kalan tutar karşılanıyor: firma vadesi yok.</p>`}`}
    </div>`;
}

// --- Oluşan plan ---

function ResultPanel({ plan, a }) {
  const app = useApp();
  const ops = app.planOps;
  const rows = a.rows;
  const start = plan.input.startDate;
  if (isCash(plan.input)) return html`<${CashPanel} plan=${plan} a=${a} />`;
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
      ${rows.map((p) => html`<${TableRow} key=${p.id} p=${p} start=${start} pv=${a.pv(p)} onClick=${() => p.kind !== Kind.CREDIT && p.kind !== Kind.ALLOCATION && editRow(p)} onLock=${() => p.kind !== Kind.CREDIT && p.kind !== Kind.ALLOCATION && ops.toggleLock(p.id)} />`)}
      <div class="pt-total"><span class="c-no">Toplam</span><span class="c-date" /><span class="c-amt">${money(a.total)}</span><span class="c-pv">${moneyShort(a.pvAtBase)}</span><span class="c-lock" /></div>
    </div>
    ${a.loan && html`
      <button class="card loan-card" onClick=${() => app.sheet(html`<${LoanSheet} loan=${a.loan} start=${start} onClose=${app.closeSheet} />`)}>
        <span class="icon-tile tone-teal"><${Icon} name="bank" size=${22} /></span>
        <span class="grow"><span class="row-title">Banka kredisi · ${moneyShort(a.loan.principal)}</span>
          <span class="caption">${a.loan.months} × ${money(a.loan.payment)} · aylık ${percent(a.loan.rate)}${a.loan.taxRate > 0 ? ` (vergili ${percent(a.loan.effectiveRate)})` : ''} · kredi ödeme planı için dokun</span></span>
        <${Icon} name="forward" size=${18} />
      </button>`}
    ${a.savings && html`
      <button class="card loan-card" onClick=${() => app.sheet(html`<${SavingsSheet} plan=${a.savings} start=${start} onClose=${app.closeSheet} />`)}>
        <span class="icon-tile tone-teal"><${Icon} name="clock" size=${22} /></span>
        <span class="grow"><span class="row-title">Tahsisat · ${moneyShort(a.savings.amount)}</span>
          <span class="caption">${a.savings.allocationMonth}. ay (${dateMid(DateX.plusMonths(start, a.savings.allocationMonth))}) · ${a.savings.months} × ${moneyShort(a.savings.firstPayment)}${a.savings.growth > 0 ? ' (artan)' : ''} · tasarruf planı için dokun</span></span>
        <${Icon} name="forward" size=${18} />
      </button>`}`;
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
  const facts = [['Liste fiyatı', moneyShort(a.listPrice)]];
  if (a.basePrice !== a.listPrice) facts.push(['Kampanyalı fiyat', moneyShort(a.basePrice)]);
  if (down > 0) facts.push(['Peşinat', moneyShort(down)]);
  if (a.loan) facts.push(['Banka kredisi', moneyShort(a.loan.principal)]);
  if (a.savings) facts.push([`Tahsisat (${a.savings.allocationMonth}. ay)`, moneyShort(a.savings.amount)]);
  // Tahsisatın kendi maliyeti (firma vadesine yedirilmez): yalnız kullanıcıya.
  if (a.allocationCost > 0) facts.push(['Tahsisat maliyeti', `${moneyShort(a.allocationCost)} · ${percent(a.allocationCost / a.listPrice)}`]);
  if (interims.length) facts.push(['Ara ödemeler', interims.every((r) => r.amount === interims[0].amount) ? `${interims.length} × ${moneyShort(interims[0].amount)}` : `${interims.length} · ${moneyShort(interims.reduce((s, r) => s + r.amount, 0))}`]);
  // Firma vadesi yoksa (kredi kalanı karşılıyor) taksit satırı yok.
  if (a.installmentCount > 0) facts.push([`${a.installmentCount} × taksit`, a.installment != null ? money(a.installment) : '—']);
  facts.push(['Toplam ödeme', moneyShort(a.total)]);
  // Katkılı kredi: yalnız kullanıcıya (müşteri PDF'inde yok).
  if (a.contribution > 0) facts.push(['Kredi katkısı', '−' + moneyShort(a.contribution)]);
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
  const cls = p.kind === Kind.DOWN ? 'down' : p.kind === Kind.CREDIT || p.kind === Kind.ALLOCATION ? 'credit' : p.kind === Kind.INTERIM ? 'interim' : p.kind === Kind.GRACE ? 'grace' : p.manual ? 'manual' : 'inst';
  const label = p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.CREDIT ? 'Banka kredisi' : p.kind === Kind.ALLOCATION ? `${p.month}. Ay · tahsisat` : p.kind === Kind.INTERIM ? `${p.month}. Ay · ara` : `${p.month}. Ay`;
  return html`
    <div class=${'pt-row ' + cls + (p.locked ? ' locked' : '')} onClick=${onClick} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && onClick()}>
      <span class="c-no"><strong>${label}</strong>${p.shiftDays !== 0 && html`<${Badge} tone="amber">${dayShift(p.shiftDays)}</${Badge}>`}</span>
      <span class="c-date">${dateMid(payDate(p, start))}${p.kind === Kind.GRACE ? ' · ödemesiz' : ''}${p.shiftDays !== 0 ? html`<em> p ${editable(period(p))}</em>` : ''}</span>
      <span class="c-amt">${money(p.amount)}</span>
      <span class="c-pv">${moneyShort(pv)}</span>
      ${p.kind === Kind.CREDIT || p.kind === Kind.ALLOCATION ? html`<span class="c-lock" />` : html`<button class="c-lock icon-btn" title=${p.locked ? 'Kilitli, kilidi aç' : 'Serbest, kilitle'} onClick=${(e) => { e.stopPropagation(); onLock(); }}><${Icon} name=${p.locked ? 'lock' : 'unlock'} size=${17} /></button>`}
    </div>`;
}

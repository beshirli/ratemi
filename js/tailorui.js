// Terzi usulü plan ekranı (Android ui/tools/TailorScreen.kt karşılığı).
import { html } from '../vendor/preact-htm.js';
import { DateX, Kind } from './finance.js';
import { moneyShort, percent, dateMid, editable } from './format.js';
import { Icon, IconButton, GradientButton, OutlineButton, Card, SectionCard, Chip, Segmented, SwitchRow, IconTile, BigAmountField, StepperField, TopBar, NumberField, useApp } from './ui.js';

const TYPES = ['HOUSING', 'VEHICLE', 'PERSONAL'];
const pctText = (v) => '%' + editable(Math.round(v * 100) / 100);

export function TailorScreen() {
  const app = useApp();
  const t = app.tailor;
  const set = (patch) => app.updateTailor({ ...t, ...patch });
  const base = t.listPrice * (1 - t.discountPercent / 100);
  const c = t.credit, sv = t.savings;
  const setBalloon = (i, patch) => set({ balloons: t.balloons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const startMonth = new Date(t.startDate * 86400000).getUTCMonth() + 1;
  const january = startMonth === 1 ? 12 : 13 - startMonth;
  const nextJanuary = (() => { for (let m = january; m <= 120; m += 12) if (!t.balloons.some((b) => b.month === m)) return m; return null; })();
  const next = Math.min(120, (t.balloons.length ? Math.max(...t.balloons.map((b) => b.month)) : 0) + 12);
  const r = app.tailorResult;
  return html`
    <div class="screen">
      <${TopBar} title="Terzi usulü plan" subtitle="Müşteriye göre öneri" onBack=${app.back}>
        <${IconButton} icon="undo" label="Temizle" onClick=${app.newTailor} />
      </${TopBar}>
      <div class="content tool-layout">
        <div class="tool-inputs">
          <${SectionCard} title="1 · Ürün ve fiyat">
            <${Segmented} grad="tailor" options=${['Konut', 'Taşıt', 'İhtiyaç']} index=${TYPES.indexOf(t.loanType)} onChange=${(i) => set({ loanType: TYPES[i] })} />
          </${SectionCard}>
          <${BigAmountField} tone="red" label="Liste fiyatı" value=${t.listPrice > 0 ? t.listPrice : null} onChange=${(v) => set({ listPrice: v ?? 0 })} />
          <${Card}>
            <div class="tl-row">
              <div class="grow"><div class="row-title">Peşin iskonto</div><div class="caption">${t.discountPercent > 0 ? `Kampanyalı fiyat ${moneyShort(base)}` : 'İskonto yok'}</div></div>
              <div class="tl-w120"><${StepperField} value=${t.discountPercent} step=${0.5} max=${50} display=${(v) => '%' + editable(v)} onChange=${(v) => set({ discountPercent: v })} /></div>
            </div>
          </${Card}>

          <${SectionCard} title="2 · Müşterinin ödeme gücü">
            <${Power} title="Peşin ödeyebileceği" caption="Peşinat (tasarruf ücretinin peşin yarısı dahil)" value=${t.cashPower} onChange=${(v) => set({ cashPower: v })} />
            <${Power} title="Aylık ödeyebileceği" caption="Firma + banka + tasarruf taksitleri toplamı" value=${t.monthlyPower} onChange=${(v) => set({ monthlyPower: v })} />
            <div class="row-title tl-sub">Balon ödemeler</div>
            ${!t.balloons.length && html`<div class="caption">Yılbaşı, ikramiye gibi toplu ödemeler (isteğe bağlı)</div>`}
            ${t.balloons.map((b, i) => html`
              <div class="tl-balloon" key=${i}>
                <div class="tl-w110"><${StepperField} value=${b.month} step=${1} min=${1} max=${120} display=${(v) => `${v}. ay`} onChange=${(v) => setBalloon(i, { month: Math.round(v) })} /></div>
                <div class="grow"><${StepperField} tone="teal" grouping value=${b.amount} step=${10000} display=${moneyShort} onChange=${(v) => setBalloon(i, { amount: v })} />
                  <div class="caption">${dateMid(DateX.plusMonths(t.startDate, b.month))}</div></div>
                <${IconButton} icon="trash" label="Sil" cls="del" onClick=${() => set({ balloons: t.balloons.filter((_, j) => j !== i) })} />
              </div>`)}
            <div class="tl-two">
              <${OutlineButton} icon="add" color="var(--teal)" onClick=${() => set({ balloons: [...t.balloons, { month: next, amount: 100000 }] })}>Balon ödeme</${OutlineButton}>
              <${OutlineButton} icon="calendar" color="var(--teal)" disabled=${nextJanuary == null}
                onClick=${() => nextJanuary && set({ balloons: [...t.balloons, { month: nextJanuary, amount: 100000 }].sort((a, b) => a.month - b.month) })}>Yılbaşı</${OutlineButton}>
            </div>
            <div class="row-title tl-sub">Azami vade</div>
            <div class="filters">
              ${[null, 24, 36, 60, 120].map((m) => html`<${Chip} label=${m ? `${m} ay` : 'Sınırsız'} selected=${t.maxMonths === m} onClick=${() => set({ maxMonths: m })} />`)}
            </div>
          </${SectionCard}>

          <${SectionCard} title="3 · Banka kredisi ve tasarruf">
            <${SwitchRow} title="Banka kredisi kullanılabilir" caption="Kalanın bir kısmı ya da tamamı kredi; kredi peşinat gününde firmaya geçer" checked=${t.allowCredit} onChange=${(v) => set({ allowCredit: v })} />
            ${t.allowCredit && html`
              <div class="tl-terms tone-blue">
                <div class="tl-three">
                  <${Term} label="Kâr payı /ay"><${StepperField} value=${Math.round(c.rate * 1e4) / 100} step=${0.01} max=${10} display=${(v) => '%' + editable(v)} onChange=${(v) => set({ credit: { ...c, rate: v / 100 } })} /></${Term}>
                  <${Term} label="Vade"><${StepperField} value=${c.months} step=${12} min=${12} max=${240} display=${(v) => `${v} ay`} onChange=${(v) => set({ credit: { ...c, months: Math.round(v) } })} /></${Term}>
                  <${Term} label="En çok"><${StepperField} value=${Math.round(c.maxRatio * 100)} step=${5} min=${5} max=${100} display=${(v) => `%${v}`} onChange=${(v) => set({ credit: { ...c, maxRatio: v / 100 } })} /></${Term}>
                </div>
                <${SwitchRow} title="Katkılı kredi" caption=${c.subsidized ? `Bankanın oranı ${percent(c.bankRate)}; aradaki fark firmaya maliyet` : 'Firma bankaya katkı ödemez'} checked=${c.subsidized} onChange=${(v) => set({ credit: { ...c, subsidized: v } })} />
                ${c.subsidized && html`<${Term} label="Bankanın oranı /ay"><${StepperField} value=${Math.round(c.bankRate * 1e4) / 100} step=${0.01} max=${10} display=${(v) => '%' + editable(v)} onChange=${(v) => set({ credit: { ...c, bankRate: v / 100 } })} /></${Term}>`}
              </div>`}
            <${SwitchRow} title="Tasarruf finansmanına açık" caption="Tahsisatta sözleşme tutarının tamamı firmaya gelir" checked=${t.allowSavings} onChange=${(v) => set({ allowSavings: v })} />
            ${t.allowSavings && html`
              <div class="tl-terms tone-teal">
                <div class="tl-two">
                  <${Term} label="Sözleşme vadesi"><${StepperField} tone="teal" value=${sv.months} step=${12} min=${12} max=${120} display=${(v) => `${v} ay`} onChange=${(v) => set({ savings: { ...sv, months: Math.round(v) } })} /></${Term}>
                  <${Term} label="Organizasyon ücreti"><${StepperField} tone="teal" value=${Math.round(sv.feeRate * 1e4) / 100} step=${0.5} max=${20} display=${(v) => '%' + editable(v)} onChange=${(v) => set({ savings: { ...sv, feeRate: v / 100 } })} /></${Term}>
                </div>
              </div>`}
          </${SectionCard}>

          <${SectionCard} title="4 · Maliyet sınırı">
            <div class="tl-row">
              <div class="caption grow">Firmanın kabul ettiği en yüksek maliyet oranı. Varsayılanı Ayarlar'da; bu müşteri için değiştirebilirsin.</div>
              <div class="tl-w120"><${StepperField} value=${Math.round(t.costLimit * 1e4) / 100} step=${0.5} max=${100} display=${(v) => '%' + editable(v)} onChange=${(v) => set({ costLimit: v / 100 })} /></div>
            </div>
          </${SectionCard}>
        </div>
        <div class="tool-result">
          <div class="tl-results">
            <${GradientButton} grad="tailor" icon="sliders" disabled=${app.tailorBusy || !(base > 0) || !(t.monthlyPower > 0)} onClick=${app.suggestTailor}>
              ${app.tailorBusy ? 'Planlar deneniyor…' : 'Plan öner'}
            </${GradientButton}>
            ${base > 0 && !(t.monthlyPower > 0) && html`<p class="caption center">Önermek için aylık ödeme gücünü gir.</p>`}
            ${!r && base > 0 && t.monthlyPower > 0 && !app.tailorBusy && html`<p class="caption center">Bilgileri girip “Plan öner”e dokun; sınır içindeki en uygun üç plan burada çıkar.</p>`}
            ${r && html`<${Results} r=${r} t=${t} />`}
          </div>
        </div>
      </div>
    </div>`;
}

function Results({ r, t }) {
  if (!r.found) {
    return html`
      <div class="card tl-none">
        <div class="row-title tl-red">Sınırlar içinde plan bulunamadı</div>
        <p>${r.shortfall}</p>
        <div class="caption">${r.tried} plan denendi.</div>
      </div>
      ${r.closest && html`<${OptionCard} title="En yakın plan" note="Sınırları aşıyor" icon="trend" tone="amber" o=${r.closest} t=${t} />`}`;
  }
  const picks = [['En kısa vade', 'clock', r.shortest], ['En düşük taksit', 'download', r.lowestPayment], ['En düşük maliyet', 'trend', r.lowestCost]];
  const tones = ['blue', 'teal', 'green'];
  // Aynı plan birden çok başlıkta çıkarsa tek kartta başlıklar birleşir.
  const groups = [];
  picks.forEach((p, i) => {
    const g = groups.find((x) => x.o === p[2]);
    if (g) g.titles.push(p[0]); else groups.push({ titles: [p[0]], icon: p[1], tone: tones[i], o: p[2] });
  });
  return html`
    <div class="caption tl-count">${r.tried} plan denendi · sınır içinde üç öneri</div>
    ${groups.map((g) => html`<${OptionCard} title=${g.titles.join(' · ')} icon=${g.icon} tone=${g.tone} o=${g.o} t=${t} />`)}`;
}

function OptionCard({ title, note, icon, tone, o, t }) {
  const app = useApp();
  const p = o.plan.input, a = o.analysis;
  const firm = a.rows.some((x) => x.kind === Kind.INSTALLMENT) ? p.months : 0;
  const down = a.rows.filter((x) => x.kind === Kind.DOWN).reduce((s, x) => s + x.amount, 0);
  const load = Math.abs(o.maxMonthly - o.firstMonthly) < 1 ? moneyShort(o.maxMonthly) : `${moneyShort(o.firstMonthly)} → ${moneyShort(o.maxMonthly)}`;
  return html`
    <button class=${'card tl-option tone-' + tone} onClick=${() => app.openTailored(o)}>
      <div class="tl-row">
        <${IconTile} icon=${icon} tone=${tone} />
        <div class="grow"><div class="tl-title">${title}</div>
          <div class="caption">${note || `Son ödeme ${o.lastMonth}. ay · ${dateMid(DateX.plusMonths(t.startDate, o.lastMonth))}`}</div></div>
        <div class="tl-right"><div class="caption">Maliyet</div><div class=${'tl-cost' + (o.cost > t.costLimit + 1e-6 ? ' tl-red' : '')}>${percent(o.cost)}</div></div>
      </div>
      <div class="tl-band"><div><small>Aylık yük</small><strong>${load}</strong></div><div><small>Peşinat</small><strong>${moneyShort(down)}</strong></div></div>
      <div class="tl-facts">
        <div><small>Firma vadesi</small><strong>${firm ? `${firm} ay` : 'Taksit yok'}</strong></div>
        <div><small>Vade farkı</small><strong>${firm ? percent(p.rate) + ' /ay' : '—'}</strong></div>
        ${a.loan && html`<div><small>Banka kredisi</small><strong>${moneyShort(a.loan.principal)} · ${a.loan.months} ay</strong></div>`}
        ${a.savings && html`<div><small>Tahsisat</small><strong>${moneyShort(a.savings.amount)} · ${a.savings.allocationMonth}. ay</strong></div>`}
      </div>
      <div class="tl-open">Planı aç <${Icon} name="forward" size=${18} /></div>
    </button>`;
}

const Power = ({ title, caption, value, onChange }) => html`
  <div class="tl-power">
    <div class="field-label">${title}</div>
    <div class="tl-inline"><span class="unit">₺</span><${NumberField} grouping value=${value > 0 ? value : null} placeholder="0" onChange=${(v) => onChange(v ?? 0)} /></div>
    <div class="caption">${caption}</div>
  </div>`;

const Term = ({ label, children }) => html`<div class="tl-term"><div class="caption">${label}</div>${children}</div>`;

/** Ayarlar › Terzi usulü plan. */
export function TailorSettings() {
  const app = useApp();
  const s = app.settings;
  const c = s.tailorCredit, sv = s.tailorSavings;
  const up = (patch) => app.updateSettings({ ...s, ...patch });
  const pctField = (label, value, onChange) => html`
    <label class="field-box"><span class="field-label">${label}</span><div class="tl-inline"><span class="unit">%</span>
      <${NumberField} value=${Math.round(value * 1e4) / 100} onChange=${(v) => v != null && onChange(v / 100)} /></div></label>`;
  const intField = (label, value, onChange) => html`
    <label class="field-box"><span class="field-label">${label}</span>
      <${NumberField} inputMode="numeric" value=${value} onChange=${(v) => v != null && v >= 1 && onChange(Math.round(v))} /></label>`;
  return html`
    <${SectionCard} title="Terzi usulü plan">
      ${pctField('Maliyet sınırı', s.tailorCostLimit, (v) => up({ tailorCostLimit: v }))}
      <div class="section-label">Banka kredisi</div>
      <div class="tl-two">
        ${pctField('Kâr payı /ay', c.rate, (v) => up({ tailorCredit: { ...c, rate: v } }))}
        ${intField('Vade (ay)', c.months, (v) => up({ tailorCredit: { ...c, months: v } }))}
      </div>
      ${pctField('Fiyatın en çok', c.maxRatio, (v) => up({ tailorCredit: { ...c, maxRatio: Math.min(1, v) } }))}
      <${SwitchRow} title="Katkılı kredi" caption="Bankanın oranıyla aradaki fark firmaya maliyet" checked=${c.subsidized} onChange=${(v) => up({ tailorCredit: { ...c, subsidized: v } })} />
      ${c.subsidized && pctField('Bankanın oranı /ay', c.bankRate, (v) => up({ tailorCredit: { ...c, bankRate: v } }))}
      <div class="section-label">Tasarruf finansmanı</div>
      <div class="tl-two">
        ${intField('Sözleşme vadesi (ay)', sv.months, (v) => up({ tailorSavings: { ...sv, months: Math.min(120, v) } }))}
        ${pctField('Organizasyon ücreti', sv.feeRate, (v) => up({ tailorSavings: { ...sv, feeRate: v } }))}
      </div>
      <p class="caption">Her müşteride Terzi usulü plan ekranında değiştirilebilir.</p>
    </${SectionCard}>`;
}

// PDF çıktıları: tarayıcının yazdırma penceresinde "PDF olarak kaydet". Plan mavi → turkuaz, teklif yeşil, çevirici lila.
import { html } from '../vendor/preact-htm.js';
import { Kind, payDate, Offers, Conversion, ValueConverter, Finance, period, DateX, isCash } from './finance.js';
import { money, moneyShort, percent, dateMid, editable } from './format.js';

const today = () => dateMid(DateX.today());

function Head({ title, grad, rep }) {
  return html`
    <div class="pr-logo"><img src="img/logo.png" alt="" /><span>Ratemi</span></div>
    <div class=${'pr-band grad-' + grad}><div><div class="pr-title">${title}</div><div class="pr-date">${today()}</div></div>${rep && html`<div class="pr-rep">Hazırlayan: ${rep}</div>`}</div>`;
}

function Fields({ f }) {
  const items = [['Ad soyad', f.name], ['Proje', f.project], ['Blok', f.block], ['Kat', f.floor], ['Daire no', f.unit], ['Daire tipi', f.type], ['Satışa esas brüt m²', f.area]]
    .filter(([, v]) => v && String(v).trim());
  if (!items.length) return null;
  return html`<div class="pr-fields">${items.map(([l, v]) => html`<div><span>${l}</span><strong>${v}</strong></div>`)}</div>`;
}

const Box = ({ label, value, tone }) => html`<div class=${'pr-box ' + (tone || '')}><span>${label}</span><strong>${value}</strong></div>`;

export function PrintDoc({ doc, rep }) {
  if (doc.kind === 'plan') return isCash(doc.plan.input) ? html`<${CashDoc} ...${doc} rep=${rep} />` : html`<${PlanDoc} ...${doc} rep=${rep} />`;
  if (doc.kind === 'offer') return html`<${OfferDoc} ...${doc} rep=${rep} />`;
  return html`<${ConvDoc} ...${doc} rep=${rep} />`;
}

/** Peşin satış PDF'i: liste fiyatı, iskonto, peşin satış fiyatı, ödeme günü; tek satırlık tablo. */
function CashDoc({ plan, a, fields, rep }) {
  const showCost = fields.analysis !== false;
  const i = plan.input;
  const discount = i.listPrice - a.basePrice;
  return html`
    <div class="pr-page">
      <${Head} title="Peşin Satış" grad="logo" rep=${rep} />
      <${Fields} f=${fields} />
      <div class="pr-boxes">
        <${Box} label="Liste fiyatı" value=${moneyShort(a.listPrice)} tone="navy" />
        ${discount > 0.5 && html`<${Box} label="Peşin iskonto" value=${moneyShort(discount)} tone="teal" />`}
        <${Box} label="Peşin satış fiyatı" value=${moneyShort(a.basePrice)} tone="blue" />
        <${Box} label="Ödeme günü" value=${dateMid(i.startDate)} tone="navy" />
        <${Box} label="Vade" value="Yok (peşin)" tone="blue" />
        ${showCost && html`<div class="pr-box cost grad-logo"><span>Maliyet oranı</span><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong><em>Baz oran ${percent(a.baseRate)} · NBD ${moneyShort(a.pvAtBase)}</em></div>`}
      </div>
      <table class="pr-table">
        <thead class="grad-logo"><tr><th>Sıra</th><th>Tarih</th><th class="num">Tutar</th>${showCost && html`<th class="num">NBD</th>`}</tr></thead>
        <tbody>
          ${a.rows.map((p) => html`<tr class="down"><td>Peşin ödeme</td><td>${dateMid(payDate(p, i.startDate))}</td><td class="num">${money(p.amount)}</td>${showCost && html`<td class="num">${moneyShort(a.pv(p))}</td>`}</tr>`)}
        </tbody>
        <tfoot><tr><td>Toplam</td><td /><td class="num">${money(a.total)}</td>${showCost && html`<td class="num">${moneyShort(a.pvAtBase)}</td>`}</tr></tfoot>
      </table>
    </div>`;
}

function PlanDoc({ plan, a, fields, rep }) {
  const showCost = fields.analysis !== false;
  const start = plan.input.startDate;
  const down = a.rows.filter((r) => r.kind === Kind.DOWN).reduce((s, r) => s + r.amount, 0);
  const interims = a.rows.filter((r) => r.kind === Kind.INTERIM);
  return html`
    <div class="pr-page">
      <${Head} title="Ödeme Planı" grad="logo" rep=${rep} />
      <${Fields} f=${fields} />
      <div class="pr-boxes">
        <${Box} label="Liste fiyatı" value=${moneyShort(a.listPrice)} tone="navy" />
        ${a.basePrice !== a.listPrice && html`<${Box} label="Kampanyalı fiyat" value=${moneyShort(a.basePrice)} tone="blue" />`}
        ${down > 0 && html`<${Box} label="Peşinat" value=${moneyShort(down)} tone="navy" />`}
        ${a.loan && html`<${Box} label="Banka kredisi" value=${moneyShort(a.loan.principal)} tone="teal" />`}
        ${a.savings && html`<${Box} label=${`Tahsisat (${a.savings.allocationMonth}. ay)`} value=${moneyShort(a.savings.amount)} tone="teal" />`}
        ${interims.length > 0 && html`<${Box} label="Ara ödemeler" value=${`${interims.length} · ${moneyShort(interims.reduce((s, r) => s + r.amount, 0))}`} tone="teal" />`}
        ${a.installmentCount > 0 && html`<${Box} label=${`${a.installmentCount} × taksit`} value=${a.installment != null ? money(a.installment) : '—'} tone="blue" />`}
        <${Box} label="Toplam ödeme" value=${moneyShort(a.total)} tone="blue" />
        ${showCost && html`<div class="pr-box cost grad-logo"><span>Maliyet oranı</span><strong>${a.costRatio != null ? percent(a.costRatio) : '—'}</strong><em>Baz oran ${percent(a.baseRate)} · NBD ${moneyShort(a.pvAtBase)}</em></div>`}
      </div>
      <table class="pr-table">
        <thead class="grad-logo"><tr><th>Sıra</th><th>Tarih</th><th class="num">Tutar</th>${showCost && html`<th class="num">NBD</th>`}</tr></thead>
        <tbody>
          ${a.rows.map((p) => html`<tr class=${p.kind === Kind.DOWN ? 'down' : p.kind === Kind.INTERIM || p.kind === Kind.CREDIT || p.kind === Kind.ALLOCATION ? 'interim' : p.kind === Kind.GRACE ? 'grace' : ''}>
            <td>${p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.CREDIT ? 'Banka kredisi' : p.kind === Kind.ALLOCATION ? `${p.month}. Ay · tahsisat` : p.kind === Kind.INTERIM ? `${p.month}. Ay · ara ödeme` : p.kind === Kind.GRACE ? `${p.month}. Ay · ödemesiz` : `${p.month}. Ay`}</td>
            <td>${dateMid(payDate(p, start))}</td><td class="num">${money(p.amount)}</td>${showCost && html`<td class="num">${moneyShort(a.pv(p))}</td>`}</tr>`)}
        </tbody>
        <tfoot><tr><td>Toplam</td><td /><td class="num">${money(a.total)}</td>${showCost && html`<td class="num">${moneyShort(a.pvAtBase)}</td>`}</tr></tfoot>
      </table>
      ${a.loan && html`<${LoanPart} loan=${a.loan} start=${plan.input.startDate} />`}
      ${a.savings && html`<${SavingsPart} plan=${a.savings} start=${plan.input.startDate} />`}
    </div>`;
}

/** Tasarruf Finansman Ödeme Planı bölümü (müşteri bilgisi). */
function SavingsPart({ plan, start }) {
  return html`
    <h2 class="pr-h2">Tasarruf Finansman Ödeme Planı</h2>
    <div class="pr-boxes">
      <${Box} label="Sözleşme tutarı" value=${moneyShort(plan.amount)} tone="teal" />
      <${Box} label="Şirkete peşinat" value=${moneyShort(plan.down)} tone="teal" />
      <${Box} label="Vade" value=${`${plan.months} ay`} tone="teal" />
      <${Box} label=${plan.growth > 0 ? 'İlk taksit (artan)' : 'Aylık taksit'} value=${money(plan.firstPayment)} tone="teal" />
      <${Box} label="Organizasyon ücreti" value=${moneyShort(plan.fee)} tone="teal" />
      <${Box} label="Tahsisat" value=${`${plan.allocationMonth}. ay · ${dateMid(DateX.plusMonths(start, plan.allocationMonth))}`} tone="teal" />
    </div>
    <table class="pr-table loan">
      <thead class="grad-logo"><tr><th>Ay</th><th>Tarih</th><th class="num">Tasarruf</th><th class="num">Org. ücreti</th><th class="num">Toplam</th><th class="num">Birikim</th></tr></thead>
      <tbody>${plan.rows.map((r) => html`<tr class=${r.allocation ? 'grace' : 'interim'}><td>${r.month === 0 ? 'P' : r.month}</td><td>${dateMid(DateX.plusMonths(start, r.month))}${r.allocation ? ' · tahsisat' : ''}</td>
        <td class="num">${money(r.saving)}</td><td class="num">${r.fee > 0 ? money(r.fee) : '—'}</td><td class="num">${money(r.saving + r.fee)}</td><td class="num">${money(r.cumulative)}</td></tr>`)}</tbody>
      <tfoot><tr><td>Toplam</td><td /><td class="num">${money(plan.rows.reduce((t, r) => t + r.saving, 0))}</td><td class="num">${money(plan.fee)}</td><td class="num">${money(plan.totalPaid)}</td><td /></tr></tfoot>
    </table>`;
}

/** Banka Kredisi Ödeme Planı bölümü (müşteri bilgisi): katkı ve bankanın oranı yazılmaz. */
function LoanPart({ loan, start }) {
  const taxed = loan.taxRate > 0;
  return html`
    <h2 class="pr-h2">Banka Kredisi Ödeme Planı</h2>
    <div class="pr-boxes">
      <${Box} label="Kredi tutarı" value=${moneyShort(loan.principal)} tone="teal" />
      <${Box} label="Vade" value=${`${loan.months} ay`} tone="teal" />
      <${Box} label="Aylık oran" value=${percent(loan.rate) + (taxed ? ` (vergili ${percent(loan.effectiveRate)})` : '')} tone="teal" />
      <${Box} label="Aylık taksit" value=${money(loan.payment)} tone="teal" />
      <${Box} label="Toplam geri ödeme" value=${moneyShort(loan.totalPayment)} tone="teal" />
    </div>
    <table class="pr-table loan">
      <thead class="grad-logo"><tr><th>No</th><th>Tarih</th><th class="num">Taksit</th><th class="num">Anapara</th><th class="num">Kâr payı</th>${taxed && html`<th class="num">Vergi</th>`}<th class="num">Kalan</th></tr></thead>
      <tbody>${loan.rows.map((r) => html`<tr class="interim"><td>${r.month}</td><td>${dateMid(DateX.plusMonths(start, r.month))}</td><td class="num">${money(r.payment)}</td><td class="num">${money(r.principal)}</td><td class="num">${money(r.interest)}</td>${taxed && html`<td class="num">${money(r.tax)}</td>`}<td class="num">${money(r.balance)}</td></tr>`)}</tbody>
      <tfoot><tr><td>Toplam</td><td /><td class="num">${money(loan.totalPayment)}</td><td class="num">${money(loan.principal)}</td><td class="num">${money(loan.totalInterest)}</td>${taxed && html`<td class="num">${money(loan.totalTax)}</td>`}<td /></tr></tfoot>
    </table>`;
}

function PayTable({ rows, start, rate, grad }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pv = (r) => r.amount * Finance.discountFactor(rate, period(r));
  return html`
    <table class="pr-table">
      <thead class=${'grad-' + grad}><tr><th>Sıra</th><th>Tarih</th><th class="num">Tutar</th><th class="num">Bugünkü değer</th></tr></thead>
      <tbody>${rows.map((p) => html`<tr class=${p.kind === Kind.DOWN ? 'down' : p.kind === Kind.INTERIM ? 'interim' : ''}>
        <td>${p.kind === Kind.DOWN ? 'Peşinat' : p.kind === Kind.INTERIM ? `${p.month}. Ay · tek ödeme` : `${p.month}. Ay`}</td>
        <td>${dateMid(payDate(p, start))}</td><td class="num">${money(p.amount)}</td><td class="num">${moneyShort(pv(p))}</td></tr>`)}</tbody>
      <tfoot><tr><td>Toplam</td><td /><td class="num">${money(total)}</td><td class="num">${moneyShort(rows.reduce((s, r) => s + pv(r), 0))}</td></tr></tfoot>
    </table>`;
}

function OfferDoc({ rec, fields, rep }) {
  const o = rec.offer, irr = Offers.irr(o);
  return html`
    <div class="pr-page">
      <${Head} title="Teklifin Gerçek Oranı" grad="offer" rep=${rep} />
      <${Fields} f=${fields} />
      <div class="pr-boxes">
        <${Box} label="Peşin tutar" value=${moneyShort(o.cashPrice)} tone="green" />
        <${Box} label="Toplam ödeme" value=${moneyShort(Offers.total(o))} tone="green" />
        <div class="pr-box cost grad-offer"><span>Aylık IRR</span><strong>${irr ? percent(irr.monthly) : '—'}</strong><em>Yıllık bileşik ${irr ? percent(irr.annual) : '—'}</em></div>
      </div>
      <${PayTable} rows=${Offers.rows(o)} start=${rec.start} rate=${irr ? irr.monthly : 0} grad="offer" />
    </div>`;
}

function ConvDoc({ rec: c, fields, rep }) {
  const result = Conversion.result(c);
  return html`
    <div class="pr-page">
      <${Head} title="Değer Çevirici" grad="conv" rep=${rep} />
      <${Fields} f=${fields} />
      ${c.series ? html`
        <div class="pr-boxes">
          <${Box} label="Toplam ödeme" value=${moneyShort(Conversion.nominal(c))} tone="indigo" />
          <${Box} label="Aylık oran" value=${percent(c.rate)} tone="indigo" />
          <div class="pr-box cost grad-conv"><span>${Conversion.targetPeriod(c) === 0 ? 'Bugünkü değeri' : dateMid(c.to) + ' değeri'}</span><strong>${money(result)}</strong><em>Bugünkü değer ${money(Conversion.seriesPresent(c))}</em></div>
        </div>
        <${PayTable} rows=${Offers.rows(c.payments)} start=${c.from} rate=${c.rate} grad="conv" />`
      : html`
        <div class="pr-boxes">
          <${Box} label=${c.toFuture ? `Tutar (${dateMid(c.from)})` : `Tutar (${dateMid(c.to)})`} value=${money(c.amount)} tone="indigo" />
          <${Box} label="Aylık oran · dönem" value=${`${percent(c.rate)} · ${editable(ValueConverter.period(c.from, c.to))} ay`} tone="indigo" />
          <div class="pr-box cost grad-conv"><span>${c.toFuture ? dateMid(c.to) : dateMid(c.from)} karşılığı</span><strong>${money(result)}</strong><em>Fark ${money(result - c.amount)}</em></div>
        </div>`}
    </div>`;
}

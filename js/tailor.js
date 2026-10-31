// Terzi usulü plan: Android finance/Tailor.kt'nin birebir karşılığı.
import { Finance, Kind, Solve, analyze, noTerm } from './finance.js';

export const TAILOR_TERMS = [6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120];

/** Ayarlar'daki varsayılan koşullar. */
export const defaultCreditTerms = () => ({ rate: 0.0249, months: 120, maxRatio: 0.8, subsidized: false, bankRate: 0.035 });
export const defaultSavingsTerms = () => ({ months: 120, feeRate: 0.07 });

const pct = (v) => '%' + (v * 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v) => '₺' + Math.round(v).toLocaleString('tr-TR');

/** Aday planı kurar: vade farkı maliyet sınırına göre; aylık yük ve son ay. Kurulamıyorsa null. */
function option(draft, t, baseRate, taxes) {
  const zero = Solve.costOf(draft, baseRate, taxes);
  if (zero == null) return null;
  let rate = 0;
  if (!noTerm(draft) && zero > t.costLimit) {
    rate = Solve.rateForCost(draft, t.costLimit, baseRate, taxes);
    if (rate == null) return null;
  }
  const input = { ...draft, rate };
  const plan = { id: 0, name: '', rows: null, balance: null, input };
  const a = analyze(plan, baseRate, taxes);
  if (a.schedule.overflow) return null;
  const monthly = new Map();
  const add = (m, v) => monthly.set(m, (monthly.get(m) || 0) + v);
  a.rows.filter((r) => r.kind === Kind.INSTALLMENT).forEach((r) => add(r.month, r.amount));
  if (a.loan) a.loan.rows.forEach((r) => add(r.month, r.payment));
  if (a.savings) a.savings.rows.filter((r) => r.month > 0).forEach((r) => add(r.month, r.saving + r.fee));
  const last = Math.max(a.rows.reduce((m, r) => Math.max(m, r.month), 0), a.loan ? a.loan.months : 0, a.savings ? a.savings.months : 0);
  const keys = [...monthly.keys()];
  return {
    plan, analysis: a, cost: a.costRatio ?? 1,
    maxMonthly: keys.length ? Math.max(...monthly.values()) : 0,
    firstMonthly: keys.length ? monthly.get(Math.min(...keys)) : 0,
    lastMonth: last,
  };
}

/**
 * Müşterinin gücüne göre olası planları dener (firma vadesi × banka kredisi × tasarruf finansmanı), her birinde vade
 * farkını maliyet sınırına denk getirir, aylık yükü güçle karşılaştırır; üç öneri seçer.
 * t = { loanType, listPrice, discountPercent, cashPower, monthlyPower, balloons: [{month, amount}], maxMonths,
 *       allowCredit, allowSavings, costLimit, credit, savings, startDate }
 */
export function suggest(t, baseRate, taxes) {
  const base = t.listPrice * (1 - t.discountPercent / 100);
  if (!(base > 0)) return { tried: 0, shortfall: 'Liste fiyatını gir.' };
  const balloons = t.balloons.filter((b) => b.amount > 0 && b.month > 0);
  const balloonSum = balloons.reduce((s, b) => s + b.amount, 0);
  const housing = t.loanType === 'HOUSING';
  const candidates = [];
  let tried = 0;
  const creditMax = Math.max(0, base * t.credit.maxRatio);
  for (const creditShare of t.allowCredit ? [0, 0.25, 0.5, 0.75, 1] : [0]) {
    for (const savingsShare of t.allowSavings ? [0, 0.5, 1] : [0]) {
      const restBeforeCredit = Math.max(0, base - t.cashPower - balloonSum);
      const credit = Finance.roundKurus(Math.min(restBeforeCredit, creditMax) * creditShare);
      const savings = Finance.roundKurus(Math.max(0, restBeforeCredit - credit) * savingsShare);
      if ((creditShare > 0 && credit <= 0) || (savingsShare > 0 && savings <= 0)) continue;
      // Tasarruf organizasyon ücretinin peşin yarısı da peşin güçten karşılanır.
      const feeUpfront = Finance.roundKurus(savings * t.savings.feeRate / 2);
      const down = Math.min(Math.max(t.cashPower - feeUpfront, 0), base);
      const firmRest = base - down - credit - savings - balloonSum;
      const terms = firmRest <= 0.5 ? [0] : TAILOR_TERMS.filter((n) => t.maxMonths == null || n <= t.maxMonths);
      for (const n of terms) {
        tried++;
        const input = {
          loanType: t.loanType, taxOn: !housing, listPrice: t.listPrice,
          discountOn: t.discountPercent > 0, discount: { amount: t.discountPercent, percent: true },
          down: { amount: Finance.roundKurus(down), percent: false },
          interims: balloons.map((b) => ({ month: b.month, value: { amount: b.amount, percent: false } })), skipOnInterim: false,
          months: Math.max(1, n), rate: 0, startDate: t.startDate, graceMonths: 0,
          credit: credit > 0 ? { amount: { amount: credit, percent: false }, months: t.credit.months, rate: t.credit.rate, subsidized: t.credit.subsidized, bankRate: t.credit.bankRate } : null,
          savings: savings > 0 ? { amount: { amount: savings, percent: false }, down: { amount: 0, percent: true }, months: t.savings.months, feeRate: t.savings.feeRate, feeInstallments: 4, growth: 0 } : null,
        };
        const o = option(input, t, baseRate, taxes);
        if (o) candidates.push(o);
      }
    }
  }
  const within = (o) => o.cost <= t.costLimit + 1e-6;
  const ok = candidates.filter((o) => o.maxMonthly <= t.monthlyPower + 0.5 && within(o));
  const minBy = (list, ...keys) => list.reduce((best, o) => {
    if (!best) return o;
    for (const k of keys) { const d = k(o) - k(best); if (d < 0) return o; if (d > 0) return best; }
    return best;
  }, null);
  if (!ok.length) {
    const closest = minBy(candidates.filter(within), (o) => o.maxMonthly) || minBy(candidates, (o) => o.cost);
    const shortfall = !closest ? 'Bu bilgilerle plan kurulamadı (peşinat ve balonlar fiyatı aşıyor olabilir).'
      : !within(closest) ? `Maliyet sınırı aşılıyor: en düşük maliyet ${pct(closest.cost)}.`
      : `Aylık ödeme gücü yetmiyor: en az ${money(closest.maxMonthly)} gerekli (${money(closest.maxMonthly - t.monthlyPower)} daha).`;
    return { tried, closest, shortfall };
  }
  return {
    found: true, tried,
    shortest: minBy(ok, (o) => o.lastMonth, (o) => o.cost),
    lowestPayment: minBy(ok, (o) => o.maxMonthly, (o) => o.cost),
    lowestCost: minBy(ok, (o) => o.cost, (o) => o.lastMonth),
  };
}

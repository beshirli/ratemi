// Ratemi finans motoru: Android sürümündeki finance/ paketinin birebir JavaScript karşılığı.
// Tarihler "epoch günü" (1970-01-01'den beri gün) olarak tutulur; ay ekleme Java LocalDate gibi ay sonuna kırpar.

export const DAYS_PER_MONTH = 30;
// CREDIT: banka kredisi (peşinat gününde firmaya peşin geçen tutar, kilitli).
export const Kind = { DOWN: 0, INSTALLMENT: 1, INTERIM: 2, GRACE: 3, CREDIT: 4 };
export const LoanType = { HOUSING: 'HOUSING', VEHICLE: 'VEHICLE', PERSONAL: 'PERSONAL' };

// --- Tarih ---

export const DateX = {
  today() {
    const n = new Date();
    return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000);
  },
  parts(e) {
    const d = new Date(e * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: (d.getUTCDay() + 6) % 7 };
  },
  of(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / 86400000); },
  lengthOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); },
  plusMonths(e, n) {
    const p = DateX.parts(e);
    const total = p.y * 12 + (p.m - 1) + n;
    const y = Math.floor(total / 12), m = total - y * 12 + 1;
    return DateX.of(y, m, Math.min(p.d, DateX.lengthOfMonth(y, m)));
  },
  monthsBetween(a, b) {
    const pa = DateX.parts(a), pb = DateX.parts(b);
    let t = (pb.y * 12 + pb.m) - (pa.y * 12 + pa.m);
    if (t > 0 && pb.d < pa.d) t--;
    else if (t < 0 && pb.d > pa.d) t++;
    return t;
  },
  iso(e) {
    const p = DateX.parts(e);
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  },
  fromIso(s) {
    const [y, m, d] = s.split('-').map(Number);
    return DateX.of(y, m, d);
  },
};

// --- Ödeme ---

export const period = (p) => p.month + (p.shiftDays || 0) / DAYS_PER_MONTH;
export const payDate = (p, start) => DateX.plusMonths(start, p.month) + (p.shiftDays || 0);
export const sortRows = (rows) => [...rows].sort((a, b) => period(a) - period(b) || a.kind - b.kind);
export const pay = (id, month, amount, kind, extra = {}) =>
  ({ id, month, amount, kind, locked: false, shiftDays: 0, manual: false, ...extra });

export const Finance = {
  discountFactor: (rate, p) => (rate === 0 ? 1 : 1 / Math.pow(1 + rate, p)),
  presentValue(rows, rate) { return rows.reduce((s, r) => s + r.amount * Finance.discountFactor(rate, period(r)), 0); },
  effectiveRate: (net, kkdf, bsmv) => net * (1 + kkdf + bsmv),
  annualCompound: (m) => Math.pow(1 + m, 12) - 1,
  roundKurus: (v) => Math.round(v * 100) / 100,

  /** Kilitli satırların PV'si hedeften düşülür, kalan serbest satırlara eşit; kuruş farkı son serbest satıra. */
  rebalance(rows, rate, targetPv) {
    const locked = rows.filter((r) => r.locked), free = rows.filter((r) => !r.locked);
    const lockedPv = Finance.presentValue(locked, rate);
    const rest = targetPv - lockedPv;
    if (!free.length) return { ok: true, rows };
    if (rest < 0) return { ok: false, excess: -rest, lockedPv };
    const factors = free.map((r) => Finance.discountFactor(rate, period(r)));
    const sum = factors.reduce((a, b) => a + b, 0);
    const each = Finance.roundKurus(rest / sum);
    const last = free[free.length - 1];
    const othersPv = factors.slice(0, -1).reduce((s, df) => s + each * df, 0);
    const lastAmount = Finance.roundKurus((rest - othersPv) / factors[factors.length - 1]);
    return {
      ok: true,
      rows: rows.map((r) => (r.locked ? r : { ...r, amount: r.id === last.id ? lastAmount : each })),
    };
  },

  /** İç verim oranı: Newton-Raphson, yakınsamazsa yarılama. Çözüm yoksa null. */
  irr(rows, price, guess = 0.02) {
    const flows = rows.filter((r) => r.amount !== 0);
    if (!flows.length || price <= 0) return null;
    const f = (r) => flows.reduce((s, x) => s + x.amount / Math.pow(1 + r, period(x)), 0) - price;
    const df = (r) => flows.reduce((s, x) => s - period(x) * x.amount / Math.pow(1 + r, period(x) + 1), 0);
    let r = guess;
    for (let step = 1; step <= 50; step++) {
      const v = f(r);
      if (Math.abs(v) < 1e-7) return irrResult(r, step);
      const slope = df(r);
      if (slope === 0 || Number.isNaN(slope)) break;
      const next = r - v / slope;
      if (next <= -0.99 || !Number.isFinite(next)) break;
      if (Math.abs(next - r) < 1e-12) return irrResult(next, step);
      r = next;
    }
    let lo = -0.99, hi = 10;
    if (f(lo) < 0 || f(hi) > 0) return null;
    let steps = 0;
    while (hi - lo > 1e-12 && steps < 300) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
      steps++;
    }
    return irrResult((lo + hi) / 2, steps);
  },
};

const irrResult = (monthly, steps) => ({ monthly, steps, annual: Finance.annualCompound(monthly) });

// --- Ödeme planı ---

/** TL ya da yüzde değer: { amount, percent }. */
export const valueOf = (v, base) => (v.percent ? base * v.amount / 100 : v.amount);
export const basePrice = (i) => i.listPrice - (i.discountOn ? valueOf(i.discount, i.listPrice) : 0);
export const firstInstallmentMonth = (i) => 1 + (i.graceMonths || 0);
/** Peşin satış: peşinat kampanyalı fiyatın tamamı (0,50 TL payla); vade, vade farkı ve ara ödeme yok, plan tek satır. */
export const isCash = (i) => i.listPrice > 0 && valueOf(i.down, basePrice(i)) >= basePrice(i) - 0.5;

/** Banka kredisi tutarı (TL): peşinattan sonra kalanı aşamaz; peşin satışta 0. input.credit = { amount, months, rate, subsidized, bankRate }. */
export function creditAmount(i) {
  const c = i.credit;
  if (!c || isCash(i)) return 0;
  const bp = basePrice(i);
  const max = Math.max(0, bp - valueOf(i.down, bp));
  return Finance.roundKurus(Math.min(Math.max(valueOf(c.amount, bp), 0), max));
}

/** Firma vadesi yok: peşinat + kredi + ara ödemeler kampanyalı fiyatı karşılıyor (0,50 TL payla). */
export function noTerm(i) {
  if (isCash(i)) return false;
  const k = creditAmount(i);
  if (!(k > 0)) return false;
  const bp = basePrice(i);
  return valueOf(i.down, bp) + k + i.interims.reduce((s, x) => s + valueOf(x.value, bp), 0) >= bp - 0.5;
}

/**
 * Banka kredisi: eşit taksitli ödeme planı ve katkı (Android BankLoan ile aynı). Kredi peşinat gününde kullanılır,
 * ilk taksit 1 ay sonra. Vergi ürün türüne göre (konutta yok). Katkı = kredi − müşteri taksitlerinin bankanın
 * (vergili) oranıyla bugünkü değeri; firma peşin öder, maliyete eklenir.
 */
export const BankLoan = {
  payment: (k, r, n) => (r === 0 ? k / n : k * r / (1 - Math.pow(1 + r, -n))),
  plan(input, taxes) {
    const c = input.credit;
    if (!c) return null;
    const principal = creditAmount(input);
    if (!(principal > 0) || !(c.months > 0)) return null;
    const t = taxes[input.loanType] || DefaultTaxes[input.loanType];
    const taxRate = t.kkdf + t.bsmv;
    const each = Finance.roundKurus(BankLoan.payment(principal, c.rate * (1 + taxRate), c.months));
    let balance = principal;
    const rows = [];
    for (let m = 1; m <= c.months; m++) {
      const interest = Finance.roundKurus(balance * c.rate);
      const tax = Finance.roundKurus(interest * taxRate);
      const principalPart = m === c.months ? balance : Finance.roundKurus(each - interest - tax);
      balance = Finance.roundKurus(balance - principalPart);
      rows.push({ month: m, payment: Finance.roundKurus(principalPart + interest + tax), principal: principalPart, interest, tax, balance });
    }
    let contribution = 0;
    if (c.subsidized && c.bankRate > c.rate) {
      const bankEff = c.bankRate * (1 + taxRate);
      contribution = Finance.roundKurus(Math.max(0, principal - rows.reduce((s, r) => s + r.payment / Math.pow(1 + bankEff, r.month), 0)));
    }
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    return {
      principal, months: c.months, rate: c.rate, taxRate, effectiveRate: c.rate * (1 + taxRate), payment: each, rows, contribution,
      totalPayment: sum('payment'), totalInterest: sum('interest'), totalTax: sum('tax'),
    };
  },
};

export const DefaultTaxes = {
  PERSONAL: { kkdf: 0.15, bsmv: 0.15 },
  VEHICLE: { kkdf: 0.15, bsmv: 0.15 },
  HOUSING: { kkdf: 0, bsmv: 0 },
};

export const Schedules = {
  rate(input, taxes) {
    if (!input.taxOn) return input.rate;
    const t = taxes[input.loanType] || DefaultTaxes[input.loanType];
    return Finance.effectiveRate(input.rate, t.kkdf, t.bsmv);
  },

  hasConflict(i) {
    const f = firstInstallmentMonth(i);
    return i.interims.some((x) => x.month >= f && x.month < f + i.months);
  },

  build(plan, taxes) {
    if (isCash(plan.input) || !plan.rows) return Schedules.generate(plan.input, taxes);
    if (!plan.balance) return balanced(plan.rows, Schedules.rate(plan.input, taxes), basePrice(plan.input));
    return balanced(plan.rows, plan.balance.rate, plan.balance.nbd);
  },

  generate(input, taxes) {
    const base = basePrice(input);
    // Peşin satış: tek satır, kampanyalı fiyatın tamamı peşinat gününde.
    if (isCash(input)) return { rows: [pay(1, 0, Finance.roundKurus(base), Kind.DOWN, { locked: true })], rate: Schedules.rate(input, taxes), target: base, overflow: null };
    let id = 1;
    const rows = [];
    const interimMonths = new Set(input.interims.map((x) => x.month));
    const down = Finance.roundKurus(valueOf(input.down, base));
    if (down > 0) rows.push(pay(id++, 0, down, Kind.DOWN, { locked: true }));
    const credit = creditAmount(input);
    if (credit > 0) rows.push(pay(id++, 0, credit, Kind.CREDIT, { locked: true }));
    input.interims.forEach((x) => rows.push(pay(id++, x.month, Finance.roundKurus(valueOf(x.value, base)), Kind.INTERIM, { locked: true })));
    // Firma vadesi yoksa taksit ve ödemesiz ay da yok.
    if (noTerm(input)) return { rows: sortRows(rows), rate: Schedules.rate(input, taxes), target: base, overflow: null };
    const first = firstInstallmentMonth(input);
    for (let m = 1; m < first; m++) if (!interimMonths.has(m)) rows.push(pay(id++, m, 0, Kind.GRACE, { locked: true }));
    for (let m = first; m < first + input.months; m++) {
      if (input.skipOnInterim && interimMonths.has(m)) continue;
      rows.push(pay(id++, m, 0, Kind.INSTALLMENT));
    }
    return balanced(rows, Schedules.rate(input, taxes), base);
  },

  toTemplate(plan, name, baseRate, taxes) {
    const i = plan.input;
    const pct = (v, base) => (v.percent || base <= 0 ? v : { amount: v.amount / base * 100, percent: true });
    const bp = basePrice(i);
    const input = {
      ...i,
      discount: pct(i.discount, i.listPrice),
      down: pct(i.down, bp),
      interims: i.interims.map((x) => ({ ...x, value: pct(x.value, bp) })),
      credit: i.credit ? { ...i.credit, amount: pct(i.credit.amount, bp) } : i.credit,
    };
    const rows = Schedules.build(plan, taxes).rows;
    return { id: 0, name, input, rows, balance: { rate: baseRate, nbd: Finance.presentValue(rows, baseRate) } };
  },

  templateCost(t, baseRate, taxes) {
    const list = t.input.listPrice;
    if (!(list > 0)) return 0;
    const nbd = t.balance ? t.balance.nbd : Finance.presentValue(Schedules.build(t, taxes).rows, baseRate);
    const contribution = BankLoan.plan(t.input, taxes)?.contribution || 0;
    return 1 - (nbd - contribution) / list;
  },

  fromTemplate(t, listPrice, today, baseRate, taxes) {
    const old = t.input;
    const factor = old.listPrice > 0 ? listPrice / old.listPrice : 1;
    const scale = (v) => (v.percent ? v : { ...v, amount: Finance.roundKurus(v.amount * factor) });
    const input = {
      ...old, listPrice, startDate: today,
      discount: scale(old.discount), down: scale(old.down),
      interims: old.interims.map((x) => ({ ...x, value: scale(x.value) })),
      credit: old.credit ? { ...old.credit, amount: scale(old.credit.amount) } : old.credit,
    };
    const cost = Schedules.templateCost(t, baseRate, taxes);
    const rows = (t.rows || Schedules.generate(old, taxes).rows).map((r) => ({ ...r, amount: Finance.roundKurus(r.amount * factor) }));
    // Katkı ayrıca maliyet: tablonun bugünkü değeri katkı kadar yüksek tutulur ki maliyet oranı aynı kalsın.
    const contribution = BankLoan.plan(input, taxes)?.contribution || 0;
    return { id: 0, name: '', input, rows, balance: { rate: baseRate, nbd: listPrice * (1 - cost) + contribution } };
  },
};

function balanced(rows, rate, target) {
  const sorted = sortRows(rows);
  const b = Finance.rebalance(sorted, rate, target);
  return b.ok ? { rows: b.rows, rate, target, overflow: null } : { rows: sorted, rate, target, overflow: b };
}

/** Maliyet bilgi kartı. */
export function analyze(plan, baseRate, taxes) {
  const schedule = Schedules.build(plan, taxes);
  const rows = schedule.rows;
  const listPrice = plan.input.listPrice;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  // Banka kredisi (müşteri bilgisi) ve katkı: katkı firmanın peşin ödediği maliyet.
  const loan = BankLoan.plan(plan.input, taxes);
  const contribution = loan ? loan.contribution : 0;
  const pvAtBase = Finance.presentValue(rows, baseRate) - contribution;
  const inst = rows.filter((r) => r.kind === Kind.INSTALLMENT);
  const pool = inst.filter((r) => !r.locked).length ? inst.filter((r) => !r.locked) : inst;
  const counts = new Map();
  pool.forEach((r) => counts.set(r.amount, (counts.get(r.amount) || 0) + 1));
  let installment = null, best = 0;
  counts.forEach((c, amt) => { if (c > best) { best = c; installment = amt; } });
  return {
    schedule, rows, baseRate, listPrice, total, pvAtBase, loan, contribution,
    basePrice: basePrice(plan.input),
    installmentCount: inst.length, installment,
    pv: (p) => p.amount * Finance.discountFactor(baseRate, period(p)),
    costRatio: listPrice > 0 ? 1 - pvAtBase / listPrice : null,
  };
}

// --- Satır düzenleme ---

/** scope: { type: 'only' | 'after' | 'range' | 'all', from, to } */
export const RowEdits = {
  affected(rows, id, scope) {
    const target = rows.find((r) => r.id === id);
    if (!target) return [];
    return rows.filter((p) => p.id !== id && !p.locked && p.kind === Kind.INSTALLMENT && (
      scope.type === 'after' ? p.month > target.month
        : scope.type === 'range' ? p.month >= scope.from && p.month <= scope.to
          : scope.type === 'all'));
  },
  apply(rows, id, amount, shift, locked, scope) {
    const target = rows.find((r) => r.id === id);
    if (!target) return rows;
    const delta = shift - target.shiftDays;
    const changed = amount != null && amount !== target.amount;
    const others = new Set(RowEdits.affected(rows, id, scope).map((r) => r.id));
    return rows.map((r) => {
      if (r.id === id) {
        return changed
          ? { ...r, amount, shiftDays: shift, locked: true, manual: true, kind: r.kind === Kind.GRACE ? Kind.INSTALLMENT : r.kind }
          : { ...r, shiftDays: shift, locked, manual: locked && r.manual };
      }
      if (others.has(r.id)) {
        return changed ? { ...r, amount, shiftDays: r.shiftDays + delta, locked: true, manual: true } : { ...r, shiftDays: r.shiftDays + delta };
      }
      return r;
    });
  },
};

// --- Teklif (IRR) ve değer çevirici ---

/** offer: { cashPrice, down, blocks: [{from,to,amount}], singles: [{month, amount}] } */
export const Offers = {
  rows(o) {
    let id = 1;
    const rows = [];
    if (o.down > 0) rows.push(pay(id++, 0, o.down, Kind.DOWN, { locked: true }));
    o.blocks.forEach((b) => { for (let m = b.from; m <= b.to; m++) rows.push(pay(id++, m, b.amount, Kind.INSTALLMENT, { locked: true })); });
    o.singles.forEach((s) => rows.push(pay(id++, s.month, s.amount, Kind.INTERIM, { locked: true })));
    return sortRows(rows);
  },
  total: (o) => Offers.rows(o).reduce((s, r) => s + r.amount, 0),
  irr: (o) => Finance.irr(Offers.rows(o), o.cashPrice),
};

export const ValueConverter = {
  period(from, to) {
    const months = DateX.monthsBetween(from, to);
    const days = to - DateX.plusMonths(from, months);
    return months + days / DAYS_PER_MONTH;
  },
  future: (pv, rate, p) => pv / Finance.discountFactor(rate, p),
  present: (fv, rate, p) => fv * Finance.discountFactor(rate, p),
  seriesPresent: (rows, rate) => rows.reduce((s, r) => s + r.amount * Finance.discountFactor(rate, period(r)), 0),
  seriesFuture: (rows, rate, p) => ValueConverter.future(ValueConverter.seriesPresent(rows, rate), rate, p),
};

/** Değer çevirici kaydı: { toFuture, amount, from, to, rate, series, payments } */
export const Conversion = {
  targetPeriod: (c) => (c.series && !c.toFuture ? 0 : Math.max(0, ValueConverter.period(c.from, c.to))),
  result(c) {
    const p = ValueConverter.period(c.from, c.to);
    if (c.series) return ValueConverter.seriesFuture(Offers.rows(c.payments), c.rate, Conversion.targetPeriod(c));
    return c.toFuture ? ValueConverter.future(c.amount, c.rate, p) : ValueConverter.present(c.amount, c.rate, p);
  },
  seriesPresent: (c) => ValueConverter.seriesPresent(Offers.rows(c.payments), c.rate),
  nominal: (c) => (c.series ? Offers.total(c.payments) : c.amount),
};

// --- Hedef maliyetten geriye: hangi vade farkı ya da ne kadar ek nakit indirim? ---

/** Girdilerden oluşan planın maliyet oranı (aşımda null). */
function costOf(input, baseRate, taxes) {
  const a = analyze({ input, rows: null, balance: null }, baseRate, taxes);
  return a.schedule.overflow ? null : a.costRatio;
}

/** Artan ya da azalan f için f(x) = hedef çözümü (yarılama); aralıkta yoksa null. */
function bisect(f, lo, hi, target, increasing) {
  const flo = f(lo), fhi = f(hi);
  if (flo == null || fhi == null) return null;
  const [min, max] = increasing ? [flo, fhi] : [fhi, flo];
  if (target < min - 1e-12 || target > max + 1e-12) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (v == null) return null;
    if ((v < target) === increasing) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const Solve = {
  costOf,
  /** Hedef maliyet oranı için aylık vade farkı (girilen, vergisiz oran). Oran büyüdükçe maliyet düşer. */
  rateForCost(input, target, baseRate, taxes) {
    const r = bisect((x) => costOf({ ...input, rate: x }, baseRate, taxes), 0, 0.5, target, false);
    return r == null ? null : Math.round(r * 1e6) / 1e6;
  },
  /** Mevcut oranla hedef maliyete ulaşmak için toplam peşin indirim (TL). İndirim büyüdükçe maliyet artar. */
  discountForCost(input, target, baseRate, taxes) {
    const withD = (d) => ({ ...input, discountOn: d > 0, discount: { amount: d, percent: false } });
    const f = (x) => costOf(withD(x), baseRate, taxes);
    // Çok büyük indirimde peşinat / ara ödemeler fiyatı aşar; üst sınırı aşımın altına çek.
    let hi = input.listPrice * 0.95;
    for (let i = 0; i < 40 && hi > 1 && f(hi) == null; i++) hi *= 0.85;
    const d = bisect(f, 0, hi, target, true);
    return d == null ? null : Math.round(d);
  },
};

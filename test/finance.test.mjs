// Android FinanceTest'teki örnek rakamlar: node test/finance.test.mjs
import { DateX, Kind, Finance, Schedules, analyze, RowEdits, Offers, ValueConverter, basePrice, Solve, isCash, BankLoan, noTerm, SavingsFinance } from '../js/finance.js';
import { parseNumber } from '../js/format.js';
let fails = 0;
const eq = (name, exp, got, tol = 1e-9) => { const ok = Math.abs(exp - got) <= tol; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${got} (beklenen ${exp})`); };
const taxes = { HOUSING: { kkdf: 0, bsmv: 0 }, VEHICLE: { kkdf: 0.15, bsmv: 0.15 }, PERSONAL: { kkdf: 0.15, bsmv: 0.15 } };
const start = DateX.of(2026, 11, 15);
const sale = { loanType: 'HOUSING', taxOn: false, listPrice: 4500000, discountOn: true, discount: { amount: 5, percent: true }, down: { amount: 30, percent: true },
  interims: [{ month: 6, value: { amount: 300000, percent: false } }, { month: 12, value: { amount: 300000, percent: false } }], skipOnInterim: false, months: 36, rate: 0.02, startDate: start, graceMonths: 0 };
const loan = { loanType: 'PERSONAL', taxOn: true, listPrice: 500000, discountOn: false, discount: { amount: 0, percent: true }, down: { amount: 0, percent: true },
  interims: [{ month: 12, value: { amount: 50000, percent: false } }], skipOnInterim: false, months: 36, rate: 0.0349, startDate: start, graceMonths: 0 };
const inst = (s) => s.rows.filter((r) => r.kind === Kind.INSTALLMENT);

let s = Schedules.generate(loan, taxes);
eq('kredi oranı', 0.04537, s.rate); eq('kredi taksit', 26772.66, inst(s)[0].amount, 0.01); eq('kredi toplam', 1013815.61, s.rows.reduce((a, r) => a + r.amount, 0), 0.5);
s = Schedules.generate(sale, taxes);
eq('esas tutar', 4275000, basePrice(sale)); eq('satış taksit', 97672.57, inst(s)[0].amount, 0.01); eq('satır', 39, s.rows.length);
const a = analyze({ input: sale }, 0.0299, taxes);
eq('toplam', 5398712.35, a.total, 0.5); eq('NBD', 3880148.41, a.pvAtBase, 0.5); eq('maliyet', 0.13774, a.costRatio, 1e-4);
s = Schedules.generate({ ...sale, graceMonths: 6 }, taxes);
eq('ödemesiz ilk taksit ayı', 7, inst(s)[0].month); eq('ödemesiz satır', 5, s.rows.filter((r) => r.kind === Kind.GRACE).length);
s = Schedules.generate({ ...sale, skipOnInterim: true }, taxes); eq('pas geç', 34, inst(s).length);
s = Schedules.generate({ ...sale, down: { amount: 70, percent: true }, interims: [{ month: 6, value: { amount: 300000, percent: false } }, { month: 12, value: { amount: 1500000, percent: false } }] }, taxes);
eq('aşım', 166631.18, s.overflow.excess, 0.01);
const edited = Schedules.generate(sale, taxes).rows.map((r) => r.kind === Kind.INSTALLMENT && r.month === 3 ? { ...r, amount: 120000, locked: true, manual: true }
  : r.kind === Kind.INSTALLMENT && r.month === 4 ? { ...r, shiftDays: 15 } : r);
s = Schedules.build({ input: sale, rows: edited }, taxes); eq('kilit + gün kaydırma', 96851.35, s.rows.find((r) => !r.locked).amount, 0.01);
const tpl = Schedules.toTemplate({ input: sale }, '36 ay', 0.0299, taxes);
const cost = analyze(tpl, 0.0299, taxes).costRatio;
for (const [price, base] of [[2000000, 0.0299], [7250000, 0.035], [1000000, 0.02]]) {
  const p = Schedules.fromTemplate(tpl, price, start, base, taxes); eq(`şablon maliyeti ${price}`, cost, analyze(p, base, taxes).costRatio, 1e-6);
}
const p9 = Schedules.fromTemplate(tpl, 9000000, start, 0.0299, taxes); eq('şablon ölçek', 97672.57 * 2, inst(Schedules.build(p9, taxes))[0].amount, 0.05);
const rows = Schedules.generate(sale, taxes).rows; const m10 = rows.find((r) => r.kind === Kind.INSTALLMENT && r.month === 10);
eq('sonrakiler', 26, RowEdits.affected(rows, m10.id, { type: 'after' }).length); eq('tümü', 35, RowEdits.affected(rows, m10.id, { type: 'all' }).length);
const offer = { cashPrice: 3800000, down: 1000000, blocks: [{ from: 1, to: 12, amount: 120000 }, { from: 13, to: 24, amount: 90000 }], singles: [{ month: 12, amount: 500000 }, { month: 24, amount: 500000 }] };
eq('teklif toplam', 4520000, Offers.total(offer)); eq('IRR', 0.017772, Offers.irr(offer).monthly, 1e-5); eq('IRR yıllık', 0.2354, Offers.irr(offer).annual, 1e-3);
eq('dönem', 12.5, ValueConverter.period(DateX.of(2026, 1, 1), DateX.of(2027, 1, 16)), 1e-12);
eq('ay sonu', DateX.of(2027, 2, 28), DateX.plusMonths(DateX.of(2027, 1, 31), 1));
eq('sayı', 1234567.89, parseNumber('₺1.234.567,89')); eq('sayı2', 500000, parseNumber('500.000')); eq('sayı3', 3.49, parseNumber('3.49'));
// Hedef maliyetten oran ve indirim: bulunan değerle plan kurulunca maliyet hedefe eşit.
const r10 = Solve.rateForCost(sale, 0.10, 0.0299, taxes);
eq('hedef %10 → oran ile maliyet', 0.10, Solve.costOf({ ...sale, rate: r10 }, 0.0299, taxes), 1e-5);
eq('hedef = mevcut → aynı oran', 0.02, Solve.rateForCost(sale, Solve.costOf(sale, 0.0299, taxes), 0.0299, taxes), 1e-6);
const d18 = Solve.discountForCost(sale, 0.18, 0.0299, taxes);
eq('hedef %18 → indirimle maliyet', 0.18, Solve.costOf({ ...sale, discountOn: true, discount: { amount: d18, percent: false } }, 0.0299, taxes), 1e-5);
eq('ulaşılamayan hedef', 1, Solve.rateForCost(sale, 0.9, 0.0299, taxes) === null ? 1 : 0);
// Peşin satış: %100 peşinat → tek satır, kampanyalı fiyat, maliyet = iskonto oranı.
const cash = { ...sale, down: { amount: 100, percent: true } };
eq('peşin satış tanınır', 1, isCash(cash) ? 1 : 0);
const cashA = analyze({ input: cash, rows: null, balance: null }, 0.0299, taxes);
eq('peşin satış tek satır', 1, cashA.rows.length);
eq('peşin satış tutarı', basePrice(cash), cashA.rows[0].amount, 0.001);
eq('peşin satış maliyeti = iskonto', 0.05, cashA.costRatio, 1e-9);
eq('kampanyalı fiyat kadar TL peşinat da peşin', 1, isCash({ ...sale, down: { amount: basePrice(cash), percent: false } }) ? 1 : 0);
// Banka kredisi (Android testleriyle aynı rakamlar).
const kInput = { ...sale, listPrice: 2000000, discountOn: false, down: { amount: 0, percent: true }, interims: [], credit: { amount: { amount: 2000000, percent: false }, months: 60, rate: 0.0099, subsidized: false, bankRate: 0.0099 } };
const kPlan = BankLoan.plan(kInput, taxes);
eq('kredi taksiti (2 mn, 60 ay, %0,99)', 44366, kPlan.payment, 5);
eq('anapara toplamı = kredi', 2000000, kPlan.rows.reduce((s, r) => s + r.principal, 0), 0.01);
eq('son kalan 0', 0, kPlan.rows[kPlan.rows.length - 1].balance, 0.001);
const sub = BankLoan.plan({ ...kInput, credit: { ...kInput.credit, subsidized: true, bankRate: 0.035 } }, taxes);
eq('katkı ≈ 893.000', 893000, sub.contribution, 3000);
const withK = (pct, bank) => ({ ...sale, credit: { amount: { amount: pct, percent: true }, months: 60, rate: 0.0099, subsidized: bank != null, bankRate: bank ?? 0.0099 } });
const aK = analyze({ input: withK(30), rows: null, balance: null }, 0.0299, taxes);
const aS = analyze({ input: withK(30, 0.035), rows: null, balance: null }, 0.0299, taxes);
eq('katkı maliyete eklenir', aK.costRatio + aS.contribution / sale.listPrice, aS.costRatio, 1e-9);
const restIn = { ...sale, credit: { amount: { amount: basePrice(sale) * 0.7 - 600000, percent: false }, months: 120, rate: 0.0119, subsidized: false, bankRate: 0.0119 } };
eq('kredi kalanı karşılıyor: firma vadesi yok', 1, noTerm(restIn) && analyze({ input: restIn, rows: null, balance: null }, 0.0299, taxes).installmentCount === 0 ? 1 : 0);
// Tasarruf finansmanı (belgedeki örnek: 10 mn, 2 mn peşinat, 60 ay, %7).
const svIn = { ...sale, listPrice: 10000000, discountOn: false, down: { amount: 0, percent: true }, interims: [],
  savings: { amount: { amount: 10000000, percent: false }, down: 2000000, months: 60, feeRate: 0.07, feeInstallments: 4, growth: 0, allocationMonth: null } };
const sv = SavingsFinance.plan(svIn);
eq('tasarruf taksiti', 133333.33, sv.firstPayment, 0.01);
eq('tahsisat 19. ay (birikim %45)', 19, sv.allocationMonth);
eq('organizasyon ücreti', 700000, sv.rows.reduce((t, r) => t + r.fee, 0), 0.01);
eq('birikim = sözleşme', 10000000, sv.rows[sv.rows.length - 1].cumulative, 0.001);
const svA = analyze({ input: svIn, rows: null, balance: null }, 0.0299, taxes);
eq('tahsisat satırı firmaya', 1, svA.rows.filter((r) => r.kind === Kind.ALLOCATION && r.month === 19 && Math.abs(r.amount - 10000000) < 0.01).length);
// Süre şartı da %45: peşinatsız 100 ay → 45. ay; %20 peşinatla 32. ay (birikim şartı).
const sv100 = (down) => SavingsFinance.plan({ ...sale, listPrice: 1000000, discountOn: false, down: { amount: 0, percent: true }, interims: [],
  savings: { amount: { amount: 1000000, percent: false }, down, months: 100, feeRate: 0.07, feeInstallments: 4, growth: 0, allocationMonth: null } });
eq('süre %45: 45. ay', 45, sv100(0).allocationMonth);
eq('%20 peşinat: 32. ay', 32, sv100(200000).allocationMonth);
console.log(fails ? `${fails} HATA` : 'Tüm testler geçti');
process.exit(fails ? 1 : 0);

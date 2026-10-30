// Türkçe sayı ve tarih biçimleri: ₺1.234.567,89 · %3,15 · 15 Ara 2026.
import { DateX } from './finance.js';

const fmt = (digits, min = digits) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: min, maximumFractionDigits: digits });
const F2 = fmt(2), F0 = fmt(0), FE = fmt(2, 0);

// Yuvarlanınca sıfır olan küçük eksi değerler ("-0") eksi işaretsiz yazılır.
export const money = (v) => (Math.round(v * 100) < 0 ? '−' : '') + '₺' + F2.format(Math.abs(v));
export const moneyShort = (v) => (Math.round(v) < 0 ? '−' : '') + '₺' + F0.format(Math.round(Math.abs(v)));
export const percent = (rate, digits = 2) => {
  const p = rate * 100;
  return '%' + fmt(digits).format(Math.round(p * 10 ** digits) === 0 ? 0 : p);
};
export const editable = (v) => FE.format(v);

/** "1.234.567,89" → 1234567.89; boş/hatalı → null. */
export function parseNumber(text) {
  const clean = String(text ?? '').replace(/[₺%\s ]/g, '').trim();
  if (!clean) return null;
  let n;
  if (clean.includes(',')) n = clean.replace(/\./g, '').replace(',', '.');
  else if ((clean.match(/\./g) || []).length === 1 && clean.split('.')[1].length !== 3) n = clean;
  else n = clean.replace(/\./g, '');
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/** Yazarken binlik nokta: "1250000" → "1.250.000", ondalık kısım korunur. */
export function groupTyping(text) {
  let s = String(text).replace(/[^\d,]/g, '');
  const i = s.indexOf(',');
  let int = i >= 0 ? s.slice(0, i) : s;
  const dec = i >= 0 ? s.slice(i + 1).replace(/,/g, '').slice(0, 2) : null;
  int = int.replace(/^0+(?=\d)/, '');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec != null ? `${int},${dec}` : int;
}

const MS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const ML = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export const dateShort = (e) => { const p = DateX.parts(e); return `${p.d} ${MS[p.m - 1]} ${p.y}`; };
export const dateMid = (e) => { const p = DateX.parts(e); return `${p.d} ${ML[p.m - 1]} ${p.y}`; };
export const dateLong = (e) => { const p = DateX.parts(e); return `${p.d} ${ML[p.m - 1]} ${p.y}, ${DAYS[p.dow]}`; };
export const dayShift = (d) => (d > 0 ? '+' : '−') + Math.abs(d) + ' gün';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

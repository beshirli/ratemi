// Kayıtlar ve ayarlar tarayıcının yerel deposunda (localStorage) saklanır; internete hiçbir şey gönderilmez.
import { DefaultTaxes } from './finance.js';

const KEY_RECORDS = 'ratemi.records.v1';
const KEY_SETTINGS = 'ratemi.settings.v1';
export const TRASH_DAYS = 30;

export const defaultSettings = () => ({
  baseRate: 0.0299,
  taxes: JSON.parse(JSON.stringify(DefaultTaxes)),
  discountOn: false,
  discountPercent: 5,
  theme: 'system',
  salesRep: '',
});

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* özel pencere ya da dolu depo */ }
}

export function loadSettings() {
  const s = { ...defaultSettings(), ...read(KEY_SETTINGS, {}) };
  s.taxes = { ...DefaultTaxes, ...s.taxes };
  return s;
}

export const saveSettings = (s) => write(KEY_SETTINGS, s);

/** Kayıt: { id, type: SCHEDULE | TEMPLATE | OFFER | CONVERSION, name, data, updatedAt, deletedAt? } */
export function loadRecords() {
  const now = Date.now();
  const all = read(KEY_RECORDS, []);
  // 30 günü geçen çöpler kalıcı silinir.
  const kept = all.filter((r) => !r.deletedAt || now - r.deletedAt < TRASH_DAYS * 86400000);
  if (kept.length !== all.length) write(KEY_RECORDS, kept);
  return kept;
}

export const saveRecords = (records) => write(KEY_RECORDS, records);

const KEY_DRAFT = 'ratemi.draft.v1';
/** Ödeme planı sayfasında çalışılan plan: { plan, dirty }. */
export const loadDraft = () => read(KEY_DRAFT, null);
export const saveDraft = (d) => write(KEY_DRAFT, d);

export const newId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

/** Yedek dosyası: bütün kayıtlar ve ayarlar. */
export function backupJson(records, settings) {
  return JSON.stringify({ app: 'ratemi-web', v: 1, exportedAt: new Date().toISOString(), settings, records: records.filter((r) => !r.deletedAt) }, null, 1);
}

export function parseBackup(text) {
  const o = JSON.parse(text);
  if (!o || o.app !== 'ratemi-web' || !Array.isArray(o.records)) throw new Error('Ratemi yedeği değil');
  return o;
}

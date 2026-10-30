// Uygulama durumu, gezinme ve kayıt işlemleri (Android'deki AppViewModel'in karşılığı).
import { html, render, useState, useEffect, useRef, useMemo } from '../vendor/preact-htm.js';
import { Finance, Kind, Schedules, analyze, RowEdits, Offers, Conversion, sortRows, pay, DateX, basePrice, valueOf, isCash } from './finance.js';
import { moneyShort, percent, editable, dateShort } from './format.js';
import { AppCtx, Icon, Logo } from './ui.js';
import { HomeScreen, TemplatesScreen, OfferScreen, ConverterScreen, SettingsScreen, BaseRatePill } from './screens.js';
import { PlanBuilderScreen } from './builder.js';
import { LoginScreen, Splash } from './account.js';
import { RateSheet, AmountSheet, NameSheet } from './sheets.js';
import { PrintDoc } from './print.js';
import { loadSettings, saveSettings, loadRecords, saveRecords, newId, backupJson, parseBackup, loadDraft, saveDraft } from './store.js';

const emptyOffer = () => ({ cashPrice: 0, down: 0, blocks: [], singles: [] });

function autoName(i) {
  if (isCash(i)) return `${moneyShort(i.listPrice)} – peşin satış`;
  const down = i.down.amount <= 0 ? 'peşinatsız' : i.down.percent ? `%${editable(i.down.amount)} peşinat` : `${moneyShort(i.down.amount)} peşinat`;
  return [moneyShort(i.listPrice), down, percent(i.rate), `${i.months} ay`].join(' – ');
}

function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [records, setRecords] = useState(loadRecords);
  const [stack, setStack] = useState(['home']);
  const [plan, setPlan] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Ödeme planı adımı: 0 Ürün, 1 Peşinat, 2 Vade, 3 Oran, 4 Plan.
  const [planStep, setPlanStepState] = useState(0);
  const [offer, setOffer] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [sheetEl, setSheetEl] = useState(null);
  const [toast, setToast] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const [shareFields, setShareFields] = useState({ analysis: true });
  const undoStack = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  // Oturum: undefined = açılıyor, null = giriş yapılmamış, { username, name, role, uid } = içeride.
  const [cloud, setCloud] = useState(null);
  const [session, setSessionState] = useState(undefined);
  const [sessionError, setSessionError] = useState('');
  const state = useRef({});
  state.current = { stack, sheetEl, plan, dirty, planStep };

  const screen = stack[stack.length - 1];
  const taxes = settings.taxes;

  // --- Kalıcılık ---
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => {
    const t = settings.theme;
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }, [settings.theme]);

  const upsert = (rec) => setRecords((all) => {
    const i = all.findIndex((r) => r.id === rec.id);
    const next = { ...rec, updatedAt: Date.now() };
    return i < 0 ? [next, ...all] : all.map((r, j) => (j === i ? { ...r, ...next, deletedAt: next.deletedAt } : r));
  });

  // --- Gezinme: her ileri adım tarayıcı geçmişine yazılır; telefonun geri tuşu da çalışır. ---
  const pushHistory = () => history.pushState({ ratemi: Date.now() }, '');

  const internalBack = () => {
    const s = state.current;
    if (s.sheetEl) { setSheetEl(null); return; }
    // Girdi adımlarında geri bir önceki adıma gider; plandan (son adım) ekran kapanır.
    if (s.stack[s.stack.length - 1] === 'plan' && s.planStep >= 1 && s.planStep <= 3) { setPlanStepState(s.planStep - 1); return; }
    if (s.stack.length > 1) {
      const next = s.stack.slice(0, -1);
      setStack(next);
      const top = next[next.length - 1];
    }
  };

  useEffect(() => {
    history.replaceState({ ratemi: 'root' }, '');
    const onPop = () => internalBack();
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => { document.querySelector('.main')?.scrollTo(0, 0); scrollTo(0, 0); }, [screen]);

  const push = (name) => {
    pushHistory();
    setStack((st) => {
      const i = st.indexOf(name);
      return i >= 0 ? st.slice(0, i + 1) : [...st, name];
    });
  };
  const back = () => history.back();
  const goTab = (tab) => {
    setSheetEl(null);
    setStack(tab === 'templates' ? ['home', 'templates'] : ['home']);
    pushHistory();
  };
  const go = (name) => (name === 'home' || name === 'templates' ? goTab(name) : push(name));

  const sheet = (el) => { pushHistory(); setSheetEl(el); };

  /** Adım değişir; ileri gidişler geçmişe yazılır (telefonun geri hareketi bir önceki adıma döner). */
  const setPlanStep = (n) => {
    if (n > state.current.planStep && n <= 3) pushHistory();
    setPlanStepState(n);
    document.querySelector('.main')?.scrollTo(0, 0); scrollTo(0, 0);
  };
  const closeSheet = () => { if (state.current.sheetEl) history.back(); };

  // --- Oturum ve kullanım ölçümü ---
  useEffect(() => {
    let first = true;
    const cached = () => { try { return JSON.parse(localStorage.getItem('ratemi.session')); } catch { return null; } };
    import('./cloud.js').then((c) => {
      setCloud(c);
      c.watchSession((s) => {
        if (s && s.error) {
          // İnternet yoksa son oturumla devam (ölçüm yapılamaz).
          const old = cached();
          setSessionState(old || null);
          if (!old) setSessionError(c.errorText(s.error));
          return;
        }
        c.setSession(s);
        setSessionState(s);
        try { s ? localStorage.setItem('ratemi.session', JSON.stringify(s)) : localStorage.removeItem('ratemi.session'); } catch { /* özel pencere */ }
        if (s && first) c.track('open');
        first = false;
      });
    }).catch(() => {
      const old = cached();
      setSessionState(old || null);
      if (!old) setSessionError('İnternet bağlantısı yok; giriş için bağlan.');
    });
  }, []);

  const track = (type, detail) => { if (cloud) cloud.track(type, detail); };
  const pendingTrack = useRef({});
  const lastTracked = useRef({});
  /** Deneme yanılmada her tuşu saymamak için: 8 sn değişmeyen ve öncekinden farklı sonuç bir kez kaydedilir. */
  const trackLater = (key, type, detail) => {
    clearTimeout(pendingTrack.current[key]);
    pendingTrack.current[key] = setTimeout(() => {
      const j = JSON.stringify(detail);
      if (lastTracked.current[key] === j) return;
      lastTracked.current[key] = j;
      track(type, detail);
    }, 8000);
  };
  const planSummary = (p) => {
    const i = p.input, a = analyze(p, settings.baseRate, taxes), bp = basePrice(i);
    return {
      loanType: i.loanType, listPrice: i.listPrice, months: i.months, rate: i.rate, grace: i.graceMonths || 0,
      down: bp > 0 ? Math.round(valueOf(i.down, bp) / bp * 1000) / 10 : 0, interims: i.interims.length,
      cost: a.costRatio != null ? Math.round(a.costRatio * 10000) / 10000 : null,
    };
  };

  const logout = async () => {
    if (!confirm('Çıkış yapılsın mı?')) return;
    if (cloud) await cloud.logout(session);
    setStack(['home']);
  };

  const showToast = (text, undo) => {
    const id = Date.now();
    setToast({ id, text, undo });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 6000);
  };

  // --- Ödeme planı: tek sayfa, kayıt isteğe bağlı. Çalışılan plan taslak olarak saklanır (sayfa yenilense de kaybolmaz). ---
  const analyzePlan = (p) => analyze(p, settings.baseRate, taxes);

  const freshPlan = () => ({
    id: 0, name: '', rows: null, balance: null,
    input: {
      loanType: 'HOUSING', taxOn: false, listPrice: 0,
      discountOn: settings.discountOn, discount: { amount: settings.discountOn ? settings.discountPercent : 0, percent: true },
      down: { amount: 0, percent: true }, interims: [], skipOnInterim: false,
      months: 24, rate: 0.02, startDate: DateX.today(), graceMonths: 0,
    },
  });

  const loadPlan = (p, isDirty) => {
    setPlan(p); setDirty(isDirty);
    undoStack.current = []; setCanUndo(false);
    saveDraft({ plan: p, dirty: isDirty });
  };

  /** "+": kaydedilmemiş bir deneme varsa ona döner, yoksa boş plan. */
  const newPlan = () => {
    const d = loadDraft();
    if (d && d.dirty && d.plan && d.plan.input.listPrice > 0) loadPlan(d.plan, true);
    else loadPlan(freshPlan(), false);
    setPlanStepState(0);
    push('plan');
  };

  const resetPlan = () => {
    const p = state.current.plan;
    if (state.current.dirty && p && p.input.listPrice > 0 && !confirm('Kaydedilmemiş plan silinip boş plan açılsın mı?')) return;
    loadPlan(freshPlan(), false);
    setPlanStepState(0);
  };

  const change = (p) => {
    setPlan(p); setDirty(true);
    if (p.input.listPrice > 0) trackLater('plan', 'plan', planSummary(p));
    saveDraft({ plan: p, dirty: true });
  };

  const updateInput = (input) => {
    const p = state.current.plan;
    if (!p) return;
    if (p.rows) showToast('Girdiler değişti; tablodaki elle düzenlemeler sıfırlandı.');
    change({ ...p, input, rows: null, balance: null });
  };

  /** Kaydet: asNew ise yeni kayıt (Farklı kaydet), değilse açık kaydın üstüne. */
  const savePlan = (name, asNew) => {
    const p = state.current.plan;
    const id = asNew || !p.id ? newId() : p.id;
    const saved = { ...p, id, name: name || autoName(p.input) };
    upsert({ id, type: 'SCHEDULE', name: saved.name, data: { input: saved.input, rows: saved.rows, balance: saved.balance } });
    setPlan(saved); setDirty(false);
    saveDraft({ plan: saved, dirty: false });
    showToast(`“${saved.name}” kaydedildi.`);
    track('plan_saved', planSummary(saved));
  };

  const openPlan = (rec) => {
    loadPlan({ id: rec.id, name: rec.name, ...rec.data }, false);
    setPlanStepState(4);
    push('plan');
  };

  const editRows = (edit) => {
    const p = state.current.plan;
    const rows = Schedules.build(p, taxes).rows;
    const base = settings.baseRate;
    const target = { rate: base, nbd: Finance.presentValue(rows, base) };
    undoStack.current = [...undoStack.current.slice(-49), p];
    setCanUndo(true);
    change({ ...p, rows: sortRows(edit(rows)), balance: target });
  };
  const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

  const planOps = {
    canUndo,
    undo() {
      const prev = undoStack.current.pop();
      if (!prev) return;
      setCanUndo(undoStack.current.length > 0);
      change({ ...prev, id: state.current.plan?.id || prev.id });
    },
    editRow: (id, amount, shift, locked, scope) => editRows((rows) => RowEdits.apply(rows, id, amount, shift, locked, scope)),
    toggleLock: (id) => editRows((rows) => rows.map((r) => (r.id === id ? { ...r, locked: !r.locked, manual: r.locked ? false : r.manual } : r))),
    deleteRow: (id) => editRows((rows) => rows.filter((r) => r.id !== id)),
    addRow: () => editRows((rows) => {
      const next = rows.filter((r) => r.kind === Kind.INSTALLMENT).reduce((m, r) => Math.max(m, r.month), 0) + 1;
      return [...rows, pay(nextId(rows), next, 0, Kind.INSTALLMENT)];
    }),
    addBlock: (from, to, amount) => editRows((rows) => {
      let id = nextId(rows);
      const kept = rows.filter((r) => !(r.kind === Kind.INSTALLMENT && r.month >= from && r.month <= to));
      const added = [];
      for (let m = from; m <= to; m++) added.push(pay(id++, m, amount, Kind.INSTALLMENT, { locked: true, manual: true }));
      return [...kept, ...added];
    }),
    saveTemplate(name) {
      const p = state.current.plan;
      const t = Schedules.toTemplate(p, name || 'Şablon', settings.baseRate, taxes);
      upsert({ id: newId(), type: 'TEMPLATE', name: t.name, data: { input: t.input, rows: t.rows, balance: t.balance } });
      showToast(`“${t.name}” şablon olarak kaydedildi.`);
      track('template', planSummary(p));
    },
  };

  // --- Şablonlar ---
  const templateCost = (t) => Schedules.templateCost(t, settings.baseRate, taxes);
  const useTemplate = (rec) => sheet(html`<${AmountSheet} title=${rec.name} caption="Liste fiyatını gir; plan anında oluşur." value=${rec.data.input.listPrice}
    button="Planı oluştur" onClose=${closeSheet} onDone=${(price) => {
      if (!(price > 0)) return;
      setSheetEl(null);
      const p = Schedules.fromTemplate(rec.data, price, DateX.today(), settings.baseRate, taxes);
      undoStack.current = []; setCanUndo(false);
      setStack((st) => [...st.filter((x) => x === 'home' || x === 'templates'), 'plan']);
      loadPlan(p, true);
      setPlanStepState(4);
    }} />`);
  const renameTemplate = (rec) => sheet(html`<${NameSheet} title="Şablonun adı" value=${rec.name} button="Tamam" onClose=${closeSheet}
    onDone=${(name) => { closeSheet(); upsert({ ...rec, name }); }} />`);

  // --- Silme / çöp kutusu ---
  const deleteRecord = (id) => {
    const rec = records.find((r) => r.id === id);
    setRecords((all) => all.map((r) => (r.id === id ? { ...r, deletedAt: Date.now() } : r)));
    showToast(`“${rec?.name || 'Kayıt'}” silindi`, () => restoreRecord(id));
  };
  const restoreRecord = (id) => setRecords((all) => all.map((r) => (r.id === id ? (({ deletedAt, ...x }) => x)(r) : r)));
  const purgeRecord = (id) => { if (confirm('Kalıcı olarak silinsin mi? Geri alınamaz.')) setRecords((all) => all.filter((r) => r.id !== id)); };
  const emptyTrash = () => { if (confirm('Çöp kutusu boşaltılsın mı? Geri alınamaz.')) setRecords((all) => all.filter((r) => !r.deletedAt)); };

  // --- Teklif ---
  const newOffer = () => { setOffer({ id: 0, name: '', offer: emptyOffer(), start: DateX.today() }); push('offer'); };
  const updateOffer = (rec) => {
    const o = rec.offer, irr = Offers.irr(o);
    const name = [moneyShort(o.cashPrice), irr ? `IRR ${percent(irr.monthly)}/ay` : 'IRR yok', `${Offers.rows(o).length} ödeme`].join(' – ');
    let next = { ...rec, name };
    if (o.cashPrice > 0 && Offers.total(o) > 0) {
      if (!next.id) next = { ...next, id: newId() };
      upsert({ id: next.id, type: 'OFFER', name, data: { offer: o, start: next.start } });
      trackLater('offer', 'offer', { cashPrice: o.cashPrice, total: Offers.total(o), irr: irr ? irr.monthly : null });
    }
    setOffer(next);
  };

  // --- Değer çevirici ---
  const newConversion = () => {
    const t = DateX.today();
    setConversion({ id: 0, name: '', toFuture: true, amount: 0, from: t, to: DateX.plusMonths(t, 12), rate: settings.baseRate, series: false, payments: emptyOffer() });
    push('converter');
  };
  const updateConversion = (c) => {
    const name = c.series ? `${moneyShort(Offers.total(c.payments))} · ${Offers.rows(c.payments).length} ödeme`
      : c.toFuture ? `${moneyShort(c.amount)} → ${dateShort(c.to)} · ${percent(c.rate)}`
        : `${moneyShort(c.amount)} (${dateShort(c.to)}) → ${dateShort(c.from)} · ${percent(c.rate)}`;
    let next = { ...c, name };
    const nominal = c.series ? Offers.total(c.payments) : c.amount;
    if (nominal > 0) {
      if (!next.id) next = { ...next, id: newId() };
      const { id, name: n, ...data } = next;
      upsert({ id, type: 'CONVERSION', name: n, data });
      trackLater('conv', 'conversion', { amount: nominal, series: !!c.series, rate: c.rate });
    }
    setConversion(next);
  };

  const openRecord = (rec) => {
    if (rec.type === 'SCHEDULE') openPlan(rec);
    else if (rec.type === 'OFFER') { setOffer({ id: rec.id, name: rec.name, ...rec.data }); push('offer'); }
    else if (rec.type === 'CONVERSION') {
      const c = { id: rec.id, name: rec.name, ...rec.data };
      setConversion(c.series && !c.toFuture ? { ...c, toFuture: true, to: c.from } : c);
      push('converter');
    }
  };

  // --- Ayarlar ---
  const updateSettings = (s) => setSettings(s);
  const editBaseRate = () => sheet(html`<${RateSheet} title="Baz oran" caption="Alternatif maliyet" rate=${settings.baseRate} onClose=${closeSheet}
    onDone=${(r) => { closeSheet(); setSettings((s) => ({ ...s, baseRate: r })); }} />`);

  const exportBackup = () => {
    const blob = new Blob([backupJson(records, settings)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ratemi-yedek-${DateX.iso(DateX.today())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importBackup = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const o = parseBackup(await inp.files[0].text());
        const have = new Set(records.map((r) => r.id));
        const add = o.records.filter((r) => !have.has(r.id));
        setRecords((all) => [...add, ...all]);
        showToast(`${add.length} kayıt yüklendi.`);
      } catch { showToast('Dosya okunamadı; Ratemi yedeği değil.'); }
    };
    inp.click();
  };

  // --- PDF (yazdır) ---
  const print = (doc) => { setPrintDoc(doc); track('pdf', doc.kind === 'plan' ? planSummary(doc.plan) : { kind: doc.kind }); };
  useEffect(() => {
    if (!printDoc) return;
    const done = () => setPrintDoc(null);
    addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [printDoc]);

  const app = {
    settings, updateSettings, records, go, back, screen, plan, dirty, planStep, setPlanStep, newPlan, resetPlan, updateInput, savePlan, autoName,
    analyzePlan, planOps, templateCost, useTemplate, renameTemplate, deleteRecord, restoreRecord, purgeRecord, emptyTrash,
    offer, newOffer, updateOffer, conversion, newConversion, updateConversion, openRecord, sheet, closeSheet, editBaseRate,
    exportBackup, importBackup, print, shareFields, setShareFields, cloud, session, sessionError, logout,
  };

  const Screen = {
    home: HomeScreen, templates: TemplatesScreen, settings: SettingsScreen,
    plan: plan ? PlanBuilderScreen : HomeScreen,
    offer: offer ? OfferScreen : HomeScreen, converter: conversion ? ConverterScreen : HomeScreen,
  }[screen] || HomeScreen;
  const tab = stack.includes('templates') ? 'templates' : screen === 'settings' ? 'settings' : 'home';

  if (session === undefined) return html`<${Splash} />`;
  if (session === null) {
    if (!cloud) return html`<${Splash} text=${sessionError || 'Bağlanıyor…'} />`;
    return html`<${AppCtx.Provider} value=${app}><${LoginScreen} /></${AppCtx.Provider}>`;
  }

  return html`
    <${AppCtx.Provider} value=${app}>
      <div class=${'shell' + (screen === 'plan' ? ' in-plan' : '')}>
        <${Sidebar} tab=${tab} screen=${screen} />
        <main class="main"><${Screen} /></main>
        <${BottomBar} tab=${tab} />
      </div>
      ${sheetEl}
      ${toast && html`<div class="toast" key=${toast.id}><span>${toast.text}</span>${toast.undo && html`<button onClick=${() => { toast.undo(); setToast(null); }}>Geri al</button>`}</div>`}
      <div class="print-root">${printDoc && html`<${PrintDoc} doc=${printDoc} rep=${settings.salesRep} />`}</div>
    </${AppCtx.Provider}>`;
}

/** Bilgisayarda soldaki menü. */
function Sidebar({ tab, screen }) {
  const app = useCtx();
  const Item = ({ id, icon, label, onClick, active }) => html`
    <button class=${'nav-item' + (active ? ' on' : '')} onClick=${onClick}><${Icon} name=${icon} size=${20} /><span>${label}</span></button>`;
  return html`
    <nav class="sidebar desktop-only">
      <div class="sb-logo"><${Logo} /></div>
      <button class="sb-create grad-logo" onClick=${app.newPlan}><${Icon} name="add" size=${20} /><span>Ödeme Planı Oluştur</span></button>
      <${Item} icon="home" label="Ana sayfa" active=${tab === 'home' && screen === 'home'} onClick=${() => app.go('home')} />
      <${Item} icon="bookmark" label="Şablonlar" active=${tab === 'templates'} onClick=${() => app.go('templates')} />
      <div class="sb-sep">Araçlar</div>
      <${Item} icon="table" label="Ödeme planı" active=${screen === 'plan'} onClick=${app.newPlan} />
      <${Item} icon="trend" label="Teklifin gerçek oranı" active=${screen === 'offer'} onClick=${app.newOffer} />
      <${Item} icon="clock" label="Değer çevirici" active=${screen === 'converter'} onClick=${app.newConversion} />
      <div class="grow" />
      <div class="sb-rate"><${BaseRatePill} /></div>
      <${Item} icon="settings" label="Ayarlar" active=${screen === 'settings'} onClick=${() => app.go('settings')} />
    </nav>`;
}

/** Telefonda alttaki menü: Ana sayfa · + · Şablonlar. */
function BottomBar({ tab }) {
  const app = useCtx();
  return html`
    <nav class="bottombar mobile-only">
      <button class=${'bb-item' + (tab === 'home' ? ' on' : '')} onClick=${() => app.go('home')}><${Icon} name="home" size=${22} /><span>Ana sayfa</span></button>
      <button class="bb-add grad-logo" onClick=${app.newPlan} aria-label="Ödeme Planı Oluştur"><${Icon} name="add" size=${28} stroke=${2.6} /></button>
      <button class=${'bb-item' + (tab === 'templates' ? ' on' : '')} onClick=${() => app.go('templates')}><${Icon} name="bookmark" size=${22} /><span>Şablonlar</span></button>
    </nav>`;
}

import { useContext } from '../vendor/preact-htm.js';
const useCtx = () => useContext(AppCtx);

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

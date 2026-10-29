// Giriş ekranı, ilk yönetici kurulumu, Ayarlar › Kullanıcılar ve kullanım ekranı.
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { moneyShort, percent, dateShort } from './format.js';
import { DateX } from './finance.js';
import { Icon, IconButton, GradientButton, OutlineButton, SectionCard, FieldBox, Sheet, SheetTitle, Badge, useApp } from './ui.js';

const NOTICE = 'Giriş, çıkış ve kullanım bilgilerin (oluşturduğun planların özeti dahil) uygulama sahibi Nazım Beşirli tarafından görülebilir. Kayıtlı planların yalnız bu cihazda saklanır.';

/** 8 karakterlik, karışması zor harf ve rakamlardan şifre. */
export function newPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  return [...a].map((x) => chars[x % chars.length]).join('');
}

const when = (ms) => {
  if (!ms) return '—';
  const d = new Date(ms);
  const day = DateX.of(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const t = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const today = DateX.today();
  return (day === today ? 'bugün' : day === today - 1 ? 'dün' : dateShort(day)) + ' ' + t;
};

const TYPE = {
  login: 'Giriş', logout: 'Çıkış', open: 'Uygulamayı açtı', plan: 'Plan oluşturdu', plan_saved: 'Planı kaydetti',
  template: 'Şablon kaydetti', pdf: 'PDF aldı', offer: 'Teklif oranı hesapladı', conversion: 'Değer çevirici kullandı',
};

function detailText(e) {
  const d = e.detail || {};
  if (d.listPrice) {
    return [moneyShort(d.listPrice), d.down ? `%${Math.round(d.down)} peşinat` : null, d.months ? `${d.months} ay` : null,
      d.rate != null ? percent(d.rate) : null, d.cost != null ? `maliyet ${percent(d.cost)}` : null].filter(Boolean).join(' · ');
  }
  if (d.cashPrice) return `Peşin ${moneyShort(d.cashPrice)}${d.irr != null ? ` · IRR ${percent(d.irr)}` : ''}`;
  if (d.amount) return moneyShort(d.amount);
  return '';
}

// --- Giriş ---

export function LoginScreen() {
  const app = useApp();
  const cloud = app.cloud;
  const [mode, setMode] = useState('login'); // login | setup
  const [needSetup, setNeedSetup] = useState(false);
  const [u, setU] = useState('');
  const [name, setName] = useState('');
  const [p, setP] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(app.sessionError || '');
  const [show, setShow] = useState(false);

  useEffect(() => { cloud.adminExists().then((x) => setNeedSetup(!x)).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const username = cloud.cleanUsername(u);
    if (mode === 'setup') {
      if (!cloud.validUsername(username)) return setErr('Kullanıcı adı en az 3 karakter olmalı (harf, rakam, nokta).');
      if (p.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
      if (p !== p2) return setErr('Şifreler aynı değil.');
    }
    setBusy(true);
    try {
      if (mode === 'setup') await cloud.setupAdmin(username, name.trim() || username, p);
      else await cloud.login(username, p);
    } catch (x) {
      setErr(cloud.errorText(x));
      setBusy(false);
    }
  };

  const setup = mode === 'setup';
  return html`
    <div class="login">
      <form class="login-card card" onSubmit=${submit}>
        <div class="login-brand"><img src="img/logo.png" alt="" /><div><div class="wordmark">Ratemi</div><div class="byline">Nazım Beşirli tarafından geliştirildi</div></div></div>
        <h1>${setup ? 'Yönetici hesabını oluştur' : 'Giriş yap'}</h1>
        ${setup && html`<p class="caption">İlk kurulum: bu hesap kullanıcıları oluşturur ve kullanımı görür. Yalnız bir kez yapılır.</p>`}
        <label class="field-box"><span class="field-label">Kullanıcı adı</span>
          <input class="text-input" autocomplete="username" autocapitalize="none" spellcheck="false" value=${u} onInput=${(e) => setU(e.target.value)} />
          ${setup && u && cloud.cleanUsername(u) !== u && html`<span class="caption">Kullanıcı adı: ${cloud.cleanUsername(u)}</span>`}
        </label>
        ${setup && html`<label class="field-box"><span class="field-label">Ad soyad</span><input class="text-input" value=${name} onInput=${(e) => setName(e.target.value)} /></label>`}
        <label class="field-box"><span class="field-label">Şifre</span>
          <span class="field-row">
            <input class="text-input" type=${show ? 'text' : 'password'} autocomplete=${setup ? 'new-password' : 'current-password'} value=${p} onInput=${(e) => setP(e.target.value)} />
            <button type="button" class="text-action" onClick=${() => setShow(!show)}>${show ? 'Gizle' : 'Göster'}</button>
          </span>
        </label>
        ${setup && html`<label class="field-box"><span class="field-label">Şifre (tekrar)</span><input class="text-input" type=${show ? 'text' : 'password'} autocomplete="new-password" value=${p2} onInput=${(e) => setP2(e.target.value)} /></label>`}
        ${err && html`<div class="alert">${err}</div>`}
        <${GradientButton} type="submit" cls="full" disabled=${busy || !u || !p}>${busy ? 'Bekle…' : setup ? 'Hesabı oluştur ve gir' : 'Giriş yap'}</${GradientButton}>
        <p class="caption login-note">${NOTICE}</p>
        ${needSetup && !setup && html`<button type="button" class="text-action center" onClick=${() => { setMode('setup'); setErr(''); }}>İlk kurulum: yönetici hesabını oluştur</button>`}
        ${setup && html`<button type="button" class="text-action center" onClick=${() => setMode('login')}>Girişe dön</button>`}
      </form>
    </div>`;
}

export const Splash = ({ text }) => html`
  <div class="login"><div class="login-card card center"><div class="login-brand"><img src="img/logo.png" alt="" /><div class="wordmark">Ratemi</div></div><p class="caption">${text || 'Açılıyor…'}</p></div></div>`;

// --- Ayarlar: hesap ve kullanıcılar ---

export function AccountSection() {
  const app = useApp();
  const s = app.session;
  return html`
    <${SectionCard} title="Hesap">
      <div class="trash-row" style="border-top:0">
        <div class="grow"><div class="row-title">${s.name}</div><div class="caption">${s.username}${s.role === 'admin' ? ' · yönetici' : ''}</div></div>
        <${OutlineButton} icon="back" onClick=${app.logout}>Çıkış yap</${OutlineButton}>
      </div>
    </${SectionCard}>
    ${s.role === 'admin' && html`<${UsersSection} />`}`;
}

function UsersSection() {
  const app = useApp();
  const cloud = app.cloud;
  const [accounts, setAccounts] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState('');
  const load = async () => {
    try {
      const [a, e] = await Promise.all([cloud.listAccounts(), cloud.listEvents()]);
      setAccounts(a.sort((x, y) => (x.role === 'admin') - (y.role === 'admin') || x.username.localeCompare(y.username)));
      setEvents(e);
      setErr('');
    } catch (x) { setErr(cloud.errorText(x)); }
  };
  useEffect(() => { load(); }, []);

  const stats = (u) => {
    const ev = events.filter((e) => e.username === u);
    const n = (t) => ev.filter((e) => e.type === t).length;
    return { last: ev[0]?.at, visits: n('login') + n('open'), plans: n('plan'), saved: n('plan_saved'), pdf: n('pdf'), tools: n('offer') + n('conversion'), ev };
  };

  const add = () => app.sheet(html`<${UserSheet} onClose=${app.closeSheet} onDone=${() => { app.closeSheet(); load(); }} />`);
  const open = (a) => app.sheet(html`<${UsageSheet} account=${a} stats=${stats(a.username)} onClose=${app.closeSheet} onChanged=${load} />`);

  return html`
    <${SectionCard} title=${`Kullanıcılar${accounts ? ' · ' + accounts.filter((a) => a.role !== 'admin').length : ''}`} trailing="yalnız sen görürsün">
      <p class="caption">Oluşturduğun kişiler kullanıcı adı ve şifreyle girer. Dokun: kullanım, şifre, durdurma.</p>
      ${err && html`<div class="alert">${err}</div>`}
      ${!accounts && !err && html`<p class="caption">Yükleniyor…</p>`}
      ${accounts && accounts.map((a) => {
        const st = stats(a.username);
        return html`
          <button class="user-row" key=${a.username} onClick=${() => open(a)}>
            <span class=${'icon-tile ' + (a.active ? 'tone-blue' : 'tone-amber')}><${Icon} name=${a.role === 'admin' ? 'settings' : 'home'} /></span>
            <span class="grow min0">
              <span class="row-title ellipsis">${a.name} ${!a.active ? html`<${Badge} tone="amber">durduruldu</${Badge}>` : a.role === 'admin' ? html`<${Badge}>yönetici</${Badge}>` : ''}</span>
              <span class="caption ellipsis">${a.username} · son: ${when(st.last)}</span>
            </span>
            <span class="user-stats"><b>${st.visits}</b><small>giriş</small></span>
            <span class="user-stats"><b>${st.plans}</b><small>plan</small></span>
          </button>`;
      })}
      <div class="btn-row">
        <${GradientButton} cls="grow" icon="add" onClick=${add}>Kullanıcı ekle</${GradientButton}>
        <${IconButton} icon="restore" label="Yenile" cls="filled" onClick=${load} />
      </div>
    </${SectionCard}>`;
}

function UserSheet({ onDone, onClose }) {
  const app = useApp();
  const cloud = app.cloud;
  const [name, setName] = useState('');
  const [u, setU] = useState('');
  const [p, setP] = useState(newPassword());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const username = cloud.cleanUsername(u || name.split(' ')[0]);
  const save = async () => {
    if (!cloud.validUsername(username)) return setErr('Kullanıcı adı en az 3 karakter olmalı (harf, rakam, nokta).');
    if (p.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    setBusy(true); setErr('');
    try { await cloud.createUser(username, name.trim() || username, p); onDone(); } catch (x) { setErr(cloud.errorText(x)); setBusy(false); }
  };
  return html`
    <${Sheet} onClose=${onClose} footer=${html`<${GradientButton} cls="full" disabled=${busy} onClick=${save}>${busy ? 'Oluşturuluyor…' : 'Kullanıcıyı oluştur'}</${GradientButton}>`}>
      <${SheetTitle} caption="Kullanıcı adını ve şifreyi kişiye ilet; bu ikisiyle girer.">Yeni kullanıcı</${SheetTitle}>
      <label class="field-box"><span class="field-label">Ad soyad</span><input class="text-input" value=${name} onInput=${(e) => setName(e.target.value)} ref=${(el) => el && !name && setTimeout(() => el.focus(), 60)} /></label>
      <label class="field-box"><span class="field-label">Kullanıcı adı</span><input class="text-input" autocapitalize="none" spellcheck="false" placeholder=${username} value=${u} onInput=${(e) => setU(e.target.value)} />
        ${username && html`<span class="caption">Giriş adı: <b>${username}</b></span>`}</label>
      <label class="field-box"><span class="field-label">Şifre</span>
        <span class="field-row"><input class="text-input mono" value=${p} onInput=${(e) => setP(e.target.value)} /><button class="text-action" onClick=${() => setP(newPassword())}>Yeni üret</button></span></label>
      ${err && html`<div class="alert">${err}</div>`}
    </${Sheet}>`;
}

function UsageSheet({ account: a, stats: st, onClose, onChanged }) {
  const app = useApp();
  const cloud = app.cloud;
  const [acc, setAcc] = useState(a);
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (fn, done) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(done); onChanged(); } catch (x) { setMsg(cloud.errorText(x)); }
    setBusy(false);
  };
  const reset = () => {
    const p = newPassword();
    act(async () => { await cloud.resetPassword(acc.username, p); setAcc({ ...acc, password: p }); setShowPw(true); }, `Yeni şifre: ${p}`);
  };
  const copy = () => navigator.clipboard?.writeText(`Ratemi\n${location.origin}${location.pathname}\nKullanıcı adı: ${acc.username}\nŞifre: ${acc.password}`).then(() => setMsg('Giriş bilgileri kopyalandı.'));
  return html`
    <${Sheet} wide onClose=${onClose}>
      <${SheetTitle} caption=${`${acc.username} · ${acc.active ? 'aktif' : 'durduruldu'}`}>${acc.name}</${SheetTitle}>
      <div class="usage-grid">
        <div><b>${st.visits}</b><span>giriş / açılış</span></div>
        <div><b>${st.plans}</b><span>plan oluşturdu</span></div>
        <div><b>${st.saved}</b><span>plan kaydetti</span></div>
        <div><b>${st.pdf}</b><span>PDF</span></div>
        <div><b>${st.tools}</b><span>teklif / çevirici</span></div>
        <div><b class="small">${when(st.last)}</b><span>son kullanım</span></div>
      </div>
      ${acc.role !== 'admin' && html`
        <div class="pw-row">
          <span class="grow"><span class="field-label">Şifre</span><span class="mono row-title">${acc.password ? (showPw ? acc.password : '••••••••') : '—'}</span></span>
          ${acc.password && html`<button class="text-action" onClick=${() => setShowPw(!showPw)}>${showPw ? 'Gizle' : 'Göster'}</button>`}
          ${acc.password && html`<button class="text-action" onClick=${copy}>Kopyala</button>`}
        </div>
        <div class="btn-row wrap">
          <${OutlineButton} cls="grow" disabled=${busy} onClick=${reset}>Şifreyi sıfırla</${OutlineButton}>
          <${OutlineButton} cls="grow" disabled=${busy} color=${acc.active ? 'var(--red)' : 'var(--green)'}
            onClick=${() => act(async () => { await cloud.setActive(acc.username, !acc.active); setAcc({ ...acc, active: !acc.active }); }, acc.active ? 'Kullanıcı durduruldu; artık giremez.' : 'Kullanıcı yeniden açıldı.')}>
            ${acc.active ? 'Durdur' : 'Yeniden aç'}
          </${OutlineButton}>
        </div>`}
      ${msg && html`<div class="impact warn">${msg}</div>`}
      <div class="section-label">Son hareketler</div>
      ${!st.ev.length && html`<p class="caption">Henüz hareket yok.</p>`}
      <div class="event-list">
        ${st.ev.slice(0, 100).map((e) => html`
          <div class="event" key=${e.id}>
            <span class="ev-time">${when(e.at)}</span>
            <span class="grow min0"><span class="row-title">${TYPE[e.type] || e.type}</span>${detailText(e) && html`<span class="caption">${detailText(e)}</span>`}</span>
            <span class="caption">${e.device || ''}</span>
          </div>`)}
      </div>
    </${Sheet}>`;
}

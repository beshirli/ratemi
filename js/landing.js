// Açılış sayfası (9 Kasım 2026): giriş yapmamış ziyaretçiye logo, slogan ve dört araç; her düğme giriş formunu açar.
import { html } from '../vendor/preact-htm.js';

/** Çift halka logosu: dışta maliyet (mavi), içte bugünkü değer (turkuaz). [id] degrade kimliklerini ayırır. */
export const Rings = ({ id = 'r', track = 0.1, cls = '' }) => html`
  <svg class=${cls} viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <linearGradient id=${id + 'o'} gradientUnits="userSpaceOnUse" x1="20" y1="100" x2="100" y2="20"><stop offset="0" stop-color="#3456DE" /><stop offset="1" stop-color="#6C9CFF" /></linearGradient>
      <linearGradient id=${id + 'i'} gradientUnits="userSpaceOnUse" x1="20" y1="100" x2="100" y2="20"><stop offset="0" stop-color="#0B7380" /><stop offset="1" stop-color="#4BE3F0" /></linearGradient>
    </defs>
    <circle cx="60" cy="60" r="35" fill="none" stroke="#fff" stroke-opacity=${track} stroke-width="11" />
    <circle cx="60" cy="60" r="21" fill="none" stroke="#fff" stroke-opacity=${track} stroke-width="11" />
    <path d="M60 25A35 35 0 1 1 27.11 48.03" fill="none" stroke=${`url(#${id}o)`} stroke-width="11" stroke-linecap="round" />
    <path d="M60 39A21 21 0 1 1 52.82 79.73" fill="none" stroke=${`url(#${id}i)`} stroke-width="11" stroke-linecap="round" />
    <circle cx="60" cy="60" r="5" fill="#fff" />
  </svg>`;

const ic = (d) => html`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TOOLS = [
  { name: 'Ödeme planı', short: 'Peşinat, kredi, tahsisat, taksit', grad: 'lp-g-plan',
    text: 'Ürün, peşinat, banka kredisi, tahsisat ve firma kredisi adım adım. Plan anında oluşur, maliyeti kırılımıyla görünür.',
    icon: ic(html`<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" />`) },
  { name: 'Teklifin gerçek oranı', short: 'Aylık gerçek maliyet (IRR)', grad: 'lp-g-offer',
    text: 'Elinizdeki teklifin peşin fiyatını ve ödemelerini girin; aylık gerçek oranı (IRR) hesaplasın.',
    icon: ic(html`<circle cx="12" cy="12" r="8" /><path d="M9 15l6-6" />`) },
  { name: 'Değer çevirici', short: 'Bugün ⇄ gelecek', grad: 'lp-g-conv',
    text: 'Bugünün parasını geleceğe, gelecekteki ödemeleri bugüne çevirin; tek tutar ya da ödeme dizisi.',
    icon: ic(html`<path d="M4 8h13l-3-3M20 16H7l3 3" />`) },
  { name: 'Terzi usulü plan', short: 'Ödeme gücüne göre plan', grad: 'lp-g-tailor',
    text: 'Müşterinin peşin ve aylık ödeme gücüne göre en kısa vadeli, en düşük taksitli ve en ucuz planı bulur.',
    icon: ic(html`<circle cx="7" cy="7" r="3" /><circle cx="7" cy="17" r="3" /><path d="M9.5 8.5L20 18M9.5 15.5L20 6" />`) },
];

export function Landing({ onLogin }) {
  return html`
    <div class="lp">
      <section class="lp-hero">
        <nav class="lp-nav">
          <img src="img/logo.png" alt="" class="lp-mark" />
          <span class="lp-word">Ratemi</span>
          <span class="lp-links">${TOOLS.map((t) => html`<span key=${t.name}>${t.name}</span>`)}</span>
          <button class="lp-btn ghost sm" onClick=${onLogin}>Giriş yap</button>
        </nav>
        <div class="lp-main">
          <div class="lp-copy">
            <${Rings} id="lpm" track=${0.08} cls="lp-logo-m" />
            <div class="lp-word lp-word-m">Ratemi</div>
            <span class="lp-chip">Ödeme planı · maliyet · bugünkü değer</span>
            <h1>Teklifin arkasındaki <span class="lp-accent">oranı gör.</span></h1>
            <p class="lp-lead lp-lead-d">Peşinat, banka kredisi, tahsisat ve taksitleri tek planda topla. Ratemi her ödemenin bugünkü değerini hesaplar, teklifin gerçek maliyetini bir bakışta gösterir.</p>
            <p class="lp-lead lp-lead-m">Ödeme planını kur, gerçek maliyeti ve bugünkü değeri tek bakışta gör.</p>
            <div class="lp-tools-m">
              ${TOOLS.slice(0, 3).map((t) => html`<div class="lp-row" key=${t.name}><i class=${t.grad}>${t.icon}</i><div>${t.name}<small>${t.short}</small></div></div>`)}
            </div>
            <div class="lp-cta">
              <button class="lp-btn main" onClick=${onLogin}>Ödeme planı oluştur <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
              <button class="lp-btn ghost" onClick=${onLogin}><span class="lp-lead-d">Teklifin oranını bul</span><span class="lp-lead-m">Giriş yap</span></button>
            </div>
            <div class="lp-checks"><span>✓ Kayıtlar cihazda kalır</span><span>✓ PDF olarak paylaş</span><span>✓ Telefon ve bilgisayar</span></div>
          </div>
          <div class="lp-art" aria-hidden="true">
            <${Rings} id="lpa" track=${0.07} cls="lp-rings" />
            <div class="lp-glass lp-cost">
              <div class="k">Maliyet oranı</div><div class="lp-big">%6,98</div>
              <div class="lp-two"><div><div class="k">Toplam NBD</div><b>₺8.836.500</b></div><div class="r"><div class="k">Baz oran</div><b>%2,99</b></div></div>
            </div>
            <div class="lp-glass lp-break">
              <div class="k">Maliyet kırılımı</div>
              ${[['İskonto', '%5,00', '#6C6CF0'], ['Banka kredisi', '%0,84', '#2F5FE0'], ['Tahsisat', '%1,62', '#22BFD0'], ['Firma kredisi', '−%0,48', '#4BE3F0']]
                .map(([a, b, c]) => html`<div class="lp-li" key=${a}><i style=${'background:' + c} />${a}<b>${b}</b></div>`)}
            </div>
          </div>
        </div>
      </section>
      <section class="lp-feats">
        <div class="lp-kicker">NE YAPAR?</div>
        <h2>Dört araç, tek hesap mantığı</h2>
        <div class="lp-grid">
          ${TOOLS.map((t) => html`<div class="lp-feat" key=${t.name}><i class=${t.grad}>${t.icon}</i><h3>${t.name}</h3><p>${t.text}</p></div>`)}
        </div>
        <div class="lp-band">
          <div><strong>Planınızı birkaç dakikada kurun.</strong><span>Kayıtlarınız cihazınızda kalır, PDF'le paylaşırsınız.</span></div>
          <button class="lp-btn light" onClick=${onLogin}>Giriş yap</button>
        </div>
        <div class="lp-foot">Ratemi · Nazım Beşirli tarafından geliştirildi</div>
      </section>
    </div>`;
}

/**
 * HTML renderers. Every view is prerendered to a real file at build time
 * (/, /girls/, /product/<slug>/, /contact/) so each page has its own URL,
 * title and meta description, and the whole catalogue is in the markup rather
 * than assembled by JavaScript. app.js then only handles interactivity.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);

/** Minimal inline formatting for CMS prose: **bold** only. */
const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/**
 * Escapes a link address and allowlists its scheme. `esc()` alone neutralises
 * markup but leaves `javascript:` intact, and the social links are free-text
 * fields held by editors who have no repo access, so every address that comes
 * out of the CMS goes through here rather than through `esc()`. Anything
 * outside the allowlist collapses to "#" so the link is inert, not broken.
 */
const SAFE_SCHEMES = ["https:", "http:", "mailto:", "tel:"];
const safeHref = url => {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return "#";
  // Browsers drop control characters while parsing a scheme, so "java\tscript:"
  // still runs. Decide on a stripped copy, but emit the address as written.
  const probe = raw.replace(/[\u0000-\u0020]/g, "").toLowerCase();
  if (probe.startsWith("//")) return "#"; // scheme-relative: points off-site
  if (/^[/#?]/.test(probe)) return esc(raw); // same-page or same-site
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*:)/);
  if (!scheme) return esc(raw); // relative path, no scheme to check
  return SAFE_SCHEMES.includes(scheme[1]) ? esc(raw) : "#";
};

const money = n => "PKR " + Number(n).toLocaleString("en-US");

/** Splits a CMS textarea into paragraphs on blank lines. */
const paragraphs = s => String(s || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

const waLink = (num, text) =>
  "https://wa.me/" + String(num).replace(/[^0-9]/g, "") +
  (text ? "?text=" + encodeURIComponent(text) : "");

/* --- icons ---------------------------------------------------------------
   Paths lifted verbatim from the prototype so the artwork is unchanged. */

const ICON = {
  igHeader: '<rect x="3" y="3" width="18" height="18" rx="5.5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r=".9" fill="#FFFCF8" stroke="none"></circle>',
  igOutline: '<rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r=".9"></circle>',
  waOutline: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.8A8.5 8.5 0 1 1 21 11.5Z"></path>',
  waOutlineDetail: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.8A8.5 8.5 0 1 1 21 11.5Z"></path><path d="M8.8 8.4c.3-.1.6 0 .8.3l.9 1.6c.1.3.1.5-.1.7l-.5.6c.6 1.1 1.4 1.9 2.5 2.4l.6-.5c.2-.2.5-.2.7-.1l1.6.8c.3.2.4.5.3.8-.3.9-1.2 1.4-2.1 1.3-2.9-.4-5.3-2.8-5.7-5.7-.1-.8.3-1.7 1-2.2Z"></path>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>',
  tiktok: '<path d="M9 12.2a3.6 3.6 0 1 0 3.6 3.6V3.5c.4 2 2 3.4 4 3.6"></path>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m4 7 8 6 8-6"></path>',
  crownCta: '<path d="M12 4a1.6 1.6 0 1 0-1.1 1.5L12 7l8.2 5.3a1.6 1.6 0 0 1-.9 3H4.7a1.6 1.6 0 0 1-.9-3L12 7"></path>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9l3-5Z"></path><path d="M3 9h18M9 4l3 16 3-16"></path>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"></rect><path d="M3 12h18M12 8v13"></path><path d="M12 8S9.5 3 7.5 4.5 9 8 12 8Zm0 0s2.5-5 4.5-3.5S15 8 12 8Z"></path>',
  globe: '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18-2.5-3-2.5-15 0-18Z"></path>',
  crown: '<path d="M3 7l4 4 5-6 5 6 4-4v11H3V7Z"></path>',
  dress: '<path d="M9 3h6l-1.5 4 5 12H5.5l5-12L9 3Z"></path><path d="M9 3c1 2 5 2 6 0"></path>',
  filters: '<path d="M4 6h16M7 12h10M10 18h4"></path>',
  chevRight: '<path d="m9 6 6 6-6 6"></path>',
  chevDown: '<path d="m6 9 6 6 6-6"></path>',
  arrowLeft: '<path d="m14.5 5-7 7 7 7"></path>',
  arrowRight: '<path d="m9.5 5 7 7-7 7"></path>',
  waFilled: '<path fill="#ffffff" d="M16.02 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.71a12.74 12.74 0 0 0 6.25 1.62h.01c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.33-6.63-3.75-9.05a12.7 12.7 0 0 0-9.06-3.66Zm0 23.02h-.01c-1.9 0-3.77-.51-5.4-1.48l-.39-.23-4.02 1.05 1.07-3.92-.25-.4a10.6 10.6 0 0 1-1.63-5.66c0-5.87 4.78-10.64 10.64-10.64 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.53c0 5.87-4.77 10.63-10.64 10.63Zm5.83-7.97c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.07 1.3 3.28c.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.82.67.76.24 1.46.21 2.01.13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z"></path>'
};

const FEATURE_ICONS = { gift: "gift", globe: "globe", crown: "crown", dress: "dress" };

const svg = (body, { size = 24, stroke = "currentColor", width = 1.6, viewBox = "0 0 24 24" } = {}) =>
  '<svg viewBox="' + viewBox + '" width="' + size + '" height="' + size + '" fill="none" stroke="' + stroke +
  '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";

/* --- shared image frame ------------------------------------------------- */

/** Renders a photo, or the empty frame shown until one is added in the CMS. */
function frame(image, { eager = false, placeholder = "Photo coming soon" } = {}) {
  if (!image) {
    return '<div class="lp-ph"><img class="lp-ph-crown" src="/assets/logo-crown.png" alt=""><span>' +
      esc(placeholder) + "</span></div>";
  }
  return '<img src="' + esc(image.src) + '" alt="' + esc(image.alt) + '"' +
    (eager ? "" : ' loading="lazy"') + ' decoding="async">';
}

/* --- chrome ------------------------------------------------------------- */

/**
 * Absolute form of an image address. WhatsApp, Instagram and structured data
 * all reject relative paths; Cloudinary links are already absolute, so those
 * pass through untouched and everything else gets the site origin.
 *
 * content.js guarantees a leading "/" on anything not absolute, so this can
 * join the two without a separator — that guarantee is what stops
 * "site.comfoo.jpg" being produced from a carelessly pasted value.
 */
function absoluteUrl(src, siteUrl) {
  return /^(https?:)?\/\//i.test(src) || /^data:/i.test(src) ? src : siteUrl + src;
}

/**
 * The built-in preview picture, used whenever a page has no photo of its own.
 *
 * PNG, not WebP, and deliberately so: WhatsApp and Facebook do not render WebP
 * link previews, and every image this site ships is otherwise WebP. The source
 * is tools/share-card.html — see the note at the top of that file for how to
 * re-render it if the wording or photo changes.
 */
const SHARE_CARD = { src: "/assets/share-card.png", width: 1200, height: 630, type: "image/png" };

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/**
 * Cloudinary resizes on delivery, so ask it for a preview-sized copy rather
 * than handing WhatsApp a full-resolution photo. WhatsApp skips preview images
 * over roughly 300 KB, so a wallpaper- or camera-sized upload shares with no
 * picture at all — the page is read fine and only the image is dropped.
 *
 * f_jpg rather than f_auto is deliberate: with f_auto Cloudinary serves WebP to
 * any client whose headers accept it, and WhatsApp and Facebook do not render
 * WebP previews. The page itself still uses the original full-quality URL.
 */
const CLOUD_PREVIEW = "c_fill,g_auto,w_1200,h_630,f_jpg,q_auto";
const CLOUD_UPLOAD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

function cloudinaryPreview(src) {
  const m = src.match(CLOUD_UPLOAD_RE);
  if (!m) return null;
  // Already transformed by us on a previous pass — don't stack it twice.
  if (m[2].startsWith(CLOUD_PREVIEW + "/")) return src;
  return m[1] + CLOUD_PREVIEW + "/" + m[2];
}

/** Share image for og:image / twitter:image, falling back to the built-in card. */
function shareImage(image, siteUrl) {
  const src = (image && image.src) || SHARE_CARD.src;
  const isCard = src === SHARE_CARD.src;
  const cloud = cloudinaryPreview(src);

  // Dimensions are only claimed where they are actually known: the built-in
  // card, and Cloudinary copies we asked for at an exact size. For any other
  // pasted photo they are omitted — guessing is worse than letting the scraper
  // fetch and measure for itself.
  if (cloud) return { url: cloud, alt: (image && image.alt) || "", width: 1200, height: 630, type: "image/jpeg" };
  if (isCard) return { url: absoluteUrl(src, siteUrl), alt: (image && image.alt) || "", width: SHARE_CARD.width, height: SHARE_CARD.height, type: SHARE_CARD.type };

  const ext = (src.split("?")[0].match(/\.([a-z0-9]+)$/i) || [])[1];
  return {
    url: absoluteUrl(src, siteUrl),
    alt: (image && image.alt) || "",
    width: null,
    height: null,
    type: MIME[String(ext).toLowerCase()] || null
  };
}

/**
 * Serialises structured data for embedding in a <script> block.
 *
 * JSON.stringify does not escape "<", so a CMS field containing "</script>"
 * would close the block early and hand the rest of the value to the HTML
 * parser as markup — stored XSS, reachable by anyone invited to edit content
 * even though they hold no access to this repo.
 *
 * < is valid JSON and parses back to "<", so what search engines read is
 * unchanged. U+2028/U+2029 are legal in JSON strings but are line terminators
 * in JavaScript, so they are escaped too: harmless in ld+json, and it keeps
 * the output safe if this block ever becomes an executable script type.
 */
function jsonLdScript(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function head({ title, description, canonical, jsonLd, share, ogType = "website", brandName = "", noindex = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(brandName)}">
<meta property="og:locale" content="en_PK">
<meta property="og:image" content="${esc(share.url)}">
${share.type ? '<meta property="og:image:type" content="' + esc(share.type) + '">' : ""}
${share.width ? '<meta property="og:image:width" content="' + share.width + '">' : ""}
${share.height ? '<meta property="og:image:height" content="' + share.height + '">' : ""}
${share.alt ? '<meta property="og:image:alt" content="' + esc(share.alt) + '">' : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(share.url)}">
<link rel="icon" href="/assets/logo-crown.png">
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/styles.css">
<noscript><style>
/* Filters and Load more need JavaScript; without it, show the whole
   catalogue rather than a button that cannot do anything. */
.lp-grid[data-preload] > .lp-card:nth-child(n+5){display:block}
[data-loadwrap],.lp-toolbar,.lp-panel,.lp-scrim{display:none}
</style></noscript>
${jsonLd ? '<script type="application/ld+json">' + jsonLdScript(jsonLd) + "</script>" : ""}
</head>
<body>`;
}

function header(s, activeTab) {
  const nav = [
    { key: "home", label: "Home", href: "/" },
    { key: "girls", label: "Girls", href: "/girls/" },
    { key: "boys", label: "Boys", href: "/boys/" },
    { key: "babies", label: "Babies", href: "/babies/" },
    { key: "ready", label: "Ready to wear", href: "/ready/" },
    { key: "contact", label: "Contact us", href: "/contact/" }
  ];
  return `<header class="lp-header" data-min="0">
<div class="lp-hdr">
<a class="lp-logo" href="/"><img src="/assets/logo-lockup.webp" alt="${esc(s.brandName)} — home"></a>
<nav class="lp-nav" aria-label="Main">
${nav.map(n =>
  '<a class="lp-navlink" href="' + n.href + '"' +
  (n.key === activeTab ? ' aria-current="page"' : "") + ">" + esc(n.label) + "</a>"
).join("\n")}
</nav>
<a class="lp-igbtn" target="_blank" rel="noopener" href="${safeHref(s.instagram)}" aria-label="Instagram">
${svg(ICON.igHeader, { size: 27, stroke: "#FFFCF8", width: 1.7 })}
</a>
</div>
</header>`;
}

function footer(s, categories) {
  return `<footer class="lp-footer">
<div class="lp-footgrid">
<div><img src="/assets/logo-lockup.webp" alt="${esc(s.brandName)}"></div>
<div class="lp-footcol">
<div class="lp-eyebrow">Shop</div>
<div>
${categories.map(c => '<a href="' + c.href + '">' + esc(c.label) + "</a>").join("\n")}
</div>
</div>
<div class="lp-footcol">
<div class="lp-eyebrow">Follow</div>
<div>
<a target="_blank" rel="noopener" href="${safeHref(s.instagram)}">Instagram</a>
<a target="_blank" rel="noopener" href="${safeHref(s.facebook)}">Facebook</a>
<a target="_blank" rel="noopener" href="${safeHref(s.tiktok)}">TikTok</a>
<a target="_blank" rel="noopener" href="${safeHref(waLink(s.whatsappNumber))}">WhatsApp</a>
</div>
</div>
<div class="lp-footcol">
<div class="lp-eyebrow">Contact</div>
<div>
<a href="${safeHref("mailto:" + s.email)}">${esc(s.email)}</a>
<a href="${safeHref("tel:" + String(s.phoneDisplay).replace(/\s/g, ""))}">${esc(s.phoneDisplay)}</a>
<a href="/contact/">How to order</a>
<a href="/#about">About us</a>
<a href="/contact/#faq">FAQ</a>
</div>
</div>
</div>
<div class="lp-footbottom">${esc(s.footerNote)}</div>
</footer>`;
}

function floatingWa(s) {
  return `<a class="lp-float" target="_blank" rel="noopener" href="${safeHref(waLink(s.whatsappNumber))}" aria-label="Contact us on WhatsApp">
<span class="lp-float-label">${esc(s.floatingLabel)}</span>
<span class="lp-float-circle">${svg(ICON.waFilled, { size: 32, viewBox: "0 0 32 32", stroke: "none", width: 0 })}</span>
</a>`;
}

function page(model, { tab, title, description, canonical, jsonLd, body, image, ogType, siteUrl, noindex }) {
  const s = model.settings;
  return [
    head({
      title, description, canonical, jsonLd, ogType, noindex,
      brandName: s.brandName,
      share: shareImage(image, siteUrl || "")
    }),
    '<div class="lp-app" data-tab="' + esc(tab) + '">',
    header(s, tab),
    body,
    footer(s, model.categories),
    floatingWa(s),
    "</div>",
    '<script src="/carousel-3d.js" defer></script>',
    '<script src="/app.js" defer></script>',
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

/* --- home --------------------------------------------------------------- */

function renderHome(model, siteUrl) {
  const s = model.settings;
  const hooks = (s.heroHooks || []).slice(0, 3).map(h => (typeof h === "string" ? h : h.text || ""));
  const ctas = s.heroCtas || [];
  const stages = [
    { src: "/assets/dress-sketch-tall.webp", alt: "Pencil sketch of a made-to-order party frock for girls, drawn in the Little Princess Designer studio" },
    { src: "/assets/dress-colour-tall.webp", alt: "The same girls party frock, watercoloured to show the chosen fabric and trim colours" },
    { src: "/assets/dress-real-tall.webp", alt: "The finished handmade girls party dress, hand-beaded and hemmed, ready to wear" }
  ];
  const ctaMeta = [
    { icon: ICON.crownCta, href: "/#explore-collection", external: false },
    { icon: ICON.waOutline, href: waLink(s.whatsappNumber), external: true },
    { icon: ICON.gem, href: "/contact/", external: false }
  ];

  const body = `<main class="lp-main lp-main--home">

<section class="lp-story">
<div class="lp-sticky">
<div class="lp-hooks">
${hooks.map((h, i) => i === 0
  ? '<h1 class="lp-hook" data-hook="0">' + esc(h) +
    '<span class="lp-sr"> — ' + esc(s.brandName) + ", " + esc(s.tagline) + "</span></h1>"
  : '<div class="lp-hook" data-hook="' + i + '" style="opacity:0">' + esc(h) + "</div>"
).join("\n")}
</div>
<div class="lp-art">
<div class="lp-artframe">
${stages.map((st, i) =>
  // None of the three are lazy-loaded. They are the hero: the crossfade starts
  // within the first flick of a scroll, and a lazy image that has not decoded
  // yet pops in mid-fade, which reads as the animation stuttering.
  '<img data-stage="' + i + '" src="' + st.src + '" alt="' + esc(st.alt) + '"' +
  (i === 0 ? ' fetchpriority="high"' : ' style="opacity:0"') + ' decoding="async">'
).join("\n")}
</div>
</div>
<div class="lp-cta">
${ctas.slice(0, 3).map((c, i) => {
  const m = ctaMeta[i] || ctaMeta[0];
  return '<a href="' + safeHref(m.href) + '"' + (m.external ? ' target="_blank" rel="noopener"' : "") + ">" +
    svg(m.icon, { stroke: "var(--berry-800)" }) +
    '<span class="lp-cta-t">' + esc(c.title) + "</span>" +
    '<span class="lp-cta-s">' + esc(c.subtitle) + "</span></a>";
}).join("\n")}
</div>
</div>
</section>

<section class="lp-sect lp-sect--feat lp-anchor lp-car-sect" id="explore-collection">
<div class="lp-car-head">
<h2 class="lp-h2 lp-h2--sm"><img class="lp-crown lp-crown--sm" src="/assets/logo-crown.png" alt="">${esc(s.carouselHeading)}</h2>
<span class="lp-car-hint">${esc(s.carouselHint)}</span>
</div>
<div class="lp-car-wrap">
<carousel-3d>
${(s.carousel || []).map((img, i) =>
  '<div><div class="lp-car-face">' + frame(img, { placeholder: "Piece " + (i + 1) }) + "</div></div>"
).join("\n")}
</carousel-3d>
</div>
</section>

<section class="lp-sect lp-sect--gap9">
<h2 class="lp-h2"><img class="lp-crown" src="/assets/logo-crown.png" alt="">${esc(s.categoriesHeading)}</h2>
<div class="lp-getyours">
${model.categories.map(c => `<a href="${c.href}">
<div class="lp-gy" data-cat="${esc(c.key)}">
<div class="lp-gy-photo">${frame(c.card.image, { placeholder: esc(c.label) + " photo" })}</div>
<div class="lp-gy-t">${esc(c.label)}</div>
<div class="lp-gy-s">${esc(c.card.subtitle)}</div>
</div>
</a>`).join("\n")}
</div>
</section>

<section class="lp-sect lp-sect--gap9">
<h2 class="lp-h2"><img class="lp-crown" src="/assets/logo-crown.png" alt="">${esc(s.featuresHeading)}</h2>
<div class="lp-feat">
${(s.features || []).map(f => `<div>
${svg(ICON[FEATURE_ICONS[f.icon] || "crown"], { size: 30, stroke: "#fff", width: 1.8 })}
<div class="lp-feat-t">${esc(f.title)}</div>
<p>${esc(f.body)}</p>
</div>`).join("\n")}
</div>
</section>

<section class="lp-sect lp-sect--gap9 lp-anchor" id="about" aria-labelledby="about-heading">
<div class="lp-ceo">
<div class="lp-ceo-photo">${frame(s.about.photo, { placeholder: "Studio or team photo" })}</div>
<div>
<div class="lp-eyebrow lp-ceo-eyebrow">${esc(s.about.eyebrow)}</div>
<h2 class="lp-ceo-h" id="about-heading">${esc(s.about.heading)}</h2>
${paragraphs(s.about.body).map(p => "<p>" + inline(p) + "</p>").join("\n")}
</div>
</div>
</section>

<section class="lp-sect lp-sect--gap8">
<div class="lp-quote">
<img src="/assets/logo-crown.png" alt="">
<div class="lp-quote-h">${esc(s.quote.heading)}</div>
<div class="lp-quote-s">${inline(s.quote.subline)}</div>
</div>
</section>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: s.brandName,
    description: s.seo.description,
    url: siteUrl + "/",
    email: s.email,
    telephone: s.phoneDisplay,
    address: { "@type": "PostalAddress", addressLocality: "Lahore", addressCountry: "PK" },
    sameAs: [s.instagram, s.facebook, s.tiktok].filter(Boolean),
    foundingDate: "2015"
  };

  return page(model, {
    tab: "home",
    siteUrl,
    title: s.seo.title,
    description: s.seo.description,
    canonical: siteUrl + "/",
    // Falls through to the built-in share card. The hero photo is WebP and
    // portrait — the wrong format and the wrong shape for a link preview.
    image: null,
    jsonLd,
    body
  });
}

/* --- shop --------------------------------------------------------------- */

const INITIAL_VISIBLE = 4;
const LOAD_STEP = 4;

function productCard(model, p) {
  const opts = p.sizes.map((s, i) =>
    '<option value="' + i + '" data-price="' + s.price + '">' + esc(s.size) + "</option>"
  ).join("");
  const first = p.sizes[0];
  const alt = p.images[0]
    ? p.images[0].alt
    : p.name + " — handmade " + p.subcategoryName.toLowerCase() + " for " + p.tabLabel.toLowerCase();

  return `<article class="lp-card" data-product data-min-price="${p.minPrice}" data-sizes="${esc(p.sizes.map(s => s.size).join("|"))}">
<a class="lp-card-imgbtn" href="${safeHref(p.href)}" aria-label="${esc("View " + p.name + " — " + p.subcategoryName + " for " + p.tabLabel)}">
<div class="lp-card-photo">
${p.badge ? '<span class="lp-badge" data-badge="' + esc(p.badge) + '">' + esc(p.badge) + "</span>" : ""}
${frame(p.images[0] ? { src: p.images[0].src, alt } : null, { placeholder: "Photo coming soon" })}
</div>
</a>
<div class="lp-card-body">
<h4><a class="lp-card-name" href="${safeHref(p.href)}">${esc(p.name)}</a></h4>
<div class="lp-card-price" data-price-out>${money(first.price)}</div>
<select class="lp-select" data-price-select aria-label="${esc("Select size for " + p.name)}">${opts}</select>
</div>
</article>`;
}

function renderShop(model, cat, siteUrl) {
  const s = model.settings;

  const sections = cat.subcategories.map(sub => {
    if (!sub.products.length) {
      return `<section class="lp-subsect" data-subsect>
<h3 id="${esc(sub.id)}">${esc(sub.name)}</h3>
<p class="lp-empty">New pieces for this category are on the way.</p>
</section>`;
    }
    return `<section class="lp-subsect" data-subsect data-step="${LOAD_STEP}" data-visible="${INITIAL_VISIBLE}">
<h3 id="${esc(sub.id)}">${esc(sub.name)}</h3>
<div class="lp-grid" data-grid${sub.products.length > INITIAL_VISIBLE ? " data-preload" : ""}>
${sub.products.map(p => productCard(model, p)).join("\n")}
</div>
<div class="lp-loadwrap" data-loadwrap${sub.products.length > INITIAL_VISIBLE ? "" : " hidden"}>
<button type="button" class="lp-load" data-load aria-label="${esc("Load more " + sub.name.toLowerCase() + " for " + cat.label.toLowerCase())}">
<span>Load more</span>
<span class="lp-load-badge">${svg(ICON.chevRight, { size: 18, stroke: "var(--tone)", width: 2.4 })}</span>
</button>
</div>
<p class="lp-empty" data-noresults hidden>No pieces in this category match your filters. Try a wider price range.</p>
</section>`;
  }).join("\n");

  const body = `<main class="lp-main lp-main--shop">
<nav class="lp-crumb" aria-label="Breadcrumb">
<ol>
<li><a href="/">Home</a></li>
<li aria-hidden="true">›</li>
<li aria-current="page">${esc(cat.title)}</li>
</ol>
</nav>
<div class="lp-eyebrow lp-shop-eyebrow">${esc(cat.eyebrow)}</div>
<h1 class="lp-shop-h1">${esc(cat.h1)}</h1>
<p class="lp-shop-blurb">${esc(cat.blurb)}</p>
<p class="lp-shop-blurb">${esc(cat.blurb2)}</p>

<div class="lp-toolbar">
<button type="button" class="lp-filterbtn" data-filter-open aria-expanded="false" aria-controls="lp-filters">
${svg(ICON.filters, { size: 18, width: 2 })}
Filters</button>
</div>

<div class="lp-scrim" data-scrim data-open="0"></div>
<aside class="lp-panel" id="lp-filters" data-panel data-open="0" aria-label="Filters">
<div class="lp-panel-head">
<div class="lp-panel-title">Filters</div>
<button type="button" class="lp-panel-x" data-filter-close aria-label="Close filters">×</button>
</div>
<div>
<div class="lp-eyebrow">Size</div>
<div class="lp-chips">
${model.sizes.map(sz =>
  '<button type="button" class="lp-chip" data-size-chip="' + esc(sz) + '" aria-pressed="false">' + esc(sz) + "</button>"
).join("\n")}
</div>
</div>
<div>
<div class="lp-eyebrow">Maximum price</div>
<input class="lp-range" id="lp-fmax" type="range" min="3000" max="100000" step="1000" value="100000"
  data-fmax aria-label="Maximum price in Pakistani rupees">
<div class="lp-range-row">
<span class="lp-range-min">PKR 3,000</span>
<span class="lp-range-max" data-fmax-out>${money(100000)}</span>
</div>
</div>
<div class="lp-panel-foot">
<button type="button" class="lp-btn-ghost" data-filter-reset>Reset</button>
<button type="button" class="lp-btn-solid" data-filter-close>Show results</button>
</div>
</aside>

<h2 class="lp-catsheading">${esc(cat.catsHeading)}</h2>
${sections}
</main>`;

  return page(model, {
    tab: cat.key,
    siteUrl,
    title: cat.seo.title,
    description: cat.seo.description,
    canonical: siteUrl + cat.href,
    image: cat.card.image,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: cat.h1,
      description: cat.seo.description,
      url: siteUrl + cat.href
    },
    body
  });
}

/* --- product ------------------------------------------------------------ */

function renderProduct(model, p, siteUrl) {
  const s = model.settings;
  const cat = model.categories.find(c => c.key === p.tab);

  const views = ["front", "side", "back"];
  const galleryImages = p.images.length ? p.images : [null, null, null];
  const gallery = galleryImages.slice(0, Math.max(3, galleryImages.length)).map((img, i) => {
    const fallbackAlt = p.name + " — " + (views[i] || "detail") + " view of the handmade " +
      p.subcategoryName.toLowerCase() + " for " + p.tabLabel.toLowerCase();
    return "<div>" + frame(
      img ? { src: img.src, alt: img.alt || fallbackAlt } : null,
      { eager: i === 0, placeholder: (views[i] || "Extra") + " view" }
    ) + "</div>";
  }).join("\n");

  const opts = p.sizes.map((sz, i) =>
    '<option value="' + i + '" data-price="' + sz.price + '">' + esc(sz.size) + "</option>"
  ).join("");
  const first = p.sizes[0];

  const specRows = [
    ["Fabric", p.specs.fabric],
    ["Occasion", p.specs.occasion],
    ["Fit", p.specs.fit],
    ["Care", p.specs.care],
    ["Made in", "Our own studio in Lahore, Pakistan"]
  ].filter(([, v]) => v);

  const body = `<main class="lp-main lp-main--product">
<nav class="lp-crumb" aria-label="Breadcrumb">
<ol>
<li><a href="/">Home</a></li>
<li aria-hidden="true">›</li>
<li><a href="${cat.href}">${esc(cat.title)}</a></li>
<li aria-hidden="true">›</li>
<li><a href="${cat.href}#${esc(p.subcategory)}">${esc(p.subcategoryName)}</a></li>
<li aria-hidden="true">›</li>
<li aria-current="page">${esc(p.name)}</li>
</ol>
</nav>
<a class="lp-back" href="${cat.href}">← Back to ${esc(cat.title)}</a>
<div class="lp-detail"
  data-detail
  data-wa="${esc(String(s.whatsappNumber))}"
  data-name="${esc(p.name)}"
  data-accessory-price="${p.accessoryPrice}">
<div class="lp-galwrap">
<div class="lp-gallery" data-gallery>
${gallery}
</div>
<button type="button" class="lp-arrow lp-arrow--prev" data-gal-prev aria-label="Previous view">
${svg(ICON.arrowLeft, { size: 20, stroke: "var(--tone-deep)", width: 2 })}
</button>
<button type="button" class="lp-arrow lp-arrow--next" data-gal-next aria-label="Next view">
${svg(ICON.arrowRight, { size: 20, stroke: "var(--tone-deep)", width: 2 })}
</button>
</div>

<div class="lp-detail-col">
<h1 class="lp-detail-h1">${esc(p.name)}</h1>
<div>
<label class="lp-label" for="lp-detail-size">Select size</label>
<select class="lp-select lp-select--detail" id="lp-detail-size" data-detail-size>${opts}</select>
</div>
<div class="lp-detail-price" data-detail-price>${money(first.price)}</div>

<div class="lp-desc">
<h2 class="lp-eyebrow">Product description</h2>
<p>${esc(p.description)}</p>
${p.description2 ? "<p>" + esc(p.description2) + "</p>" : ""}
<dl class="lp-specs">
${specRows.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>").join("\n")}
</dl>
</div>

<div>
<label class="lp-acc">
<input type="checkbox" data-accessory aria-describedby="lp-acc-note">
<span>${esc(s.accessoryLabel)}</span>
</label>
<div class="lp-acc-note" id="lp-acc-note">${esc(s.accessoryNote)}</div>
</div>

<div class="lp-total">
<div class="lp-total-row">
<span class="lp-total-label">Total</span>
<span class="lp-total-amount" data-total>${money(first.price)}</span>
</div>
<div class="lp-total-note">${esc(s.deliveryNote)}</div>
</div>

<a class="lp-wa" target="_blank" rel="noopener" href="${safeHref(waLink(s.whatsappNumber,
  "Hello Little Princess Designer, I'd like to order:\n" + p.name +
  "\nSize: " + first.size + "\nMatching accessory: no\nTotal shown: " + money(first.price)))}" data-wa-order>
${svg(ICON.waFilled, { size: 20, viewBox: "0 0 32 32", stroke: "none", width: 0 })}
Order on WhatsApp</a>
</div>
</div>
</main>`;

  const desc = p.description.split(". ")[0] + ". Made to order, hand-finished in our Lahore studio.";

  return page(model, {
    tab: p.tab,
    siteUrl,
    ogType: "product",
    title: p.name + " | " + p.tabLabel + " " + p.subcategoryName + " | " + s.brandName,
    description: desc,
    canonical: siteUrl + p.href,
    image: p.images[0],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description,
      category: p.tabLabel + " > " + p.subcategoryName,
      brand: { "@type": "Brand", name: s.brandName },
      image: p.images.map(i => absoluteUrl(i.src, siteUrl)),
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "PKR",
        lowPrice: p.minPrice,
        highPrice: Math.max(...p.sizes.map(x => x.price)),
        offerCount: p.sizes.length,
        availability: p.badge === "Sold out"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock"
      }
    },
    body
  });
}

/* --- contact ------------------------------------------------------------ */

function renderContact(model, siteUrl) {
  const s = model.settings;
  const c = s.contact;

  const cards = [
    { key: "instagram", label: "Instagram", icon: ICON.igOutline, href: s.instagram, aria: "Little Princess Designer on Instagram" },
    { key: "whatsapp", label: "WhatsApp", icon: ICON.waOutlineDetail, href: waLink(s.whatsappNumber), aria: "Chat with Little Princess Designer on WhatsApp" },
    { key: "facebook", label: "Facebook", icon: ICON.facebook, href: s.facebook, aria: "Little Princess Designer on Facebook" },
    { key: "tiktok", label: "TikTok", icon: ICON.tiktok, href: s.tiktok, aria: "Little Princess Designer on TikTok" },
    { key: "email", label: "Email", icon: ICON.email, href: "mailto:" + s.email, aria: "Email Little Princess Designer" }
  ];

  const body = `<main class="lp-main lp-main--contact">
<h1 class="lp-contact-h1">${esc(c.heading)}</h1>
<p class="lp-contact-intro">${esc(c.intro)}</p>
<h2 class="lp-eyebrow lp-steps-eyebrow">${esc(c.stepsEyebrow)}</h2>
<div class="lp-steps">
${(c.steps || []).map((st, i) => `<div class="lp-step">
<div class="lp-step-num">${i + 1}</div>
<h3>${esc(st.title)}</h3>
<p>${esc(st.body)}</p>
</div>`).join("\n")}
</div>

<h2 class="lp-h2 lp-h2--sm lp-h2--section lp-anchor" id="faq">
<img class="lp-crown lp-crown--sm" src="/assets/logo-crown.png" alt="">${esc(c.faqHeading)}</h2>
<div class="lp-faq">
${(c.faq || []).map(q => `<details class="lp-faqitem">
<summary>
<h3>${esc(q.question)}</h3>
<span class="lp-chev">${svg(ICON.chevDown, { size: 16, stroke: "var(--berry-800)", width: 2.4 })}</span>
</summary>
<p>${esc(q.answer)}</p>
</details>`).join("\n")}
</div>

<h2 class="lp-h2 lp-h2--sm lp-h2--section">
<img class="lp-crown lp-crown--sm" src="/assets/logo-crown.png" alt="">${esc(c.socialHeading)}</h2>
<div class="lp-social">
${cards.map(card => {
  const meta = (c.social && c.social[card.key]) || {};
  const ext = card.key === "email" ? "" : ' target="_blank" rel="noopener"';
  return `<div>
<a class="lp-social-icon"${ext} href="${safeHref(card.href)}" aria-label="${esc(card.aria)}">
${svg(card.icon, { size: 28, stroke: "var(--berry-800)", width: 1.5 })}
</a>
<div class="lp-social-t">${esc(card.label)}</div>
<p>${esc(meta.description || "")}</p>
<a class="lp-social-pill"${ext} href="${safeHref(card.href)}">${esc(meta.button || "Open")}</a>
</div>`;
}).join("\n")}
</div>

<div class="lp-feedback">
<div>
<div class="lp-eyebrow">${esc(c.feedback.eyebrow)}</div>
<h3>${esc(c.feedback.heading)}</h3>
<p>${esc(c.feedback.body)}</p>
</div>
<a class="lp-feedback-btn" target="_blank" rel="noopener" href="${safeHref(waLink(s.whatsappNumber, c.feedback.prefill))}">
${svg(ICON.waOutline, { size: 22, stroke: "#ffffff", width: 1.8 })}
${esc(c.feedback.button)}</a>
</div>
</main>`;

  return page(model, {
    tab: "contact",
    siteUrl,
    title: c.seo.title,
    description: c.seo.description,
    canonical: siteUrl + "/contact/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: (c.faq || []).map(q => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer }
      }))
    },
    body
  });
}

/* --- 404 ---------------------------------------------------------------- */

/**
 * Served by Netlify for any address that does not exist — a mistyped URL, or a
 * link to a product that has since been renamed or hidden. Deliberately built
 * from the same classes as the rest of the site so it needs no CSS of its own.
 */
function render404(model, siteUrl) {
  const s = model.settings;
  const links = [
    { icon: ICON.crownCta, href: "/girls/", title: "Browse the collection",
      subtitle: "Girls, boys, babies and ready to wear" },
    { icon: ICON.waOutline, href: waLink(s.whatsappNumber, "Hello! I was looking for something on your website."),
      title: "Message us on WhatsApp", subtitle: "Tell us what you were looking for", external: true },
    { icon: ICON.gem, href: "/contact/", title: "How to order", subtitle: "Sizes, delivery and questions" }
  ];

  // Structured like the contact page: the lp-main modifier carries the width
  // and padding, so there is no lp-sect inside doubling the gutter.
  const body = `<main class="lp-main lp-main--notfound">
<div class="lp-eyebrow">Page not found</div>
<h1 class="lp-h2">This page has slipped away</h1>
<p>
The address may have been mistyped, or the piece you were looking for may have
been renamed or taken down. Everything else is still here.
</p>
<div class="lp-cta lp-cta--center">
${links.map(l =>
  '<a href="' + safeHref(l.href) + '"' + (l.external ? ' target="_blank" rel="noopener"' : "") + ">" +
  svg(l.icon, { stroke: "var(--berry-800)" }) +
  '<span class="lp-cta-t">' + esc(l.title) + "</span>" +
  '<span class="lp-cta-s">' + esc(l.subtitle) + "</span></a>"
).join("\n")}
</div>
</main>`;

  return page(model, {
    // Matches no nav key, so no link is marked aria-current: the visitor is not
    // on any of them. The berry defaults on .lp-app apply either way — only the
    // four category tabs override the palette.
    tab: "none",
    siteUrl,
    title: "Page not found | " + s.brandName,
    description: "That page could not be found. Browse the collection or message us on WhatsApp.",
    // No canonical to the 404 itself — it stands in for many addresses, so it
    // points at the home page instead, and is kept out of search results.
    canonical: siteUrl + "/",
    noindex: true,
    body
  });
}

module.exports = { renderHome, renderShop, renderProduct, renderContact, render404, money, esc };

/**
 * HTML renderers. Every view is prerendered to a real file at build time
 * (/, /girls/, /product/<slug>/, /contact/) so each page has its own URL,
 * title and meta description, and the whole catalogue is in the markup rather
 * than assembled by JavaScript. app.js then only handles interactivity.
 */

const images = require("./images");

/**
 * The product card, and the helpers it is built from, live in tools/card.js —
 * the admin's preview panel loads that same file in the browser to draw the
 * card as the owner types. Anything the card touches has to be reachable from
 * both sides, so it lives there and is imported here rather than the other way
 * round. Everything else about rendering stays in this file, which is Node-only.
 */
const card = require("./card");
const { esc, safeHref, money, frame, IMG_SIZES, productCard, svg, ICON, waLink } = card;

/** Minimal inline formatting for CMS prose: **bold** only. */
const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");


/**
 * Closes every product's page summary when Site Settings has no wording of its
 * own. Kept as a constant rather than an empty string so a settings file
 * missing the field still produces a whole sentence.
 */
const SUMMARY_TAIL = "Made to order, hand-finished in our Lahore studio.";

/**
 * How many pieces spin in the home carousel. Ten, because that is how many
 * faces the cylinder was built around — fewer makes each face wide and the
 * ring sparse.
 */
const CAROUSEL_COUNT = 10;

/** Splits a CMS textarea into paragraphs on blank lines. */
const paragraphs = s => String(s || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);



const FEATURE_ICONS = { gift: "gift", globe: "globe", crown: "crown", dress: "dress" };




/* --- chrome ------------------------------------------------------------- */

/**
 * Absolute form of an image address. WhatsApp, Instagram and structured data
 * all reject relative paths; ImageKit links are already absolute, so those
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

/** Share image for og:image / twitter:image, falling back to the built-in card. */
function shareImage(image, siteUrl) {
  const src = (image && image.src) || SHARE_CARD.src;
  const isCard = src === SHARE_CARD.src;
  // A host that resizes on delivery can hand WhatsApp a preview-sized copy
  // instead of the full-resolution photo; see tools/images.js for why that
  // matters and what each host is asked for.
  const derived = images.preview(src);

  // Dimensions are only claimed where they are actually known: the built-in
  // card, and derived copies we asked for at an exact size. For any other
  // pasted photo they are omitted — guessing is worse than letting the scraper
  // fetch and measure for itself.
  if (derived) return { url: derived.url, alt: (image && image.alt) || "", width: derived.width, height: derived.height, type: derived.type };
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
<button type="button" class="lp-searchbtn" data-search-open aria-expanded="false" aria-controls="lp-search" aria-label="Search the catalogue" hidden>
${svg(ICON.search, { size: 24, stroke: "var(--berry-800)", width: 2 })}
</button>
<a class="lp-igbtn" target="_blank" rel="noopener" href="${safeHref(s.instagram)}" aria-label="Instagram">
${svg(ICON.igHeader, { size: 27, stroke: "#FFFCF8", width: 1.7 })}
</a>
</div>
<!-- Unhidden by app.js along with the button that opens it: with no JavaScript
     there is nothing to search with, so neither is shown. -->
<div class="lp-search" id="lp-search" data-search hidden>
<div class="lp-search-bar">
<label class="lp-sr" for="lp-search-q">Search for a piece</label>
<span class="lp-search-icon">${svg(ICON.search, { size: 20, stroke: "var(--text-muted)", width: 2 })}</span>
<input class="lp-search-q" id="lp-search-q" type="search" data-search-input autocomplete="off"
  placeholder="Search by name, category or section — try &quot;gown&quot; or &quot;boys&quot;">
<button type="button" class="lp-search-close" data-search-close aria-label="Close search">
${svg(ICON.close, { size: 20, stroke: "var(--berry-800)", width: 2 })}
</button>
</div>
<p class="lp-search-note" data-search-note role="status" aria-live="polite"></p>
<div class="lp-search-results" data-search-results></div>
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

  // The carousel used to spin a hand-curated photo list from Site Settings.
  // It shows the newest pieces instead, so new work is visible from the home
  // page rather than only to someone who opens the right subcategory — and so
  // the row keeps itself up to date with no one having to maintain it.
  const newest = [...model.products]
    .sort((a, b) => b.addedOn - a.addedOn || a.name.localeCompare(b.name))
    .slice(0, CAROUSEL_COUNT);
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
${newest.map(p =>
  '<div><a class="lp-car-face" href="' + safeHref(p.href) +
  '" aria-label="' + esc(p.name + " — " + p.subcategoryName + " for " + p.tabLabel) + '">' +
  // The placeholder carries the product name rather than the generic wording:
  // a photo-only face with no photo would otherwise say nothing at all, and
  // most of the catalogue is still unphotographed.
  frame(p.images[0] || null, { placeholder: p.name, sizes: IMG_SIZES.carousel }) +
  "</a></div>"
).join("\n")}
</carousel-3d>
</div>
</section>

<section class="lp-sect lp-sect--gap9">
<h2 class="lp-h2"><img class="lp-crown" src="/assets/logo-crown.png" alt="">${esc(s.categoriesHeading)}</h2>
<div class="lp-getyours">
${model.categories.map(c => `<a href="${c.href}">
<div class="lp-gy" data-cat="${esc(c.key)}">
<div class="lp-gy-photo">${frame(c.card.image, { placeholder: esc(c.label) + " photo", sizes: IMG_SIZES.category })}</div>
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
<div class="lp-ceo-photo">${frame(s.about.photo, { placeholder: "Studio or team photo", sizes: IMG_SIZES.studio })}</div>
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



  // The page summary is the opening sentence of the description plus a fixed
  // tail. Both ends of that need guarding: `description` is optional on
  // products and on subcategories, so it can resolve empty and leave the
  // summary opening on a bare ". "; and when the description is a single
  // sentence, split() never takes its full stop off, which is where the
  // "hand-stitched buttons.. Made to order" in today's Prince Arthur Suit
  // summary comes from.
  const opening = String(p.description || "").split(". ")[0].trim().replace(/[.\s]+$/, "");
  const tail = (s.productDefaults && String(s.productDefaults.summaryTail || "").trim()) || SUMMARY_TAIL;
  const desc = opening ? opening + ". " + tail : tail;




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
${card.productDetail(p, s)}
</main>`;

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
      // Never empty: falls back to the same summary the meta tags carry.
      description: p.description || desc,
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

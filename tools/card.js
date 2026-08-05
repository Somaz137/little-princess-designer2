/**
 * The product card, and the few helpers it is built from.
 *
 * This file is loaded twice, by two very different things:
 *
 *   · the build (`tools/render.js`), as an ordinary Node module, to write the
 *     cards into every shop page; and
 *   · the admin preview panel (`site/admin/preview.js`), as a plain browser
 *     script, to draw the card the owner is editing as they type.
 *
 * One file rather than two, because the alternative is a lookalike card in the
 * admin that matches on the day it is written and quietly stops matching the
 * first time the real one changes — which is exactly the failure a preview
 * exists to prevent. Everything here is therefore string-building only: no
 * `fs`, no DOM, nothing either side cannot provide.
 *
 * The cost of that is the export block at the bottom and the `images` lookup
 * just below, which have to work under both loaders. Both are small, and both
 * are commented where they sit.
 */

"use strict";

/**
 * The resize-rule table (`tools/images.js`). Under Node it is required;
 * in the browser `tools/images.js` has already run and left itself on the
 * window as `LPImages`. The admin loads the two in that order.
 */
const images = (typeof require === "function")
  ? require("./images")
  : (typeof LPImages !== "undefined" ? LPImages : null);

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);

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

/* --- shared image frame ------------------------------------------------- */

/**
 * How wide each kind of photo is actually drawn, read off styles.css so the
 * browser can pick a copy rather than fetching a 4000px original for a 250px
 * hole. 768px is the phone breakpoint used throughout the stylesheet.
 *
 *   carousel — .lp-car-face is 3/4 of the carousel's 31.25rem height (20rem on
 *              a phone), so 375px and 240px
 *   category — .lp-getyours is 4 columns of the 1180px container, less .lp-gy's
 *              padding and border; 2 columns on a phone
 *   product  — .lp-grid is 2 columns of 900px; 2 columns of the viewport on a
 *              phone
 *   studio   — .lp-ceo gives the photo 0.5 of a 0.5fr/1.5fr split, capped at
 *              230px on a phone
 *   gallery  — .lp-detail is auto-fit minmax(300px,1fr) with a 40px gap, so it
 *              is two columns until the container drops under 640px — around a
 *              712px viewport, hence the 720px breakpoint rather than the usual
 *              768. Above it the column is half the container less the gap:
 *              ~44vw while the container is still tracking the viewport, then a
 *              flat 570px once the container caps at 1180px (viewport 1308px,
 *              where the clamped page gutter has reached its own 64px cap).
 *
 *              Those are the layout widths; the numbers below are 1.5x them,
 *              and that multiplier is why the gallery stopped looking soft.
 *              `sizes` is what the browser multiplies by the screen density to
 *              choose a copy, so the honest 570px picked the 1200 on a 2x
 *              laptop and never reached the 1600 the detail profile offers.
 *              1.5x also covers the crop: .lp-gallery img is object-fit:cover
 *              in a 3/4 frame, so a landscape upload is scaled until its height
 *              fills the frame and its width overflows — up to 1.78x the column
 *              for a 4:3 photo, all of which comes out of the same pixels.
 *              Cards do not get this: nobody studies a thumbnail, and there the
 *              multiplier would be pure waste.
 *
 * These are hints, not promises: get one wrong and the browser fetches a copy
 * a size out, which is still far less than the original.
 */
const IMG_SIZES = {
  carousel: "(max-width: 768px) 240px, 375px",
  category: "(max-width: 768px) 44vw, (max-width: 1024px) 45vw, 255px",
  product: "(max-width: 768px) 45vw, 436px",
  studio: "(max-width: 768px) 230px, 270px",
  gallery: "(max-width: 720px) 138vw, (max-width: 1308px) 66vw, 855px"
};

/**
 * Renders a photo, or the empty frame shown until one is added in the CMS.
 *
 * `sizes` is the width the picture is actually drawn at, as a CSS length or
 * media-query list. Pass it and the browser is offered resized copies through
 * `srcset` and picks one to match the screen; leave it out and the original is
 * served whole. Every caller passes one — including the product gallery, which
 * used to be exempted on the grounds that a visitor might pinch into the photo.
 * Nothing on the page lets them: .lp-gallery img is `object-fit:cover` inside a
 * fixed 3/4 frame, so the picture is never drawn above its column width. All
 * the exemption bought was the full-resolution original on the one page most
 * likely to be opened on a phone, on data.
 *
 * `profile` picks how generous to be with the copies offered — see PROFILES in
 * tools/images.js. Cards take the default; the gallery asks for "detail".
 */
function frame(image, { eager = false, placeholder = "Photo coming soon", sizes = "", profile = "card" } = {}) {
  if (!image) {
    return '<div class="lp-ph"><img class="lp-ph-crown" src="/assets/logo-crown.png" alt=""><span>' +
      esc(placeholder) + "</span></div>";
  }
  // Empty on a host that cannot resize, in which case both attributes are
  // dropped and the markup is exactly what it was before. `images` is also
  // empty if the resize table failed to load in the browser — the photo is
  // then shown at its own size, which is a slow preview, never a broken one.
  const set = sizes && images ? images.srcset(image.src, profile) : "";
  return '<img src="' + esc(image.src) + '" alt="' + esc(image.alt) + '"' +
    (set ? ' srcset="' + esc(set) + '" sizes="' + esc(sizes) + '"' : "") +
    (eager ? "" : ' loading="lazy"') + ' decoding="async">';
}

/* --- the card ------------------------------------------------------------ */

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
${frame(p.images[0] ? { src: p.images[0].src, alt } : null, { placeholder: "Photo coming soon", sizes: IMG_SIZES.product })}
</div>
</a>
<div class="lp-card-body">
<h4><a class="lp-card-name" href="${safeHref(p.href)}">${esc(p.name)}</a></h4>
<div class="lp-card-price" data-price-out>${money(first.price)}</div>
<select class="lp-select" data-price-select aria-label="${esc("Select size for " + p.name)}">${opts}</select>
</div>
</article>`;
}

/* --- the admin preview's half -------------------------------------------- */

/**
 * Turns a half-typed CMS form into something `productCard` can draw.
 *
 * The build hands `productCard` a finished product, assembled by
 * `tools/content.js` out of files that are already complete and valid. The
 * preview panel has neither luxury: it is handed whatever is in the form at
 * this keystroke, which for a new piece means no name, no sizes and no photo.
 * So this is content.js's product-shaping rules again (tools/content.js:256-295
 * — same filters, same order, same minimum), rewritten to bend rather than
 * break when a field is not filled in yet.
 *
 * It lives here, next to the card, for the same reason the card is here: the
 * two have to agree, and `npm test` can only check that if both are reachable
 * from Node.
 *
 * `catalogue` is the parsed `/data/products.json` the build already writes.
 * It supplies the canonical size order and the readable subcategory name.
 * Pass nothing and both fall back gracefully — the card is unharmed, since
 * neither is drawn on it.
 *
 * Returns the product plus `notes`: the things a preview can usefully say are
 * missing, which the panel prints under the card.
 */
function fromCmsEntry(data, catalogue) {
  const d = data || {};
  const cat = catalogue || {};
  const order = Array.isArray(cat.sizes) ? cat.sizes : [];
  const notes = [];

  const name = String(d.name || "").trim();

  // content.js drops any row that is unavailable, unpriced, or names a size
  // the config does not offer. Here an unknown size is kept when the size list
  // could not be loaded, because "unknown" would then mean "unknowable".
  const sizes = (Array.isArray(d.sizes) ? d.sizes : [])
    .filter(s => s && s.available !== false)
    .map(s => ({ size: String(s.size || "").trim(), price: Number(s.price) }))
    .filter(s => s.size && Number.isFinite(s.price) && s.price > 0 &&
      (!order.length || order.includes(s.size)))
    .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));

  // A pasted link wins over a library pick, exactly as on the site
  // (tools/content.js:134). Rows still being typed hold neither.
  const imgs = (Array.isArray(d.images) ? d.images : [])
    .map(img => {
      const src = String((img && img.url) || "").trim() || String((img && img.upload) || "").trim();
      return src ? { src: normaliseSrc(src), alt: String((img && img.alt) || "").trim() || name } : null;
    })
    .filter(Boolean);

  const sub = findSubcategory(cat, d.subcategory);

  if (!name) notes.push("No product name yet.");
  if (!imgs.length) notes.push("No photo yet — the card shows an empty frame until one is added.");
  if (!sizes.length) {
    notes.push("No size with a price yet, so there is no price to show. " +
      "A piece stays off the website until it has one.");
  }
  if (!d.subcategory) notes.push("No subcategory chosen, so this piece has no section to appear in.");
  if (d.visible === false) notes.push("“Show on website” is off — this card is hidden from the shop.");

  return {
    notes,
    product: {
      id: "preview",
      name: name || "Untitled piece",
      // Nothing in the panel is clickable, but the card builds two links and
      // `safeHref` has to be handed something it recognises.
      href: "#",
      subcategory: String(d.subcategory || ""),
      subcategoryName: sub.name,
      tab: sub.parent,
      tabLabel: sub.label,
      badge: String(d.badge || "").trim(),
      images: imgs,
      // The card reads `sizes[0]` and `minPrice` unconditionally. A single
      // priceless row keeps it drawable while the form is still empty; the
      // note above has already said so in words.
      sizes: sizes.length ? sizes : [{ size: "No size yet", price: 0 }],
      minPrice: sizes.length ? Math.min(...sizes.map(s => s.price)) : 0
    }
  };
}

/**
 * The same rule the build applies to a photo address (`normaliseSrc` in
 * tools/content.js): absolute addresses pass through, anything else is forced
 * root-relative. Repeated rather than shared because content.js is Node-only —
 * it reads the content directory — and this file has to run in a browser. It is
 * three lines, and `npm test` checks the two against each other.
 */
function normaliseSrc(src) {
  if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src) || src.startsWith("/")) return src;
  return "/" + src;
}

/**
 * Looks a subcategory code — "g3" — up to its readable name and tab label.
 * Neither is printed on the card; both feed the alt text and the link's
 * screen-reader label, so an unknown code degrades to the code itself rather
 * than to a crash or an empty string.
 */
function findSubcategory(catalogue, id) {
  const code = String(id || "").trim();
  const cats = Array.isArray(catalogue && catalogue.categories) ? catalogue.categories : [];
  for (const c of cats) {
    for (const sub of (c.subcategories || [])) {
      if (sub.id === code) return { name: sub.name, parent: c.key, label: c.label };
    }
  }
  return { name: code || "this section", parent: "", label: "the shop" };
}

/**
 * Exported for Node and for the browser from the one file. Under Node
 * `module` exists and this is an ordinary CommonJS module; loaded as a plain
 * <script> it leaves itself on the window instead, which is what
 * site/admin/preview.js picks up.
 *
 * The name is deliberately not something plain like `API` — see the matching
 * note in tools/images.js. As <script> tags these two files share one top-level
 * scope, and the same `const` name in both is a redeclaration error that kills
 * whichever loads second.
 */
const CARD_API = { esc, safeHref, money, frame, IMG_SIZES, productCard, fromCmsEntry, findSubcategory };

if (typeof module === "object" && module.exports) {
  module.exports = CARD_API;
} else {
  (typeof globalThis !== "undefined" ? globalThis : self).LPCard = CARD_API;
}

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

/**
 * The price block, used on the card and on the product page.
 *
 * Off sale it is one line. On sale the old price sits above the new one,
 * smaller and struck through — `wasPrice` is the original, `price` is always
 * what the customer actually pays (tools/content.js does that swap, so nothing
 * downstream has to know a sale is on).
 *
 * Both spans are always in the markup, with the struck-through one hidden when
 * there is nothing to strike. That is what lets app.js switch a card between
 * sale and full price as the size dropdown changes, without building elements.
 */
function priceBlock(sz, cls) {
  return '<span class="lp-price-was" data-price-was' + (sz.wasPrice ? "" : " hidden") + ">" +
    (sz.wasPrice ? money(sz.wasPrice) : "") + "</span>" +
    '<span class="' + cls + '" data-price-now>' + money(sz.price) + "</span>";
}

function productCard(model, p) {
  // data-was rides along on each option so the dropdown carries both prices;
  // empty on a size that is not discounted.
  const opts = p.sizes.map((s, i) =>
    '<option value="' + i + '" data-price="' + s.price + '" data-was="' +
    (s.wasPrice || "") + '">' + esc(s.size) + "</option>"
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
<div class="lp-card-price${first.wasPrice ? " lp-card-price--sale" : ""}" data-price-out>${priceBlock(first, "lp-price-now")}</div>
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
    .map(s => ({
      size: String(s.size || "").trim(),
      price: Number(s.price),
      salePrice: Number(s.salePrice)
    }))
    .filter(s => s.size && Number.isFinite(s.price) && s.price > 0 &&
      (!order.length || order.includes(s.size)))
    // Same swap as the site (tools/content.js): `price` is what is paid,
    // `wasPrice` is the struck-through original, and a sale price that is not
    // actually lower is ignored rather than shown as a rise.
    .map(s => {
      const onSale = Number.isFinite(s.salePrice) && s.salePrice > 0 && s.salePrice < s.price;
      if (Number.isFinite(s.salePrice) && s.salePrice > 0 && !onSale) {
        notes.push("The sale price for " + s.size + " is not below its normal price, so it is ignored.");
      }
      return { size: s.size, price: onSale ? s.salePrice : s.price, wasPrice: onSale ? s.price : null };
    })
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
      showAccessory: d.showAccessory !== false,
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
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path>',
  close: '<path d="m6 6 12 12M18 6 6 18"></path>',
  chevRight: '<path d="m9 6 6 6-6 6"></path>',
  chevDown: '<path d="m6 9 6 6 6-6"></path>',
  arrowLeft: '<path d="m14.5 5-7 7 7 7"></path>',
  arrowRight: '<path d="m9.5 5 7 7-7 7"></path>',
  waFilled: '<path fill="#ffffff" d="M16.02 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.71a12.74 12.74 0 0 0 6.25 1.62h.01c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.33-6.63-3.75-9.05a12.7 12.7 0 0 0-9.06-3.66Zm0 23.02h-.01c-1.9 0-3.77-.51-5.4-1.48l-.39-.23-4.02 1.05 1.07-3.92-.25-.4a10.6 10.6 0 0 1-1.63-5.66c0-5.87 4.78-10.64 10.64-10.64 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.53c0 5.87-4.77 10.63-10.64 10.63Zm5.83-7.97c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.07 1.3 3.28c.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.82.67.76.24 1.46.21 2.01.13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z"></path>'
};

const svg = (body, { size = 24, stroke = "currentColor", width = 1.6, viewBox = "0 0 24 24" } = {}) =>
  '<svg viewBox="' + viewBox + '" width="' + size + '" height="' + size + '" fill="none" stroke="' + stroke +
  '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";


/* --- the product page's own block ---------------------------------------- */

const waLink = (num, text) =>
  "https://wa.me/" + String(num).replace(/[^0-9]/g, "") +
  (text ? "?text=" + encodeURIComponent(text) : "");

/**
 * The three views a gallery is laid out for. A piece with fewer photos still
 * gets three frames, so the page does not reflow as photos are added.
 */
const GALLERY_VIEWS = ["front", "side", "back"];

/**
 * Everything on a product page below the breadcrumb: the photo gallery, and the
 * column with the name, size picker, price, description, details, accessory
 * tick-box, total and order button.
 *
 * Shared with the admin preview panel for the same reason the card is — the
 * panel draws this exact markup, so what the owner sees while typing is the
 * page, not an impression of it. The page chrome around it (header, breadcrumb,
 * footer, meta tags) stays in tools/render.js: it is identical on every product
 * and would only eat the panel's narrow width.
 *
 * `s` is the site settings — the WhatsApp number, the accessory wording and
 * price, the delivery note. The build has them from content/settings.json; the
 * panel fetches the copy the build publishes to /data/settings.json.
 */
function productDetail(p, s) {
  const galleryImages = p.images.length ? p.images : [null, null, null];
  const slides = galleryImages.slice(0, Math.max(3, galleryImages.length));
  const gallery = slides.map((img, i) => {
    const fallbackAlt = p.name + " — " + (GALLERY_VIEWS[i] || "detail") + " view of the handmade " +
      p.subcategoryName.toLowerCase() + " for " + p.tabLabel.toLowerCase();
    return "<div>" + frame(
      img ? { src: img.src, alt: img.alt || fallbackAlt } : null,
      {
        eager: i === 0,
        placeholder: (GALLERY_VIEWS[i] || "Extra") + " view",
        sizes: IMG_SIZES.gallery,
        profile: "detail"
      }
    ) + "</div>";
  }).join("\n");

  // data-was carries the crossed-out original for a discounted size, empty for
  // one at its usual price — app.js repaints from these as the size changes.
  const opts = p.sizes.map((sz, i) =>
    '<option value="' + i + '" data-price="' + sz.price + '" data-was="' +
    (sz.wasPrice || "") + '">' + esc(sz.size) + "</option>"
  ).join("");
  const first = p.sizes[0];

  // A sold-out piece cannot be supplied, so it does not get an order button —
  // customers were ordering them. Everything else on the page stays live: the
  // size dropdown, the price and the total still work, and the floating
  // WhatsApp button is still there to ask about it. No data-wa-order attribute,
  // so app.js leaves this alone while it carries on repricing.
  const soldOut = p.badge === "Sold out";
  const orderCta = soldOut
    ? `<span class="lp-wa lp-wa--off" aria-disabled="true">Currently unavailable</span>`
    : `<a class="lp-wa" target="_blank" rel="noopener" href="${safeHref(waLink(s.whatsappNumber,
  "Hello Little Princess Designer, I'd like to order:\n" + p.name +
  "\nSize: " + first.size + "\nMatching accessory: no\nTotal shown: " + money(first.price)))}" data-wa-order>
${svg(ICON.waFilled, { size: 20, viewBox: "0 0 32 32", stroke: "none", width: 0 })}
Order on WhatsApp</a>`;

  // A product with one photo has nothing to page to, and app.js already
  // null-checks both buttons, so they are simply left out. A product with no
  // photos still gets three placeholder frames, and paging between those works
  // the same as it always did.
  const arrows = slides.length > 1
    ? `<button type="button" class="lp-arrow lp-arrow--prev" data-gal-prev aria-label="Previous view">
${svg(ICON.arrowLeft, { size: 20, stroke: "var(--tone-deep)", width: 2 })}
</button>
<button type="button" class="lp-arrow lp-arrow--next" data-gal-next aria-label="Next view">
${svg(ICON.arrowRight, { size: 20, stroke: "var(--tone-deep)", width: 2 })}
</button>`
    : "";

  // Left out entirely for a piece that has no matching accessory, rather than
  // shown and ignored. app.js finds no tick-box and leaves the total alone —
  // it already null-checks this, so nothing else has to change.
  const accessory = p.showAccessory === false ? "" : `<div>
<label class="lp-acc">
<input type="checkbox" data-accessory aria-describedby="lp-acc-note">
<span>${esc(s.accessoryLabel)}</span>
</label>
<div class="lp-acc-note" id="lp-acc-note">${esc(s.accessoryNote)}</div>
</div>
`;

  const specRows = [
    ["Fabric", p.specs.fabric],
    ["Occasion", p.specs.occasion],
    ["Fit", p.specs.fit],
    ["Care", p.specs.care],
    ["Made in", "Our own studio in Lahore, Pakistan"]
  ].filter(([, v]) => v);

  return `<div class="lp-detail"
  data-detail
  data-wa="${esc(String(s.whatsappNumber))}"
  data-name="${esc(p.name)}"
  data-accessory-price="${p.accessoryPrice}">
<div class="lp-galwrap">
<div class="lp-gallery" data-gallery>
${gallery}
</div>
${arrows}
</div>

<div class="lp-detail-col">
<h1 class="lp-detail-h1">${esc(p.name)}</h1>
<div>
<label class="lp-label" for="lp-detail-size">Select size</label>
<select class="lp-select lp-select--detail" id="lp-detail-size" data-detail-size>${opts}</select>
</div>
<div class="lp-detail-price${first.wasPrice ? " lp-detail-price--sale" : ""}" data-detail-price>${priceBlock(first, "lp-price-now")}</div>

<div class="lp-desc">
<h2 class="lp-eyebrow">Product description</h2>
${p.description ? "<p>" + esc(p.description) + "</p>" : ""}
${p.description2 ? "<p>" + esc(p.description2) + "</p>" : ""}
<dl class="lp-specs">
${specRows.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>").join("\n")}
</dl>
</div>

${accessory}
<div class="lp-total">
<div class="lp-total-row">
<span class="lp-total-label">Total</span>
<span class="lp-total-amount" data-total>${money(first.price)}</span>
</div>
<div class="lp-total-note">${esc(s.deliveryNote)}</div>
</div>

${orderCta}
</div>
</div>`;
}

/**
 * The wording cascade, for the preview panel: a piece's own words, then its
 * section's standard wording, then the site defaults. Three steps, so nothing
 * can resolve empty — leaving a piece and its section both blank is two clicks
 * in the admin, and the live page falls back rather than showing a gap.
 *
 * This is `nonEmpty()` from tools/content.js:145 applied to the same fields in
 * the same order. It is repeated rather than shared because content.js reads
 * the content directory and cannot run in a browser; `npm test` checks the two
 * against each other on the same input.
 */
function firstNonEmpty(...vals) {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function applyWording(data, sub, settings) {
  const own = data || {};
  const section = sub || {};
  const site = (settings && settings.productDefaults) || {};
  const ownSpecs = own.specs || {};
  const sectionSpecs = section.defaultSpecs || {};
  const siteSpecs = site.specs || {};
  return {
    description: firstNonEmpty(own.description, section.defaultDescription, site.description),
    description2: firstNonEmpty(own.description2, section.defaultDescription2, site.description2),
    specs: {
      fabric: firstNonEmpty(ownSpecs.fabric, sectionSpecs.fabric, siteSpecs.fabric),
      occasion: firstNonEmpty(ownSpecs.occasion, sectionSpecs.occasion, siteSpecs.occasion),
      fit: firstNonEmpty(ownSpecs.fit, sectionSpecs.fit, siteSpecs.fit),
      care: firstNonEmpty(ownSpecs.care, sectionSpecs.care, siteSpecs.care)
    }
  };
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
const CARD_API = {
  esc, safeHref, money, frame, IMG_SIZES, priceBlock, productCard,
  svg, ICON, waLink, productDetail, applyWording,
  fromCmsEntry, findSubcategory
};

if (typeof module === "object" && module.exports) {
  module.exports = CARD_API;
} else {
  (typeof globalThis !== "undefined" ? globalThis : self).LPCard = CARD_API;
}

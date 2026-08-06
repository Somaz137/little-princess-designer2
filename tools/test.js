#!/usr/bin/env node
/**
 * Assertions over tools/content.js, the one file in the build with real
 * branching in it: the wording cascade, duplicate-id detection, and the size
 * and price filtering that decides whether a product reaches the site at all.
 * A regression in any of those is invisible in review and shows up as a
 * product quietly missing from the live shop.
 *
 * Plus tools/images.js, for a different reason: the addresses it builds are
 * only ever proved right by a photo appearing, and every photo on this site
 * comes from an account no test can reach. Pinning the exact strings here at
 * least means a change to them has to be deliberate.
 *
 * Dependency-free on purpose — no runner, no framework, nothing to install.
 *
 *   npm test
 *
 * It runs against tools/fixtures/content, a small catalogue built to hit every
 * branch at once: a product with its own wording, one that has to inherit from
 * its subcategory, one that has to fall through to the site defaults, a hidden
 * one, an orphaned one, a price row with an unknown size, a product with no
 * usable price, and a duplicated subcategory id. Editing the fixture is how you
 * add a case; it is not a copy of the real catalogue and does not track it.
 */

"use strict";

const path = require("path");
const { load, SIZES } = require("./content");
const images = require("./images");

const FIXTURE = path.join(__dirname, "fixtures", "content");

/* --- tiny harness ------------------------------------------------------- */

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures.push("  ✗ " + label + "\n      expected: " + e + "\n      actual:   " + a);
}

function checkTrue(label, actual) {
  if (actual) { passed++; return; }
  failures.push("  ✗ " + label + "\n      expected something truthy, got: " + JSON.stringify(actual));
}

/** A warning mentioning every one of these fragments. */
function warned(warnings, ...fragments) {
  return warnings.some(w => fragments.every(f => w.includes(f)));
}

/* --- the run ------------------------------------------------------------ */

const model = load({ dir: FIXTURE, quiet: true });
const byName = Object.fromEntries(model.products.map(p => [p.name, p]));
const w = model.warnings;

console.log("Checking tools/content.js against tools/fixtures/content, and tools/images.js…\n");

/* which products survive */

check("visible products", model.products.map(p => p.name).sort(),
  ["Bad size row", "Badged sale only", "Inherits site", "Inherits sub", "On sale", "Own words",
    "Photos", "Some sizes off", "Undated"]);
check("hidden products are counted, not rendered", model.stats.hidden, 1);
checkTrue("a product with no usable price is dropped, with a warning",
  !byName["No price"] && warned(w, "No price", "no size with a price"));
checkTrue("a product pointing at a missing subcategory is dropped, with a warning",
  !byName["Orphaned piece"] && warned(w, "Orphaned piece", "no longer exists"));

/* the wording cascade: product → subcategory → site default */

check("own wording wins", byName["Own words"].description, "OWN description");
check("own second paragraph wins", byName["Own words"].description2, "OWN second paragraph");
check("own specs win", byName["Own words"].specs.fabric, "OWN fabric");

check("blank falls through to the subcategory", byName["Inherits sub"].description, "SUB description");
check("blank second paragraph falls through to the subcategory",
  byName["Inherits sub"].description2, "SUB second paragraph");
check("blank specs fall through to the subcategory", byName["Inherits sub"].specs, {
  fabric: "SUB fabric", occasion: "SUB occasion", fit: "SUB fit", care: "SUB care"
});

check("with no subcategory default, falls through to the site default",
  byName["Inherits site"].description, "SITE description");
check("site default second paragraph", byName["Inherits site"].description2, "SITE second paragraph");
check("site default specs", byName["Inherits site"].specs, {
  fabric: "SITE fabric", occasion: "SITE occasion", fit: "SITE fit", care: "SITE care"
});

/* sizes and prices */

check("size rows sort into age order, not file order",
  byName["Own words"].sizes.map(s => s.size), ["0–3 years", "7–9 years"]);
check("minPrice is the cheapest row", byName["Own words"].minPrice, 1000);
check("an unknown size is dropped and the rest of the product survives",
  byName["Bad size row"].sizes.map(s => s.size), ["10–12 years"]);
checkTrue("the unknown size is warned about", warned(w, "Bad size row", "unknown size"));
check("a row marked unavailable is left out",
  byName["Some sizes off"].sizes.map(s => s.size), ["4–6 years"]);
check("the size vocabulary is the one read from the admin", model.sizes, SIZES);

/* subcategories */

check("subcategories sort by order, not by filename",
  model.categories.find(c => c.key === "girls").subcategories.map(s => s.name),
  ["No defaults", "Has defaults"]);
check("products sort newest-first within a subcategory, not by filename",
  model.categories.find(c => c.key === "girls").subcategories
    .find(s => s.id === "s1").products.map(p => p.name),
  ["Inherits sub", "Own words", "Bad size row", "Some sizes off"]);
check("a product with no date sorts last rather than first",
  model.categories.find(c => c.key === "girls").subcategories
    .find(s => s.id === "s2").products.map(p => p.name),
  ["Inherits site", "On sale", "Badged sale only", "Photos", "Undated"]);
check("a missing date is 0, not NaN — NaN would make the sort incoherent",
  byName["Undated"].addedOn, 0);
check("a date is parsed to milliseconds for sorting",
  byName["Own words"].addedOn, Date.parse("2026-08-03T12:00:00.000Z"));
checkTrue("a duplicated subcategory id is warned about",
  warned(w, "Duplicate id", 'already uses that id'));
checkTrue("a subcategory under an unknown parent is skipped, with a warning",
  !model.subcategories.some(s => s.id === "orphan") && warned(w, "orphan", "not a category"));

/* images */

check("a pasted url wins over an upload",
  byName["Photos"].images[0].src, "https://example.test/pasted.jpg");
check("a photo with no alt falls back to the product name",
  byName["Photos"].images[0].alt, "Photos");
check("an address with no scheme and no leading slash is forced root-relative",
  byName["Photos"].images[1].src, "/assets/uploads/relative.jpg");
checkTrue("and warned about", warned(w, "assets/uploads/relative.jpg", "no leading"));
check("an alt that is set is kept", byName["Photos"].images[1].alt, "Has alt");

/* image addresses (tools/images.js) */

// A photo as the ImageKit library hands it over: a delivery address with the
// upload time already on it, which is what makes the query string worth
// getting right.
const IK = "https://ik.imagekit.io/shop/products/frock.jpg?updatedAt=1770000000";

check("a card asks for three widths, largest last",
  images.srcset(IK, "card").split(", ").map(s => s.split(" ")[1]),
  ["400w", "800w", "1200w"]);
check("a card copy scales down only, and lets ImageKit pick the format",
  images.resized(IK, 800),
  IK + "&tr=w-800,c-at_max,f-auto");
check("the gallery goes one step larger and pins the quality",
  images.srcset(IK, "detail").split(", ").pop(),
  IK + "&tr=w-1600,c-at_max,f-auto,q-90 1600w");
check("an unknown profile name costs quality, not a broken picture",
  images.srcset(IK, "typo"), images.srcset(IK, "card"));

check("the share copy is a padded JPEG at exactly the size it claims",
  images.preview(IK),
  { url: IK + "&tr=w-1200,h-630,cm-pad_resize,bg-FFFCF8,f-jpg",
    width: 1200, height: 630, type: "image/jpeg" });
check("transforming an already-transformed address replaces, never stacks",
  images.preview(images.preview(IK).url).url, images.preview(IK).url);
check("an address with no query string of its own still gets one",
  images.resized("https://ik.imagekit.io/shop/frock.jpg", 400),
  "https://ik.imagekit.io/shop/frock.jpg?tr=w-400,c-at_max,f-auto");
checkTrue("ImageKit photos are worth warming before anyone shares one",
  images.warms(IK));

// The fallback the whole table rests on: a host it does not know must cost
// bytes, never a missing photo.
const OTHER = "https://example.test/pasted.jpg";
check("an unknown host is left exactly as it is", images.resized(OTHER, 400), OTHER);
check("…with no srcset, so the browser keeps the single src", images.srcset(OTHER), "");
check("…and no share copy claimed for it", images.preview(OTHER), null);
checkTrue("…and nothing to warm", !images.warms(OTHER));

/* shape the rest of the build relies on */

check("product id and href come from the filename",
  [byName["Own words"].id, byName["Own words"].href], ["own-words", "/product/own-words/"]);
check("category href", model.categories.find(c => c.key === "girls").href, "/girls/");

/* --- sale prices ---------------------------------------------------------
 *
 * A discounted row carries what the customer pays as `price`, with the old
 * price kept aside as `wasPrice`. That swap is the whole design: the totals,
 * the filters, the "from PKR" line, the WhatsApp message and the price given
 * to search engines all keep reading `price` and are correct on a sale without
 * knowing one is on. These checks are what hold that promise.
 */

const sale = byName["On sale"];

check("a discounted size charges the sale price",
  [sale.sizes[0].size, sale.sizes[0].price, sale.sizes[0].wasPrice],
  ["0–3 years", 6000, 8000]);
check("a size with no sale price is untouched",
  [sale.sizes[1].price, sale.sizes[1].wasPrice], [9000, null]);
check("a sale price that is not lower is ignored rather than shown as a rise",
  [sale.sizes[2].price, sale.sizes[2].wasPrice], [10000, null]);
checkTrue("…and that is warned about, since it is a typo not a choice",
  warned(w, "On sale", "not below", "ignored"));
check("the lowest price — filters, and the 'from PKR' line — follows the sale",
  sale.minPrice, 6000);

// The badge and the prices are set in different places on the form, so the one
// combination that misleads a customer — badge on, nothing actually discounted
// — gets its own warning. The piece still builds; it is a warning, not a bar.
checkTrue('a "Sale" badge with no sale price anywhere is warned about',
  warned(w, "Badged sale only", "no size has a sale price"));
checkTrue("…and that piece still reaches the site", !!byName["Badged sale only"]);
check("…at its ordinary price", byName["Badged sale only"].sizes[0].wasPrice, null);

/* --- tools/card.js: the card the site and the admin preview share --------
 *
 * The card was pulled out of render.js so the admin's preview panel could draw
 * the real one instead of a lookalike. That buys accuracy only for as long as
 * the two halves agree, and neither half can be checked in a browser from here
 * — the admin loads Decap from a CDN. So the agreement is pinned in Node.
 */

const card = require("./card");
const render = require("./render");

/* the move itself: render.js must be using the shared copies, not its own */

checkTrue("render.js re-exports the shared esc, not a second copy",
  render.esc === card.esc);
checkTrue("…and the shared money", render.money === card.money);

/* safeHref survived being moved — the scheme allowlist is a security guard
   (see the Security item in review-checklist.md), and its control-character
   handling is the part most easily broken by a careless copy. */

check("safeHref keeps an ordinary link", card.safeHref("https://example.test/a"), "https://example.test/a");
check("safeHref keeps a same-site path", card.safeHref("/girls/"), "/girls/");
check("safeHref blocks javascript:", card.safeHref("javascript:alert(1)"), "#");
check("safeHref blocks javascript: hidden behind a tab",
  card.safeHref("java\tscript:alert(1)"), "#");
check("safeHref blocks a scheme-relative address", card.safeHref("//evil.test/x"), "#");
check("safeHref turns nothing into an inert link", card.safeHref(""), "#");

/* the preview's own half: a form mid-typing must produce a drawable card */

// The catalogue the panel fetches at runtime, built here the way tools/build.js
// writes it, so the lookup under test is the real shape.
const catalogue = {
  sizes: model.sizes,
  categories: model.categories.map(c => ({
    key: c.key, label: c.label,
    subcategories: c.subcategories.map(sub => ({ id: sub.id, name: sub.name }))
  }))
};

const empty = card.fromCmsEntry({}, catalogue);
checkTrue("an empty form still yields a card that can be drawn",
  typeof card.productCard(null, empty.product) === "string");
checkTrue("…and says the name is missing",
  empty.notes.some(n => n.includes("name")));
checkTrue("…and says there is no photo",
  empty.notes.some(n => n.includes("photo")));
checkTrue("…and says there is no price",
  empty.notes.some(n => n.includes("price")));
check("…with no photo, the card falls back to the empty frame",
  card.productCard(null, empty.product).includes("lp-ph"), true);

check("a hidden piece is called out in the preview",
  card.fromCmsEntry({ visible: false }, catalogue).notes.some(n => n.includes("hidden")), true);

/* the mapper applies content.js's rules — same filters, same order */

const typed = card.fromCmsEntry({
  name: "Half typed",
  subcategory: "s1",
  sizes: [
    { size: "7–9 years", price: 3000, available: true },
    { size: "0–3 years", price: 1000, available: true },
    { size: "4–6 years", price: 50, available: false },   // unavailable: dropped
    { size: "10–12 years", price: 0, available: true },   // no price: dropped
    { size: "Not a size", price: 900, available: true }   // unknown: dropped
  ],
  images: [
    { upload: "https://ik.imagekit.io/lpdlhr/a.jpg", url: "", alt: "Chosen" },
    { upload: "https://ik.imagekit.io/lpdlhr/b.jpg", url: "https://example.test/pasted.jpg", alt: "" },
    { upload: "", url: "", alt: "still empty" }           // untouched row: dropped
  ]
}, catalogue);

check("unavailable, unpriced and unknown size rows are dropped",
  typed.product.sizes.map(s => s.size), ["0–3 years", "7–9 years"]);
check("…and the survivors come back in age order, not typing order",
  typed.product.sizes[0].size, "0–3 years");
check("minPrice is the lowest price, not the first row's",
  typed.product.minPrice, 1000);
check("a pasted link beats a library pick on the same row",
  typed.product.images.map(i => i.src),
  ["https://ik.imagekit.io/lpdlhr/a.jpg", "https://example.test/pasted.jpg"]);
check("a photo with no description falls back to the product name",
  typed.product.images[1].alt, "Half typed");

/* the preview panel shows a sale the same way the site does */

const salePreview = card.fromCmsEntry({
  name: "Preview sale",
  badge: "Sale",
  sizes: [
    { size: "0–3 years", price: 8000, salePrice: 6000 },
    { size: "4–6 years", price: 9000 },
    { size: "7–9 years", price: 10000, salePrice: 12000 }
  ]
}, catalogue);

check("the preview charges the sale price and keeps the old one to strike",
  salePreview.product.sizes.map(s => [s.price, s.wasPrice]),
  [[6000, 8000], [9000, null], [10000, null]]);
check("…and the preview's lowest price follows the sale, as the site's does",
  salePreview.product.minPrice, 6000);
checkTrue("…and a sale price that is not lower is called out rather than shown",
  salePreview.notes.some(n => n.includes("7–9 years") && n.includes("not below")));
checkTrue("the drawn card carries both prices",
  card.productCard(null, salePreview.product).includes("PKR 8,000") &&
  card.productCard(null, salePreview.product).includes("PKR 6,000"));
checkTrue("…and marks itself as a sale card so the styling applies",
  card.productCard(null, salePreview.product).includes("lp-card-price--sale"));
checkTrue("a card at its usual price hides the struck-through line rather than leaving a gap",
  card.productCard(null, typed.product).includes('data-price-was hidden'));
check("the subcategory code resolves to its readable name",
  typed.product.subcategoryName, "Has defaults");
check("…and to the tab label the card's screen-reader text needs",
  typed.product.tabLabel, "Girls");
check("an unknown subcategory code degrades instead of throwing",
  card.fromCmsEntry({ subcategory: "nope" }, catalogue).product.subcategoryName, "nope");
check("a photo address with no scheme and no slash is forced root-relative, as on the site",
  card.fromCmsEntry({ images: [{ upload: "assets/uploads/x.jpg" }] }, catalogue).product.images[0].src,
  "/assets/uploads/x.jpg");

// Without the catalogue — the fetch failed, or has not landed on the first
// keystroke — the panel must still draw rather than blank.
const noCat = card.fromCmsEntry({ name: "No catalogue", sizes: [{ size: "0–3 years", price: 500 }] });
check("with no catalogue loaded, sizes are kept rather than all rejected",
  noCat.product.sizes.length, 1);
checkTrue("…and the card still renders",
  card.productCard(null, noCat.product).includes("No catalogue"));

/* the two halves agree: a finished product mapped from its raw CMS file must
   match what content.js built out of the same file for the live site */

const rawPhotos = JSON.parse(
  require("fs").readFileSync(path.join(FIXTURE, "products", "photos.json"), "utf8"));
const mapped = card.fromCmsEntry(rawPhotos, catalogue).product;
const built = byName[rawPhotos.name];

check("preview and site agree on the sizes of a finished product",
  mapped.sizes, built.sizes);
check("…on its lowest price", mapped.minPrice, built.minPrice);
check("…on its photos", mapped.images.map(i => i.src), built.images.map(i => i.src));
check("…and on their descriptions", mapped.images.map(i => i.alt), built.images.map(i => i.alt));

/* --- the product page, shared with the preview panel ---------------------
 *
 * productDetail() builds everything on a product page below the breadcrumb, and
 * the admin preview panel draws that same function. What is checked here is the
 * bargain that makes sharing worth it: the build's own product page really is
 * this output, so the panel cannot show one thing while the site shows another.
 */

const detailProduct = byName["On sale"];
const detailHtml = card.productDetail(detailProduct, model.settings);

checkTrue("the shared block is what the build's product page contains",
  render.renderProduct(model, detailProduct, "https://example.test").includes(detailHtml));

checkTrue("it carries the size picker app.js repaints from",
  detailHtml.includes("data-detail-size") && detailHtml.includes('data-was="8000"'));
checkTrue("…the sale price block", detailHtml.includes("lp-detail-price--sale"));
checkTrue("…the total", detailHtml.includes("data-total"));
checkTrue("…and the order button, addressed to the shop's number",
  detailHtml.includes("data-wa-order") &&
  detailHtml.includes(String(model.settings.whatsappNumber).replace(/[^0-9]/g, "")));

// A sold-out piece must not offer an order button — the same rule the page has
// had since that finding was fixed, now living in the shared file.
const soldOutHtml = card.productDetail(
  Object.assign({}, detailProduct, { badge: "Sold out" }), model.settings);
checkTrue("a sold-out piece offers no order button",
  !soldOutHtml.includes("data-wa-order") && soldOutHtml.includes("Currently unavailable"));

/* the matching accessory can be switched off per piece */

// Matched on the tick-box's own class and note id, not on "data-accessory":
// the wrapper carries data-accessory-price, which contains that string and
// would make this pass whatever the switch did.
checkTrue("a piece offers the accessory by default",
  detailHtml.includes('class="lp-acc"') && detailHtml.includes('id="lp-acc-note"'));
check("…and every piece saved before the switch existed still does",
  detailProduct.showAccessory, true);

const noAccessoryHtml = card.productDetail(
  Object.assign({}, detailProduct, { showAccessory: false }), model.settings);
checkTrue("switched off, the tick-box is left out rather than shown and ignored",
  !noAccessoryHtml.includes('class="lp-acc"') && !noAccessoryHtml.includes('id="lp-acc-note"'));
checkTrue("…and the rest of the page is untouched",
  noAccessoryHtml.includes("data-total") && noAccessoryHtml.includes("data-detail-size"));
check("the preview reads the switch the same way",
  [
    card.fromCmsEntry({ showAccessory: false }, catalogue).product.showAccessory,
    card.fromCmsEntry({}, catalogue).product.showAccessory
  ],
  [false, true]);

/* the wording cascade the panel applies: piece → section → site default */

const sectionWording = { defaultDescription: "SECTION words", defaultSpecs: { fabric: "SECTION fabric" } };
const siteWording = { productDefaults: { description: "SITE words", specs: { fabric: "SITE fabric" } } };

check("a piece's own words win",
  card.applyWording({ description: "OWN words" }, sectionWording, siteWording).description,
  "OWN words");
check("blank falls through to the section",
  card.applyWording({}, sectionWording, siteWording).description, "SECTION words");
check("blank with no section wording falls through to the site default",
  card.applyWording({}, {}, siteWording).description, "SITE words");
check("the same three steps apply to the details rows",
  [
    card.applyWording({ specs: { fabric: "OWN" } }, sectionWording, siteWording).specs.fabric,
    card.applyWording({}, sectionWording, siteWording).specs.fabric,
    card.applyWording({}, {}, siteWording).specs.fabric
  ],
  ["OWN", "SECTION fabric", "SITE fabric"]);

// The panel repeats this cascade because content.js cannot run in a browser.
// Repeated logic is only safe while something checks the two agree.
check("the panel's cascade agrees with the one the site is built with",
  [
    card.applyWording({}, sectionWording, siteWording).description,
    card.applyWording({}, {}, {}).description
  ],
  ["SECTION words", ""]);

/* --- report ------------------------------------------------------------- */

if (failures.length) {
  console.error(failures.join("\n"));
  console.error("\nFAILED — " + failures.length + " of " + (passed + failures.length) + " checks");
  process.exit(1);
}

console.log("OK — " + passed + " checks passed");

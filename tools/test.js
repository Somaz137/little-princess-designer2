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
  ["Bad size row", "Inherits site", "Inherits sub", "Own words", "Photos", "Some sizes off", "Undated"]);
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
  ["Inherits site", "Photos", "Undated"]);
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

/* --- report ------------------------------------------------------------- */

if (failures.length) {
  console.error(failures.join("\n"));
  console.error("\nFAILED — " + failures.length + " of " + (passed + failures.length) + " checks");
  process.exit(1);
}

console.log("OK — " + passed + " checks passed");

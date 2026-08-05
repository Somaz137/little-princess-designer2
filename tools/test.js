#!/usr/bin/env node
/**
 * Assertions over tools/content.js, the one file in the build with real
 * branching in it: the wording cascade, duplicate-id detection, and the size
 * and price filtering that decides whether a product reaches the site at all.
 * A regression in any of those is invisible in review and shows up as a
 * product quietly missing from the live shop.
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

console.log("Checking tools/content.js against tools/fixtures/content…\n");

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

/* shape the rest of the build relies on */

check("product id and href come from the filename",
  [byName["Own words"].id, byName["Own words"].href], ["own-words", "/product/own-words/"]);
check("category href", model.categories.find(c => c.key === "girls").href, "/girls/");

/* --- report ------------------------------------------------------------- */

if (failures.length) {
  console.error(failures.join("\n"));
  console.error("\nFAILED — " + failures.length + " of " + (passed + failures.length) + " checks");
  process.exit(1);
}

console.log("OK — " + passed + " checks passed");

#!/usr/bin/env node
/**
 * One-time seed for content/subcategories and content/products.
 *
 * The prototype had no catalogue: product names came from a generator
 * (8 first names x 3 lines x category noun) and prices from arithmetic
 * (base + i*900 + line*1400). This script lays down a realistic starter
 * catalogue in the shape the CMS edits, converting those formula prices into
 * explicit per-size prices the admin can now change one by one.
 *
 * Safe to delete once you have your real catalogue in. Re-running it will NOT
 * overwrite files that already exist, so it can never clobber real content;
 * pass --force if you deliberately want the seed values back.
 *
 *   node tools/seed-content.js [--force]
 */

const fs = require("fs");
const path = require("path");
const { SIZES } = require("./content");

const ROOT = path.join(__dirname, "..");
const SUBDIR = path.join(ROOT, "content", "subcategories");
const PRODDIR = path.join(ROOT, "content", "products");
const FORCE = process.argv.includes("--force");

/**
 * The size vocabulary, taken from content.js so this file cannot drift out of
 * step with the admin the way it had. Babies are offered the youngest two
 * bands, and the uplifts are held by position rather than by name so none of
 * the strings is written down twice.
 */
const BABY_BAND_COUNT = 2;
const BABY_SIZES = SIZES.slice(0, BABY_BAND_COUNT);
/** Age-band uplifts the prototype applied on top of a product's base price. */
const UPLIFT_BY_BAND = [0, 900, 1800, 2700, 3600];
const upliftFor = size => UPLIFT_BY_BAND[SIZES.indexOf(size)] || 0;

const SUBS = [
  {
    id: "g1", parent: "girls", name: "Casual dresses", order: 10, base: 7500,
    defaultDescription: "An everyday frock in soft cotton-lawn, lined through the bodice so it sits comfortably all day. The skirt is gathered for movement and the back closes with covered buttons.",
    defaultDescription2: "French seams inside mean nothing scratches, and the hem is hand-finished so it holds its line after washing. Cut to your child's measurements and pressed before it is packed.",
    defaultSpecs: {
      fabric: "Cotton-lawn shell, cotton lining through the bodice",
      occasion: "Everyday wear, school events, family lunches",
      fit: "Gathered skirt with room to move; covered-button back",
      care: "Cold hand wash or gentle machine cycle, dry in shade, warm iron inside out"
    }
  },
  {
    id: "g2", parent: "girls", name: "Theme dresses", order: 20, base: 11500,
    defaultDescription: "A character-themed party dress built on a fitted bodice with a full net skirt. A matching hair accessory is available. Tell us the theme colours and we will match them.",
    defaultDescription2: "Appliqué and trims are stitched on by hand in our Lahore studio. Tell us the theme colours and we match them before we cut.",
    defaultSpecs: {
      fabric: "Fitted satin bodice with layered soft net skirt",
      occasion: "Birthday parties, themed shoots, costume days",
      fit: "Fitted bodice, full skirt; matching hair accessory available",
      care: "Spot clean or dry clean only; store hanging so the net keeps its volume"
    }
  },
  {
    id: "g3", parent: "girls", name: "Luxury dresses", order: 30, base: 18500,
    defaultDescription: "Our heaviest occasion gown — layered net over satin with hand-worked beading across the bodice. A boned waistband keeps the shape through a long evening.",
    defaultDescription2: "Every piece takes roughly three weeks in the studio and is made only on order, with two fittings before it goes home.",
    defaultSpecs: {
      fabric: "Layered net over duchess satin, hand-worked beading",
      occasion: "Weddings, mehndi and walima, flower-girl duties",
      fit: "Boned waistband holds the shape through a long evening",
      care: "Dry clean only; store flat in the garment bag we send with it"
    }
  },
  {
    id: "g4", parent: "girls", name: "Skirts", order: 40, base: 5500,
    defaultDescription: "A stand-alone party skirt with an elasticated comfort waist and a full lined underlayer. Length is set to your measurement so it falls exactly where you want it.",
    defaultDescription2: "Pairs with any of our shirts or a plain top. It falls exactly where you want it because the length is cut to your number, not a chart.",
    defaultSpecs: {
      fabric: "Net over lined cotton underlayer, satin waistband",
      occasion: "Parties, mix-and-match everyday dressing",
      fit: "Elasticated comfort waist; length set to your measurement",
      care: "Cold hand wash, dry in shade, do not tumble dry"
    }
  },
  {
    id: "b1", parent: "boys", name: "Prince dresses", order: 10, base: 13500,
    defaultDescription: "A full prince suit: coat, inner shirt and trousers, with braid detailing on the shoulder and cuff. The coat is fully lined and the trousers have an adjustable waist.",
    defaultDescription2: "Coat, inner shirt and trousers, with braid detailing on the shoulder and cuff. Every button is stitched on by hand. Made on order in roughly three weeks.",
    defaultSpecs: {
      fabric: "Cotton-silk coat with full lining, braid trim",
      occasion: "Weddings, Eid, formal family occasions",
      fit: "Fully lined coat; trousers with adjustable inner waist",
      care: "Dry clean the coat; wash the shirt cold and iron warm"
    }
  },
  {
    id: "b2", parent: "boys", name: "Boys collection", order: 20, base: 8500,
    defaultDescription: "A three-piece waistcoat set — shirt, waistcoat and trousers — in breathable cotton-silk. Comfortable enough for a full day of celebrations.",
    defaultDescription2: "Collar, placket and buttonholes are hand-finished. Cut to your child's measurements rather than a standard block.",
    defaultSpecs: {
      fabric: "Breathable cotton-silk, cotton shirt",
      occasion: "Day weddings, birthdays, photo sessions",
      fit: "Three pieces; comfortable enough for a full day of celebrations",
      care: "Machine wash the shirt cold; press the waistcoat with a cloth"
    }
  },
  {
    id: "b3", parent: "boys", name: "Theme dresses", order: 30, base: 10500,
    defaultDescription: "A themed outfit made to your brief — colours, character and trims chosen with you over WhatsApp before we cut. Fully lined and finished inside.",
    defaultDescription2: "Colours, character and trims are agreed with you over WhatsApp before we cut. Made on order.",
    defaultSpecs: {
      fabric: "Chosen with you — cotton, cotton-silk or satin",
      occasion: "Themed birthdays, school plays, costume events",
      fit: "Fully lined and finished inside; matching accessory available",
      care: "Spot clean; full care card packed with the outfit"
    }
  },
  {
    id: "y1", parent: "babies", name: "Shirts", order: 10, base: 3500,
    defaultDescription: "A soft cotton shirt with shoulder poppers so it goes on easily. Flat seams sit away from the skin and it is pre-washed so it keeps its size.",
    defaultDescription2: "Pre-washed so it keeps its size after the first few washes. Made in gentle peach and blue shades.",
    defaultSpecs: {
      fabric: "Pre-washed soft cotton, no scratchy labels",
      occasion: "Everyday, first outings, gifting",
      fit: "Shoulder poppers so it goes on easily; flat seams away from the skin",
      care: "Machine wash warm, tumble dry low, no bleach"
    }
  },
  {
    id: "y2", parent: "babies", name: "Rompers", order: 20, base: 4500,
    defaultDescription: "A full romper with poppers through the inside leg for quick changes. Lined bodice, soft elastic at the cuffs, no scratchy labels.",
    defaultDescription2: "No scratchy labels anywhere. Gift wrapping is available on request.",
    defaultSpecs: {
      fabric: "Soft cotton jersey, lined bodice, soft elastic cuffs",
      occasion: "Everyday wear, naming days, newborn gifts",
      fit: "Poppers through the inside leg for quick changes",
      care: "Machine wash warm, dry in shade, warm iron if needed"
    }
  },
  {
    id: "y3", parent: "babies", name: "Baby sets", order: 30, base: 6500,
    defaultDescription: "A three-piece set — top, bottom and cap — in matching fabric, ready for a first birthday or naming day. Everything is pre-washed and hand-finished.",
    defaultDescription2: "Everything is pre-washed and hand-finished, then packed in tissue in a gift box.",
    defaultSpecs: {
      fabric: "Matching pre-washed cotton across all three pieces",
      occasion: "First birthdays, naming days, gifting",
      fit: "Top, bottom and cap; relaxed fit with room to grow",
      care: "Machine wash warm with like colours, dry in shade"
    }
  },
  {
    id: "r1", parent: "ready", name: "Ready to wear", order: 10, base: 4900,
    defaultDescription: "Already stitched and waiting in the studio — no three-week wait. Standard sizing, pressed and packed, dispatched the same day you order.",
    defaultDescription2: "Priced lower than our made-to-order pieces, and exchangeable within seven days if the fitting is wrong.",
    defaultSpecs: {
      fabric: "As shown on the piece — cotton, net or satin",
      occasion: "Last-minute parties, weddings, gifting",
      fit: "Standard sizing, no measurements needed",
      care: "Care card packed with every piece"
    }
  }
];

/** [subcategory id, product names...] — curated from the generator's vocabulary. */
const PRODUCTS = {
  g1: ["Rosette Classic Frock", "Blossom Everyday Frock", "Meadow Cotton Frock", "Clara Lawn Frock", "Juniper Day Frock"],
  g2: ["Aurora Theme Dress", "Peony Character Dress", "Marigold Party Theme Dress", "Blossom Birthday Theme Dress"],
  g3: ["Aurora Luxury Gown", "Peony Beaded Gown", "Clara Walima Gown", "Rosette Flower-Girl Gown"],
  g4: ["Meadow Party Skirt", "Peony Tulle Skirt", "Marigold Satin Skirt"],
  b1: ["Prince Arthur Suit", "Royal Braid Prince Suit", "Prince Zain Coat Suit"],
  b2: ["Junior Waistcoat Set", "Cotton-Silk Three Piece", "Eid Waistcoat Set"],
  b3: ["Little Knight Theme Outfit", "Safari Theme Outfit"],
  y1: ["Soft Cotton Baby Shirt", "Peach Popper Shirt", "Blue Cloud Baby Shirt"],
  y2: ["Cloud Romper", "Peach Blossom Romper", "First Steps Romper"],
  y3: ["First Birthday Baby Set", "Naming Day Gift Set", "Three-Piece Cotton Set"],
  r1: ["Ready Blush Party Dress", "Ready Ivory Frock", "Ready Sky Boys Suit", "Ready Peach Baby Set", "Ready Berry Theme Dress", "Ready Gold Party Skirt"]
};

/** A couple of per-product description overrides, to show the override works. */
const OVERRIDES = {
  "aurora-luxury-gown": {
    description: "Our most-requested walima gown: seven layers of soft net over duchess satin, with hand-worked pearl and bead detail running across the bodice and down the centre front.",
    badge: "Made to order"
  },
  "prince-arthur-suit": {
    description: "A three-piece prince suit in deep navy cotton-silk, with gold braid at the shoulder and cuff, a fully lined coat and an inner shirt with hand-stitched buttons."
  }
};

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function write(dir, name, obj) {
  const file = path.join(dir, name + ".json");
  if (fs.existsSync(file) && !FORCE) {
    console.log("  skip (exists)  " + path.relative(ROOT, file));
    return false;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
  console.log("  wrote          " + path.relative(ROOT, file));
  return true;
}

console.log("Seeding subcategories…");
for (const s of SUBS) {
  write(SUBDIR, s.id, {
    id: s.id,
    parent: s.parent,
    name: s.name,
    order: s.order,
    defaultDescription: s.defaultDescription,
    defaultDescription2: s.defaultDescription2,
    defaultSpecs: s.defaultSpecs
  });
}

console.log("Seeding products…");
for (const s of SUBS) {
  const names = PRODUCTS[s.id] || [];
  names.forEach((name, i) => {
    const slug = slugify(name);
    const sizes = (s.parent === "babies" ? BABY_SIZES : SIZES).map(size => ({
      size,
      price: s.base + i * 900 + upliftFor(size),
      available: true
    }));
    const ov = OVERRIDES[slug] || {};
    write(PRODDIR, slug, {
      name,
      subcategory: s.id,
      visible: true,
      badge: ov.badge || "",
      order: (i + 1) * 10,
      sizes,
      accessoryPrice: 1500,
      description: ov.description || "",
      description2: "",
      specs: { fabric: "", occasion: "", fit: "", care: "" },
      images: [{ url: "", upload: "", alt: "" }]
    });
  });
}

console.log("\nDone. Empty description/specs fields inherit from the subcategory at build time.");

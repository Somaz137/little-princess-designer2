/**
 * Reads everything under content/ and turns it into one normalised model that
 * both the JSON emitter and the page renderer consume.
 *
 * Rules applied here (so neither the site nor the CMS has to care):
 *   - an image is `url` if set, else `upload`, else null (empty frame renders)
 *   - a product's blank description / spec fields inherit from its subcategory
 *   - `visible: false` products are dropped entirely — they never reach the site
 *   - products pointing at a deleted subcategory are dropped with a warning,
 *     so removing a subcategory can never take the whole build down
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

/** Canonical size vocabulary. Keep in step with the `size` select in site/admin/config.yml. */
const SIZES = ["0–3 years", "4–6 years", "7–9 years", "10–12 years", "13–16 years"];
/** Tab order across nav, footer and the "Get yours now" grid. */
const CATEGORY_ORDER = ["girls", "boys", "babies", "ready"];

const warnings = [];
const warn = msg => { warnings.push(msg); console.warn("  warn: " + msg); };

function readJson(file, { required = true } = {}) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error("Missing required content file: " + path.relative(ROOT, file));
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error("Invalid JSON in " + path.relative(ROOT, file) + " — " + err.message);
  }
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ slug: f.replace(/\.json$/, ""), data: readJson(path.join(dir, f)) }));
}

/** True for addresses that already point somewhere on their own. */
const isAbsoluteSrc = src => /^(https?:)?\/\//i.test(src) || /^data:/i.test(src);

/**
 * An image address is either absolute — Cloudinary and anything else pasted in
 * full — or a path on this site, which must start with "/". A value with
 * neither resolves against whatever page it happens to land on, and gets the
 * site origin glued straight onto it when building share tags. Force it
 * root-relative and say so: a visible 404 beats a silently malformed URL.
 */
function normaliseSrc(src) {
  if (isAbsoluteSrc(src) || src.startsWith("/")) return src;
  warn('image address "' + src + '" has no https:// and no leading "/" — ' +
       'treating it as "/' + src + '", which will not load. Paste the full ' +
       "address, or start it with a slash if it is a file on this site.");
  return "/" + src;
}

/** An image entry is `{url, upload, alt}`; a pasted URL wins over an upload. */
function resolveImage(img, fallbackAlt) {
  if (!img) return null;
  const src = (img.url || "").trim() || (img.upload || "").trim();
  if (!src) return null;
  return { src: normaliseSrc(src), alt: (img.alt || "").trim() || fallbackAlt || "" };
}

function resolveImages(list, fallbackAlt) {
  return (Array.isArray(list) ? list : [])
    .map(i => resolveImage(i, fallbackAlt))
    .filter(Boolean);
}

const nonEmpty = (...vals) => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
};

function load() {
  const settings = readJson(path.join(CONTENT, "settings.json"));

  // The CMS stores every photo as {url, upload, alt}; the renderer wants {src,
  // alt}. Products and category cards are converted further down — these two
  // are the settings-level photos, and they render as an empty <img> until
  // they go through the same step.
  if (settings.about) {
    settings.about.photo = resolveImage(settings.about.photo, settings.about.heading);
  }
  // Nulls are kept rather than filtered out: an empty slot renders the same
  // "photo coming soon" frame as everywhere else, so the ring keeps its shape
  // while the catalogue is being photographed.
  settings.carousel = (Array.isArray(settings.carousel) ? settings.carousel : [])
    .map(img => resolveImage(img));

  const categories = CATEGORY_ORDER.map(key => {
    const c = readJson(path.join(CONTENT, "categories", key + ".json"));
    return Object.assign({}, c, {
      key,
      href: "/" + key + "/",
      card: Object.assign({}, c.card, {
        image: resolveImage(c.card && c.card.image, c.card && c.card.alt)
      }),
      subcategories: []
    });
  });
  const byKey = Object.fromEntries(categories.map(c => [c.key, c]));

  // --- subcategories ------------------------------------------------------
  const subs = [];
  for (const { slug, data } of readDir(path.join(CONTENT, "subcategories"))) {
    const id = (data.id || slug).trim();
    if (!byKey[data.parent]) {
      warn('subcategory "' + id + '" has parent "' + data.parent + '", which is not a category — skipped');
      continue;
    }
    const sub = {
      id,
      parent: data.parent,
      name: nonEmpty(data.name, id),
      order: Number(data.order ?? 100),
      defaultDescription: data.defaultDescription || "",
      defaultDescription2: data.defaultDescription2 || "",
      defaultSpecs: data.defaultSpecs || {},
      products: []
    };
    subs.push(sub);
    byKey[data.parent].subcategories.push(sub);
  }
  for (const c of categories) c.subcategories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  // Two subcategories sharing an id is silent damage, and the id is a free-text
  // field in the admin so one mistyped character does it. The lookup below is
  // last-one-wins, so every product pointing at that id is pulled out of the
  // first subcategory and into the second — the first then renders as empty
  // while its products appear under the wrong heading, and both emit the same
  // anchor. This is exactly what happened to boys "b2".
  const seenId = new Map();
  for (const s of subs) {
    const clash = seenId.get(s.id);
    if (clash) {
      warn('subcategory "' + s.name + '" uses the id "' + s.id + '", but subcategory "' +
        clash.name + '" already uses that id — one of them will show no products ' +
        'until you give it an id of its own');
    } else {
      seenId.set(s.id, s);
    }
  }

  const subById = Object.fromEntries(subs.map(s => [s.id, s]));

  // --- products -----------------------------------------------------------
  const products = [];
  const noPhoto = [];
  let hiddenCount = 0;
  for (const { slug, data } of readDir(path.join(CONTENT, "products"))) {
    const name = nonEmpty(data.name, slug);

    if (data.visible === false) { hiddenCount++; continue; }

    const sub = subById[data.subcategory];
    if (!sub) {
      warn('product "' + name + '" points at subcategory "' + data.subcategory +
           '", which no longer exists — hidden from the site until you reassign it');
      continue;
    }

    const sizes = (Array.isArray(data.sizes) ? data.sizes : [])
      .filter(s => s && s.available !== false)
      .map(s => ({ size: String(s.size || "").trim(), price: Number(s.price) }))
      .filter(s => {
        if (!SIZES.includes(s.size)) {
          warn('product "' + name + '" has unknown size "' + s.size + '" — that row is ignored');
          return false;
        }
        if (!Number.isFinite(s.price) || s.price <= 0) {
          warn('product "' + name + '" has no valid price for ' + s.size + ' — that row is ignored');
          return false;
        }
        return true;
      })
      .sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size));

    if (!sizes.length) {
      warn('product "' + name + '" has no size with a price — hidden from the site');
      continue;
    }

    const specsIn = data.specs || {};
    const specsDefault = sub.defaultSpecs || {};
    const images = resolveImages(data.images, name);

    const product = {
      id: slug,
      name,
      href: "/product/" + slug + "/",
      subcategory: sub.id,
      subcategoryName: sub.name,
      tab: sub.parent,
      tabLabel: byKey[sub.parent].label,
      badge: nonEmpty(data.badge),
      order: Number(data.order ?? 100),
      sizes,
      minPrice: Math.min(...sizes.map(s => s.price)),
      accessoryPrice: Number(
        Number.isFinite(Number(data.accessoryPrice)) && Number(data.accessoryPrice) > 0
          ? data.accessoryPrice
          : settings.accessoryPriceDefault || 0
      ),
      description: nonEmpty(data.description, sub.defaultDescription),
      description2: nonEmpty(data.description2, sub.defaultDescription2),
      specs: {
        fabric: nonEmpty(specsIn.fabric, specsDefault.fabric),
        occasion: nonEmpty(specsIn.occasion, specsDefault.occasion),
        fit: nonEmpty(specsIn.fit, specsDefault.fit),
        care: nonEmpty(specsIn.care, specsDefault.care)
      },
      images
    };

    if (!images.length) noPhoto.push(name);

    products.push(product);
    sub.products.push(product);
  }

  for (const s of subs) {
    s.products.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    if (!s.products.length) warn('subcategory "' + s.name + '" (' + s.id + ') has no visible products');
  }

  // A product's first photo becomes its link preview. WhatsApp and Facebook do
  // not render WebP previews, so those links share as bare text — which is
  // invisible from the admin and easy to leave broken for months.
  // Cloudinary photos are exempt: the renderer asks Cloudinary for a JPEG copy
  // at preview size, so their original format does not reach WhatsApp.
  const webpFirst = products
    .filter(p => p.images.length &&
      /\.webp(\?|$)/i.test(p.images[0].src) &&
      !/^https?:\/\/res\.cloudinary\.com\//i.test(p.images[0].src))
    .map(p => p.name);
  if (webpFirst.length) {
    warn(webpFirst.length + " product(s) have a WebP first photo, which WhatsApp and " +
      "Facebook will not show when the link is shared: " +
      webpFirst.slice(0, 5).join(", ") + (webpFirst.length > 5 ? ", …" : "") +
      ". Use a JPEG or PNG for the first photo, or set Cloudinary's format to jpg.");
  }

  // One line rather than one per product — with an empty catalogue this would
  // otherwise bury the warnings that actually need acting on.
  if (noPhoto.length) {
    warn(noPhoto.length + " product(s) have no photo yet and show an empty frame: " +
      noPhoto.slice(0, 5).join(", ") + (noPhoto.length > 5 ? ", …" : ""));
  }

  return {
    settings,
    sizes: SIZES,
    categories,
    subcategories: subs,
    products,
    stats: {
      products: products.length,
      hidden: hiddenCount,
      subcategories: subs.length,
      warnings: warnings.length
    }
  };
}

module.exports = { load, SIZES, CATEGORY_ORDER, warnings };

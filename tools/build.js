#!/usr/bin/env node
/**
 * Builds dist/ from content/ + site/.
 *
 *   site/     hand-written sources (CSS, app.js, assets, admin) — committed
 *   content/  what Decap CMS edits — committed
 *   dist/     build output served by Netlify — NOT committed
 *
 * Because every page is regenerated from scratch on each build, a product that
 * is deleted or hidden in the CMS simply stops having a page. Nothing goes stale.
 *
 * Env:
 *   SITE_URL   canonical origin, no trailing slash. Netlify's own URL is used
 *              automatically when this is unset.
 */

const fs = require("fs");
const path = require("path");
const content = require("./content");
const render = require("./render");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "site");
const DIST = path.join(ROOT, "dist");

const SITE_URL = (
  process.env.SITE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

/* --- fs helpers --------------------------------------------------------- */

function writeFile(rel, body) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

/* --- build ------------------------------------------------------------- */

console.log("Little Princess Designer — build");
console.log("  site url: " + SITE_URL);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

console.log("Reading content/…");
const model = content.load();
const s = model.settings;

// 1. passthrough sources
for (const entry of ["tokens.css", "styles.css", "app.js", "carousel-3d.js", "assets", "admin"]) {
  const from = path.join(SITE, entry);
  if (fs.existsSync(from)) copyRecursive(from, path.join(DIST, entry));
}

// 2. data files — the CMS-to-site contract, also handy for any future consumer
writeFile("data/products.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  sizes: model.sizes,
  categories: model.categories.map(c => ({
    key: c.key, label: c.label, href: c.href,
    subcategories: c.subcategories.map(sub => ({
      id: sub.id, name: sub.name, order: sub.order,
      products: sub.products.map(p => p.id)
    }))
  })),
  products: model.products
}, null, 2) + "\n");

writeFile("data/settings.json", JSON.stringify(s, null, 2) + "\n");

// 3. pages
writeFile("index.html", render.renderHome(model, SITE_URL));
writeFile("contact/index.html", render.renderContact(model, SITE_URL));
for (const cat of model.categories) {
  writeFile(cat.key + "/index.html", render.renderShop(model, cat, SITE_URL));
}
for (const p of model.products) {
  writeFile("product/" + p.id + "/index.html", render.renderProduct(model, p, SITE_URL));
}

// 4. robots + sitemap
const urls = [
  "/",
  "/contact/",
  ...model.categories.map(c => c.href),
  ...model.products.map(p => p.href)
];
writeFile("sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => "  <url><loc>" + SITE_URL + u + "</loc></url>").join("\n") +
  "\n</urlset>\n"
);
writeFile("robots.txt",
  "User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: " + SITE_URL + "/sitemap.xml\n"
);

/* --- report ------------------------------------------------------------ */

const st = model.stats;
console.log("\nBuilt:");
console.log("  " + (2 + model.categories.length + model.products.length) + " pages" +
  "  (home, contact, " + model.categories.length + " category, " + model.products.length + " product)");
console.log("  " + st.subcategories + " subcategories, " + st.products + " live products" +
  (st.hidden ? ", " + st.hidden + " hidden by the admin" : ""));
console.log("  " + urls.length + " urls in sitemap.xml");

if (st.warnings) {
  console.log("\n" + st.warnings + " content warning(s) above — the build still succeeded.");
  console.log("They are safe to ignore while the catalogue is being filled in.");
}
console.log("\nOutput: dist/  (serve it with `npm start`)");

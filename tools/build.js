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
const { execFileSync } = require("child_process");
const content = require("./content");
const render = require("./render");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "site");
const DIST = path.join(ROOT, "dist");
// This directory. The admin preview is served two files from here — see the
// copy step below.
const TOOLS = __dirname;

const SITE_URL = (
  process.env.SITE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

/* --- sitemap dates ------------------------------------------------------ */

/**
 * When each file under content/ last actually changed, for <lastmod>.
 *
 * Deliberately not file mtimes. The site is built from a fresh clone, and a
 * clone stamps every file with the moment it was checked out — so mtimes would
 * date every page "today" on every deploy. A sitemap that claims the whole
 * site changed each time is worse than one with no dates at all: it is the
 * signal search engines learn to ignore.
 *
 * So the dates come from git, in one call for the whole directory. A shallow
 * clone cannot answer the question — it holds one commit, and would date
 * everything to that — so it returns nothing and every URL goes out without a
 * <lastmod>, which is valid and honest. If the deployed sitemap has no dates,
 * that is what happened: give the build a full clone.
 */
function contentDates() {
  const dates = new Map();
  try {
    const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"],
      { cwd: ROOT, encoding: "utf8" }).trim();
    if (shallow !== "false") return dates;

    // %cI is the committer date, ISO 8601. --name-only lists the files each
    // commit touched, so one pass gives every file its newest commit.
    const log = execFileSync("git",
      ["log", "--format=%cI", "--name-only", "--", "content"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

    let current = null;
    for (const line of log.split("\n")) {
      const value = line.trim();
      if (!value) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) { current = value.slice(0, 10); continue; }
      // Newest first, so the first date a file is seen with is the one to keep.
      if (current && !dates.has(value)) dates.set(value, current);
    }
  } catch {
    // No git, or no history to read. Dates are an optimisation; the sitemap is
    // still correct without them.
  }
  return dates;
}

/* --- fs helpers --------------------------------------------------------- */

/** Every .html written, so the build summary counts rather than guesses. */
const pagesWritten = [];

function writeFile(rel, body) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  if (rel.endsWith(".html")) pagesWritten.push(rel);
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

// 1b. the two files the admin preview shares with this build. They are build
// code — they live in tools/ and are required above — but the preview panel
// loads them as ordinary scripts in the browser, so they need an address. They
// are copied rather than kept in site/ so that there is exactly one copy in the
// repository: edit tools/card.js and both the site and the preview change with
// it, which is the entire point of the arrangement. Order matters at load time
// (card.js reads images.js off the window), and it is index.html that fixes it.
for (const entry of ["images.js", "card.js"]) {
  copyRecursive(path.join(TOOLS, entry), path.join(DIST, "admin", entry));
}

// 2. data files — the CMS-to-site contract, also handy for any future consumer
writeFile("data/products.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  sizes: model.sizes,
  categories: model.categories.map(c => ({
    key: c.key, label: c.label, href: c.href,
    subcategories: c.subcategories.map(sub => ({
      id: sub.id, name: sub.name, order: sub.order,
      // The section's standard wording travels with it, because the admin's
      // preview panel needs the same fallback chain the site uses — a piece
      // with a blank description shows its section's words, then the site
      // defaults from settings.json. The form holds only the piece's own
      // fields, so without these the panel would show a gap where the live
      // page shows a paragraph.
      defaultDescription: sub.defaultDescription || "",
      defaultDescription2: sub.defaultDescription2 || "",
      defaultSpecs: sub.defaultSpecs || {},
      products: sub.products.map(p => p.id)
    }))
  })),
  products: model.products
}, null, 2) + "\n");

writeFile("data/settings.json", JSON.stringify(s, null, 2) + "\n");

// 3. pages
writeFile("index.html", render.renderHome(model, SITE_URL));
writeFile("contact/index.html", render.renderContact(model, SITE_URL));
// Netlify serves this for any address that matches nothing else.
writeFile("404.html", render.render404(model, SITE_URL));
for (const cat of model.categories) {
  writeFile(cat.key + "/index.html", render.renderShop(model, cat, SITE_URL));
}
for (const p of model.products) {
  writeFile("product/" + p.id + "/index.html", render.renderProduct(model, p, SITE_URL));
}

// 4. robots + sitemap
// Each URL is dated by the content file it is built from: a product by its own
// JSON, a category page by its category file, home and contact by settings.
const urls = [
  ["/", "content/settings.json"],
  ["/contact/", "content/settings.json"],
  ...model.categories.map(c => [c.href, "content/categories/" + c.key + ".json"]),
  ...model.products.map(p => [p.href, "content/products/" + p.id + ".json"])
];
const dates = contentDates();
writeFile("sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(([u, file]) => {
    const on = dates.get(file);
    return "  <url><loc>" + SITE_URL + u + "</loc>" +
      (on ? "<lastmod>" + on + "</lastmod>" : "") + "</url>";
  }).join("\n") +
  "\n</urlset>\n"
);
writeFile("robots.txt",
  "User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: " + SITE_URL + "/sitemap.xml\n"
);

/* --- report ------------------------------------------------------------ */

const st = model.stats;
console.log("\nBuilt:");
console.log("  " + pagesWritten.length + " pages" +
  "  (home, contact, 404, " + model.categories.length + " category, " +
  model.products.length + " product)");
console.log("  " + st.subcategories + " subcategories, " + st.products + " live products" +
  (st.hidden ? ", " + st.hidden + " hidden by the admin" : ""));
console.log("  " + urls.length + " urls in sitemap.xml");

if (st.warnings) {
  console.log("\n" + st.warnings + " content warning(s) above — the build still succeeded.");
  console.log("They are safe to ignore while the catalogue is being filled in.");
}
console.log("\nOutput: dist/  (serve it with `npm start`)");

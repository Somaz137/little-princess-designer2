#!/usr/bin/env node
/**
 * Packages dist/ into ONE self-contained HTML file for sharing a preview
 * before the site is deployed anywhere.
 *
 * It does not re-render anything: it takes the real built pages, inlines the
 * real CSS, JS, fonts and images as data URIs, and adds a small router that
 * swaps one page's markup for another and re-runs app.js against it. So what
 * you see is the actual build, not an approximation.
 *
 *   node tools/build-preview.js [outfile]
 *
 * Not part of `npm run build` — the deployed site never uses this.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const OUT = process.argv[2] || path.join(ROOT, "preview.html");

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2"
};

/** Reads a file from dist/ and returns it as a data: URI. */
const seen = new Map();
function dataUri(urlPath) {
  if (seen.has(urlPath)) return seen.get(urlPath);
  const file = path.join(DIST, urlPath.replace(/^\//, "").split("?")[0]);
  if (!fs.existsSync(file)) {
    console.warn("  missing asset, left as-is: " + urlPath);
    seen.set(urlPath, urlPath);
    return urlPath;
  }
  const mime = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  const uri = "data:" + mime + ";base64," + fs.readFileSync(file).toString("base64");
  seen.set(urlPath, uri);
  return uri;
}

/** Rewrites url(/assets/…) inside CSS to data URIs. */
function inlineCss(cssPath) {
  let css = fs.readFileSync(path.join(DIST, cssPath), "utf8");
  css = css.replace(/url\(\s*['"]?(\/assets\/[^'")]+)['"]?\s*\)/g, (m, p) => "url('" + dataUri(p) + "')");
  return css;
}

/* --- collect the pages ------------------------------------------------- */

const PAGES = [
  { key: "home", label: "Home", file: "index.html" },
  { key: "girls", label: "Girls", file: "girls/index.html" },
  { key: "boys", label: "Boys", file: "boys/index.html" },
  { key: "babies", label: "Babies", file: "babies/index.html" },
  { key: "ready", label: "Ready to wear", file: "ready/index.html" },
  { key: "contact", label: "Contact us", file: "contact/index.html" }
];

// include one product page so the detail view is previewable
const productDirs = fs.existsSync(path.join(DIST, "product"))
  ? fs.readdirSync(path.join(DIST, "product"))
  : [];
const featured = ["aurora-luxury-gown", "prince-arthur-suit", "cloud-romper", "ready-blush-party-dress"]
  .filter(slug => productDirs.includes(slug));
for (const slug of featured) {
  PAGES.push({ key: "product/" + slug, label: null, file: "product/" + slug + "/index.html" });
}

const pageHtml = {};
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(DIST, p.file), "utf8");
  const m = html.match(/<body>([\s\S]*)<\/body>/);
  if (!m) { console.warn("  could not read body of " + p.file); continue; }

  let body = m[1]
    // drop the script tags — the router re-injects app.js itself
    .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "")
    // rewrite asset references to data URIs
    .replace(/(src|href)="(\/assets\/[^"]+)"/g, (mm, attr, p2) => attr + '="' + dataUri(p2) + '"')
    // internal links become router hashes
    .replace(/href="\/"/g, 'href="#/home"')
    .replace(/href="\/(girls|boys|babies|ready|contact)\/"/g, 'href="#/$1"')
    .replace(/href="\/product\/([^/"]+)\/"/g, 'href="#/product/$1"')
    .replace(/href="\/(girls|boys|babies|ready)\/#([^"]+)"/g, 'href="#/$1"')
    .replace(/href="\/#([^"]+)"/g, 'href="#/home"');

  pageHtml[p.key] = body.trim();
}

const missingProducts = PAGES
  .filter(p => p.key.startsWith("product/"))
  .map(p => p.key.replace("product/", ""));

/* --- assemble ---------------------------------------------------------- */

const tokens = inlineCss("tokens.css");
const styles = inlineCss("styles.css");
const app = fs.readFileSync(path.join(DIST, "app.js"), "utf8");
const carousel = fs.readFileSync(path.join(DIST, "carousel-3d.js"), "utf8");

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Little Princess Designer — site preview</title>
<style>
${tokens}
</style>
<style>
${styles}
</style>
<style>
/* Preview chrome only — not part of the site. */
#pv-bar{
  position:fixed;left:0;right:0;bottom:0;z-index:200;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;background:var(--ink-800);color:var(--paper-000);
  font:700 12.5px/1 var(--font-ui);box-shadow:0 -6px 18px rgba(0,0,0,.18);
}
#pv-bar strong{
  font:400 17px/1 var(--font-hand);letter-spacing:.02em;
  color:var(--berry-300);margin-right:4px;
}
#pv-bar a{
  color:var(--paper-000);background:rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.22);border-radius:999px;
  padding:7px 12px;text-decoration:none;white-space:nowrap;
}
#pv-bar a:hover{background:rgba(255,255,255,.2);color:#fff}
#pv-bar a[data-on="1"]{background:var(--berry-700);border-color:var(--berry-500)}
#pv-note{margin-left:auto;font-weight:400;opacity:.72;font-size:11.5px;max-width:44ch}

/* The bar is fixed over the page, so everything that measures itself against
   the viewport has to be told about it — otherwise the hero's CTA cards sit
   behind the bar, which is not how the real site behaves. */
:root{--pv-bar:60px}
body{padding-bottom:var(--pv-bar)}
.lp-sticky{height:calc(100svh - var(--lp-header,78px) - var(--pv-bar))}
.lp-float{bottom:calc(var(--pv-bar) + 14px)}
@media (max-width:900px){
  :root{--pv-bar:92px}
  #pv-bar{gap:6px;padding:8px 10px;font-size:11.5px}
  #pv-bar a{padding:6px 9px}
  #pv-note{display:none}
}
</style>
</head>
<body>

<div id="pv-root"></div>

<nav id="pv-bar" aria-label="Preview navigation">
  <strong>Preview</strong>
  ${PAGES.filter(p => p.label).map(p =>
    '<a href="#/' + p.key + '" data-pv="' + p.key + '">' + p.label + "</a>"
  ).join("\n  ")}
  ${featured.length ? '<a href="#/product/' + featured[0] + '" data-pv="product/' + featured[0] + '">A product page</a>' : ""}
  <span id="pv-note">Real build output, fully interactive. Product photos are empty frames until you add them in the admin.</span>
</nav>

<script>${carousel}</script>
<script>
window.__PV_PAGES = ${JSON.stringify(pageHtml)};
window.__PV_APP = ${JSON.stringify(app)};
(function () {
  var root = document.getElementById("pv-root");

  function currentKey() {
    var h = (location.hash || "#/home").replace(/^#\\//, "");
    return window.__PV_PAGES[h] ? h : "home";
  }

  function show(key) {
    root.innerHTML = window.__PV_PAGES[key];

    // Re-run app.js against the freshly injected DOM. Each execution is a new
    // IIFE binding its own listeners to the current elements.
    var s = document.createElement("script");
    s.textContent = window.__PV_APP;
    document.body.appendChild(s);
    s.remove();

    // Mark the active chip
    var chips = document.querySelectorAll("#pv-bar [data-pv]");
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute("data-on", chips[i].getAttribute("data-pv") === key ? "1" : "0");
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function () { show(currentKey()); });
  show(currentKey());
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, out);
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log("Preview written: " + path.relative(ROOT, OUT) + "  (" + (kb / 1024).toFixed(1) + " MB)");
console.log("  pages: " + PAGES.filter(p => pageHtml[p.key]).length +
  " (" + PAGES.filter(p => p.label).length + " main + " + missingProducts.length + " product)");
console.log("  inlined assets: " + seen.size);

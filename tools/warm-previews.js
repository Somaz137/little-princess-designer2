#!/usr/bin/env node
/**
 * Warms the Cloudinary share images so the first person to share a link does
 * not have to wait for one to be built.
 *
 * og:image does not point at the photo the visitor sees. It points at a
 * *derived* copy — `c_fill,g_auto,w_1200,h_630,f_jpg,q_auto` — and Cloudinary
 * builds derived copies lazily, on the first request for that exact URL. That
 * first request is the slow one: Cloudinary fetches the original, runs `g_auto`
 * (content-aware crop, an analysis pass), re-encodes under `q_auto` (a second
 * analysis pass), stores the result and only then answers. Seconds, not
 * milliseconds. Every request after that is a cached CDN hit.
 *
 * WhatsApp builds its preview card on the sender's phone the moment the link is
 * pasted, and it gives up on a slow image long before Cloudinary has finished.
 * That is why a freshly-photographed product shares as a bare card with the
 * right title and no picture, and why sharing the same link again later works —
 * the first share paid for the build and warmed the cache for everyone else.
 *
 * Which hosts work this way, and what a derived copy looks like, is in
 * tools/images.js — this file only warms whatever that says is worth warming.
 *
 * So the build pays that cost instead, once per image, before anyone shares.
 * This never fails the build: a warm that does not happen costs a slow first
 * share, which is exactly where we were without it.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const images = require("./images");

const DIST = path.join(__dirname, "..", "dist");
const OG_IMAGE_RE = /<meta\s+property="og:image"\s+content="([^"]+)"/gi;

const CONCURRENCY = 4;
const TIMEOUT_MS = 20000;

/** Every og:image in the built site, deduped. */
function collectShareImages(dir) {
  const found = new Set();
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      // The admin is copied in wholesale and has no share tags of ours.
      if (entry.isDirectory()) {
        if (entry.name !== "admin") walk(full);
      } else if (entry.name.endsWith(".html")) {
        const html = fs.readFileSync(full, "utf8");
        // matchAll rather than a shared `exec` loop: OG_IMAGE_RE is global and
        // module-level, so an `exec` loop leans on the terminating null to
        // reset `lastIndex` between files. That happens to hold here, but it
        // stops holding the moment anyone adds a `break`, and the failure — a
        // few images silently never warmed — would be invisible.
        for (const m of html.matchAll(OG_IMAGE_RE)) found.add(decodeEntities(m[1]));
      }
    }
  };
  walk(dir);
  return [...found];
}

/** og:image values are HTML-escaped on the way in; undo that to get a URL. */
function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function fetchOnce(url) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = https.get(url, { headers: { "User-Agent": "little-princess-designer build/warm-previews" } }, (res) => {
      // The body is thrown away — the point is to make Cloudinary build the
      // derived copy, not to keep it. Draining it frees the socket.
      res.resume();
      res.on("end", () => resolve({ ok: res.statusCode === 200, status: res.statusCode, ms: Date.now() - started }));
    });
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve({ ok: false, status: "timeout", ms: Date.now() - started });
    });
    req.on("error", (err) => resolve({ ok: false, status: err.code || err.message, ms: Date.now() - started }));
  });
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.log("\nShare previews: no dist/ to read — skipped.");
    return;
  }

  // images.js decides which hosts build their derived copies lazily and so
  // are worth a warming request; everything else is served as it stands.
  const urls = collectShareImages(DIST).filter((u) => images.warms(u));
  if (!urls.length) {
    console.log("\nShare previews: no photos on a host that needs warming — nothing to warm.");
    return;
  }

  // Local builds have no reason to reach out, and on a machine without a route
  // to Cloudinary every URL would sit here until it timed out. Netlify sets
  // NETLIFY=true; `--force` is the escape hatch for testing this by hand.
  const forced = process.argv.includes("--force");
  if (!process.env.NETLIFY && !forced) {
    console.log("\nShare previews: " + urls.length + " image(s) to warm, skipped off Netlify.");
    console.log("  (run `node tools/warm-previews.js --force` to warm them from here)");
    return;
  }

  console.log("\nShare previews: warming " + urls.length + " image(s)…");

  const queue = urls.slice();
  const failures = [];
  let slowest = 0;

  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      const r = await fetchOnce(url);
      if (r.ok) {
        slowest = Math.max(slowest, r.ms);
      } else {
        failures.push({ url, status: r.status });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

  const warmed = urls.length - failures.length;
  console.log("  " + warmed + "/" + urls.length + " warmed" +
    (warmed ? " (slowest " + (slowest / 1000).toFixed(1) + "s — that is the wait a sharer would have had)" : ""));

  for (const f of failures.slice(0, 5)) {
    console.log("  warn: " + f.status + " — " + f.url);
  }
  if (failures.length > 5) console.log("  warn: …and " + (failures.length - 5) + " more");
  if (failures.length) {
    console.log("  These links will still share; their first preview will just be the slow one.");
  }
}

main().catch((err) => {
  // Warming is an optimisation. It must never be the reason a deploy fails.
  console.log("\nShare previews: skipped (" + (err && err.message) + ")");
});

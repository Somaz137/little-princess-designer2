/**
 * Where image-host knowledge lives.
 *
 * Photos reach the CMS as whole URLs — picked out of the ImageKit library or
 * pasted in by hand — so the site never controls their pixel size: an editor
 * uploading straight off a phone camera hands every visitor a 4000px original
 * for a card drawn 436px wide. Hosts that resize on delivery can be asked for
 * a smaller copy just by rewriting the address, and this file holds the one
 * table of how to ask, per host.
 *
 * A host that is not in the table gets its address back untouched. That is the
 * whole fallback: an unrecognised photo is served exactly as it is today, so
 * adding a host is additive and forgetting one costs bytes, never a broken
 * picture.
 */

"use strict";

/**
 * How hard to ask a host to work, per kind of photo. Two profiles, because the
 * two kinds of photo on this site are looked at differently.
 *
 *   card   — a thumbnail in a grid, glanced at on the way to somewhere else.
 *            The largest is drawn around 436px, so 800 covers it on a 2× screen
 *            and 1200 covers the same card on a 3× phone. Compression is left
 *            to the host's own judgement, which is tuned to be invisible at a
 *            glance and is where most of the byte saving comes from.
 *
 *   detail — the gallery on a product page. This is the photo a customer
 *            decides on, zooms their face towards, and compares against what
 *            arrives, so it is worth spending bytes on: a fixed high quality
 *            rather than the host's judgement, and a 1600 step above the card
 *            widths.
 *
 * 1600 is deliberately the largest step, and that is what bounds the cost: no
 * device can ask for anything above it however dense its screen, so the biggest
 * download a product page can produce is one 1600-wide copy at this quality —
 * the ~300-500 KB the owner budgeted for. Raising the ceiling means raising
 * that bill, so add a step here only with a number in mind.
 */
const PROFILES = {
  card: { widths: [400, 800, 1200], quality: "auto" },
  detail: { widths: [400, 800, 1200, 1600], quality: "best" }
};

/**
 * The quality number the "detail" profile asks for, on a 1-100 scale both hosts
 * understand. One place, because it is the knob to turn when the owner says the
 * product photos look soft — or when the bill says they cost too much.
 */
const DETAIL_QUALITY = 90;

/**
 * The paper colour the site is printed on (`--paper-050` in site/tokens.css),
 * used to pad a portrait photo out to the landscape shape a link preview wants.
 * Written without the `#`, which is how ImageKit takes a colour.
 */
const PAPER = "FFFCF8";

/**
 * Netlify resizes anything the site itself serves, through /.netlify/images.
 * That endpoint only exists on a deployed site, so the rule is switched off
 * elsewhere — `npm start` serves dist/ from a plain static server (serve.js)
 * that has no such route, and a srcset pointing at it would leave every photo
 * broken in local preview. Off Netlify the address is returned unchanged, the
 * same as any unknown host. Matches the check in warm-previews.js.
 */
const onNetlify = () => Boolean(process.env.NETLIFY);

/**
 * An ImageKit address carrying the transformation `tr`.
 *
 * ImageKit takes transformations either in the path (`/tr:w-400/…`) or as a
 * `tr` query parameter, and the query form is the one that survives being
 * bolted onto an address someone else built: the widget hands over links like
 * `…/dress.jpg?updatedAt=1770000000`, and appending a parameter cannot disturb
 * a path it does not understand.
 *
 * Any `tr` already on the address is dropped rather than added to, so running
 * this twice over the same URL — which happens when a photo is both rendered
 * and shared — gives the same answer as running it once.
 */
function ikUrl(src, tr) {
  const hash = src.indexOf("#");
  const address = hash === -1 ? src : src.slice(0, hash);
  const fragment = hash === -1 ? "" : src.slice(hash);
  const mark = address.indexOf("?");
  const params = (mark === -1 ? "" : address.slice(mark + 1))
    .split("&")
    .filter(p => p && !/^tr=/i.test(p));
  params.push("tr=" + tr);
  return (mark === -1 ? address : address.slice(0, mark)) + "?" + params.join("&") + fragment;
}

const HOSTS = [
  {
    name: "netlify",
    // CMS uploads only (media_folder in site/admin/config.yml). The photos
    // committed by hand under /assets/ are already cut to the size they are
    // drawn at; it is the uploads, straight off a phone camera, that arrive
    // unbounded.
    match: /^\/assets\/uploads\//i,
    enabled: onNetlify,
    // Netlify's default quality is 75; the "detail" rung asks for the same
    // number ImageKit is given, so the two hosts stay in step.
    resized(src, width, quality) {
      return "/.netlify/images?url=" + encodeURIComponent(src) + "&w=" + width + "&fit=contain" +
        (quality === "best" ? "&q=" + DETAIL_QUALITY : "");
    }
  },
  {
    name: "imagekit",
    // https://ik.imagekit.io/<imagekit id>/<folders…>/<file>
    //
    // Only ImageKit's own delivery domain. An account served from a custom
    // domain would not match, and its photos would be served at full size
    // rather than broken — the same fallback as any host not in this table.
    // If the shop ever moves to one, widen this pattern.
    match: /^https?:\/\/ik\.imagekit\.io\/[^/]+\//i,

    /**
     * c-at_max rather than a plain width: it only ever scales down, so a photo
     * uploaded smaller than the requested width is served at its own size
     * instead of being blown up (that is what at_max_enlarge does, and it is
     * not what we want). f-auto picks WebP or AVIF per browser — safe here
     * because these are the pictures on the page; the link-preview copy is
     * pinned to JPEG separately, since WhatsApp renders neither.
     *
     * The "card" rung asks for no quality at all, which leaves ImageKit on its
     * account default of 80 — tuned to be invisible at a glance and where most
     * of the byte saving comes from. The "detail" rung pins a literal q-90 so
     * the product page gets the same fidelity whatever the photo, which is the
     * point of paying for it. DETAIL_QUALITY is the dial — 80 is noticeably
     * softer, 95 roughly doubles the file for little visible gain.
     */
    resized(src, width, quality) {
      return ikUrl(src, "w-" + width + ",c-at_max,f-auto" +
        (quality === "best" ? ",q-" + DETAIL_QUALITY : ""));
    },

    /**
     * The copy handed to WhatsApp and Facebook as og:image, rather than a
     * full-resolution photo: WhatsApp skips preview images over roughly 300 KB,
     * so a wallpaper- or camera-sized upload shares with no picture at all —
     * the page reads fine and only the image is dropped.
     *
     * f-jpg rather than the f-auto used above is deliberate. Left to itself
     * ImageKit serves WebP or AVIF to any client whose headers accept it, and
     * neither WhatsApp nor Facebook renders those in a preview. The size is
     * exact, so the dimensions can be claimed in the meta tags.
     *
     * cm-pad_resize, not a crop: these are full-length dresses photographed
     * upright, and 1200x630 is a letterbox. Cropping to fill it takes the head
     * and the hem off the piece being advertised, so the whole photo is fitted
     * inside instead and the gap either side filled with the site's own paper
     * colour — which reads as a card rather than as a mistake.
     */
    preview: {
      transform: "w-1200,h-630,cm-pad_resize,bg-" + PAPER + ",f-jpg",
      width: 1200,
      height: 630,
      type: "image/jpeg",
      url(src) { return ikUrl(src, this.transform); }
    },

    /**
     * ImageKit builds a transformed copy lazily, on the first request for that
     * exact address, and that first request is slow enough that WhatsApp gives
     * up on it. warm-previews.js pays that cost at build time instead.
     */
    warms: true
  }
];

/** The host rule for an address, or null when nothing in the table matches. */
function hostFor(src) {
  const url = String(src || "");
  return HOSTS.find(h => h.match.test(url) && (!h.enabled || h.enabled())) || null;
}

/** One resized copy, or the address unchanged on an unknown host. */
function resized(src, width, quality = "auto") {
  const host = hostFor(src);
  return host ? host.resized(String(src), width, quality) : String(src || "");
}

/**
 * A `srcset` value listing one copy per width, or "" when the host cannot
 * resize — an empty string means the caller omits the attribute and the
 * browser is left with the single `src` it has today.
 *
 * `profile` names a row of PROFILES. An unknown name falls back to `card`
 * rather than throwing: a typo should cost quality, never a broken picture.
 */
function srcset(src, profile = "card") {
  if (!hostFor(src)) return "";
  const { widths, quality } = PROFILES[profile] || PROFILES.card;
  return widths.map(w => resized(src, w, quality) + " " + w + "w").join(", ");
}

/**
 * The link-preview copy of a photo — `{ url, width, height, type }` — or null
 * when the host cannot make one, in which case the caller shares the original
 * and claims no dimensions for it.
 *
 * Not gated on `enabled`: a preview address goes into a meta tag read by
 * WhatsApp and Facebook off the deployed site, never fetched by the local
 * preview server, so there is nothing to break by emitting it anywhere.
 */
function preview(src) {
  const url = String(src || "");
  const host = HOSTS.find(h => h.preview && h.match.test(url));
  if (!host) return null;
  return {
    url: host.preview.url(url),
    width: host.preview.width,
    height: host.preview.height,
    type: host.preview.type
  };
}

/**
 * Whether a preview address is worth requesting once at build time. True for
 * hosts that build derived copies lazily, where the first request is slow
 * enough to lose a share.
 */
function warms(src) {
  const url = String(src || "");
  return HOSTS.some(h => h.warms && h.match.test(url));
}

/**
 * Exported for Node and for the browser from the one file. The build requires
 * it; the admin preview panel loads it as a plain <script>, where `module` does
 * not exist and it leaves itself on the window for tools/card.js to pick up.
 * Nothing above this line touches `fs` or the DOM, which is what lets the same
 * text serve both.
 *
 * The name is deliberately not something plain like `API`. Loaded as ordinary
 * <script> tags these files share one top-level scope, so a `const` of the same
 * name in two of them is a redeclaration error — the second file stops dead and
 * its global is never set. That failure is silent everywhere except the browser
 * console, and it is why tools/test.js cannot be the only check on this file.
 */
const IMAGES_API = { PROFILES, hostFor, resized, srcset, preview, warms };

if (typeof module === "object" && module.exports) {
  module.exports = IMAGES_API;
} else {
  (typeof globalThis !== "undefined" ? globalThis : self).LPImages = IMAGES_API;
}

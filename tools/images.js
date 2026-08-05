/**
 * Where image-host knowledge lives.
 *
 * Photos are pasted into the CMS as whole URLs, so the site never controls
 * their pixel size — an editor uploading straight off a phone camera hands
 * every visitor a 4000px original for a card drawn 436px wide. Hosts that
 * resize on delivery can be asked for a smaller copy just by rewriting the
 * address, and this file holds the one table of how to ask, per host.
 *
 * A host that is not in the table gets its address back untouched. That is the
 * whole fallback: an unrecognised photo is served exactly as it is today, so
 * adding a host is additive and forgetting one costs bytes, never a broken
 * picture.
 */

"use strict";

/**
 * Widths offered to the browser for in-page photos. The largest card on the
 * site is drawn around 436px, so 800 covers it on a 2× screen and 1200 covers
 * the same card on a 3× phone.
 */
const WIDTHS = [400, 800, 1200];

/**
 * Netlify resizes anything the site itself serves, through /.netlify/images.
 * That endpoint only exists on a deployed site, so the rule is switched off
 * elsewhere — `npm start` serves dist/ from a plain static server (serve.js)
 * that has no such route, and a srcset pointing at it would leave every photo
 * broken in local preview. Off Netlify the address is returned unchanged, the
 * same as any unknown host. Matches the check in warm-previews.js.
 */
const onNetlify = () => Boolean(process.env.NETLIFY);

const HOSTS = [
  {
    name: "netlify",
    // CMS uploads only (media_folder in site/admin/config.yml). The photos
    // committed by hand under /assets/ are already cut to the size they are
    // drawn at; it is the uploads, straight off a phone camera, that arrive
    // unbounded.
    match: /^\/assets\/uploads\//i,
    enabled: onNetlify,
    resized(src, width) {
      return "/.netlify/images?url=" + encodeURIComponent(src) + "&w=" + width + "&fit=contain";
    }
  },
  {
    name: "cloudinary",
    // https://res.cloudinary.com/<cloud>/image/upload/<transforms…>/<public id>
    match: /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i,

    /**
     * Cloudinary reads transformations from the path segment straight after
     * /upload/, and chains them left to right, so ours can be prefixed in
     * front of whatever the pasted address already carries.
     *
     * c_limit rather than c_fill: it only ever scales down, so a photo
     * uploaded smaller than the requested width is served at its own size
     * instead of being blown up. f_auto picks WebP or AVIF per browser — safe
     * here because these are the pictures on the page; the link-preview copy
     * is pinned to JPEG separately, since WhatsApp renders neither.
     */
    resized(src, width) {
      const at = src.search(/\/upload\//i) + "/upload/".length;
      return src.slice(0, at) + "c_limit,w_" + width + ",f_auto,q_auto/" + src.slice(at);
    }
  }
];

/** The host rule for an address, or null when nothing in the table matches. */
function hostFor(src) {
  const url = String(src || "");
  return HOSTS.find(h => h.match.test(url) && (!h.enabled || h.enabled())) || null;
}

/** One resized copy, or the address unchanged on an unknown host. */
function resized(src, width) {
  const host = hostFor(src);
  return host ? host.resized(String(src), width) : String(src || "");
}

/**
 * A `srcset` value listing one copy per width, or "" when the host cannot
 * resize — an empty string means the caller omits the attribute and the
 * browser is left with the single `src` it has today.
 */
function srcset(src, widths = WIDTHS) {
  if (!hostFor(src)) return "";
  return widths.map(w => resized(src, w) + " " + w + "w").join(", ");
}

module.exports = { WIDTHS, hostFor, resized, srcset };

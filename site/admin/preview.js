/**
 * The live preview panel for products.
 *
 * The right-hand third of the product editor used to be empty: `editor.preview`
 * was off, so the only way to see how a piece looked was to publish it and open
 * the site. This draws the real shop card instead, updating as the form is
 * typed into.
 *
 * "The real card" is meant literally. The markup comes from `productCard()` in
 * tools/card.js — the same function, in the same file, that the build uses to
 * write every card on the live site, delivered here by the build's copy step
 * (tools/build.js). There is no second copy of the card to keep in step, which
 * is the whole reason that file was pulled out of tools/render.js.
 *
 * Three things this file has to bridge:
 *
 *   1. Decap hands over the form as it stands this keystroke — half-typed, with
 *      no name or sizes on a new piece. `fromCmsEntry()` in tools/card.js turns
 *      that into something drawable and reports what is missing.
 *   2. The preview is an iframe of its own, so the site's stylesheets have to
 *      be registered with it explicitly or the card renders unstyled.
 *   3. The readable subcategory name ("g3" → "Casual dresses") is not in the
 *      form, which holds only the code. It is read from /data/products.json,
 *      which the build already writes.
 *
 * Loaded after decap-cms.js — see the note beside the script tags in
 * index.html. Everything here is defensive: this panel is a convenience, and
 * nothing it can fail at should be able to stop the admin loading.
 */

(function () {
  "use strict";

  if (!window.CMS) return;

  /**
   * Decap's own element factory. It exposes React's `createElement` as `h` for
   * exactly this — writing preview templates without a build step. `React` is
   * checked as well in case a future release stops setting `h`; if neither is
   * there we leave the panel switched off rather than throw, and the editor is
   * merely as empty as it was before.
   */
  var h = window.h ||
    (window.React && window.React.createElement) ||
    null;

  if (!h || !window.LPCard) {
    // Worth a line in the console: the panel silently not appearing is more
    // confusing than a reason for it.
    if (window.console) {
      console.warn("[lp] product preview not registered — " +
        (h ? "tools/card.js did not load" : "no element factory on window"));
    }
    return;
  }

  var card = window.LPCard;

  /* --- the site's own styles ---------------------------------------------- */

  // The preview renders in its own iframe, which inherits nothing from the
  // admin page. tokens.css first: styles.css is written against the custom
  // properties it defines.
  try {
    window.CMS.registerPreviewStyle("/tokens.css");
    window.CMS.registerPreviewStyle("/styles.css");
    // The card is normally a cell in a shop grid, and takes its width from one.
    // This gives it that context and nothing else, plus the panel's own note
    // list. Kept to the minimum: anything styled here is styling that is NOT
    // coming from the real site, and so is a chance for the preview to lie.
    window.CMS.registerPreviewStyle(
      ".lp-preview{padding:18px;max-width:460px;margin:0 auto;font-family:var(--body,system-ui)}" +
      ".lp-preview .lp-grid{display:block}" +
      ".lp-preview-notes{margin:18px 0 0;padding:14px 16px;list-style:none;" +
      "background:#fff6ef;border:1px solid #e8d5c4;border-radius:12px;" +
      "font-size:13px;line-height:1.5;color:#6b4a3a}" +
      ".lp-preview-notes li+li{margin-top:7px}" +
      ".lp-preview-head{font-size:12px;letter-spacing:.08em;text-transform:uppercase;" +
      "color:#a08878;margin:0 0 12px;text-align:center}",
      { raw: true }
    );
  } catch (e) {
    // A rejected stylesheet is survivable — an unstyled card still shows the
    // photo, the name and the price, which is most of the point.
    if (window.console) console.warn("[lp] preview styles: " + e);
  }

  /* --- the catalogue ------------------------------------------------------ */

  /**
   * /data/products.json, for the size order and the readable subcategory name.
   * Fetched once, in the background. Until it lands — and if it never does —
   * `fromCmsEntry` falls back to the stored code, which is not printed on the
   * card anyway: it feeds the alt text and the link's screen-reader label only.
   * So a missing catalogue costs accuracy in two attributes, not a preview.
   */
  var catalogue = null;
  try {
    fetch("/data/products.json", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { catalogue = json; })
      .catch(function () { /* keep the fallbacks */ });
  } catch (e) { /* no fetch: same fallbacks */ }

  /* --- the panel ---------------------------------------------------------- */

  /**
   * Immutable-to-plain, defensively. Decap hands the entry over as an
   * Immutable Map; `toJS` is how it comes back out. A plain object is passed
   * through untouched so this keeps working if that ever changes.
   */
  function plain(entry) {
    try {
      var data = entry && entry.getIn ? entry.getIn(["data"]) : null;
      if (!data) return {};
      return typeof data.toJS === "function" ? data.toJS() : data;
    } catch (e) {
      return {};
    }
  }

  function ProductPreview(props) {
    var out;
    try {
      out = card.fromCmsEntry(plain(props.entry), catalogue);
    } catch (e) {
      return h("div", { className: "lp-preview" },
        h("p", { className: "lp-preview-head" }, "Preview unavailable"));
    }

    var html = '<div class="lp-grid">' + card.productCard(null, out.product) + "</div>";

    var notes = out.notes.length
      ? h("ul", { className: "lp-preview-notes" },
        out.notes.map(function (n, i) { return h("li", { key: i }, n); }))
      : null;

    return h("div", { className: "lp-preview" },
      h("p", { className: "lp-preview-head" }, "How this looks in the shop"),
      // The card is a string of the site's own markup. It is inserted as
      // markup because that is what it is — and everything inside it that came
      // from the form has already been through `esc()` and `safeHref()` in
      // tools/card.js, the same two guards the live site relies on.
      h("div", { dangerouslySetInnerHTML: { __html: html } }),
      notes
    );
  }

  try {
    window.CMS.registerPreviewTemplate("products", ProductPreview);
  } catch (e) {
    if (window.console) console.warn("[lp] product preview not registered: " + e);
  }
})();

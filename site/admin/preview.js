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
      ".lp-preview{padding:16px}" +
      // The panel is far narrower than a page. .lp-detail is auto-fit
      // minmax(300px,1fr), so it drops to one column here by itself — this only
      // stops .lp-main adding the page's own wide gutters on top of the panel's.
      ".lp-preview .lp-main{padding:0;max-width:none}" +
      // Stacked in a narrow panel, a full-width photo is about 700px tall and
      // pushes the price and the description — the fields actually being typed
      // — below the fold on every keystroke. Capping the gallery keeps the
      // whole page in view. This changes the scale of the preview, never its
      // content: the markup is still exactly what the site renders.
      // An explicit width, not max-width. .lp-galwrap is a grid item, and the
      // centring margins turn off its stretch — so with only a max-width it
      // falls back to shrink-to-fit, and .lp-gallery is a horizontal scroller
      // whose fit-content width is zero. The frame then had no width, the 3/4
      // aspect ratio gave it no height, and the photo vanished along with its
      // slot. A stated width cannot collapse. min() keeps it honest if the
      // panel is ever narrower than 300px.
      ".lp-preview .lp-galwrap{width:min(300px,100%);margin:0 auto}" +
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
  var settings = null;

  /**
   * Both files the build publishes, fetched once in the background.
   *
   *   products.json — the size order, the readable section name, and each
   *                   section's standard wording for the fallback chain
   *   settings.json — the WhatsApp number, the accessory wording and price,
   *                   the delivery note, and the site-wide default wording
   *
   * Neither is required. Without them the panel still draws: the section name
   * falls back to its stored code, the wording falls back to whatever the piece
   * itself carries, and the order button falls back to a number-less link. A
   * slow first keystroke is the cost, not a blank panel — and once they land,
   * the next keystroke repaints with everything.
   */
  function grab(url, keep) {
    try {
      fetch(url, { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) { if (json) keep(json); })
        .catch(function () { /* keep the fallbacks */ });
    } catch (e) { /* no fetch: same fallbacks */ }
  }
  grab("/data/products.json", function (j) { catalogue = j; });
  grab("/data/settings.json", function (j) { settings = j; });

  /** The section a piece belongs to, with its standard wording. */
  function sectionFor(code) {
    var cats = (catalogue && catalogue.categories) || [];
    for (var i = 0; i < cats.length; i++) {
      var subs = cats[i].subcategories || [];
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].id === code) return subs[j];
      }
    }
    return null;
  }

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

    // The product page as a customer meets it, not an impression of it: this is
    // the same productDetail() the build writes into every product page. The
    // panel is a narrow column, so it lays itself out the way a phone does —
    // photo above, details below — which is how most customers see it anyway.
    var data = plain(props.entry);
    var wording = card.applyWording(data, sectionFor(out.product.subcategory), settings);
    var product = Object.assign({}, out.product, wording, {
      accessoryPrice: Number(data.accessoryPrice) > 0
        ? Number(data.accessoryPrice)
        : Number(settings && settings.accessoryPriceDefault) || 0
    });

    var html = '<main class="lp-main lp-main--product">' +
      card.productDetail(product, settings || {}) + "</main>";

    var notes = out.notes.length
      ? h("ul", { className: "lp-preview-notes" },
        out.notes.map(function (n, i) { return h("li", { key: i }, n); }))
      : null;

    return h("div", { className: "lp-preview" },
      h("p", { className: "lp-preview-head" }, "The product page"),
      // A string of the site's own markup. It is inserted as markup because
      // that is what it is — and everything inside it that came from the form
      // has already been through `esc()` and `safeHref()` in tools/card.js, the
      // same two guards the live site relies on.
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

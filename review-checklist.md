# Review checklist

Findings from the code review of `main` on 2026-08-05, plus the admin-experience
round at the bottom. Ticked boxes are done and on `main`.

**Every item on this list is now ticked.** The last one — the live preview panel
under "Admin experience" — was finished on 2026-08-05. Two of the recent ones
carry an "unverified from here" note rather than a clean bill of health: the
photo library and the preview panel both depend on scripts this container cannot
reach, so the first real use in the admin is still their proof.

Ordered by what to do first. The three admin-facing items (#3, #4, #13) all edit
`site/admin/config.yml`, so they are cheaper done together than separately.

---

## Security

- [x] **`tools/render.js:212`, `:232-234`, `:722`, `:727` — CMS link fields are not
      scheme-checked.** `instagram` / `facebook` / `tiktok` are free-text fields in
      the admin (`site/admin/config.yml:412-414`) and land straight in `href`.
      `esc()` escapes `<>&"'` and does nothing to `javascript:`, so an editor can
      put executable code in a link on every page of the site. Editors hold no repo
      access, so this crosses the boundary the DecapBridge setup exists to enforce
      — the same class as the JSON-LD breakout already fixed at `:150`.
      **Fix:** add a `safeHref()` allowlist (`https:`, `http:`, `mailto:`, `tel:`,
      `/`, `#`) beside `esc()` and route every CMS-sourced `href` through it,
      including the `mailto:` / `tel:` pair at `:241-242` and `:688`.

## Performance

- [x] **`tools/render.js:57` — cards download full-resolution originals.**
      `frame()` emits one unmodified photo URL, so a phone rendering a 180px card
      pulls the whole upload; a shop page can cost 15–25 MB where ~1 MB would do.
      **Fix:** emit a `srcset` of provider-resized copies (400/800/1200) with a
      `sizes` hint, keeping the original on the product-page gallery.

- [x] **`tools/render.js:103-112`, `tools/content.js:243`,
      `tools/warm-previews.js:32` — Cloudinary knowledge is spread across three
      files.** Any move to another host (ImageKit, etc.) means finding all three.
      **Fix:** do the `srcset` work in one new `tools/images.js` holding a
      host → resize-rule table, and have all three call into it; an unrecognised
      host returns the plain URL so nothing breaks.

## Correctness

- [x] **`tools/render.js:644` — empty description yields a malformed page summary.**
      `description` is optional on both products (`config.yml:212`) and
      subcategories (`:319`), so `p.description.split(". ")[0]` can be `""`, giving
      a meta/og description that opens with a bare `". Made to order…"`, plus an
      empty `<p>` at `:612`. No product hits this today; the admin allows it in two
      clicks.
      **Fix:** guard the split, and add site-wide fallback wording (next item) so
      the field can never resolve empty in practice.

- [x] **`content/settings.json` + `site/admin/config.yml:391` — no site-wide default
      product wording.** Fallbacks stop at the subcategory
      (`tools/content.js:213-220`), and the closing sentence used in every product
      summary is hardcoded at `tools/render.js:644` where no admin can reach it.
      **Fix:** add a "Default product wording" object to Site Settings
      (description, description2, fabric, occasion, fit, care, summary tail) and
      pass it as the third argument to the existing `nonEmpty()` chain, making the
      cascade product → subcategory → site default.

- [x] **`tools/content.js:20` vs `site/admin/config.yml:183-188` — the size list is
      duplicated with nothing keeping the copies in step.** `SIZES` drives price-row
      validation (`:175`), age-order sorting (`:185`) and the shop filter chips
      (`:261`). Adding a sixth age band in the admin alone means every price using
      it is silently discarded and a product offered only in that size vanishes
      from the site with no error. A third stale copy sits in
      `tools/seed-content.js:27` (not part of the build).
      **Fix (decided: full merge):** delete `SIZES` from `content.js` and read the
      list out of `config.yml` at build time via the existing YAML reader in
      `tools/check-config.js:27`. Guards, all required:
    - [x] Reader returns the 5 current strings byte-for-byte before anything else
          changes — the en dash in `0–3 years` (U+2013) is not a hyphen, so compare
          with `===`, not by eye.
    - [x] Build **fails loudly** if the list is missing, empty, not an array, or has
          a different length than the previous build — never fall through to `[]`,
          which would strip every price on the site.
    - [x] `npm run build` output is diffed before and after: same 46 pages, same 39
          products, same warnings, identical `dist/data/products.json`.
    - [x] Stale copy in `tools/seed-content.js:27` deleted or pointed at the same
          source, so it cannot mislead later.

## Polish

- [x] **`tools/render.js:594-599` — gallery arrows render on single-photo products.**
      Prev/next are always drawn; with one photo (today: "Aurora Luxury Gown 123")
      they do nothing when clicked.
      **Fix:** omit both buttons when the gallery has one slide.

- [x] **`tools/build.js:111` — `sitemap.xml` carries no `<lastmod>`.** Search engines
      get no signal about which pages changed, so new products are recrawled later
      than they need to be.
      **Fix:** emit `<lastmod>` per URL from the mtime of the backing file in
      `content/`.

- [x] *(optional)* **`site/app.js:233` — "Load more" gives screen readers no
      feedback.** Four cards appear further down with nothing announced. The button
      itself already hides correctly when nothing is left to load
      (`site/app.js:225`, `tools/render.js:462`) — verified against the built pages.
      **Fix:** move focus to the first newly-revealed card after the click.

- [x] *(optional)* **no automated checks anywhere.** `tools/content.js` has real
      branching — inheritance fallbacks, duplicate-id detection, size and price
      filtering — and a regression would only surface on the live site.
      **Fix:** a dependency-free assertion script over a small fixture content
      directory, wired to `npm test`.

## Features

- [x] **`tools/render.js:635` + `:668` — "Sold out" does not stop an order.** The
      badge is a fixed dropdown (`config.yml:151-159`) and already sets
      `OutOfStock` in structured data, but the page still shows a live "Order on
      WhatsApp" button, so customers order pieces that cannot be supplied.
      **Fix:** when `p.badge === "Sold out"`, render the CTA greyed and
      non-clickable as "Currently unavailable", keeping price, size dropdown and
      the floating WhatsApp button working for enquiries.

- [x] **`tools/content.js:231` + `site/admin/config.yml` — newest pieces are not
      surfaced anywhere.** Products sort by a hand-set `order` number (values 5–60
      are deliberately curated today, so this cannot simply be replaced) and carry
      no date, so new work is invisible until a customer digs into the right
      subcategory.
      **Fix:** add an auto-filled "Added on" datetime field; backfill the 39
      existing products with dates that reproduce today's exact order; sort
      newest-first and retire `order` on products (keep it on subcategories). Then
      add a "Just finished in the studio" row of 4 cards to the home page after the
      carousel at `tools/render.js:345`, reusing `productCard()` and `.lp-grid`.

- [x] **no way to search the catalogue.** 39 products across 12 sections, findable
      only by browsing four tabs. `dist/data/products.json` (`tools/build.js:77`)
      already contains everything needed.
      **Fix:** a client-side search box in `site/app.js` filtering that file.

- [x] **`site/app.js:170` — filter state is not in the URL.** Chosen size and price
      live in a JS object and are lost on reload, so a filtered view cannot be sent
      to a customer over WhatsApp.
      **Fix:** mirror `state` into the URL hash and restore from it on load.

## Admin experience

Three findings from working through the admin as the owner uses it, 2026-08-05.
All done. The last of them — getting dresses in — is the one that mattered;
both of its halves are finished, and both are waiting on a real sign-in to the
admin to be called proven.

- [x] **`site/admin/config.yml:112` — the product list showed nothing but a
      name.** 39 rows of bare names, so finding one piece meant opening several.
      **Fixed:** the row summary now carries section, price and any HIDDEN /
      SOLD OUT marker, and two view filters were added for photos. Two limits
      worth knowing, both Decap's rather than ours: the section shows the stored
      code (`g3`, `y1`) because a summary cannot follow a relation to its label,
      and the price is the first size row's, not the lowest, because a summary
      cannot compare rows.

- [x] **`site/admin/config.yml` — Photos sat ~2,000px down a ~2,700px form.**
      The field most likely to be the reason for opening a product was the one
      furthest from the top.
      **Fixed:** moved to second, directly under the product name.

- [x] **`site/admin/index.html` — the admin read as someone else's tool.**
      Decap's own cold grey page, blue accents and system fonts, with the form
      capped at 800px and centred while roughly a third of the screen sat empty
      (`ControlPaneContainer`, `max-width:800px`).
      **Fixed:** warm paper, berry buttons, hand-lettered headings, darker and
      larger field hints, and the form widened to 1180px. Toggles and the delete
      button were left alone on purpose — see the note in that file.

- [x] **THE BIG ONE — get dresses into the admin.** 38 of 39 products have no
      photo. Everything above makes the tool pleasanter to use; none of it puts
      a single dress on the site. Both halves are now done — the tool is ready
      and the photos are the owner's to add:
    - [x] **Turn on the photo library — ImageKit, not Cloudinary.** Done
          2026-08-05. The owner opened an ImageKit account rather than a
          Cloudinary one, so the commented-out Cloudinary block was replaced
          rather than uncommented. Decap ships no ImageKit library, so the
          wiring is ours: `site/admin/imagekit.js` registers ImageKit's own
          embeddable widget through `CMS.registerMediaLibrary`, and
          `site/admin/index.html` loads both. `tools/images.js` swapped its
          Cloudinary resize rules for ImageKit's `tr=` parameters; nothing else
          in the build had to change, which is what that file was extracted for.
          **Not blocked on anything:** the widget carries no keys — each editor
          signs in to ImageKit inside the panel — so there is nothing left for
          the owner to supply. The optional `imagekit_id` in `config.yml` only
          saves a click. Photos go straight to ImageKit and never enter git
          history.
          **Unverified from here:** the proxy blocks `ik.imagekit.io` and
          `unpkg.com`, so neither a real upload nor a rendered `tr=` URL could
          be tried. The transformation names are checked against ImageKit's own
          published SDK and the widget's source, and the wiring is covered by
          `npm test`; the first real upload is still the proof.
    - [x] **Switch the preview panel on and feed it the real product card.**
          Done 2026-08-05. `editor.preview` is now `true` for products, and the
          panel draws the site's own card, updating as the form is typed into.

          **Shared, not copied.** `productCard()` and the four helpers it is
          built from (`esc`, `safeHref`, `money`, `frame`) moved out of
          `tools/render.js` into a new `tools/card.js` that runs unchanged under
          both Node and a browser; `tools/images.js` got the same treatment for
          its resize rules. `render.js` imports them, and the build copies both
          files to `dist/admin/` so the admin has an address for them. One copy
          of the card in the repository — change it and the preview changes with
          it, which was the point.

          `tools/card.js` also holds `fromCmsEntry()`: content.js's
          product-shaping rules (`tools/content.js:256-295` — same filters, same
          age order, same lowest-price rule) rewritten to bend rather than break
          on a half-typed form, plus the notes the panel prints under the card
          for what is still missing. It lives beside the card so `npm test` can
          hold the two to the same rules.

          **Verified:** the site builds byte-identically apart from its
          timestamp — same 46 pages, same `dist/data/products.json`; `npm test`
          covers the mapper and the moved `safeHref` allowlist (74 checks, up
          from 43); and in Chromium the shared file really does load as a plain
          script and produce a card **byte-identical** to the one Node builds.
          `preview.js` itself was driven against a stubbed CMS — it registers,
          renders a filled-in piece, renders the notes for an empty one, and
          survives a null entry.

          One bug that only the browser found, recorded because it will catch
          the next person: both files ended up declaring `const API`, and plain
          `<script>` tags share one top-level scope, so the second file died on
          a redeclaration and its global was never set — silent everywhere but
          the browser console. Hence `IMAGES_API` / `CARD_API`.

          **Unverified from here:** the same wall as ImageKit — the admin loads
          Decap from `unpkg.com`, which this container is blocked from, so the
          panel has never been seen inside the real admin. The specific gamble
          is the element factory: `window.h`, with `window.React.createElement`
          as a fallback and a console warning if neither is there. If the panel
          comes up blank, that line is the first place to look. Nothing in this
          work can stop the admin loading — every step is wrapped so a failure
          costs the preview and nothing else.

---

## Checked and found not to be a problem

- ~~**"Load more" hiding when nothing is left to load.**~~ **Was a problem after
  all — fixed 2026-08-05.** Both layers were right about *when* to hide it, but
  `.lp-loadwrap{display:flex}` outranked the browser's `[hidden]{display:none}`,
  so `loadwrap.hidden = true` had no effect and the button stayed on screen and
  clickable with nothing left to reveal. The original check read the markup and
  the JS; this only shows up in a browser. `.lp-loadwrap[hidden]{display:none}`
  added, verified in Chromium on both affected sections.
- **Filter panel focus handling.** Raised, then dropped as out of scope.

## Closed in the previous round

Findings from the review of `claude/netlify-bridgecap-cms-setup-xb5hwb`, all fixed
and verified on 2026-08-04: JSON-LD stored XSS (`render.js:110`), `shareImage`
concatenating without a separator (`:76`), the wrong page count in the build
summary (`build.js:121`), and three 404-page defects — uncentred `.lp-cta`,
missing vertical padding, and `aria-current` on the wrong nav item.

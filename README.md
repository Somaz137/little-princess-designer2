# Little Princess Designer

Handmade made-to-order kidswear, Lahore. Static website with a
[Decap CMS](https://decapcms.org) admin page at `/admin/`.

**Adding products, prices and photos does not need a developer** — open
`/admin/` on the live site and fill in a form. See
[docs/CMS-SETUP.md](docs/CMS-SETUP.md) for the one-time setup.

Sign-in goes through [DecapBridge](https://decapbridge.com), so editors log in
with an email address rather than needing a GitHub account with write access to
this repo.

---

## How it fits together

```
content/          ← what the admin page edits. The source of truth.
  settings.json       contact details + wording used across the site
  categories/         the four shop tabs (Girls, Boys, Babies, Ready to wear)
  subcategories/      the sections inside them — one file each
  products/           one file per product

site/             ← hand-written source
  styles.css          all the site's styling
  tokens.css          the Little Princess design system (colours, type, spacing)
  app.js              filters, load more, size-to-price, gallery, hero scroll
  carousel-3d.js      the draggable 3D carousel on the home page
  assets/             logo, hero images (webp) and self-hosted fonts
  admin/              the Decap CMS admin page and its configuration

tools/            ← the build
  content.js          reads and validates content/
  render.js           turns it into HTML pages
  build.js            writes dist/
  check-config.js     stops the CMS from silently dropping fields
  serve.js            local preview server
  seed-content.js     one-time starter catalogue (safe to delete)
  build-preview.js    packs dist/ into one self-contained preview.html

dist/             ← generated. Not committed. This is what Netlify serves.
```

Every push to `main` makes Netlify run `npm run build`, which regenerates the
whole site from `content/`. There is no database and no server — just files.

## Commands

```bash
npm run build     # generate dist/
npm start         # build, then serve on http://localhost:8080
npm run cms       # local admin save-server (run alongside npm start)
npm run check     # verify content/ matches the CMS config
npm run preview   # bundle the whole site into a single shareable preview.html
```

## Pages

45 pages are generated from 39 products:

| URL | What it is |
|---|---|
| `/` | Home — scroll-driven hero, features, about, 3D carousel, category cards |
| `/girls/` `/boys/` `/babies/` `/ready/` | Shop, split into subcategory sections with filters and load-more |
| `/product/<name>/` | Product page — gallery, per-size price, accessory total, WhatsApp order |
| `/contact/` | Ordering steps, FAQs, social links, feedback |

Each has its own title, meta description and structured data. The four shop tabs
recolour the whole page: berry for girls, sky blue for boys, peach for babies,
gold for ready to wear.

## Things worth knowing before you change something

- **The design system in `site/tokens.css` is binding.** Colours, type and
  spacing come from there, copied from the brand's design system — don't edit the
  values. The one deliberate change is the font block: the same two typefaces,
  self-hosted from `site/assets/fonts` instead of fetched from Google on every
  page load.
- **Prices are per product, per size.** There is no formula any more. Each
  product file lists its own size/price rows, all editable in the admin.
- **Hiding a product removes it from the build entirely.** It is not hidden with
  CSS — a hidden product has no page and appears in no JSON, so it cannot be
  found by poking around.
- **`site/admin/config.yml` must declare every field** that appears in
  `content/`. Decap deletes undeclared fields when an admin presses Save, so
  `npm run check` runs as part of the build and fails loudly if the two drift
  apart. If you add a field to a content file, add it to the config too.
- **Products fall back to their subcategory** for description and details. Write
  the standard text once on the subcategory rather than on every piece.
- **Pages are prerendered, not client-rendered.** `app.js` never builds markup;
  it only wires up interactivity. If you add a section, add it to
  `tools/render.js`.

## Where this came from

The design was prototyped in Claude Design over six sessions. The original
prototype, transcripts and the assets that came with them are preserved in
`project/` and `chats/`, with the handover notes in
`docs/DESIGN-HANDOFF-README.md`. Nothing in `project/` is used by the live site —
it is kept as the visual reference the production code was built against.

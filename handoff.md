# Handoff: Little Princess Designer — live site, admin, link previews
_Last updated: 2026-08-05_

## Goal

A handmade kidswear shop (Lahore) running on Netlify, where the owner and
invited helpers add products, prices and photos through a form — no developer.
Photos live on ImageKit, not in git.

## What we're building

Static site, no database, no server. `content/` holds one JSON file per product,
subcategory and category page plus a settings file. Netlify runs `npm run build`,
which regenerates every page from `content/` + `site/` into `dist/`. Decap CMS at
`/admin/` writes those JSON files back to the repo, triggering the next build.

Constraints that bite if forgotten:
- **Zero runtime dependencies.** `tools/check-config.js` parses `config.yml` with
  a hand-rolled YAML reader and gates every build — anything added to the config
  must survive it.
- **Every field in `content/` must be declared in `site/admin/config.yml`**, or
  Decap silently deletes it on save. `npm run check` enforces this.
- `site/tokens.css` is a binding design system. Don't edit its values.
- **Never claim a mobile fix is verified.** Headless Chromium ignores the
  viewport meta, does not reproduce scrolling, and does not fire the URL-bar
  resize events. Phone-width screenshots are capture artifacts — the existing
  contact page "overflows" identically. Only a real device confirms.

## Current state

**Live** at `https://littleprincessdesigner.netlify.app`. Build clean.
Admin works end to end: two people (Rimaz, Javeria) have saved edits through
DecapBridge, and their names land in the commit messages as intended.

**PR #5 is OPEN and UNMERGED** — https://github.com/Somaz137/little-princess-designer2/pull/5
`mergeable_state: clean`, Netlify checks were still running when the session
ended. Branch `claude/netlify-bridgecap-cms-setup-xb5hwb` at `0c160d2`, one
commit ahead of `main` (`38883cb`). Merging it is the next action.

**Unverified in PR #5** (all need a real phone or a real share):
- Instagram icon no longer flashing left on header minimise
- Header now waiting for the hero sequence before minimising
- Provider-resized link previews actually rendering in WhatsApp

**Content problem, not code:** CMS edits deleted subcategory `b2`, orphaning
three boys products — Cotton-Silk Three Piece, Eid Waistcoat Set, Junior
Waistcoat Set. They are hidden from the site until reassigned in the admin. The
build names each one. Catalogue is now 36 live products, 43 pages.

**Done 2026-08-05:** the *photo library*, on ImageKit rather than Cloudinary.
`media_library: imagekit` is live in `site/admin/config.yml`, wired to ImageKit's
embeddable widget by `site/admin/imagekit.js` (Decap ships no ImageKit library of
its own). No keys anywhere — each editor signs in to ImageKit inside the panel —
so nothing is outstanding from the owner. Untested against the real thing from
this environment: the proxy blocks `ik.imagekit.io` and `unpkg.com`, so the first
real upload is the proof.

**Empty:** all four category card photos (`content/categories/*.json`,
`card.image`). This is why category links preview with the generic card and why
the home page shows "GIRLS PHOTO" placeholders. Owner must add them in the
admin; no code change can supply them.

## Files in flight

- `tools/render.js` — `shareImage()` + `images.preview()` build og:image;
  `jsonLdScript()` escapes structured data; `render404()`; home section order.
- `tools/content.js` — `normaliseSrc()` forces a leading `/`; settings-level
  carousel/about photos resolved; WebP-first-photo warning (skips ImageKit).
- `tools/build.js` — counts `.html` actually written; emits `404.html`.
- `site/app.js` — header latch threshold tied to the hero story; resize handler
  ignores height-only changes.
- `site/styles.css` — `.lp-igbtn` no longer transitions `margin`; `will-change`
  on hero layers; `.lp-main--notfound`, `.lp-cta--center`; `.lp-back` inline-block.
- `site/admin/config.yml` — DecapBridge PKCE, real site id, `auth:` claims,
  live `media_library: imagekit` block.
- `site/admin/imagekit.js` — ImageKit widget ↔ `CMS.registerMediaLibrary`.
- `tools/images.js` — the one place any image host is described.
- `site/assets/share-card.png` — 1200x630 PNG preview card (210 KB).
- `tools/share-card.html` — its source, with re-render instructions in a comment.
- `review-checklist.md` — all six review findings checked off.

Working tree clean; everything committed and pushed.

## What's changed

- Admin sign-in moved from GitHub OAuth to DecapBridge PKCE so non-technical
  helpers can edit without repo access. Confirmed working by two real editors.
- Closed a stored XSS: `JSON.stringify` does not escape `<`, so a CMS field
  containing `</script>` broke out of the JSON-LD block. That mattered *because*
  of the DecapBridge switch — content editors now hold no repo access.
- Fixed blank home carousel and About photos (`<img src="">`), missing share
  tags, a wrong page count, three 404 defects, and the `.lp-back` pill
  overlapping the product gallery.
- **Link previews took two passes.** First diagnosis (every share image was
  WebP, which WhatsApp will not render) was correct but incomplete — added
  `share-card.png`. Products still failed: the shared card showed the right
  title and description and dropped only the image, which pointed at image
  *size*. og:image now requests a resized copy at
  `w-1200,h-630,cm-pad_resize,bg-FFFCF8,f-jpg`; the page keeps the original.
- Home page reordered twice: Explore the Collection and Get yours now moved
  above Features/About, then the quote banner moved to the very end.

## Failed attempts

- **`unpkg.com`, `docs.netlify.com`, `*.netlify.app`, `res.cloudinary.com` and
  `ik.imagekit.io` are all blocked by this environment's proxy** (403 on
  CONNECT). `imagekit.io`'s docs pages answer 403 to WebFetch too; the npm
  tarballs of `imagekit-javascript` and `imagekit-media-library-widget` are the
  way to read what those actually do. Verify package
  behaviour through `registry.npmjs.org` instead: download the tarball and read
  `dist/*.js.map` `sourcesContent`. This is how every Decap claim was confirmed.
  It also means the deploy preview and the live site cannot be inspected — do
  not promise to check them.
- **`add_repo` for `decaporg/decap-cms` was denied by the user.** Don't retry;
  use the npm tarball route.
- **Do not add a `netlify-identity-widget` script tag.** Most git-gateway
  tutorials call for it. `decap-cms-ui-auth` only defers to
  `window.netlifyIdentity` when that global exists, so adding it would hijack
  login and point it at the retired Netlify Identity service.
- **ffmpeg cannot decode WebP here** (Playwright's minimal build). Use headless
  Chromium to render and screenshot instead — that is how `share-card.png` was
  produced.
- **`pkill -f "tools/serve.js"` kills its own shell** (the pattern matches the
  bash command line). Use `pkill -f "serve[.]js"`.
- **Nearly shipped literal U+2028/U+2029 characters in a regex.** They survived
  transit, but had they been normalised to spaces the code would have replaced
  every space in the structured data. Written as `\uXXXX` escapes instead.
- Anchor-jump screenshots (`#about`) do not work — headless Chromium resets
  scroll. To capture lower sections, inject a fixed-**pixel** height override for
  `.lp-story` into a throwaway copy in `dist/`; `vh` units scale with the tall
  capture window and do not help.

## Next step

Merge PR #5 once its Netlify checks pass
(`mcp__github__merge_pull_request`, owner `Somaz137`, repo
`little-princess-designer2`, pullNumber 5, merge_method `merge`), then sync the
local branch to `main` and push it so the branch ref matches.

Then hand three things back to the owner, none of which are code:
1. Test a share on `littleprincessdesigner.netlify.app` — **not** a
   `<deploy-id>--littleprincessdesigner.netlify.app` snapshot URL, and append
   `?1` to defeat WhatsApp's per-URL preview cache.
2. Reassign the three orphaned `b2` products in the admin.
3. Add the four category card photos — the photo library is on now, so this is
   a job in the admin rather than anything to send anyone.

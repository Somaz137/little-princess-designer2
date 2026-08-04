# Handoff: Little Princess Designer — Netlify + Decap CMS launch
_Last updated: 2026-08-04_

## Goal

Get a handmade kidswear shop site (Lahore) live on Netlify with a working admin
page, so the owner can add products, prices and photos without a developer.
Photos are to live on Cloudinary rather than in the git repo.

## What we're building

Static site, no database, no server. `content/` holds one JSON file per product,
subcategory, category page, plus a settings file. Netlify runs `npm run build`,
which regenerates all 45 pages from `content/` + `site/` into `dist/`. The Decap
CMS admin at `/admin/` writes those JSON files back to the repo, which triggers
the next rebuild.

Key constraints:
- Zero runtime dependencies. `tools/check-config.js` parses `config.yml` with a
  hand-rolled YAML reader — anything added to the config must survive it, and it
  gates every build.
- `site/tokens.css` is a binding design system. Don't edit its values.
- Every field present in `content/` must be declared in `site/admin/config.yml`,
  or Decap silently deletes it on save. `npm run check` enforces this.

## Current state

**Live and working:** site deploys at `https://littleprincessdesigner.netlify.app`.
Build is clean (45 pages + `404.html`). Everything below is merged to `main`
(PR #1 and PR #2, HEAD `0d73d7a`).

**Fixed:** publishing from the admin used to fail with
`API_ERROR: Resource not accessible by personal access token` — the token
DecapBridge uses had read-only access. The owner corrected it in GitHub /
DecapBridge settings; nothing in this repo changed. `main` has had no CMS-authored
commit yet, so the first successful save is still unconfirmed from here.

**Not started:** Cloudinary. The `media_library` block in
`site/admin/config.yml` is still commented out, so uploads would commit into
this repo. Must be switched on *before* any photo is uploaded — repo history is
permanent. It needs the owner's Cloudinary **cloud name** and **API key**; those
two values are the only edit left.

**Empty:** every image slot in `content/` is still `{"url": "", "upload": ""}` —
39 products, 4 category cards, 10 carousel photos, 1 About photo. The build warns
about the products and succeeds; the site renders "photo coming soon" frames.

## Files in flight

- `site/admin/config.yml` — done. `backend: git-gateway` with DecapBridge PKCE,
  real site id `6a40028d-8569-4023-a050-8b533a65ff01` in both `auth_endpoint`
  and `auth_token_endpoint`. Top-level `auth:` claim block present. Cloudinary
  block at ~line 59 still commented out — the one thing left to edit here.
- `site/admin/index.html` — done. Decap pinned to `3.15.1` (was `^3.8.0`).
- `tools/content.js` — done. `settings.about.photo` and `settings.carousel` now
  go through `resolveImage()`.
- `tools/render.js` — done. Added `shareImage()`, og:image/twitter:image
  threading through `page()`/`head()`, `noindex` support, and `render404()`.
- `tools/build.js` — done. Writes `dist/404.html`.
- `docs/CMS-SETUP.md` — done. Rewritten for DecapBridge; GitHub OAuth steps gone.
- `docs/ADMIN-GUIDE.md`, `README.md` — done. Login wording updated.

Nothing uncommitted. Working tree clean.

## What's changed

- Audited the repo against the Netlify + Decap + Cloudinary plan. Netlify config,
  build, and `/admin/*` rewrite were all already correct.
- Chose DecapBridge over GitHub sign-in, at the user's request, so non-technical
  people can be invited by email without repo write access.
- First pass used DecapBridge's GoTrue email/password backend. The user then
  supplied the dashboard-generated snippet, which uses **PKCE** instead —
  replaced the whole backend block with theirs. `identity_url` was dropped; it is
  unread on the PKCE path.
- Added the top-level `auth:` claim mapping. Not cosmetic: without it
  `{{author-name}}` resolves to an empty string, since `PKCEAuthenticationPage`
  builds the display name by joining the `first_name`/`last_name` claims.
- Fixed a real rendering bug: the home carousel and About photo emitted
  `<img src="">` on every build, because those two settings-level image fields
  never went through `resolveImage()`. Would have stayed broken after Cloudinary
  was enabled, with nothing in the admin explaining why.
- Added og:image/twitter:image (were missing entirely while `twitter:card` was
  already `summary_large_image`), pinned the Decap version, added a 404 page.
- Kept the shop's own `logo_url` rather than DecapBridge's offered logo, and set
  `site_url` to the real Netlify address.

## Failed attempts

- **`unpkg.com` and `docs.netlify.com` are blocked by this environment's proxy**
  (403 on CONNECT). Verify package contents via `registry.npmjs.org` instead —
  download the tarball and read `dist/*.js.map` `sourcesContent`. That worked
  well and is how every Decap claim below was confirmed.
- **`add_repo` for `decaporg/decap-cms` was denied by the user**, and
  `mcp__github__get_file_contents` refuses repos outside session scope. Don't
  retry; use the npm tarball route.
- **Nearly added a `netlify-identity-widget` script tag** — most tutorials for
  the git-gateway backend tell you to. Reading `decap-cms-ui-auth` showed
  `NetlifyAuthenticationPage` renders its own email/password form and only defers
  to `window.netlifyIdentity` when that global exists. Adding the widget would
  hijack login and point it at the retired Netlify Identity service. Do not add it.
- **Web search hit its session rate limit** (resets 2:30pm UTC) while diagnosing
  the publish error, so DecapBridge's current dashboard wording was not re-verified.

## Next step

Turn on Cloudinary, before any photo is uploaded. Uncomment the `media_library`
block in `site/admin/config.yml` and fill in the owner's Cloudinary **cloud name**
and **API key** (Cloudinary dashboard → Product Environment Credentials). Both are
client-side values by design; the API *secret* is not used and must not go in.

Verified this session, so the two values really are the whole job:

- The pinned `decap-cms@3.15.1` bundle already contains
  `decap-cms-media-library-cloudinary@3.1.0` and registers it. **No extra
  `<script>` tag** — the common tutorial step is unnecessary here.
- Option names are right, checked against that package's source:
  `output_filename_only` is an integration option (sits beside `name`), while
  `default_transformations` is a Cloudinary behaviour key (sits inside `config`)
  and takes an array-of-arrays. Getting either nesting wrong fails silently.
- `tools/check-config.js`'s hand-rolled YAML reader survives the uncommented
  block — tested with real values; `npm run check` still passes.
- `resolveImage()` uses the stored string verbatim, and `shareImage()` already
  passes absolute URLs through. So a `https://res.cloudinary.com/...` value lands
  correctly in both `<img src>` and `og:image` with no code change.
- `api_key` is quoted in the template on purpose: unquoted, an all-digit key
  parses as a YAML number and reaches the widget in the wrong type.
- Once enabled, the admin loads `https://media-library.cloudinary.com/global/all.js`
  at runtime. Nothing to do today — there is no CSP on the site — but that host
  has to be allowed if one is ever added.

After that the work is content, not code: fill the 54 empty image slots via
`/admin/`, keeping uploads ~1600px on the long edge and under ~300 KB.

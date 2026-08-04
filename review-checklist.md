# Review checklist

Open findings from the code review and security review of
`claude/netlify-bridgecap-cms-setup-xb5hwb`. Line numbers verified against the
working tree on 2026-08-04.

## Security

- [x] **`tools/render.js:110` — stored XSS via JSON-LD breakout.** `JSON.stringify`
      does not escape `<`, so CMS free text containing `</script>` terminates the
      structured-data block and returns the parser to HTML context. Reachable by
      DecapBridge collaborators, who hold no repo access — an escalation past the
      boundary the new auth setup exists to enforce. CMS-controlled inputs reach
      it at `:445`, `:452`, `:575`, `:672-673`.
      **Fix:** `.replace(/</g, '\\u003c')` on the stringified output (valid JSON,
      parses back to `<`, so the structured data Google reads is unchanged); also
      escape U+2028/U+2029.

## Correctness

- [x] **`tools/render.js:76` — `shareImage` concatenates with no separator.**
      `siteUrl + src` yields a malformed `og:image` if a pasted image link has
      neither a scheme nor a leading slash, with no build warning. Same pattern
      already exists in the product JSON-LD at `:578`.
      **Fix:** normalise to a leading `/` before concatenating, and warn on a
      value that is neither absolute nor root-relative.

- [x] **`tools/build.js:121` — page count in the build summary is wrong.**
      Still computes `2 + categories + products`, so it reports 45 pages while 46
      files are written; the new 404 is invisible in the log.
      **Fix:** include `404.html` in the count, or derive the count from what was
      actually written.

## 404 page polish

- [ ] **`tools/render.js:705` — `.lp-cta` is styled for a different parent.**
      It is only centred as a flex child of `.lp-sticky`; as a block child of
      `.lp-sect` it sits flush left at ≥1180px. Separately,
      `@media (max-width:768px){.lp-cta-s{display:none}}` hides all three
      subtitles on phones.
      **Fix:** centre the row on the 404 (e.g. `margin-inline:auto`) and either
      accept the hidden subtitles or fold the wording into the titles.

- [ ] **`tools/render.js:698` — no vertical padding on the 404.** `.lp-main`
      without a modifier and `.lp-sect` supply none, so the "Page not found"
      eyebrow touches the sticky header. Home-page spacing comes from the
      `--gap8`/`--gap9` modifiers, which are not used here.
      **Fix:** add the appropriate `lp-main--*` / `lp-sect--gap*` modifier.

- [ ] **`tools/render.js:717` — wrong nav item marked current.** `tab: "home"`
      puts `aria-current="page"` on the Home link while the visitor is on a 404,
      which misreports the location to screen readers.
      **Fix:** pass a tab value that matches no nav entry.

---

**Not a finding, but worth knowing:** `href` attributes built from CMS values are
escaped with `esc()` but not scheme-validated, so a `javascript:` URL in the
Instagram / Facebook / TikTok settings would be live. Only reachable by someone
who can already commit code, so no boundary is crossed today — but it becomes a
real issue if Site Settings is ever exposed to invited collaborators.

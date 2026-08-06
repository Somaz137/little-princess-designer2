/**
 * Little Princess Designer — client behaviour.
 *
 * Pages are prerendered, so this file never builds markup. It only handles the
 * things that need a browser: the header latch, the scroll-driven hero story,
 * size-to-price on cards and product pages, the filter panel, load-more, and
 * the product gallery.
 */
(function () {
  "use strict";

  var money = function (n) { return "PKR " + Number(n).toLocaleString("en-US"); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  /** Coalesce bursts of scroll/resize work into one frame. */
  var raf = function (fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn(); });
    };
  };

  /* --- 1. Header ------------------------------------------------------- */

  function initHeader() {
    var header = $(".lp-header");
    if (!header) return;

    /* Reserve space for the header at its EXPANDED height, so the sticky hero
       stage never jumps or gets clipped when the header minimises. */
    var measure = function () {
      var wasMin = header.getAttribute("data-min") === "1";
      var prevTransition = header.style.transition;
      if (wasMin) {
        header.style.transition = "none";
        header.setAttribute("data-min", "0");
      }
      var px = header.getBoundingClientRect().height;
      if (wasMin) {
        header.setAttribute("data-min", "1");
        header.style.transition = prevTransition;
      }
      document.documentElement.style.setProperty("--lp-header", px + "px");
    };

    /* Where the header is allowed to start minimising.
       On the home page that is the end of the hero story, so the drawing plays
       all the way through to the finished dress before the header moves — two
       things animating against each other reads as jank. Elsewhere, 120px. */
    var story = $(".lp-story");
    var threshold = function () {
      if (!story) return 120;
      var end = story.offsetTop + story.offsetHeight - window.innerHeight;
      return Math.max(120, end);
    };

    /* One-way latch: minimise once past the threshold, expand again only back
       at the very top. Without the latch, the reflow from minimising nudges
       scrollY across the threshold and the header flickers. */
    var latch = raf(function () {
      var y = window.scrollY || 0;
      var isMin = header.getAttribute("data-min") === "1";
      var next = isMin ? y >= 4 : y > threshold();
      if (next !== isMin) header.setAttribute("data-min", next ? "1" : "0");
    });

    /* Mobile browsers fire `resize` continuously while the URL bar slides in and
       out, and that only ever changes the viewport HEIGHT. Re-measuring then is
       both pointless and costly: measure() forces a synchronous layout and
       briefly flips data-min to "0" and back, mid-scroll. Watching width only
       keeps the header steady on a phone while still handling rotation. */
    var lastWidth = window.innerWidth;
    var onResize = raf(function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      measure();
    });

    measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", latch, { passive: true });
    latch();
  }

  /* --- 2. Hero scroll story ------------------------------------------- */

  function initStory() {
    var story = $(".lp-story");
    var stages = $$("[data-stage]");
    var hooks = $$("[data-hook]");
    if (!story || !stages.length) return;

    /* 0 before `a`, 1 after `b`, linear between. */
    var seg = function (p, a, b) {
      return Math.max(0, Math.min(1, (p - a) / (b - a)));
    };

    var update = raf(function () {
      var rect = story.getBoundingClientRect();
      var span = rect.height - window.innerHeight;
      var p = span > 0 ? Math.max(0, Math.min(1, -rect.top / span)) : 0;

      var mobile = window.innerWidth < 768;
      var a1 = mobile ? 0.16 : 0.26, b1 = mobile ? 0.28 : 0.38;
      var a2 = mobile ? 0.50 : 0.60, b2 = mobile ? 0.62 : 0.72;

      var o = [
        1 - seg(p, a1, b1),
        seg(p, a1, b1) * (1 - seg(p, a2, b2)),
        seg(p, a2, b2)
      ];

      stages.forEach(function (el) { el.style.opacity = o[Number(el.getAttribute("data-stage"))]; });
      hooks.forEach(function (el) { el.style.opacity = o[Number(el.getAttribute("data-hook"))]; });
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* --- 3. Product cards: size to price ------------------------------- */

  /** Reads a card's size/price table straight out of its <select> options. */
  function priceTable(card) {
    var select = $("[data-price-select]", card);
    if (!select) return {};
    var table = {};
    $$("option", select).forEach(function (opt) {
      table[opt.textContent.trim()] = Number(opt.getAttribute("data-price"));
    });
    return table;
  }

  /**
   * Writes a price into a block built by priceBlock() in tools/card.js: the
   * price paid, plus the crossed-out original above it when the chosen size is
   * on sale. `data-was` is empty on a size at its usual price, which hides that
   * line — so changing size can move a card into or out of its sale look.
   */
  function paintPrice(out, price, was) {
    if (!out) return;
    var nowEl = $("[data-price-now]", out);
    var wasEl = $("[data-price-was]", out);
    if (nowEl) nowEl.textContent = money(price);
    if (wasEl) {
      var on = was && Number(was) > 0;
      wasEl.textContent = on ? money(was) : "";
      wasEl.hidden = !on;
    }
    // Older markup with no spans inside: keep the single-line behaviour rather
    // than blanking the price.
    if (!nowEl && !wasEl) out.textContent = money(price);
  }

  function paintCardPrice(card) {
    var select = $("[data-price-select]", card);
    var out = $("[data-price-out]", card);
    if (!select || !out) return;
    var opt = select.options[select.selectedIndex];
    if (!opt) return;
    var was = opt.getAttribute("data-was");
    paintPrice(out, opt.getAttribute("data-price"), was);
    out.classList.toggle("lp-card-price--sale", !!(was && Number(was) > 0));
  }

  function initCards(root) {
    $$("[data-product]", root).forEach(function (card) {
      card._prices = priceTable(card);
      var select = $("[data-price-select]", card);
      if (select) {
        select.addEventListener("change", function () { paintCardPrice(card); });
      }
    });
  }

  /* --- 4. Filters + load more ---------------------------------------- */

  function initShop() {
    var sections = $$("[data-subsect]");
    if (!sections.length) return;

    var panel = $("[data-panel]");
    var scrim = $("[data-scrim]");
    var openBtn = $("[data-filter-open]");
    var range = $("[data-fmax]");
    var rangeOut = $("[data-fmax-out]");
    var chips = $$("[data-size-chip]");

    var state = { size: null, max: range ? Number(range.value) : Infinity };

    sections.forEach(function (sec) {
      sec._initial = Number(sec.getAttribute("data-visible") || 4);
      sec._visible = sec._initial;
      sec._step = Number(sec.getAttribute("data-step") || 4);
      /* Hand visibility over from the CSS preload rule to this script. */
      var grid = $("[data-grid]", sec);
      if (grid) grid.removeAttribute("data-preload");
    });

    /** A card qualifies on size if it offers the picked band, and on price by
        that band's price (or its cheapest size when no band is picked). */
    function eligible(card) {
      if (state.size) {
        var offered = (card.getAttribute("data-sizes") || "").split("|");
        if (offered.indexOf(state.size) === -1) return false;
        var p = card._prices[state.size];
        if (typeof p === "number" && p > state.max) return false;
        return true;
      }
      return Number(card.getAttribute("data-min-price")) <= state.max;
    }

    /* --- filter state in the URL ------------------------------------- */

    /**
     * Size and price lived only in `state`, so a filtered view could not be
     * reloaded or sent to a customer — the link opened the unfiltered page.
     * They are mirrored into the hash instead.
     *
     * Only non-default values are written, so an unfiltered page keeps a clean
     * address, and `#g1`-style section anchors — which the footer and
     * breadcrumbs both use — are left alone: a hash with no "=" in it is a link
     * to a section, not filter state.
     */
    function writeHash() {
      var parts = [];
      if (state.size) parts.push("size=" + encodeURIComponent(state.size));
      if (range && state.max < Number(range.max)) parts.push("max=" + state.max);
      var hash = parts.length ? "#" + parts.join("&") : "";
      // replaceState rather than assigning location.hash: dragging the price
      // slider would otherwise push one history entry per step and bury
      // whatever page the visitor arrived from.
      history.replaceState(null, "", location.pathname + location.search + hash);
    }

    /** Restores state from the hash. Returns false if there was none to read. */
    function readHash() {
      var raw = location.hash.slice(1);
      if (raw.indexOf("=") === -1) return false;

      var params = {};
      raw.split("&").forEach(function (pair) {
        var i = pair.indexOf("=");
        if (i === -1) return;
        try {
          params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
        } catch (err) {
          /* A half-typed or mangled escape — ignore that pair rather than throw. */
        }
      });

      // Only a size this page actually offers. A stale or invented one would
      // otherwise match nothing and read as an empty catalogue.
      var offered = chips.map(function (c) { return c.getAttribute("data-size-chip"); });
      state.size = offered.indexOf(params.size) !== -1 ? params.size : null;
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed",
          c.getAttribute("data-size-chip") === state.size ? "true" : "false");
      });

      if (range) {
        var hi = Number(range.max);
        var lo = Number(range.min);
        var max = Number(params.max);
        // Clamped, so a hand-edited number cannot push the slider off its track.
        state.max = params.max !== undefined && isFinite(max) ? Math.min(hi, Math.max(lo, max)) : hi;
        range.value = state.max;
        if (rangeOut) rangeOut.textContent = money(state.max);
      }
      return true;
    }

    function apply() {
      sections.forEach(function (sec) {
        var cards = $$("[data-product]", sec);
        var loadwrap = $("[data-loadwrap]", sec);
        var noresults = $("[data-noresults]", sec);
        var shown = 0;

        cards.forEach(function (card) {
          if (!eligible(card)) {
            card.hidden = true;
            return;
          }
          if (shown < sec._visible) {
            card.hidden = false;
            shown++;
            /* Keep the card's dropdown on the band being filtered for. */
            if (state.size) {
              var select = $("[data-price-select]", card);
              if (select) {
                $$("option", select).forEach(function (opt) {
                  if (opt.textContent.trim() === state.size) select.value = opt.value;
                });
                paintCardPrice(card);
              }
            }
          } else {
            card.hidden = true;
          }
        });

        var total = cards.filter(eligible).length;
        if (loadwrap) loadwrap.hidden = total <= sec._visible;
        if (noresults) noresults.hidden = total !== 0;
        var grid = $("[data-grid]", sec);
        if (grid) grid.hidden = total === 0;
      });
    }

    /* Load more */
    $$("[data-load]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sec = btn.closest("[data-subsect]");
        if (!sec) return;
        // Where the new cards will start. Read before the count moves, so it
        // is the index of the first one the click reveals.
        var firstNew = sec._visible;
        sec._visible += sec._step;
        apply();

        // Nothing announces four cards appearing further down the page, and a
        // screen-reader or keyboard user is left where they were with no way to
        // tell the click did anything. Moving focus to the first new card says
        // it: the card's name and price are read out, and tabbing carries on
        // from there. tabindex is set here rather than in the markup so the
        // cards are not in the tab order the rest of the time.
        var revealed = $$("[data-product]", sec).filter(function (card) {
          return !card.hidden;
        })[firstNew];
        if (revealed) {
          revealed.setAttribute("tabindex", "-1");
          revealed.focus();
        }
      });
    });

    /* Panel open/close */
    function setOpen(open) {
      if (panel) panel.setAttribute("data-open", open ? "1" : "0");
      if (scrim) scrim.setAttribute("data-open", open ? "1" : "0");
      if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (openBtn) openBtn.addEventListener("click", function () {
      setOpen(panel.getAttribute("data-open") !== "1");
    });
    $$("[data-filter-close]").forEach(function (b) {
      b.addEventListener("click", function () { setOpen(false); });
    });
    if (scrim) scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    /* Size chips — single select, click again to clear */
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var value = chip.getAttribute("data-size-chip");
        var already = state.size === value;
        state.size = already ? null : value;
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", c === chip && !already ? "true" : "false");
        });
        sections.forEach(function (sec) { sec._visible = sec._initial; });
        writeHash();
        apply();
      });
    });

    /* Max price */
    if (range) {
      range.addEventListener("input", function () {
        state.max = Number(range.value);
        if (rangeOut) rangeOut.textContent = money(state.max);
        sections.forEach(function (sec) { sec._visible = sec._initial; });
        writeHash();
        apply();
      });
    }

    /* Reset */
    var reset = $("[data-filter-reset]");
    if (reset) reset.addEventListener("click", function () {
      state.size = null;
      chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      if (range) {
        range.value = range.max;
        state.max = Number(range.max);
        if (rangeOut) rangeOut.textContent = money(state.max);
      }
      sections.forEach(function (sec) { sec._visible = sec._initial; });
      writeHash();
      apply();
    });

    // Restore before the first paint, so a shared link opens already filtered
    // rather than showing everything and then narrowing.
    readHash();

    // Someone pasting a different filtered link into the same tab, or using
    // Back after arriving on one. Our own writeHash uses replaceState, which
    // does not fire this, so there is no loop.
    window.addEventListener("hashchange", function () {
      if (!readHash()) return;
      sections.forEach(function (sec) { sec._visible = sec._initial; });
      apply();
    });

    apply();
  }

  /* --- 5. Product detail --------------------------------------------- */

  function initDetail(root) {
    var detail = $("[data-detail]", root);
    if (!detail) return;

    var select = $("[data-detail-size]", detail);
    var priceOut = $("[data-detail-price]", detail);
    var totalOut = $("[data-total]", detail);
    var accessory = $("[data-accessory]", detail);
    var waLink = $("[data-wa-order]", detail);

    var waNumber = String(detail.getAttribute("data-wa") || "").replace(/[^0-9]/g, "");
    var name = detail.getAttribute("data-name") || "";
    var accessoryPrice = Number(detail.getAttribute("data-accessory-price") || 0);

    function paint() {
      var opt = select ? select.options[select.selectedIndex] : null;
      if (!opt) return;
      var price = Number(opt.getAttribute("data-price"));
      var withAccessory = accessory && accessory.checked;
      var total = price + (withAccessory ? accessoryPrice : 0);

      var was = opt.getAttribute("data-was");
      if (priceOut) {
        paintPrice(priceOut, price, was);
        priceOut.classList.toggle("lp-detail-price--sale", !!(was && Number(was) > 0));
      }
      // The total is what is actually paid, so it never carries the old price:
      // one crossed-out number on the page is a saving, two is a puzzle.
      if (totalOut) totalOut.textContent = money(total);

      if (waLink) {
        var text =
          "Hello Little Princess Designer, I'd like to order:\n" + name +
          "\nSize: " + opt.textContent.trim() +
          "\nMatching accessory: " + (withAccessory ? "yes" : "no") +
          "\nTotal shown: " + money(total);
        waLink.href = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(text);
      }
    }

    if (select) select.addEventListener("change", paint);
    if (accessory) accessory.addEventListener("change", paint);
    paint();

    /* Gallery: explicit index so scroll-snap can't cancel an arrow press. */
    var gallery = $("[data-gallery]", detail);
    if (!gallery) return;
    var index = 0;

    function go(delta) {
      var slides = Array.prototype.slice.call(gallery.children);
      index = Math.max(0, Math.min(slides.length - 1, index + delta));
      var el = slides[index];
      if (el) gallery.scrollTo({ left: el.offsetLeft - gallery.offsetLeft, behavior: "smooth" });
    }

    var prev = $("[data-gal-prev]", detail);
    var next = $("[data-gal-next]", detail);
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });

    /* Keep the index honest when the user swipes instead of using the arrows. */
    gallery.addEventListener("scroll", raf(function () {
      var slides = Array.prototype.slice.call(gallery.children);
      var mid = gallery.scrollLeft + gallery.clientWidth / 2;
      for (var i = 0; i < slides.length; i++) {
        var left = slides[i].offsetLeft - gallery.offsetLeft;
        if (mid >= left && mid < left + slides[i].offsetWidth) { index = i; break; }
      }
    }), { passive: true });
  }

  /* --- 6. Catalogue search -------------------------------------------- */

  /**
   * 39 pieces across 12 sections were reachable only by browsing four tabs.
   * The build already writes /data/products.json with everything needed, so
   * this filters that rather than adding any server.
   *
   * The button and the panel are both `hidden` in the markup and unhidden
   * here — with no JavaScript there is nothing to search with, so neither is
   * shown at all rather than showing a control that does nothing.
   */
  function initSearch() {
    var openBtn = $("[data-search-open]");
    var panel = $("[data-search]");
    if (!openBtn || !panel) return;

    var input = $("[data-search-input]", panel);
    var note = $("[data-search-note]", panel);
    var results = $("[data-search-results]", panel);
    var closeBtn = $("[data-search-close]", panel);

    var MAX_HITS = 12;
    var products = null;   // filled on first open
    var loading = false;

    openBtn.hidden = false;

    function setOpen(open) {
      panel.hidden = !open;
      openBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        load();
        input.focus();
        input.select();
      }
    }

    function load() {
      if (products || loading) return;
      loading = true;
      note.textContent = "Loading the catalogue…";
      fetch("/data/products.json")
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          products = (data && data.products) || [];
          loading = false;
          run();
        })
        .catch(function () {
          loading = false;
          products = null;
          note.textContent = "Search is unavailable right now. Browse the tabs above instead.";
          results.innerHTML = "";
        });
    }

    /** Everything about a piece worth typing: its name, section and tab. */
    function haystack(p) {
      return (p.name + " " + p.subcategoryName + " " + p.tabLabel).toLowerCase();
    }

    function run() {
      if (!products) return;
      var q = input.value.trim().toLowerCase();
      if (!q) {
        note.textContent = "Type to search " + products.length + " pieces.";
        results.innerHTML = "";
        return;
      }
      // Every word has to match somewhere, so "boys suit" narrows rather than
      // widening the way a single-substring match would.
      var terms = q.split(/\s+/);
      var hits = products.filter(function (p) {
        var hay = haystack(p);
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });

      if (!hits.length) {
        note.textContent = 'Nothing matches "' + input.value.trim() + '". Try a shorter word.';
        results.innerHTML = "";
        return;
      }

      note.textContent = hits.length === 1
        ? "1 piece found."
        : hits.length > MAX_HITS
          ? "Showing " + MAX_HITS + " of " + hits.length + " pieces — keep typing to narrow it."
          : hits.length + " pieces found.";

      results.innerHTML = "";
      hits.slice(0, MAX_HITS).forEach(function (p) {
        var a = document.createElement("a");
        a.className = "lp-search-hit";
        // Same guard render.js applies server-side: only ever a path on this
        // site. href is built from a filename today and cannot be typed in the
        // admin, but assigning a JSON string straight to .href is the one place
        // here a scheme could sneak in, so it is checked rather than trusted.
        a.href = /^\/[^/]/.test(String(p.href || "")) ? p.href : "#";

        var img = p.images && p.images[0];
        if (img) {
          var el = document.createElement("img");
          el.src = img.src;
          el.alt = "";
          el.loading = "lazy";
          a.appendChild(el);
        } else {
          var ph = document.createElement("div");
          ph.className = "lp-search-hit-ph";
          a.appendChild(ph);
        }

        var text = document.createElement("div");
        var t = document.createElement("div");
        t.className = "lp-search-hit-t";
        // textContent throughout: these are CMS values, and building the row
        // by hand keeps them out of any HTML parse.
        t.textContent = p.name;
        var sub = document.createElement("div");
        sub.className = "lp-search-hit-s";
        sub.textContent = p.tabLabel + " · " + p.subcategoryName + " · from " + money(p.minPrice) +
          (p.badge ? " · " + p.badge : "");
        text.appendChild(t);
        text.appendChild(sub);
        a.appendChild(text);
        results.appendChild(a);
      });
    }

    openBtn.addEventListener("click", function () { setOpen(panel.hidden); });
    if (closeBtn) closeBtn.addEventListener("click", function () {
      setOpen(false);
      openBtn.focus();
    });
    input.addEventListener("input", run);
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setOpen(false); openBtn.focus(); }
    });
  }

  /* --- boot ----------------------------------------------------------- */

  function boot() {
    // initSearch first, and deliberately. It reveals the search button, which
    // is `hidden` in the markup — and on a narrow screen that extra button
    // makes the nav wrap, so the header gets taller. initHeader measures the
    // header once and caches the height in --lp-header, which .lp-sticky uses
    // for both its top offset and its height. Measuring before the button
    // appeared left that value up to 44px short at 390px wide, and the sticky
    // header then clipped the hero headline on scroll.
    initSearch();
    initHeader();
    initStory();
    initCards();
    initShop();
    initDetail();
  }

  /**
   * Handed out so the admin's preview panel can wire the markup it renders.
   * Decap draws the preview into an iframe of its own, and a <script> tag
   * inserted as markup never runs there — so without this the panel showed a
   * product page whose size dropdown, accessory tick-box and total did nothing.
   * site/admin/preview.js loads this file into that iframe and calls these two
   * on each render.
   */
  window.LPBehaviour = { initCards: initCards, initDetail: initDetail };

  /**
   * The preview sets this before loading the file, because there it is a
   * library rather than a page: the panel re-renders on every keystroke and
   * calls the initialisers itself, so a self-boot would only wire the first
   * render and then double up on it.
   */
  if (!window.LP_NO_AUTOBOOT) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();

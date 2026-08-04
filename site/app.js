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

    /* One-way latch: minimise once past 120px, expand again only back at the
       very top. Without the latch, the reflow from minimising nudges scrollY
       across the threshold and the header flickers. */
    var latch = raf(function () {
      var y = window.scrollY || 0;
      var isMin = header.getAttribute("data-min") === "1";
      var next = isMin ? y >= 4 : y > 120;
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

  function paintCardPrice(card) {
    var select = $("[data-price-select]", card);
    var out = $("[data-price-out]", card);
    if (!select || !out) return;
    var opt = select.options[select.selectedIndex];
    if (opt) out.textContent = money(opt.getAttribute("data-price"));
  }

  function initCards() {
    $$("[data-product]").forEach(function (card) {
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
        sec._visible += sec._step;
        apply();
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
        apply();
      });
    });

    /* Max price */
    if (range) {
      range.addEventListener("input", function () {
        state.max = Number(range.value);
        if (rangeOut) rangeOut.textContent = money(state.max);
        sections.forEach(function (sec) { sec._visible = sec._initial; });
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
      apply();
    });

    apply();
  }

  /* --- 5. Product detail --------------------------------------------- */

  function initDetail() {
    var detail = $("[data-detail]");
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

      if (priceOut) priceOut.textContent = money(price);
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

  /* --- boot ----------------------------------------------------------- */

  function boot() {
    initHeader();
    initStory();
    initCards();
    initShop();
    initDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

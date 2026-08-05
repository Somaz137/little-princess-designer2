/**
 * The Photos button in the admin, wired to the ImageKit media library.
 *
 * WHY THIS FILE EXISTS
 *
 * Decap ships two external photo libraries in the box — Uploadcare and
 * Cloudinary — and ImageKit is not one of them. What Decap does ship is the
 * socket they both plug into: `CMS.registerMediaLibrary`, which takes an object
 * with a `show()` and a `hide()` and calls `show()` whenever an editor presses
 * "Choose an image". ImageKit, for its part, publishes its whole media library
 * as an embeddable widget. This file is the twenty lines of wiring between the
 * two, and nothing else in the project knows it is here.
 *
 * WHAT AN EDITOR SEES
 *
 * Press "Choose an image" on any photo row → ImageKit's own library opens over
 * the form, signed in to the shop's ImageKit account → drag a photo in or pick
 * one already there → press Insert → the address lands in the field. The photo
 * never touches this repository, which is the point: anything committed to git
 * stays in its history forever, even after it is deleted.
 *
 * WHAT IT NEEDS TO WORK
 *
 * A login to ImageKit, in the browser, once — the widget carries no keys and
 * asks for none, so there is nothing secret in this file or in config.yml, and
 * nothing to leak by publishing the admin. Two consequences worth knowing:
 *
 *   · The sign-in happens inside a frame from imagekit.io, so a browser set to
 *     block third-party cookies will refuse it. Chrome's incognito blocks them
 *     by default. The way out is an ordinary window, or the "…or paste an image
 *     link" field, which never stops working.
 *   · Every editor needs their own ImageKit login. Invite them from the
 *     ImageKit dashboard the same way they were invited on DecapBridge.
 *
 * IF THE LIBRARY WILL NOT OPEN
 *
 * Nothing here can lose an editor's work: the picker either opens or says why,
 * and the paste-a-link field beside it is unaffected either way.
 */

(function () {
  "use strict";

  // Written against the widget pinned in index.html. `data` is the list of
  // chosen files, each with `url` — the full delivery address, which is exactly
  // what the site wants to store.
  var INSERT = "INSERT";

  /**
   * Reads the `media_library.config` block out of config.yml. Every value is
   * optional — with an empty block the library still opens, at the top of
   * whatever the account holds.
   */
  function settingsFrom(config) {
    var ml = {
      // One photo per row. The form has a row per photo, so multi-select would
      // put several addresses into one field and lose all but the first.
      multiple: false
    };

    // Which ImageKit account to open. Without it the widget asks the editor to
    // pick, which is one more question than a single-account shop needs.
    if (config.imagekit_id) ml.widgetImagekitId = String(config.imagekit_id);

    // Skips the email-and-password form for accounts that sign in with Google
    // or Microsoft. Wrong for a password account — it would send them down a
    // route they cannot finish — so it stays off unless asked for.
    if (config.sso) ml.loginViaSSO = true;

    // Opens straight into a folder instead of the library root.
    if (config.folder) ml.initialView = { folderPath: String(config.folder) };

    return ml;
  }

  function init(args) {
    args = args || {};
    var options = args.options || {};
    var handleInsert = args.handleInsert;
    var config = options.config || {};
    var mlSettings = settingsFrom(config);
    var widget = null;

    /**
     * The widget is built on first use rather than on page load: constructing
     * it creates a frame that starts loading imagekit.io, and most visits to
     * the admin never open a photo picker at all.
     */
    function build() {
      if (widget) return widget;
      if (!window.IKMediaLibraryWidget) return null;

      var host = document.createElement("div");
      host.id = "lp-imagekit";
      document.body.appendChild(host);

      widget = new window.IKMediaLibraryWidget(
        {
          container: host,
          view: "modal",
          // Decap already draws the button that opens this; a second one would
          // sit loose at the bottom of the page.
          renderOpenButton: false,
          dimensions: { height: "100%", width: "100%" },
          mlSettings: mlSettings
        },
        function (payload) {
          // Closing the library fires this too, with no chosen files.
          if (!payload || payload.eventType !== INSERT) return;
          var files = payload.data || [];
          var urls = [];
          for (var i = 0; i < files.length; i++) {
            if (files[i] && files[i].url) urls.push(files[i].url);
          }
          if (urls.length) handleInsert(urls.length === 1 ? urls[0] : urls);
        }
      );
      return widget;
    }

    return {
      show: function () {
        var w = build();
        if (!w) {
          // The one failure worth explaining: the widget script did not load,
          // so the button would otherwise do nothing at all when pressed.
          window.alert(
            "The ImageKit photo library could not load — check your internet " +
            "connection and reload the page.\n\n" +
            "You can still add a photo by pasting its address into the " +
            "“…or paste an image link” field."
          );
          return;
        }
        w.open();
      },
      hide: function () {
        // The widget closes itself on Insert and on its own close button, and
        // exposes no close of its own. Decap calls this when the editor
        // navigates away mid-pick; hiding the frame is enough.
        var host = document.getElementById("lp-imagekit");
        var modal = host && host.querySelector(".ik-media-library-widget-modal");
        if (modal) modal.style.display = "none";
      },
      // Puts a "Media" button in the top bar, which opens the library on its
      // own so photos can be uploaded ahead of writing the product they belong
      // to. Inserting from there has nothing to insert into and does nothing —
      // that is Decap's behaviour for every external library, not ours.
      enableStandalone: function () { return true; }
    };
  }

  if (window.CMS && window.CMS.registerMediaLibrary) {
    window.CMS.registerMediaLibrary({ name: "imagekit", init: init });
  }
})();

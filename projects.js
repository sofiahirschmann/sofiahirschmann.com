/* ============================================================================
 * projects.js
 * ----------------------------------------------------------------------------
 * Living gallery for sofiahirschmann.com/projects.
 *
 * Each .project-tile embeds its real deployed app in an iframe rendered at the
 * app's natural viewport size (data-vw × data-vh) and scaled down with a CSS
 * transform to fit the tile — a wall of tiny working machines.
 *
 *   • Lazy boot:  an IntersectionObserver assigns iframe src only when a tile
 *                 nears the viewport; on load the poster cross-fades away.
 *   • Scaling:    one shared ResizeObserver keeps --s = tileWidth / naturalWidth
 *                 so the miniature is always a faithful, sharp render.
 *   • Inert grid: grid iframes never receive pointer events; the whole screen
 *                 is a button that opens an interactive <dialog> lightbox.
 *
 * Pure vanilla JS. No dependencies.
 * ==========================================================================*/
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var tiles = Array.prototype.slice.call(document.querySelectorAll('.project-tile'));
  if (!tiles.length) return;

  // Entrance styles only apply once JS is known to be running, so tiles are
  // never stuck invisible if this script fails to load.
  document.body.classList.add('js-anim');

  // ---- Entrance choreography: tiles rise in as they reach the viewport ----
  var entrance = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      entrance.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  tiles.forEach(function (tile, i) {
    if (!REDUCED) tile.style.setProperty('--enter-delay', (i % 3) * 110 + 'ms');
    entrance.observe(tile);
  });

  // ---- Keep each miniature at scale = tileWidth / naturalWidth ------------
  var screens = tiles
    .map(function (t) { return t.querySelector('.tile-viewport'); })
    .filter(Boolean);

  var sizer = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var tile = entry.target.closest('.project-tile');
      var vw = parseInt(tile.getAttribute('data-vw'), 10) || 1280;
      entry.target.style.setProperty('--s', entry.contentRect.width / vw);
    });
  });
  screens.forEach(function (s) { sizer.observe(s); });

  // ---- Lazy boot: mount the live app when the tile approaches -------------
  var boot = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      boot.unobserve(entry.target);
      mount(entry.target);
    });
  }, { rootMargin: '600px 0px' });

  tiles.forEach(function (t) { boot.observe(t); });

  function mount(tile) {
    var viewport = tile.querySelector('.tile-viewport');
    var src = tile.getAttribute('data-src');
    if (!viewport || !src || tile.classList.contains('is-live')) return;

    var vw = parseInt(tile.getAttribute('data-vw'), 10) || 1280;
    var vh = parseInt(tile.getAttribute('data-vh'), 10) || 800;

    var iframe = document.createElement('iframe');
    iframe.className = 'tile-iframe';
    iframe.width = vw;
    iframe.height = vh;
    iframe.loading = 'lazy';
    iframe.setAttribute('tabindex', '-1');            // the button is the control
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', '');
    iframe.addEventListener('load', function () {
      // Small stagger so neighbouring screens switch on one after another.
      var delay = REDUCED ? 0 : (mount.booted = (mount.booted || 0) + 1) % 3 * 140;
      setTimeout(function () { tile.classList.add('is-live'); }, delay);
    });
    iframe.src = src;
    viewport.appendChild(iframe);
  }

  // ---- Detail lightbox: one <dialog>, repopulated per tile -----------------
  var dialog = document.getElementById('project-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var dTitle  = dialog.querySelector('.dialog-title');
  var dMeta   = dialog.querySelector('.dialog-meta');
  var dDesc   = dialog.querySelector('.dialog-desc');
  var dFrame  = dialog.querySelector('.dialog-iframe');
  var dScreen = dialog.querySelector('.dialog-screen');
  var dGit    = dialog.querySelector('.dialog-github');
  var dLive   = dialog.querySelector('.dialog-live');

  tiles.forEach(function (tile) {
    var btn = tile.querySelector('.tile-screen');
    if (!btn) return;
    btn.addEventListener('click', function () { open(tile); });
  });

  function open(tile) {
    var name = tile.querySelector('.tile-name');
    var meta = tile.querySelector('.tile-meta');
    var desc = tile.querySelector('.tile-desc');
    var detail = tile.querySelector('.tile-detail');
    var repo = tile.querySelector('.tile-repo');
    var src = tile.getAttribute('data-src');

    dTitle.textContent = name ? name.textContent : '';
    // Meta line without the trailing "GitHub ↗" link text.
    dMeta.textContent = meta ? meta.textContent.replace(/GitHub\s*↗\s*$/, '').trim() : '';
    // Lede (the one-liner) followed by the longer story.
    dDesc.innerHTML =
      (desc ? '<p class="dialog-lede">' + desc.innerHTML + '</p>' : '') +
      (detail ? detail.innerHTML : '');
    dGit.href = repo ? repo.href : 'https://github.com/sofiahirschmann';
    dLive.href = src;

    dFrame.setAttribute('title', (name ? name.textContent : 'Project') + ' — live demo');
    dFrame.src = src;

    dialog.showModal();
  }

  // Stop the embedded app (audio, rafs) as soon as the dialog closes.
  dialog.addEventListener('close', function () { dFrame.src = 'about:blank'; });

  dialog.querySelector('.dialog-close').addEventListener('click', function () {
    dialog.close();
  });

  // Native <dialog> handles Esc; add light-dismiss on backdrop click.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });
})();

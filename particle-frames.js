/* ============================================================================
 * particle-frames.js
 * ----------------------------------------------------------------------------
 * Geometric particle field for sofiahirschmann.com.
 *
 *   • Hero:  particles drift as a loose connected web; the cursor parts them
 *            like a hand moving through water (motion-driven, no static ring).
 *   • Scroll into the About section: the particles fly into place and draw two
 *            clean rectangles — one framing the headshot, one framing the bio —
 *            tracking those elements live. The web fades out as the boxes form;
 *            the boxes are static once formed and dissolve again on scroll-up.
 *
 * Pure vanilla JS + <canvas>. No dependencies. (This is NOT particles.js — it's
 * a custom system, because particles.js can't morph particles into target
 * shapes.)
 *
 * USAGE
 *   1. Drop this file in your site and load it once, at the end of <body>:
 *        <script src="particle-frames.js" defer></script>
 *   2. Make sure the three selectors below match your markup (see CONFIG).
 *   3. Ensure your hero/about content sits ABOVE the canvas. The script gives
 *      the canvas z-index:0; give your page sections position:relative;z-index:1
 *      (the handoff notes include the exact CSS).
 * ==========================================================================*/
(function () {
  'use strict';

  // ---- CONFIG ---------------------------------------------------------------
  var CONFIG = {
    // Selectors into YOUR existing markup:
    aboutSelector:    '.section.about',  // section used for scroll progress
    portraitSelector: '.about-portrait', // element the first rectangle frames
    bioSelector:      '.about-text',     // element the second rectangle frames

    color: '#6F9FC2',   // muted sky-blue, matches the calm palette
    count: 420,         // total particles
    cursorRepel: 80,    // wake strength (0 = off)
    repelRadius: 235,   // cursor influence radius in px
    linkDistance: 92,   // max distance for a connecting line (shorter = sparser)
  };

  // Respect users who prefer reduced motion: render the formed state, no drift.
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    var aboutEl    = document.querySelector(CONFIG.aboutSelector);
    var portraitEl = document.querySelector(CONFIG.portraitSelector);
    var bioEl      = document.querySelector(CONFIG.bioSelector);
    if (!aboutEl || !portraitEl || !bioEl) {
      // Selectors didn't match — bail quietly rather than throw.
      return;
    }

    // ---- Canvas ----
    var canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext('2d');
    var dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.round(window.innerWidth  * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // ---- Particles ----
    var count = CONFIG.count;
    var nA = Math.round(count * 0.32);   // headshot frame
    var nB = Math.round(count * 0.40);   // bio frame
    var nAmb = Math.max(0, count - nA - nB);

    var W = window.innerWidth, H = window.innerHeight;
    var parts = [];
    function mk(group, frac) {
      return {
        group: group, frac: frac,
        fx: Math.random() * W, fy: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.26, vy: (Math.random() - 0.5) * 0.26,
        rx: 0, ry: 0,
        ox: 0, oy: 0,                        // smoothed cursor-wake offset
        r: 0.7 + Math.random() * 0.7,        // much smaller dots
        a: 0.6 + Math.random() * 0.22,       // lighter, so hero text stays legible
      };
    }
    var i;
    for (i = 0; i < nA; i++)   parts.push(mk('A', i / nA));
    for (i = 0; i < nB; i++)   parts.push(mk('B', i / nB));
    for (i = 0; i < nAmb; i++) parts.push(mk('amb', 0));

    // ---- Cursor (motion-driven wake) ----
    var mouse = { x: -9999, y: -9999 };
    var mv = { x: 0, y: 0 };
    var mvSpeed = 0;
    window.addEventListener('mousemove', function (e) {
      if (mouse.x > -9000) { mv.x += (e.clientX - mouse.x); mv.y += (e.clientY - mouse.y); }
      mouse.x = e.clientX; mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('mouseout', function () {
      mouse.x = -9999; mouse.y = -9999; mv.x = 0; mv.y = 0;
    }, { passive: true });

    var rgb = hexToRgb(CONFIG.color);
    var RGB = rgb.r + ',' + rgb.g + ',' + rgb.b;

    // Point along a rectangle's perimeter at fraction f (clockwise from TL).
    function perim(rect, f) {
      var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
      var per = 2 * (w + h);
      var d = f * per;
      if (d < w) return [x + d, y];
      d -= w;
      if (d < h) return [x + w, y + d];
      d -= h;
      if (d < w) return [x + w - d, y + h];
      d -= w;
      return [x, y + h - d];
    }
    function rectFor(el, pad) {
      var r = el.getBoundingClientRect();
      return { x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad };
    }

    function loop() {
      var Wn = window.innerWidth, Hn = window.innerHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wn, Hn);

      // Scroll progress -> formation amount te (0 scattered, 1 formed).
      var te = 0;
      var top = aboutEl.getBoundingClientRect().top;
      var raw = (Hn - top) / (Hn * 0.85);
      raw = Math.min(Math.max(raw, 0), 1);
      te = raw * raw * (3 - 2 * raw);          // smoothstep
      if (REDUCED) te = raw >= 0.5 ? 1 : 0;    // no mid-flight motion

      var rectA = rectFor(portraitEl, 20);
      var rectB = rectFor(bioEl, 24);

      // Decay cursor velocity (water settles when the hand stops).
      mv.x *= 0.86; mv.y *= 0.86;
      mvSpeed = Math.sqrt(mv.x * mv.x + mv.y * mv.y);
      if (mvSpeed > 70) { var s = 70 / mvSpeed; mv.x *= s; mv.y *= s; mvSpeed = 70; }

      var p, t;
      for (var n = 0; n < parts.length; n++) {
        p = parts[n];
        if (!REDUCED) {
          p.fx += p.vx; p.fy += p.vy;
          if (p.fx < -20) p.fx = Wn + 20; else if (p.fx > Wn + 20) p.fx = -20;
          if (p.fy < -20) p.fy = Hn + 20; else if (p.fy > Hn + 20) p.fy = -20;
        }
        var tx = p.fx, ty = p.fy;
        if (p.group === 'A') { t = perim(rectA, p.frac); tx = t[0]; ty = t[1]; }
        else if (p.group === 'B') { t = perim(rectB, p.frac); tx = t[0]; ty = t[1]; }
        var amt = p.group === 'amb' ? 0 : te;
        var rx = p.fx + (tx - p.fx) * amt;
        var ry = p.fy + (ty - p.fy) * amt;

        // Cursor wake — push along motion, only while loose (te < 1).
        // We compute a *desired* offset, then ease the particle's persistent
        // offset toward it (low-pass filter) so the parting builds and settles
        // smoothly instead of snapping frame-to-frame.
        var formAmt = 1 - te;
        var desOx = 0, desOy = 0;
        if (!REDUCED && formAmt > 0.02 && mvSpeed > 0.4 && CONFIG.cursorRepel > 0) {
          var dx = rx - mouse.x, dy = ry - mouse.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < CONFIG.repelRadius * CONFIG.repelRadius) {
            var d = Math.sqrt(d2) || 1;
            var wgt = 1 - d / CONFIG.repelRadius;
            var prox = wgt * wgt * formAmt;
            var dirK = CONFIG.cursorRepel / 26;
            var radK = prox * mvSpeed * (CONFIG.cursorRepel / 520);
            desOx = mv.x * prox * dirK + (dx / d) * radK;
            desOy = mv.y * prox * dirK + (dy / d) * radK;
            desOx = Math.max(-150, Math.min(150, desOx));
            desOy = Math.max(-150, Math.min(150, desOy));
          }
        }
        p.ox += (desOx - p.ox) * 0.16;
        p.oy += (desOy - p.oy) * 0.16;
        rx += p.ox; ry += p.oy;
        p.rx = rx; p.ry = ry;
      }

      // 1) Proximity web + compact-triangle shading (fade out as boxes form).
      var webA = (1 - te) * 0.52;
      if (webA > 0.01) {
        var D = CONFIG.linkDistance, D2 = D * D;
        var N = parts.length;
        var neigh = [];
        for (i = 0; i < N; i++) neigh.push([]);
        ctx.lineWidth = 1;
        var segs = [];
        for (i = 0; i < N; i++) {
          var a = parts[i];
          for (var j = i + 1; j < N; j++) {
            var b = parts[j];
            var ddx = a.rx - b.rx, ddy = a.ry - b.ry;
            var dd = ddx * ddx + ddy * ddy;
            if (dd < D2) { neigh[i].push(j); neigh[j].push(i); segs.push([i, j, Math.sqrt(dd)]); }
          }
        }
        // Shade only COMPACT triangles (all edges well within link distance).
        var triA = webA * 0.1;
        var TD2 = (D * 0.58) * (D * 0.58);
        ctx.fillStyle = 'rgba(' + RGB + ',' + triA.toFixed(3) + ')';
        for (i = 0; i < N; i++) {
          var ni = neigh[i], pi = parts[i];
          for (var aa = 0; aa < ni.length; aa++) {
            var jj = ni[aa]; if (jj < i) continue;
            var pj = parts[jj];
            var ex = pi.rx - pj.rx, ey = pi.ry - pj.ry;
            if (ex * ex + ey * ey > TD2) continue;
            for (var bb = aa + 1; bb < ni.length; bb++) {
              var kk = ni[bb]; if (kk < i) continue;
              var pk = parts[kk];
              ex = pi.rx - pk.rx; ey = pi.ry - pk.ry;
              if (ex * ex + ey * ey > TD2) continue;
              var tdx = pj.rx - pk.rx, tdy = pj.ry - pk.ry;
              if (tdx * tdx + tdy * tdy < TD2) {
                ctx.beginPath();
                ctx.moveTo(pi.rx, pi.ry); ctx.lineTo(pj.rx, pj.ry); ctx.lineTo(pk.rx, pk.ry);
                ctx.closePath(); ctx.fill();
              }
            }
          }
        }
        for (var sg = 0; sg < segs.length; sg++) {
          var pa = parts[segs[sg][0]], pb = parts[segs[sg][1]], dist = segs[sg][2];
          ctx.strokeStyle = 'rgba(' + RGB + ',' + (webA * (1 - dist / D)).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(pa.rx, pa.ry); ctx.lineTo(pb.rx, pb.ry); ctx.stroke();
        }
      }

      // 2) Rectangle outlines (fade in as boxes form).
      var edgeA = te * 0.72;
      if (edgeA > 0.01) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(' + RGB + ',' + edgeA.toFixed(3) + ')';
        drawLoop(parts.filter(function (q) { return q.group === 'A'; }));
        drawLoop(parts.filter(function (q) { return q.group === 'B'; }));
      }

      // 3) Dots.
      for (var m = 0; m < parts.length; m++) {
        p = parts[m];
        var alpha = p.a * (0.5 + 0.5 * (p.group === 'amb' ? 1 - te * 0.7 : 1));
        ctx.fillStyle = 'rgba(' + RGB + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.rx, p.ry, p.r, 0, Math.PI * 2); ctx.fill();
      }

      requestAnimationFrame(loop);
    }

    function drawLoop(list) {
      if (list.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(list[0].rx, list[0].ry);
      for (var k = 1; k < list.length; k++) ctx.lineTo(list[k].rx, list[k].ry);
      ctx.closePath();
      ctx.stroke();
    }

    requestAnimationFrame(loop);
  }

  function hexToRgb(hex) {
    var m = hex.replace('#', '');
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    var num = parseInt(m, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

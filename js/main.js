/* Михайловск — Уральская Швейцария. Скрипты: мобильное меню, лайтбокс, анимации. */
(function () {
  "use strict";

  /* ---- мобильное меню ---- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", function () {
      header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", header.classList.contains("open"));
    });
  }

  /* ---- лайтбокс для галереи ----
     Работает по элементам <figure data-full="..." data-cap="...">.
     Масштаб: колесо мыши или щипок, двойное нажатие — приблизить/вернуть,
     при увеличении картинку можно перетаскивать. */
  var lb = document.createElement("div");
  lb.className = "lb";
  lb.innerHTML =
    '<button class="close" type="button" aria-label="Закрыть">✕</button>' +
    '<button class="prev" type="button" aria-label="Предыдущее">‹</button>' +
    '<button class="next" type="button" aria-label="Следующее">›</button>' +
    '<span class="idx"></span>' +
    '<img src="" alt="" draggable="false">' +
    '<p class="cap"></p>' +
    '<p class="hint">Колесо или щипок — масштаб · двойное нажатие — приблизить · тянуть — передвинуть</p>';
  document.body.appendChild(lb);

  var lbImg = lb.querySelector("img");
  var lbCap = lb.querySelector(".cap");
  var lbIdx = lb.querySelector(".idx");
  var group = [];
  var current = 0;

  /* масштаб и сдвиг: визуальный центр картинки = base + (tx, ty),
     base — положение без трансформации, замеряется при scale = 1 */
  var SCALE_MAX = 5;
  var scale = 1, tx = 0, ty = 0;
  var baseCx = 0, baseCy = 0;
  var pointers = new Map();
  var pinchPrev = null;
  var moved = false;
  var lastTap = 0, lastTapX = 0, lastTapY = 0;
  var lastPointerType = "";
  var animTimer = 0;

  function apply() {
    lbImg.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  /* на время непрерывного жеста отключаем плавную анимацию трансформа */
  function noAnim() {
    lbImg.style.transition = "none";
    clearTimeout(animTimer);
    animTimer = setTimeout(function () { lbImg.style.transition = ""; }, 180);
  }

  function animZoom(cx, cy, f) {
    clearTimeout(animTimer);
    lbImg.style.transition = "";
    zoomAt(cx, cy, f);
  }

  function measureBase() {
    var r = lbImg.getBoundingClientRect();
    baseCx = r.left + r.width / 2;
    baseCy = r.top + r.height / 2;
  }

  /* картинка не уезжает за пределы экрана: когда она меньше окна — остаётся
     целиком видимой, когда больше — всегда закрывает окно без щелей */
  function clampPan() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var hx = lbImg.offsetWidth * scale / 2;
    var hy = lbImg.offsetHeight * scale / 2;
    var lo = Math.min(hx - baseCx, vw - hx - baseCx);
    var hi = Math.max(hx - baseCx, vw - hx - baseCx);
    tx = Math.min(hi, Math.max(lo, tx));
    lo = Math.min(hy - baseCy, vh - hy - baseCy);
    hi = Math.max(hy - baseCy, vh - hy - baseCy);
    ty = Math.min(hi, Math.max(lo, ty));
  }

  function zoomAt(cx, cy, factor) {
    var ns = Math.min(SCALE_MAX, Math.max(1, scale * factor));
    if (ns === scale) return;
    var k = ns / scale;
    var qx = cx - baseCx, qy = cy - baseCy;
    tx = qx * (1 - k) + tx * k;
    ty = qy * (1 - k) + ty * k;
    scale = ns;
    if (scale <= 1.001) { tx = 0; ty = 0; }
    lb.classList.toggle("is-zoomed", scale > 1.001);
    clampPan();
    apply();
  }

  function resetZoom() {
    scale = 1; tx = 0; ty = 0; pinchPrev = null;
    lb.classList.remove("is-zoomed", "is-dragging");
    lbImg.style.transition = "";
    apply();
  }

  function show(i) {
    current = (i + group.length) % group.length;
    var fig = group[current];
    var full = fig.getAttribute("data-full");
    var cap = fig.getAttribute("data-cap") || "";
    resetZoom();
    lbImg.src = full;
    lbImg.alt = cap;
    lbCap.textContent = cap;
    lbIdx.textContent = (current + 1) + " / " + group.length;
  }

  /* размер и центр замеряем, когда новая картинка уже отрисована */
  lbImg.addEventListener("load", function () {
    if (scale === 1 && tx === 0 && ty === 0) measureBase();
  });

  function openLb(fig) {
    var album = fig.closest("[data-album]") || document;
    group = Array.prototype.slice.call(album.querySelectorAll("[data-full]"));
    show(group.indexOf(fig));
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLb() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    resetZoom();
    moved = false;
    lbImg.src = "";
  }

  /* --- масштаб колесом (к точке под курсором) --- */
  lb.addEventListener("wheel", function (e) {
    if (!lb.classList.contains("open")) return;
    e.preventDefault();
    noAnim();
    var d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    zoomAt(e.clientX, e.clientY, Math.pow(1.0022, -d));
  }, { passive: false });

  /* --- перетаскивание и щипок --- */
  lb.addEventListener("pointerdown", function (e) {
    if (!lb.classList.contains("open") || e.target.closest(".lb button")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 2) {
      var pts = Array.prototype.slice.call(pointers.values());
      pinchPrev = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2
      };
    } else if (scale > 1) {
      lb.classList.add("is-dragging");
    }
  });

  lb.addEventListener("pointermove", function (e) {
    var prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchPrev) {
      var pts = Array.prototype.slice.call(pointers.values());
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      var mx = (pts[0].x + pts[1].x) / 2;
      var my = (pts[0].y + pts[1].y) / 2;
      moved = true;
      noAnim();
      tx += mx - pinchPrev.mx;
      ty += my - pinchPrev.my;
      if (dist > 0 && pinchPrev.dist > 0) zoomAt(mx, my, dist / pinchPrev.dist);
      else { clampPan(); apply(); }
      pinchPrev = { dist: dist, mx: mx, my: my };
    } else if (pointers.size === 1 && scale > 1) {
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (dx || dy) {
        moved = true;
        noAnim();
        tx += dx;
        ty += dy;
        clampPan();
        apply();
      }
    }
  });

  function endPointer(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinchPrev = null;
    if (pointers.size === 0) lb.classList.remove("is-dragging");
    lastPointerType = e.pointerType;
    /* двойной тап пальцем/стилусом: приблизить к точке или вернуть как было.
       Для мыши используется событие dblclick ниже. */
    if (!moved && e.pointerType !== "mouse") {
      var now = Date.now();
      var dbl = now - lastTap < 350 &&
        Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 44;
      lastTap = dbl ? 0 : now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;
      if (dbl) {
        if (scale > 1) animZoom(e.clientX, e.clientY, 1 / scale);
        else animZoom(e.clientX, e.clientY, 2.6);
      }
    }
  }
  lb.addEventListener("pointerup", endPointer);
  lb.addEventListener("pointercancel", endPointer);

  /* двойной клик мышью по картинке */
  lb.addEventListener("dblclick", function (e) {
    if (!lb.classList.contains("open")) return;
    if (!e.target.closest(".lb img")) return;
    if (lastPointerType === "touch" || lastPointerType === "pen") return;
    if (scale > 1) animZoom(e.clientX, e.clientY, 1 / scale);
    else animZoom(e.clientX, e.clientY, 2.6);
  });

  window.addEventListener("resize", function () {
    if (!lb.classList.contains("open")) return;
    if (scale === 1) { tx = 0; ty = 0; apply(); measureBase(); }
    else { clampPan(); apply(); }
  });

  document.addEventListener("click", function (e) {
    var fig = e.target.closest("[data-full]");
    if (fig) { openLb(fig); return; }
    if (e.target.closest(".lb .close")) closeLb();
    if (e.target.closest(".lb .prev")) show(current - 1);
    if (e.target.closest(".lb .next")) show(current + 1);
    if (moved) { moved = false; return; } /* после перетаскивания фон не закрывает */
    if (e.target === lb) closeLb();
  });

  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
    if (e.key === "+" || e.key === "=") animZoom(baseCx, baseCy, 1.45);
    if (e.key === "-") animZoom(baseCx, baseCy, 1 / 1.45);
    if (e.key === "0" && scale > 1) animZoom(baseCx, baseCy, 1 / scale);
  });

  /* ---- плавное появление блоков при прокрутке ----
     Класс reveal добавляется скриптом, поэтому без JS всё просто видно. */
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var revealTargets = Array.prototype.slice.call(document.querySelectorAll([
    ".hero .inner",
    ".hero-facts .cell",
    ".sec-head",
    ".cards .card",
    ".split > div",
    ".split > figure",
    ".ph-row > figure",
    ".timeline .event",
    ".dl .item",
    ".route",
    ".dir .row",
    "figure.fig",
    ".album > h3",
    ".album > .count",
    ".masonry > figure",
    ".table",
    ".form-note",
    ".poi .item",
    ".cta-strip .in > *"
  ].join(",")));

  var seen = new Set();
  revealTargets = revealTargets.filter(function (el) {
    if (seen.has(el)) return false;
    seen.add(el);
    return true;
  });

  if (!reduceMotion && "IntersectionObserver" in window) {
    var byParent = new Map();
    revealTargets.forEach(function (el) {
      var fadeOnly = el.closest(".masonry") !== null; /* в колонках — только прозрачность */
      el.classList.add("reveal");
      if (fadeOnly) el.classList.add("reveal-fade");
      var parent = el.parentElement;
      var idx = byParent.get(parent) || 0;
      byParent.set(parent, idx + 1);
      el.style.setProperty("--rd", Math.min(idx, 7) * 75 + "ms");
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.06 });

    revealTargets.forEach(function (el) { io.observe(el); });
  }
  /* без observer или при reduced-motion блоки остаются видимыми по умолчанию */
})();

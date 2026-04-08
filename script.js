/** Keep index at scroll top when there is no hash (e.g. back from a work page). */
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.addEventListener("pageshow", (e) => {
  if (e.persisted && !location.hash) {
    window.scrollTo(0, 0);
  }
});

const headerActions = document.querySelector(".header-actions");
const fullViewBtn = document.querySelector(".header-action--full-view");
const listViewBtn = document.querySelector(".header-action--list-view");

function setActive(btn) {
  const buttons = [fullViewBtn, listViewBtn].filter(Boolean);
  for (const b of buttons) {
    const isActive = b === btn;
    b.classList.toggle("is-active", isActive);
    b.setAttribute("aria-pressed", String(isActive));
  }
}

headerActions?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.(".header-action");
  if (!btn) return;
  setActive(btn);
});

const pixelCursor = document.getElementById("pixel-cursor");
document.addEventListener("mousemove", (e) => {
  if (!pixelCursor) return;
  pixelCursor.style.left = `${e.clientX}px`;
  pixelCursor.style.top = `${e.clientY}px`;
  pixelCursor.classList.toggle("is-work", Boolean(e.target.closest(".col-project")));
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const colEls = Array.from(document.querySelectorAll(".col"));
const stateByCol = new Map();

/** Viewport Y where the column top sits by default (0 = top). Below 0.5 = column block sits higher. */
const COLUMN_TOP_ANCHOR_FRAC = 0.46;

function getColState(col) {
  let s = stateByCol.get(col);
  if (s) return s;
  // y is the visual translateY of the whole column (px)
  s = { y: 0, targetY: 0, raf: 0 };
  stateByCol.set(col, s);
  return s;
}

/** Viewport Y of the column's layout top (ignores current translateY). */
function getLayoutTop(col) {
  const s = getColState(col);
  const r = col.getBoundingClientRect();
  return r.top - s.y;
}

/**
 * Scroll range: default y = baseline puts the column top on COLUMN_TOP_ANCHOR_FRAC × viewport height.
 * minY moves the column up until its bottom hits the center line.
 */
function computeBounds(col) {
  const h = col.offsetHeight;
  const anchorY = window.innerHeight * COLUMN_TOP_ANCHOR_FRAC;
  const baselineY = anchorY - getLayoutTop(col);
  return { minY: baselineY - h, maxY: baselineY };
}

function renderCol(col) {
  const s = getColState(col);
  col.style.transform = `translateY(${s.y}px)`;
}

function tickCol(col) {
  const s = getColState(col);
  s.raf = 0;
  const ease = 0.14;
  s.y += (s.targetY - s.y) * ease;
  if (Math.abs(s.targetY - s.y) < 0.25) s.y = s.targetY;
  renderCol(col);
  if (s.y !== s.targetY) s.raf = requestAnimationFrame(() => tickCol(col));
}

function setColTarget(col, nextY) {
  const s = getColState(col);
  const { minY, maxY } = computeBounds(col);
  s.targetY = clamp(nextY, minY, maxY);
  if (!s.raf) s.raf = requestAnimationFrame(() => tickCol(col));
}

/** Snap columns so the top edge sits on the viewport vertical center (default scroll position). */
function applyColumnCentering() {
  for (const col of colEls) {
    const s = getColState(col);
    const { minY, maxY } = computeBounds(col);
    s.targetY = maxY;
    s.y = maxY;
    renderCol(col);
  }
}

function initColumnPositions() {
  applyColumnCentering();
}

requestAnimationFrame(() => {
  requestAnimationFrame(initColumnPositions);
});

window.addEventListener("load", () => {
  requestAnimationFrame(initColumnPositions);
});

if (typeof ResizeObserver !== "undefined" && colEls.length) {
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      for (const col of colEls) {
        const s = getColState(col);
        const { minY, maxY } = computeBounds(col);
        s.targetY = clamp(s.targetY, minY, maxY);
        s.y = clamp(s.y, minY, maxY);
        renderCol(col);
      }
    });
  });
  for (const col of colEls) ro.observe(col);
}

function findColumnForClientX(clientX) {
  for (const col of colEls) {
    const r = col.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right) return col;
  }
  return null;
}

// Scroll the column based on horizontal "band", regardless of Y position.
window.addEventListener(
  "wheel",
  (e) => {
    const col = findColumnForClientX(e.clientX);
    if (!col) return;

    e.preventDefault();
    const s = getColState(col);
    // deltaY > 0 scroll down => move column up (reduce y)
    setColTarget(col, s.targetY - e.deltaY);
  },
  { passive: false }
);

window.addEventListener("resize", () => {
  for (const col of colEls) {
    const s = getColState(col);
    const { minY, maxY } = computeBounds(col);
    s.targetY = clamp(s.targetY, minY, maxY);
    s.y = clamp(s.y, minY, maxY);
    renderCol(col);
  }
});

/** Order: row by row — left→right across columns, then next row down (row-major). */
function syncProjectNumbers() {
  const cols = Array.from(document.querySelectorAll("main.columns > .col"));
  const perCol = cols.map((col) =>
    Array.from(col.querySelectorAll(".col-projects .col-project"))
  );
  const maxRows = perCol.length ? Math.max(...perCol.map((list) => list.length)) : 0;
  let n = 0;
  for (let row = 0; row < maxRows; row++) {
    for (let c = 0; c < perCol.length; c++) {
      const article = perCol[c][row];
      if (!article) continue;
      const numEl = article.querySelector(".col-project__num");
      if (!numEl) continue;
      n += 1;
      numEl.textContent = String(n).padStart(2, "0");
    }
  }
}

syncProjectNumbers();

document.querySelectorAll("[data-home-reload]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    location.reload();
  });
});

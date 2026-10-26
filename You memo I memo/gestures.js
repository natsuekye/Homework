
const HOLD_MS = 1000;
const TAP_MS = 450;
const MOVE_TOL = 8;
const SWIPE_DOWN_PX = 90;
const FROST_HOLD_MS = 700;

const G = { ptrs: new Map(), mode: "idle", single: null, dbl: null, openHold: null, drawing: null, shelf: null };
const DBLTAP_MS = 330;
const TAPQ = { t: 0, x: 0, y: 0, timer: null };
function cancelDot() { if (TAPQ.timer) { clearTimeout(TAPQ.timer); TAPQ.timer = null; } }
const CUE = { breathP: 0, bx: 0, by: 0, br: 0, frostP: 0, fx: 0, fy: 0, fr: 0 };

function centroid() {
  let x = 0, y = 0, n = 0;
  G.ptrs.forEach((p) => { x += p.x; y += p.y; n++; });
  return { x: x / n, y: y / n };
}

function bindGestures(el) {
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

function writeY(y) { return Math.min(y, sillTop() - 1); }

function onDown(e) {
  e.preventDefault();
  try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
  const now = performance.now();
  G.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.pointerType === "mouse" && e.shiftKey && !G.ptrs.has("v")) {
    G.ptrs.set("v", { x: e.clientX + 36, y: e.clientY + 10 });
  }

  if (G.mode === "idle") {
    if (DROPS.open) {
      G.mode = "open";
      G.openHold = { t0: now, sx: e.clientX, sy: e.clientY };
      return;
    }
    if (DROPS.shelf.open) {
      G.mode = "shelf";
      G.shelf = { t0: now, sx: e.clientX, sy: e.clientY, s0: DROPS.shelf.scroll, moved: false };
      return;
    }
    if (G.ptrs.size >= 2) {
      beginDouble(now);
      return;
    }

    if (activeText() && textHandleAt(e.clientX, e.clientY)) {
      beginTextDrag("size", e.clientX, e.clientY, activeText());
      G.mode = "single";
      G.single = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now,
        moved: true, fired: true, stroke: null, handle: "size", icon: null, drop: null, textHit: null };
      return;
    }

    const onText = textMemoAt(e.clientX, e.clientY);
    if (onText) {
      G.mode = "single";
      G.single = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now,
        moved: false, fired: false, stroke: null, handle: null, icon: null, drop: null, textHit: onText };
      return;
    }

    if (isTyping() || TEXT.selected) {
      clearTextSelection();
      G.mode = "consumed";
      return;
    }
    if (hitDrawer(e.clientX, e.clientY)) {
      openShelf();
      G.mode = "consumed";
      return;
    }

    G.mode = "single";
    G.single = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now, moved: false, fired: false,
      stroke: null, handle: null, icon: hitDropIcon(e.clientX, e.clientY), drop: null, textHit: null };
    if (!G.single.icon) G.single.drop = hitDrop(e.clientX, e.clientY);
  } else if (G.mode === "single") {
    const s = G.single;
    if (s.stroke || (s.textHit && s.moved)) {
      G.mode = "consumed";
    } else {
      if (s.handle) endTextDrag();
      beginDouble(now);
    }
  }
}

function beginDouble(now) {
  G.mode = "double";
  G.single = null;
  G.dbl = { c0: centroid(), t0: now, moved: false, fired: false };
}

function onMove(e) {
  const p = G.ptrs.get(e.pointerId);
  if (!p) return;
  e.preventDefault();
  p.x = e.clientX; p.y = e.clientY;
  if (G.ptrs.has("v")) { const v = G.ptrs.get("v"); v.x = e.clientX + 36; v.y = e.clientY + 10; }

  if (G.mode === "single" && G.single && e.pointerId === G.single.id) {
    const s = G.single;
    if (s.handle) { moveTextDrag(p.x, p.y); return; }
    if (s.textHit) {
      if (!s.moved && Math.hypot(p.x - s.sx, p.y - s.sy) > MOVE_TOL) {
        s.moved = true;
        selectText(s.textHit);
        beginTextDrag("move", s.sx, s.sy, s.textHit);
      }
      if (s.moved) moveTextDrag(p.x, p.y);
      return;
    }
    if (!s.moved && Math.hypot(p.x - s.sx, p.y - s.sy) > MOVE_TOL) {
      s.moved = true;
      cancelDot();
      if (isPlacing()) cancelPlacing();
      s.stroke = newStroke(s.sx, writeY(s.sy));
      G.drawing = s.stroke;
      hideIntroHint();
    }
    if (s.moved && s.stroke) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (evs && evs.length) for (const ce of evs) extendStroke(s.stroke, ce.clientX, writeY(ce.clientY));
      else extendStroke(s.stroke, p.x, writeY(p.y));
    }
  } else if (G.mode === "shelf" && G.shelf) {
    const sh = G.shelf;
    if (Math.abs(p.y - sh.sy) > 8) sh.moved = true;
    DROPS.shelf.scroll = U.clamp(sh.s0 - (p.y - sh.sy), 0, shelfMaxScroll() + DROPS.shelf.scroll);
  } else if (G.mode === "double" && G.dbl && !G.dbl.fired) {
    const d = G.dbl, c = centroid();
    const dx = c.x - d.c0.x, dy = c.y - d.c0.y;
    if (dy > SWIPE_DOWN_PX && Math.abs(dx) < dy) {
      d.fired = true;
      archiveAll();
    } else if (Math.hypot(dx, dy) > 22) {
      d.moved = true;
    }
  }
}

function onUp(e) {
  const now = performance.now();
  const wasV = G.ptrs.has("v");
  G.ptrs.delete(e.pointerId);
  if (e.pointerType === "mouse" && wasV) G.ptrs.delete("v");

  if (G.mode === "double" && G.ptrs.size < 2 && G.ptrs.size > 0) G.mode = "consumed";

  if (G.ptrs.size > 0) return;

  if (G.mode === "single" && G.single) {
    const s = G.single;
    if (s.handle) { endTextDrag(); }
    else if (s.textHit) {
      if (s.moved) {
        endTextDrag();
      } else if (now - s.t0 < TAP_MS) {
        const near = Math.hypot(s.sx - TAPQ.x, s.sy - TAPQ.y) < 40;
        if (now - TAPQ.t < DBLTAP_MS && near) {
          TAPQ.t = 0;
          editText(s.textHit);
        } else {
          TAPQ.t = now; TAPQ.x = s.sx; TAPQ.y = s.sy;
          selectText(s.textHit);
        }
      }
    }
    else if (!s.moved && !s.fired && now - s.t0 < TAP_MS) {
      if (s.icon) { evaporateDrop(s.icon); }
      else if (s.drop && s.drop.state === "rest") { openDrop(s.drop); }
      else if (isPlacing()) {
        cancelPlacing();
        startTyping(s.sx, writeY(s.sy));
      }
      else {
        cancelDot();
        newStroke(s.sx, writeY(s.sy));
        hideIntroHint();
        scheduleSave();
      }
    }
  } else if (G.mode === "open") {
    closeOpen();
  } else if (G.mode === "shelf" && G.shelf) {
    const sh = G.shelf;
    if (!sh.moved) {
      const del = hitShelfIcon(sh.sx, sh.sy);
      if (del) { removeMemo(del); }
      else {
        const d = hitShelfCell(sh.sx, sh.sy);
        if (d) { closeShelf(); openDrop(d); }
        else closeShelf();
      }
    }
  }
  if (G.drawing) { finishStroke(G.drawing); G.drawing = null; }
  G.mode = "idle"; G.single = null; G.dbl = null; G.openHold = null; G.shelf = null;
}

function updateGestures(now, dt) {
  let breathTarget = 0, frostTarget = 0;

  if (G.mode === "single" && G.single && !G.single.moved && !G.single.fired) {
    const s = G.single, el = now - s.t0;
    if (el > 250 && !s.drop && !s.icon && !s.handle && !isPlacing()) {
      breathTarget = U.clamp((el - 250) / (HOLD_MS - 250), 0, 1);
      CUE.bx = s.sx; CUE.by = s.sy; CUE.br = breathRadius() * 0.5;
    }
    if (el >= HOLD_MS && !s.drop && !s.icon && !s.handle && !isPlacing()) {
      s.fired = true;
      startBreath(s.sx, s.sy, breathRadius(), true);
      CUE.breathP = 1;
    }
  } else if (G.mode === "double" && G.dbl && !G.dbl.moved && !G.dbl.fired) {
    const d = G.dbl, el = now - d.t0, c = centroid();
    frostTarget = U.clamp(el / FROST_HOLD_MS, 0, 1);
    CUE.fx = c.x; CUE.fy = c.y; CUE.fr = frostRadius();
    if (el >= FROST_HOLD_MS) {
      d.fired = true;
      freezeNear(c.x, c.y, frostRadius());
    }
  }

  CUE.breathP = breathTarget > CUE.breathP ? breathTarget : Math.max(breathTarget, CUE.breathP - dt * 3.5);
  CUE.frostP = frostTarget > CUE.frostP ? frostTarget : Math.max(frostTarget, CUE.frostP - dt * 2.5);
}

function drawCues(ctx) {
  if (CUE.breathP > 0.01) {
    mist(ctx, CUE.bx, CUE.by, CUE.br * 1.02 * (0.3 + 0.7 * CUE.breathP), MIST_A * CUE.breathP, 7);
  }
  drawFrostCue(ctx, CUE.fx, CUE.fy, CUE.fr, CUE.frostP);
}

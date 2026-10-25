const HOLD_MS = 1000;
const TAP_MS = 450;
const MOVE_TOL = 8;
const SWIPE_DOWN_PX = 90;

const G = { ptrs: new Map(), mode: "idle", single: null, dbl: null, openHold: null };

const DBLTAP_MS = 330;
const TAPQ = { t: 0, x: 0, y: 0, timer: null };
function cancelDot() { if (TAPQ.timer) { clearTimeout(TAPQ.timer); TAPQ.timer = null; } }

const CUE = { breathP: 0, bx: 0, by: 0, br: 0, frostP: 0 };

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

    if (isTyping()) {
      stopTyping();
      G.mode = "consumed";
      return;
    }
    if (DROPS.open) {
      G.mode = "open";
      G.openHold = { t0: now, fired: false, moved: false, sx: e.clientX, sy: e.clientY };
    } else if (G.ptrs.size >= 2) {
      beginDouble(now);
    } else {
      G.mode = "single";
      G.single = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now, moved: false, fired: false, stroke: null, icon: hitDropIcon(e.clientX, e.clientY), drop: null };
      if (!G.single.icon) G.single.drop = hitDrop(e.clientX, e.clientY);
    }
  } else if (G.mode === "single") {

    if (G.single.moved) G.mode = "consumed";
    else beginDouble(now);
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
    if (!s.moved && Math.hypot(p.x - s.sx, p.y - s.sy) > MOVE_TOL) {
      s.moved = true;
      cancelDot();
      s.stroke = newStroke(s.sx, writeY(s.sy));
      hideIntroHint();
    }
    if (s.moved && s.stroke) {

      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (evs && evs.length) for (const ce of evs) extendStroke(s.stroke, ce.clientX, writeY(ce.clientY));
      else extendStroke(s.stroke, p.x, writeY(p.y));
    }
  } else if (G.mode === "double" && G.dbl && !G.dbl.fired) {
    const d = G.dbl, c = centroid();
    const dx = c.x - d.c0.x, dy = c.y - d.c0.y;
    if (dy > SWIPE_DOWN_PX && Math.abs(dx) < dy) {
      d.fired = true;
      showHint(archiveAll() ? "물방울이 되어 창틀로 흘러내려요" : "보낼 메모가 없어요");
    } else if (Math.hypot(dx, dy) > 22) {
      d.moved = true;
    }
  } else if (G.mode === "open" && G.openHold && Math.hypot(p.x - G.openHold.sx, p.y - G.openHold.sy) > 14) {
    G.openHold.moved = true;
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
    if (!s.moved && !s.fired && now - s.t0 < TAP_MS) {
      if (s.icon) { evaporateDrop(s.icon); }
      else if (s.drop && s.drop.state === "rest") { openDrop(s.drop); }
      else {

        const near = Math.hypot(s.sx - TAPQ.x, s.sy - TAPQ.y) < 40;
        if (now - TAPQ.t < DBLTAP_MS && near) {
          cancelDot();
          TAPQ.t = 0;
          startTyping(s.sx, writeY(s.sy));
        } else {
          TAPQ.t = now; TAPQ.x = s.sx; TAPQ.y = s.sy;
          const px = s.sx, py = writeY(s.sy);
          cancelDot();
          TAPQ.timer = setTimeout(() => {
            TAPQ.timer = null;
            newStroke(px, py);
            hideIntroHint();
          }, DBLTAP_MS);
        }
      }
    }
  } else if (G.mode === "open" && G.openHold) {
    const h = G.openHold;
    if (!h.fired && !h.moved && now - h.t0 < TAP_MS) closeOpen();
    else if (!h.fired && h.moved && now - h.t0 < TAP_MS) closeOpen();
  }
  G.mode = "idle"; G.single = null; G.dbl = null; G.openHold = null;
}

function updateGestures(now, dt) {
  let breathTarget = 0, frostTarget = 0;

  if (G.mode === "single" && G.single && !G.single.moved && !G.single.fired) {
    const s = G.single, el = now - s.t0;
    if (el > 250 && !s.drop && !s.icon) {
      breathTarget = U.clamp((el - 250) / (HOLD_MS - 250), 0, 1);
      CUE.bx = s.sx; CUE.by = s.sy; CUE.br = breathRadius() * 0.5;
    }
    if (el >= HOLD_MS && !s.drop && !s.icon) {
      s.fired = true;
      startBreath(s.sx, s.sy, breathRadius(), true);
      CUE.breathP = 1;
    }
  } else if (G.mode === "open" && G.openHold && !G.openHold.moved && !G.openHold.fired) {
    const h = G.openHold, el = now - h.t0, g = openGeom();
    if (g && el > 250) {
      breathTarget = U.clamp((el - 250) / (HOLD_MS - 250), 0, 1);
      CUE.bx = g.x; CUE.by = g.y; CUE.br = g.r * 0.9;
    }
    if (el >= HOLD_MS) { h.fired = true; evaporateOpen(); CUE.breathP = 0; }
  } else if (G.mode === "double" && G.dbl && !G.dbl.moved && !G.dbl.fired) {
    const d = G.dbl, el = now - d.t0;
    frostTarget = U.clamp(el / HOLD_MS, 0, 1);
    if (el >= HOLD_MS) {
      d.fired = true;
      showHint(freezeAll() ? "성에로 얼려서 남겼어요" : "얼릴 메모가 없어요");
    }
  }

  CUE.breathP = breathTarget > CUE.breathP ? breathTarget : Math.max(breathTarget, CUE.breathP - dt * 3.5);
  CUE.frostP = frostTarget > CUE.frostP ? frostTarget : Math.max(frostTarget, CUE.frostP - dt * 2.5);
}

function drawCues(ctx) {
  if (CUE.breathP > 0.01) {
    mist(ctx, CUE.bx, CUE.by, CUE.br * 1.02 * (0.3 + 0.7 * CUE.breathP), MIST_A * CUE.breathP, 7);
  }
  drawEdgeFrost(ctx, CUE.frostP);
}

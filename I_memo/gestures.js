// =====================================================
// gestures.js : 터치(포인터) 동작을 해석해서 기능에 연결하는 파일
//
//   동작                     →  의미(창문에서 일어나는 일)   →  기능
//   한 손가락으로 문지르기    →  김을 닦아 투명해짐           →  기록
//   한 곳을 1초 꾹            →  입김을 후 불어 다시 뿌예짐   →  삭제
//   두 손가락으로 1초 꾹      →  유리가 얼어 성에가 낌        →  저장
//   두 손가락으로 아래로 쓸기 →  물방울이 되어 흘러내림       →  아카이빙
//   창틀의 물방울 톡          →  물방울 속을 들여다봄         →  메모 열기
//
// - 모든 입력을 Pointer Events 로 받아요 (마우스·터치·펜 공통, iOS 사파리 13+ 지원)
// - 마우스로 테스트할 때는 Shift를 누른 채 클릭하면 "손가락 두 개"로 취급해요.
// =====================================================

const HOLD_MS = 1000;      // 꾹 누르기 기준 시간
const TAP_MS = 450;        // 이보다 짧게 누르면 "톡"
const MOVE_TOL = 8;        // 이 거리 안에서는 "가만히 있는 것"으로 봄 (손가락 떨림)
const SWIPE_DOWN_PX = 90;  // 두 손가락 쓸기 인식 거리

const G = { ptrs: new Map(), mode: "idle", single: null, dbl: null, openHold: null };
// 두 번 톡 치면 자판 입력 : 한 번 톡(점 찍기)과 구분하려고 잠깐 기다립니다
const DBLTAP_MS = 330;
const TAPQ = { t: 0, x: 0, y: 0, timer: null };
function cancelDot() { if (TAPQ.timer) { clearTimeout(TAPQ.timer); TAPQ.timer = null; } }
// 화면에 보여 줄 "누르고 있는 중" 표시 (입김이 서리는 중 / 성에가 번지는 중)
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

function writeY(y) { return Math.min(y, sillTop() - 1); }   // 창틀 위에는 쓸 수 없어요

function onDown(e) {
  e.preventDefault();
  try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
  const now = performance.now();
  G.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  // 마우스 + Shift : 손가락 하나가 더 있는 것처럼
  if (e.pointerType === "mouse" && e.shiftKey && !G.ptrs.has("v")) {
    G.ptrs.set("v", { x: e.clientX + 36, y: e.clientY + 10 });
  }

  if (G.mode === "idle") {
    // 자판으로 치는 중이면, 아무 데나 톡 치는 것으로 입력을 마칩니다
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
    // 쓰는 도중에 손가락이 하나 더 닿으면 : 아직 안 움직였으면 두 손가락 동작, 쓰는 중이었으면 무시(손바닥 방지)
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
      cancelDot();   // 움직이기 시작했으면 '톡' 대기는 취소
      s.stroke = newStroke(s.sx, writeY(s.sy));
      hideIntroHint();
    }
    if (s.moved && s.stroke) {
      // 빠르게 움직일 때 놓치기 쉬운 중간 점들까지 사용
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
      d.moved = true;   // 움직이면 "꾹 누르기"는 취소
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

  // 모든 손가락이 떨어짐
  if (G.mode === "single" && G.single) {
    const s = G.single;
    if (!s.moved && !s.fired && now - s.t0 < TAP_MS) {
      if (s.icon) { evaporateDrop(s.icon); }                           // × 아이콘 : 이 물방울만 삭제
      else if (s.drop && s.drop.state === "rest") { openDrop(s.drop); }
      else {
        // 톡 : 점 하나 / 두 번 톡 : 자판 입력 시작
        const near = Math.hypot(s.sx - TAPQ.x, s.sy - TAPQ.y) < 40;
        if (now - TAPQ.t < DBLTAP_MS && near) {
          cancelDot();
          TAPQ.t = 0;
          startTyping(s.sx, writeY(s.sy));   // 키보드는 손을 뗀 이 순간에 바로 올려야 합니다
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

// 매 프레임 : "꾹 누르는 중" 인지 확인하고, 1초가 차면 기능을 실행
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

// 누르고 있는 동안 보여 주는 표시들
function drawCues(ctx) {
  if (CUE.breathP > 0.01) {
    mist(ctx, CUE.bx, CUE.by, CUE.br * 1.02 * (0.3 + 0.7 * CUE.breathP), MIST_A * CUE.breathP, 7);
  }
  drawEdgeFrost(ctx, CUE.frostP);
}

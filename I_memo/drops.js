// =====================================================
// drops.js : "물방울로 흘러내리기" (아카이빙) + 창틀 + 크게 펼쳐 보기
//
//  두 손가락으로 아래로 쓸면
//   1) gather : 창 위의 모든 획이 한 점으로 모이며 물방울이 맺히고
//   2) slide  : 물방울이 멈췄다 흐르기를 반복하며 미끄러져 내려가고 (지나간 자리엔 물줄기 자국)
//   3) land   : 창틀에 닿으며 살짝 찌그러졌다가
//   4) rest   : 창틀에 고인 물방울이 됩니다.  → 물방울 1개 = 보관된 메모 1개
//  창틀의 물방울을 톡 치면 크게 펼쳐져 안의 메모가 보이고, 펼친 채 1초 누르면 증발(삭제)해요.
// =====================================================

const DROPS = {
  archive: [],   // 저장되는 데이터 [{id, ts, ice, strokes:[{pts, w}]}]
  list: [],      // 화면에 있는 물방울 (움직임 상태 포함)
  open: null,    // 펼쳐 보는 중인 물방울 {drop, p, dir}
  dimOut: 0,     // 펼침 화면의 어두운 배경이 사라지는 중일 때의 값
};

// ---------- 창틀 / 크기 ----------
function sillH() { return Math.max(46, VH * 0.085); }
function sillTop() { return VH - sillH(); }
function dropBaseR() { return U.clamp(Math.min(VW, VH) * 0.06, 22, 32); }   // 모든 물방울이 같은 크기
function openR() { return Math.min(VW, VH) * 0.36; }

// ---------- 메모 그림을 물방울 안에 맞춰 그리기 ----------
function memoBBox(mem) {
  const key = VW + "x" + VH;
  if (mem._bb && mem._bb.key === key) return mem._bb;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const st of mem.strokes) {
    if (st.text) {
      const b = memoTextBounds(st);
      if (b) {
        if (b.x0 < x0) x0 = b.x0; if (b.x1 > x1) x1 = b.x1;
        if (b.y0 < y0) y0 = b.y0; if (b.y1 > y1) y1 = b.y1;
      }
      continue;
    }
    for (let i = 0; i < st.pts.length; i += 2) {
      const x = st.pts[i] * VW, y = st.pts[i + 1] * VH;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  mem._bb = { key: key, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, span: Math.max(x1 - x0, y1 - y0, 60) };
  return mem._bb;
}

function makeInner(mem, k) {
  return function (ctx, r) {
    const bb = memoBBox(mem);
    const s = (r * 1.32) / bb.span;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(-bb.cx * s, -bb.cy * s);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const st of mem.strokes) {
      if (st.text) { drawTextScaled(ctx, st, s); continue; }
      const lw = U.clamp(st.w * s * 0.32, 1.1, Math.max(1.4, r * 0.1));
      tracePts(ctx, st.pts, VW * s, VH * s);
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = lw * 2.3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.96)";
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  };
}

// ---------- 물방울 만들기 ----------
function makeDropObj(mem, state) {
  return {
    mem: mem, state: state, x: 0, y: 0, r: 0, R: dropBaseR(), tx: 0, ty: 0,
    v: 0, t0: performance.now(), nseed: Math.random() * 100, hidden: false, sx: 1, sy: 1, alpha: 1,
  };
}

// 저장된 메모들로 창틀의 물방울 복원 (처음 열 때)
function rebuildDrops() {
  DROPS.list = DROPS.archive.map((mem) => makeDropObj(mem, "rest"));
  layoutDrops(1);
  for (const d of DROPS.list) { d.x = d.tx; d.y = d.ty; d.r = d.R; }
}

const MAX_PER_ROW = 10;   // 한 줄에 놓이는 물방울의 최대 개수

// 창틀에 물방울이 놓일 자리 계산 : 아랫줄부터 채우고 넘치면 윗줄. 자리가 모자라면 가장 오래된 것은 잠시 숨겨져요 (저장은 유지)
function layoutDrops(dt) {
  const vis = DROPS.list.filter((d) => d.state !== "evap").sort((a, b) => a.mem.ts - b.mem.ts);
  const DR = dropBaseR();
  const margin = 14 + DR;
  const perRow = Math.min(MAX_PER_ROW, Math.max(3, Math.floor((VW - 2 * margin) / (DR * 2.3)) + 1));
  const spacing = Math.min((VW - 2 * margin) / (perRow - 1), DR * 3);   // 넓은 화면에서 너무 띄엄띄엄 놓이지 않게
  const startX = (VW - (perRow - 1) * spacing) / 2;                      // 한 줄을 가운데 정렬
  const cap = perRow * 3;
  const hiddenN = Math.max(0, vis.length - cap);
  const top = sillTop();
  vis.forEach((d, i) => {
    d.R = DR;
    const k = i - hiddenN;
    d.hidden = k < 0;
    if (d.hidden) return;
    const row = Math.floor(k / perRow), col = k % perRow;
    // 가지런하게: 같은 줄은 같은 높이, 같은 간격으로 놓아요
    d.tx = startX + col * spacing;
    d.ty = top - d.R * 0.62 - row * DR * 2.3;   // 윗줄과 겹치지 않도록 간격 확보
  });
}

// ---------- 아카이빙 시작 : 창 위의 모든 메모를 물방울 하나로 ----------
function archiveAll() {
  if (isTyping()) stopTyping();   // 치는 중이었다면 먼저 마무리
  const src = MEMO.strokes.filter((s) => s.kind === "wipe" || s.kind === "text");
  if (!src.length) return false;

  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of src) {
    if (s.kind === "text") {
      const b = memoTextBounds(s);
      if (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); }
      continue;
    }
    for (let i = 0; i < s.pts.length; i += 2) {
      const x = s.pts[i] * VW, y = s.pts[i + 1] * VH;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x0 > x1) return false;
  const mem = {
    id: (Date.now() % 1000000) + Math.floor(Math.random() * 1000),
    ts: Date.now(),
    ice: src.some((s) => s.frozen),
    strokes: src.map((s) =>
      s.kind === "text"
        ? { text: 1, str: s.str, x: s.x, y: s.y, sizeR: s.sizeR, wrapR: s.wrapR, gone: (s.gone || []).slice(), seed: s.seed }
        : { pts: s.pts.slice(), w: s.w },
    ),
  };
  DROPS.archive.push(mem);
  MEMO.strokes = MEMO.strokes.filter((s) => s.kind !== "wipe" && s.kind !== "text");
  markFrostDirty();

  const d = makeDropObj(mem, "gather");
  d.c = { x: (x0 + x1) / 2, y: Math.min((y0 + y1) / 2, sillTop() - d.R * 3) };
  d.x = d.c.x; d.y = d.c.y; d.dur = 1100;
  d.snap = mem.strokes;
  DROPS.list.push(d);
  saveState();
  return true;
}

// 모이는 중인 획들 : 중심으로 오그라들며 굵어지다 사라짐 (김 지우기 목록에 같이 넣어 그려요)
function gatherStrokes(now) {
  const out = [];
  for (const d of DROPS.list) {
    if (d.state !== "gather") continue;
    const e = U.easeInOut(U.clamp((now - d.t0) / d.dur, 0, 1));
    const sc = 1 - 0.96 * e;
    for (const s of d.snap) {
      if (s.text) {
        out.push({ kind: "text", src: s, gs: sc, gc: d.c, fixedA: 1 - 0.9 * Math.pow(e, 3) });
        continue;
      }
      const pts = new Array(s.pts.length);
      for (let i = 0; i < s.pts.length; i += 2) {
        pts[i] = (d.c.x + (s.pts[i] * VW - d.c.x) * sc) / VW;
        pts[i + 1] = (d.c.y + (s.pts[i + 1] * VH - d.c.y) * sc) / VH;
      }
      out.push({ kind: "wipe", frozen: true, pts: pts, w: s.w * (1 + 0.9 * e), fixedA: 1 - 0.9 * Math.pow(e, 3) });
    }
  }
  return out;
}

// ---------- 매 프레임 갱신 ----------
function updateDrops(now, dt) {
  // 펼침 애니메이션
  const o = DROPS.open;
  if (o) {
    o.p = U.clamp(o.p + o.dir * (dt / 0.36), 0, 1);
    if (o.dir < 0 && o.p <= 0) DROPS.open = null;
  } else if (DROPS.dimOut > 0) {
    DROPS.dimOut = Math.max(0, DROPS.dimOut - dt * 1.6);
  }

  layoutDrops(dt);

  for (let i = DROPS.list.length - 1; i >= 0; i--) {
    const d = DROPS.list[i];
    if (d.state === "gather") {
      const p = U.clamp((now - d.t0) / d.dur, 0, 1);
      const e = U.easeInOut(p);
      d.r = d.R * (0.15 + 0.85 * e) * (p < 0.15 ? p / 0.15 : 1);
      d.x = d.c.x + Math.sin(now * 0.02) * (1 - e) * 1.2;
      d.y = d.c.y;
      if (p >= 1) {
        d.state = "slide"; d.r = d.R; d.x0 = d.x; d.y0 = d.y; d.v = 0;
        d.trail = { id: MEMO.nextId++, kind: "trail", pts: [d.x / VW, d.y / VH], w: d.R * 0.34, t0: Date.now(), lifeMs: 30000, frozen: false, seed: 1, maxA: 0.8 };
        MEMO.strokes.push(d.trail);
      }
    } else if (d.state === "slide") {
      const nz = U.noise1(d.nseed + now * 0.0013);          // 값이 낮을 때 멈추고, 높을 때 주르륵
      const u = U.clamp((nz - 0.3) / 0.4, 0, 1);
      const vT = 40 + 820 * u * u;
      d.v += (vT - d.v) * Math.min(1, dt * 3);
      d.y += d.v * dt;
      const prog = U.clamp((d.y - d.y0) / Math.max(60, d.ty - d.y0), 0, 1);
      d.x = d.x0 + (U.noise1(d.nseed * 2 + d.y * 0.012) - 0.5) * d.R * 1.1 * Math.sin(prog * Math.PI);
      const st = 1 + Math.min(0.28, d.v / 2600);              // 빠를수록 길쭉
      d.sy = st; d.sx = 1 / Math.sqrt(st);
      if (d.trail) extendStroke(d.trail, d.x, d.y);
      if (d.y >= d.ty) {
        d.state = "land"; d.t0 = now; d.y = d.ty;
        // 바닥에 닿으면 물줄기 자국은 곧바로 옅어지며 사라져요 (김이 다시 차오름)
        if (d.trail) { d.trail.lifeMs = 2000; d.trail.t0 = Date.now() - 2000 * 0.6; d.trail = null; }
      }
    } else if (d.state === "land") {
      const p = (now - d.t0) / 650;
      const s = Math.sin(p * Math.PI * 2.4) * Math.exp(-p * 4.2) * 0.24;   // 납작했다가 출렁
      d.sy = 1 - s; d.sx = 1 + s * 0.85;
      d.y = d.ty;
      d.x += (d.tx - d.x) * Math.min(1, dt * 5);   // 창틀 위를 자기 자리로 굴러감
      if (p >= 1) { d.state = "rest"; d.sx = d.sy = 1; }
    } else if (d.state === "rest") {
      const k = Math.min(1, dt * 5);
      d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k;
      d.r = d.R;
    } else if (d.state === "evap") {
      const p = (now - d.t0) / 800;
      d.alpha = 1 - p;
      d.r = d.r0 * (1 - 0.45 * p);
      if (p >= 1) DROPS.list.splice(i, 1);
    }
  }
}

// ---------- 창틀 그리기 ----------
function drawSill(ctx) {
  const top = sillTop(), h = VH - top;
  const k = 0.4 + 0.6 * (1 - SKY.dark);
  const c = (r, g, b) => "rgb(" + (r * k | 0) + "," + (g * k | 0) + "," + (b * k | 0) + ")";

  // 유리 아래쪽에 고인 물기
  const wet = ctx.createLinearGradient(0, top - 18, 0, top);
  wet.addColorStop(0, "rgba(235,246,255,0)");
  wet.addColorStop(1, "rgba(235,246,255," + (0.3 * k) + ")");
  ctx.fillStyle = wet;
  ctx.fillRect(0, top - 18, VW, 18);

  // 창틀 (윗면 → 앞면)
  const g = ctx.createLinearGradient(0, top, 0, VH);
  g.addColorStop(0, c(248, 245, 238));
  g.addColorStop(0.4, c(226, 222, 212));
  g.addColorStop(0.42, c(204, 199, 188));
  g.addColorStop(1, c(160, 154, 142));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, VW, h);
  ctx.fillStyle = "rgba(255,255,255," + (0.8 * k) + ")";
  ctx.fillRect(0, top, VW, 1.5);
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, top + h * 0.41, VW, 1);
  // 위에서 떨어지는 그림자(유리와 창틀 사이 홈)
  const gr = ctx.createLinearGradient(0, top, 0, top + 7);
  gr.addColorStop(0, "rgba(20,30,44,0.28)");
  gr.addColorStop(1, "rgba(20,30,44,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, top, VW, 7);
}

// ---------- 물방울 그리기 ----------
function drawDrops(ctx, now) {
  const draw = DROPS.list
    .filter((d) => !d.hidden && !(DROPS.open && DROPS.open.drop === d))
    .sort((a, b) => a.y - b.y);
  for (const d of draw) {
    let k = 1;
    if (d.state === "gather") k = U.clamp((now - d.t0) / d.dur, 0, 1);
    paintDrop(ctx, d.x, d.y, d.r, {
      sx: d.sx, sy: d.sy, alpha: d.alpha,
      ice: d.mem.ice, spread: 3.2, inner: makeInner(d.mem, k),
    });
  }
  drawDropIcons(ctx);
}

// ---------- 물방울 우측 상단의 작은 삭제(×) 아이콘 ----------
function dropIconPos(d) {
  return { x: d.x + d.R * 0.78, y: d.y - d.R * 0.78, r: U.clamp(dropBaseR() * 0.34, 7.5, 11) };
}

function hitDropIcon(x, y) {
  if (DROPS.open) return null;
  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest") continue;
    const ic = dropIconPos(d);
    if (Math.hypot(x - ic.x, y - ic.y) < ic.r + 7) return d;   // 손가락이 닿기 쉽게 조금 넓게
  }
  return null;
}

function drawDropIcons(ctx) {
  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest" || (DROPS.open && DROPS.open.drop === d)) continue;
    const ic = dropIconPos(d), k = ic.r * 0.36;
    ctx.save();
    ctx.fillStyle = "rgba(16,26,40,0.66)";
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ic.x - k, ic.y - k); ctx.lineTo(ic.x + k, ic.y + k);
    ctx.moveTo(ic.x + k, ic.y - k); ctx.lineTo(ic.x - k, ic.y + k);
    ctx.stroke();
    ctx.restore();
  }
}

// 창틀의 물방울 하나를 증발시키며 삭제
function evaporateDrop(d) {
  d.r0 = d.r; d.state = "evap"; d.t0 = performance.now(); d.alpha = 1;
  DROPS.archive = DROPS.archive.filter((m) => m !== d.mem);
  startBreath(d.x, d.y, d.R * 1.8, false);
  saveState();
}

// ---------- 펼쳐 보기 ----------
function hitDrop(x, y) {
  if (DROPS.open) return null;
  let best = null, bd = 1e9;
  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest") continue;
    const dd = Math.hypot(x - d.x, y - d.y);
    if (dd < d.r * 1.25 && dd < bd) { best = d; bd = dd; }
  }
  return best;
}

function openDrop(d) { DROPS.open = { drop: d, p: 0, dir: 1 }; DROPS.dimOut = 0; }
function closeOpen() { if (DROPS.open) DROPS.open.dir = -1; }

function openGeom() {
  const o = DROPS.open;
  if (!o) return null;
  const e = U.easeOut(o.p), d = o.drop;
  return { x: U.lerp(d.x, VW / 2, e), y: U.lerp(d.y, VH * 0.45, e), r: U.lerp(d.r, openR(), e), e: e };
}

// 펼쳐 본 메모를 증발시키기(삭제)
function evaporateOpen() {
  const o = DROPS.open, g = openGeom();
  if (!o) return;
  const d = o.drop;
  d.x = g.x; d.y = g.y; d.r = g.r; d.r0 = g.r;
  d.state = "evap"; d.t0 = performance.now();
  DROPS.dimOut = 0.62 * g.e;
  DROPS.open = null;
  DROPS.archive = DROPS.archive.filter((m) => m !== d.mem);
  startBreath(g.x, g.y, g.r * 1.3, false);
  saveState();
}

function drawOpenView(ctx) {
  const o = DROPS.open, g = openGeom();
  let dim = DROPS.dimOut;
  if (o) dim = 0.62 * g.e;
  if (dim > 0.005) {
    ctx.fillStyle = "rgba(8,14,24," + dim + ")";
    ctx.fillRect(0, 0, VW, VH);
  }
  if (!o) return;
  const d = o.drop;
  paintDrop(ctx, g.x, g.y, g.r, { ice: d.mem.ice, spread: 2.8, inner: makeInner(d.mem, 1) });
  if (g.e > 0.7) {
    const when = new Date(d.mem.ts).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    ctx.save();
    ctx.globalAlpha = (g.e - 0.7) / 0.3;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "500 14px -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(when, g.x, g.y + g.r + 30);
    ctx.restore();
  }
}

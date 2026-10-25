const FOG_RETURN_MS = 120000;
const STORE_KEY = "imemo.v1";

const MEMO = {
  strokes: [],
  nextId: 1,
};

const BREATHS = [];

const BRUSH_STEPS = [12, 20, 32];
const BRUSH_DOTS = [8, 14, 20];
const BRUSH_KEY = "imemo.brushStep";
let brushStep = null;

function wipeWidth() {
  if (brushStep === null) {
    let v = NaN;
    try { v = parseInt(localStorage.getItem(BRUSH_KEY), 10); } catch (e) {}
    brushStep = isNaN(v) ? 1 : U.clamp(v, 0, BRUSH_STEPS.length - 1);
  }

  const k = U.clamp(Math.min(VW, VH) / 700, 0.8, 1.5);
  return BRUSH_STEPS[brushStep] * k;
}

function nextBrush() {
  wipeWidth();
  brushStep = (brushStep + 1) % BRUSH_STEPS.length;
  try { localStorage.setItem(BRUSH_KEY, String(brushStep)); } catch (e) {}
  return brushStep;
}

function newStroke(xPx, yPx) {
  const s = {
    id: MEMO.nextId++, kind: "wipe",
    pts: [xPx / VW, yPx / VH], w: wipeWidth(),
    t0: Date.now(), lifeMs: FOG_RETURN_MS,
    frozen: false, seed: (Math.random() * 1e9) | 0,
  };
  MEMO.strokes.push(s);
  return s;
}

function extendStroke(s, xPx, yPx) {
  const n = s.pts.length;
  const lx = s.pts[n - 2] * VW, ly = s.pts[n - 1] * VH;
  const dx = xPx - lx, dy = yPx - ly, d = Math.hypot(dx, dy);
  if (d < 2.5) return;
  const steps = Math.ceil(d / 5);
  for (let i = 1; i <= steps; i++) {
    s.pts.push((lx + (dx * i) / steps) / VW, (ly + (dy * i) / steps) / VH);
  }
}

function strokeLook(s, wall) {
  if (s.kind === "ambient") return { a: 0.62, wf: 1 };
  if (TEXT.editing === s) return { a: 1, wf: 1 };
  if (s.fixedA !== undefined) return { a: s.fixedA, wf: s.fixedW || 1 };
  if (s.frozen) return { a: 1, wf: 1 };
  const life = 1 - (wall - s.t0) / s.lifeMs;
  if (life <= 0) return null;
  return { a: U.clamp(life / 0.4, 0, 1) * (s.maxA || 1), wf: 0.5 + 0.5 * U.clamp(life / 0.7, 0, 1) };
}

function tracePts(ctx, pts, sx, sy) {
  const n = pts.length / 2;
  ctx.beginPath();
  if (n === 1) {
    ctx.moveTo(pts[0] * sx, pts[1] * sy);
    ctx.lineTo(pts[0] * sx + 0.01, pts[1] * sy);
    return;
  }
  ctx.moveTo(pts[0] * sx, pts[1] * sy);
  for (let i = 1; i < n - 1; i++) {
    const x = pts[2 * i] * sx, y = pts[2 * i + 1] * sy;
    const nx = pts[2 * i + 2] * sx, ny = pts[2 * i + 3] * sy;
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(pts[2 * n - 2] * sx, pts[2 * n - 1] * sy);
}

function paintMask(ctx, list, wall) {
  const looks = list.map((s) => strokeLook(s, wall));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < list.length; i++) {
    const s = list[i], lk = looks[i];
    if (!lk || s.kind === "ambient") continue;
    if (s.kind === "text") { memoTextPass(ctx, s, lk, "halo"); continue; }
    tracePts(ctx, s.pts, VW, VH);
    ctx.strokeStyle = "rgba(255,255,255," + 0.2 * lk.a + ")";
    ctx.lineWidth = s.w * lk.wf + 5;
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < list.length; i++) {
    const s = list[i], lk = looks[i];
    if (!lk) continue;
    if (s.kind === "text") { memoTextPass(ctx, s, lk, "erase"); continue; }
    tracePts(ctx, s.pts, VW, VH);
    ctx.strokeStyle = "rgba(0,0,0," + 0.4 * lk.a + ")";
    ctx.lineWidth = s.w * lk.wf + 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0," + lk.a + ")";
    ctx.lineWidth = s.w * lk.wf;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function breathRadius() {
  return U.clamp(Math.min(VW, VH) * 0.2, 90, 170);
}

function startBreath(x, y, R, trim) {
  BREATHS.push({ x: x, y: y, R: R, t0: performance.now(), dur: 950, trim: trim !== false });
  try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
}

function trimStrokes(cx, cy, rr) {
  const out = [];
  const r2 = rr * rr;
  for (const s of MEMO.strokes) {
    if (s.frozen || s.kind === "ambient") { out.push(s); continue; }
    if (s.kind === "text") {

      if (!trimText(s, cx, cy, rr).empty) out.push(s);
      continue;
    }
    const p = s.pts, runs = [];
    let cur = [], cut = false;
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] * VW - cx, dy = p[i + 1] * VH - cy;
      if (dx * dx + dy * dy < r2) {
        cut = true;
        if (cur.length) { runs.push(cur); cur = []; }
      } else cur.push(p[i], p[i + 1]);
    }
    if (cur.length) runs.push(cur);
    if (!cut) { out.push(s); continue; }
    for (const run of runs) {
      out.push({ id: MEMO.nextId++, kind: s.kind, pts: run, w: s.w, t0: s.t0, lifeMs: s.lifeMs, frozen: false, seed: s.seed, maxA: s.maxA });
    }
  }
  MEMO.strokes = out;
}

function updateBreaths(now) {
  for (let i = BREATHS.length - 1; i >= 0; i--) {
    const b = BREATHS[i];
    const p = (now - b.t0) / b.dur;
    if (p >= 1) { BREATHS.splice(i, 1); continue; }
    if (b.trim) trimStrokes(b.x, b.y, U.lerp(b.R * 0.5, b.R, U.easeOut(p)) * 0.92);
  }
}

function mist(ctx, x, y, r, a, seed) {
  if (r < 1 || a <= 0.005) return;
  const rnd = U.rng(seed | 0);
  const blob = (bx, by, br, ba) => {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, "rgba(250,253,255," + ba + ")");
    g.addColorStop(0.55, "rgba(246,250,254," + ba * 0.75 + ")");
    g.addColorStop(1, "rgba(242,248,253,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  };
  blob(x, y, r, a);
  for (let i = 0; i < 6; i++) {
    const ang = rnd() * TAU, dist = r * (0.25 + rnd() * 0.35);
    blob(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, r * (0.45 + rnd() * 0.3), a * 0.7);
  }
}

const MIST_A = 0.8;

function drawBlooms(ctx, now) {
  for (const b of BREATHS) {
    const p = (now - b.t0) / b.dur;
    const r = U.lerp(b.R * 0.5, b.R, U.easeOut(p));
    mist(ctx, b.x, b.y, r * 1.02, MIST_A * Math.pow(1 - p, 1.15), 7);
  }
}

function freezeAll() {
  let n = 0;
  const now = performance.now();
  for (const s of MEMO.strokes) {
    if ((s.kind === "wipe" || s.kind === "text") && !s.frozen) {
      s.frozen = true; s.frostT0 = now; n++;
    }
  }
  if (n) saveState();
  return n;
}

function saveState() {
  try {
    const r = (v) => Math.round(v * 5000) / 5000;
    const frozen = MEMO.strokes
      .filter((s) => s.frozen && s.kind === "wipe")
      .map((s) => ({ pts: s.pts.map(r), w: s.w, ts: s.t0, seed: s.seed }));

    const texts = MEMO.strokes
      .filter((s) => s.frozen && s.kind === "text")
      .map((t) => ({ str: t.str, x: r(t.x), y: r(t.y), sizeR: t.sizeR, wrapR: t.wrapR, gone: t.gone, ts: t.t0, seed: t.seed }));

    const clean = (st) => st.text
      ? { text: 1, str: st.str, x: st.x, y: st.y, sizeR: st.sizeR, wrapR: st.wrapR, gone: st.gone, seed: st.seed }
      : { pts: st.pts, w: st.w };
    const archive = DROPS.archive.map((m) => ({ id: m.id, ts: m.ts, ice: m.ice, strokes: m.strokes.map(clean) }));
    localStorage.setItem(STORE_KEY, JSON.stringify({ frozen: frozen, texts: texts, archive: archive }));
  } catch (e) {  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    for (const f of d.frozen || []) {
      MEMO.strokes.push({
        id: MEMO.nextId++, kind: "wipe", pts: f.pts, w: f.w, t0: f.ts || Date.now(),
        lifeMs: FOG_RETURN_MS, frozen: true, seed: f.seed || 1, frostT0: -1e9,
      });
    }
    for (const x of d.texts || []) {
      MEMO.strokes.push({
        id: MEMO.nextId++, kind: "text", str: x.str || "", x: x.x, y: x.y,
        sizeR: x.sizeR, wrapR: x.wrapR, gone: x.gone || [], t0: x.ts || Date.now(),
        lifeMs: FOG_RETURN_MS, frozen: true, seed: x.seed || 1, frostT0: -1e9,
      });
    }
    DROPS.archive = d.archive || [];
  } catch (e) {}
}

function resetAll() {
  MEMO.strokes = [];
  markFrostDirty();
  saveState();
  startBreath(VW / 2, VH / 2, Math.hypot(VW, VH) * 0.62, false);
}

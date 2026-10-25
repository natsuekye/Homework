let FROSTL = null;
let frostDirty = true;
let EDGEF = null;
let iceTex = null;

function markFrostDirty() { frostDirty = true; }

function getIcePattern() {
  if (iceTex) return iceTex;
  const S = 192;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(226,240,255,0.62)";
  x.fillRect(0, 0, S, S);
  const rnd = U.rng(4242);

  const img = x.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const v = rnd();
    if (v > 0.45) {
      img.data[i * 4] = 255; img.data[i * 4 + 1] = 255; img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.max(img.data[i * 4 + 3], (v - 0.45) * 190);
    }
  }
  x.putImageData(img, 0, 0);

  const wrap = (fn) => { for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) fn(ox, oy); };
  for (let i = 0; i < 70; i++) {
    const px = rnd() * S, py = rnd() * S, a = rnd() * TAU, l = 8 + rnd() * 26;
    wrap((ox, oy) => {
      x.strokeStyle = "rgba(255,255,255," + (0.18 + rnd() * 0.25) + ")";
      x.lineWidth = 0.6 + rnd() * 0.5;
      x.beginPath();
      x.moveTo(px + ox, py + oy);
      x.lineTo(px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l);
      x.stroke();
    });
  }
  for (let i = 0; i < 16; i++) {
    const px = rnd() * S, py = rnd() * S, r = 14 + rnd() * 28;
    wrap((ox, oy) => {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(px + ox, py + oy, r, 0, TAU); x.fill();
    });
  }
  iceTex = document.createElement("canvas").getContext("2d").createPattern(c, "repeat");
  return iceTex;
}

function addBranch(st, x, y, ang, len, depth, delay, rnd) {
  const dur = 160 + len * 7;
  st.d[depth].push(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, delay, dur);
  if (delay + dur > st.end) st.end = delay + dur;
}

const FROST_SWEEP_MS = 1200;
const FROST_SPUR_CHANCE = 0;

function frostFor(s) {
  const key = VW + "x" + VH;
  if (s.kind === "text") {

    if (s._fc && s._fc.key === key) return s._fc;
    layoutText(s);
    s._fc = { d: [[], [], []], end: FROST_SWEEP_MS + 120, key: key,
      sp: memoTextSparkles(s), len: Math.max(1, s.chars.length) };
    return s._fc;
  }
  if (s._fc && s._fc.key === key) return s._fc;
  const rnd = U.rng(s.seed || 1);
  const n = s.pts.length / 2;
  const xs = [], ys = [], cum = [0];
  for (let i = 0; i < n; i++) {
    xs.push(s.pts[2 * i] * VW); ys.push(s.pts[2 * i + 1] * VH);
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const total = cum[n - 1] || 1;
  const st = { d: [[], [], []], end: FROST_SWEEP_MS + 100, key: key, sp: [], len: total };

  let next = 0;
  for (let i = 0; i < n; i++) {
    if (cum[i] < next) continue;
    next = cum[i] + 18 * (0.7 + rnd() * 0.8);
    const i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
    let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    for (const side of [-1, 1]) {
      if (rnd() > FROST_SPUR_CHANCE) continue;
      const nx = -ty * side, ny = tx * side;
      const ox = xs[i] + nx * (s.w * 0.5), oy = ys[i] + ny * (s.w * 0.5);
      const ang = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.1;
      const len = U.clamp(s.w * (0.18 + rnd() * 0.25), 3, 7);
      addBranch(st, ox, oy, ang, len, 0, (cum[i] / total) * FROST_SWEEP_MS + rnd() * 150, rnd);
    }
  }

  const spN = U.clamp(Math.round(total / 90), 2, 10);
  for (let k = 0; k < spN; k++) {
    const i = Math.min(n - 1, Math.floor(rnd() * n));
    st.sp.push(xs[i] + (rnd() - 0.5) * s.w * 0.8, ys[i] + (rnd() - 0.5) * s.w * 0.8, rnd() * TAU);
  }
  s._fc = st;
  return st;
}

function drawFronds(ctx, st, t, alphaMul) {
  const arr = st.d[0];
  if (!arr.length) return;
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    const off = pass === 0 ? 0.8 : 0;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 6) {
      const p = U.clamp((t - arr[i + 4]) / arr[i + 5], 0, 1);
      if (p <= 0) continue;
      ctx.moveTo(arr[i] + off, arr[i + 1] + off);
      ctx.lineTo(arr[i] + (arr[i + 2] - arr[i]) * p + off, arr[i + 1] + (arr[i + 3] - arr[i + 1]) * p + off);
    }
    ctx.strokeStyle = pass === 0 ? "rgba(96,132,176," + 0.3 * alphaMul + ")" : "rgba(240,249,255," + 0.85 * alphaMul + ")";
    ctx.lineWidth = pass === 0 ? 1.1 : 0.9;
    ctx.stroke();
  }
}

let ICEB = null;
let ICET = null;

function unionPass(ctx, list, k, add, color) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, VW, VH);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const it of list) {
    if (it.s.kind === "text") { ctx.setLineDash([]); memoTextUnion(ctx, it.s, k, add, it.p); continue; }
    ctx.setLineDash(it.p < 1 ? [it.len * it.p + 0.01, it.len * 2 + 100] : []);
    tracePts(ctx, it.s.pts, VW, VH);
    ctx.lineWidth = it.s.w * k + add;
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function renderBands(now) {
  const list = [];
  for (const s of MEMO.strokes) {
    if (s.frozen && (s.kind === "wipe" || s.kind === "text")) {
      list.push({ s: s, p: U.clamp((now - s.frostT0) / FROST_SWEEP_MS, 0, 1), len: frostFor(s).len });
    }
  }
  const B = ICEB.x, T = ICET.x;
  B.globalCompositeOperation = "source-over";
  B.globalAlpha = 1;
  B.clearRect(0, 0, VW, VH);
  if (!list.length) return;

  unionPass(T, list, 1, 3, "#7096cd");
  B.globalAlpha = 0.34; B.drawImage(ICET.c, 0, 0, VW, VH);

  unionPass(T, list, 1, 0, "#ffffff");
  T.globalCompositeOperation = "source-in";
  T.fillStyle = getIcePattern();
  T.fillRect(0, 0, VW, VH);
  T.globalCompositeOperation = "source-over";
  B.globalAlpha = 0.9; B.drawImage(ICET.c, 0, 0, VW, VH);

  unionPass(T, list, 0.45, 0, "#ffffff");
  B.globalAlpha = 0.38; B.drawImage(ICET.c, 0, 0, VW, VH);
  B.globalAlpha = 1;
}

function frostGrown(s, now) {
  return now - (s.frostT0 || 0) >= frostFor(s).end + 80;
}

function rebakeFrost(now) {
  FROSTL.x.clearRect(0, 0, VW, VH);
  for (const s of MEMO.strokes) {
    if (!s.frozen || (s.kind !== "wipe" && s.kind !== "text")) continue;
    if (!frostGrown(s, now)) { s.baked = false; continue; }
    drawFronds(FROSTL.x, frostFor(s), 1e9, 1);
    s.baked = true;
  }
  frostDirty = false;
}

function drawFrost(ctx, now) {
  let animating = false;
  for (const s of MEMO.strokes) {
    if (s.frozen && (s.kind === "wipe" || s.kind === "text") && !s.baked) {
      animating = true;
      if (frostGrown(s, now)) frostDirty = true;
    }
  }
  const needBand = frostDirty || animating;
  if (frostDirty) rebakeFrost(now);
  if (needBand) renderBands(now);

  ctx.drawImage(ICEB.c, 0, 0, VW, VH);
  ctx.drawImage(FROSTL.c, 0, 0, VW, VH);

  for (const s of MEMO.strokes) {
    if (!s.frozen || (s.kind !== "wipe" && s.kind !== "text")) continue;
    const st = frostFor(s);
    if (!s.baked) drawFronds(ctx, st, now - s.frostT0, 1);

    const sp = st.sp;
    for (let i = 0; i < sp.length; i += 3) {
      const tw = Math.pow(0.5 + 0.5 * Math.sin(now * 0.0026 + sp[i + 2] * 3), 4);
      if (tw < 0.08) continue;
      const L = 2 + 4.5 * tw;
      ctx.strokeStyle = "rgba(255,255,255," + (0.35 + 0.6 * tw) + ")";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(sp[i] - L, sp[i + 1]); ctx.lineTo(sp[i] + L, sp[i + 1]);
      ctx.moveTo(sp[i], sp[i + 1] - L); ctx.lineTo(sp[i], sp[i + 1] + L);
      ctx.stroke();
    }
  }
}

function buildEdgeFrost() { EDGEF = true; }

function drawEdgeFrost(ctx, p) {
  if (p < 0.01) return;
  const dp = Math.min(VW, VH) * 0.2 * (0.4 + 0.6 * p);
  const a = 0.62 * p;
  const mk = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(232,244,255," + a + ")");
    g.addColorStop(0.5, "rgba(232,244,255," + a * 0.35 + ")");
    g.addColorStop(1, "rgba(232,244,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  mk(0, 0, 0, dp, 0, 0, VW, dp);
  mk(0, VH, 0, VH - dp, 0, VH - dp, VW, dp);
  mk(0, 0, dp, 0, 0, 0, dp, VH);
  mk(VW, 0, VW - dp, 0, VW - dp, 0, dp, VH);
}

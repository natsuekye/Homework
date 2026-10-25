// =====================================================
// frost.js : "성에로 얼리기" (저장)
// - 얼어붙은 획은 입김으로도 지워지지 않고, 김이 다시 차올라도 사라지지 않아요.
// - 모습: ① 닦인 자리에 얼음 질감이 얇게 덮이고 ② 가장자리에서 고사리 모양 결정이 뻗어 나가요.
//   결정은 "가지 → 곁가지 → 곁곁가지" 3단계로 자라는 선을 시간차를 두고 그려서 만들어요.
// - 다 자란 성에는 한 장의 레이어(FROSTL)에 구워 두고, 자라는 중인 것만 매 프레임 그려요.
// =====================================================

let FROSTL = null;          // 다 자란 성에를 모아 둔 레이어
let frostDirty = true;      // 다시 구워야 하는지
let EDGEF = null;           // 두 손가락으로 누를 때 화면 가장자리에 서리는 성에
let iceTex = null;          // 얼음 질감 패턴

function markFrostDirty() { frostDirty = true; }

// ---------- 얼음 질감 (이어 붙여도 티 안 나는 타일) ----------
function getIcePattern() {
  if (iceTex) return iceTex;
  const S = 192;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(226,240,255,0.62)";
  x.fillRect(0, 0, S, S);
  const rnd = U.rng(4242);
  // 잔 알갱이
  const img = x.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const v = rnd();
    if (v > 0.45) {
      img.data[i * 4] = 255; img.data[i * 4 + 1] = 255; img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.max(img.data[i * 4 + 3], (v - 0.45) * 190);
    }
  }
  x.putImageData(img, 0, 0);
  // 결정 무늬 선과 얼룩 (가장자리에서 반대편으로 이어지게 9번 그림)
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

// ---------- 글씨 위에 맺히는 아주 작은 얼음 가시 ----------
// 성에가 "글씨 자체"를 얼리는 느낌이 나도록, 결정은 가장자리에 짧고 드문 가시로만 남겼어요.
// d[0] 에 [시작x, 시작y, 끝x, 끝y, 자라기 시작하는 시각(ms), 자라는 데 걸리는 시간(ms)] 를 쌓아요
function addBranch(st, x, y, ang, len, depth, delay, rnd) {
  const dur = 160 + len * 7;
  st.d[depth].push(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, delay, dur);
  if (delay + dur > st.end) st.end = delay + dur;
}

const FROST_SWEEP_MS = 1200;   // 얼음이 글씨를 따라 번져 가는 시간
const FROST_SPUR_CHANCE = 0; // 가장자리 가시가 생길 확률 (0 = 가시 없이 글씨만 얼어붙음)

// 획 하나에 대한 성에 데이터 (창 크기가 같으면 캐시를 재사용)
function frostFor(s) {
  const key = VW + "x" + VH;
  if (s.kind === "text") {
    // 글 메모는 가시 없이, 글자를 하나씩 덮으며 얼어붙습니다
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
  // 반짝임 위치 (글씨 위에 몇 개만)
  const spN = U.clamp(Math.round(total / 90), 2, 10);
  for (let k = 0; k < spN; k++) {
    const i = Math.min(n - 1, Math.floor(rnd() * n));
    st.sp.push(xs[i] + (rnd() - 0.5) * s.w * 0.8, ys[i] + (rnd() - 0.5) * s.w * 0.8, rnd() * TAU);
  }
  s._fc = st;
  return st;
}

// 얼음 가시 그리기 (푸른 회색 그림자 → 흰 선)
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

// 글씨가 통째로 얼어붙은 모습.
// 획마다 따로 반투명하게 덮으면 획이 겹치는 곳이 두 겹으로 보이기 때문에,
// "모든 획을 한꺼번에 합친 모양(합집합)" 으로 먼저 만든 다음 딱 한 번만 얼음 질감을 입혀요.
//   1) 푸른 윤곽  2) 서리 질감  3) 안쪽의 하얀 결  (세 번 모두 합집합으로 처리)
let ICEB = null;   // 얼음 덩어리를 완성해서 담는 레이어
let ICET = null;   // 합집합을 만드는 임시 레이어

function unionPass(ctx, list, k, add, color) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, VW, VH);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const it of list) {
    if (it.s.kind === "text") { ctx.setLineDash([]); memoTextUnion(ctx, it.s, k, add, it.p); continue; }
    ctx.setLineDash(it.p < 1 ? [it.len * it.p + 0.01, it.len * 2 + 100] : []);   // 글씨를 따라 번져 가는 효과
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

  unionPass(T, list, 1, 3, "#7096cd");                    // 푸른 윤곽
  B.globalAlpha = 0.34; B.drawImage(ICET.c, 0, 0, VW, VH);

  unionPass(T, list, 1, 0, "#ffffff");                    // 서리 질감 (합집합 모양 안에만)
  T.globalCompositeOperation = "source-in";
  T.fillStyle = getIcePattern();
  T.fillRect(0, 0, VW, VH);
  T.globalCompositeOperation = "source-over";
  B.globalAlpha = 0.9; B.drawImage(ICET.c, 0, 0, VW, VH);

  unionPass(T, list, 0.45, 0, "#ffffff");                 // 안쪽의 하얀 결
  B.globalAlpha = 0.38; B.drawImage(ICET.c, 0, 0, VW, VH);
  B.globalAlpha = 1;
}

// ---------- 레이어 관리 ----------
// 얼음 덩어리(ICEB)는 새로 얼거나 번지는 중일 때만 다시 만들고, 가시와 반짝임은 따로 그려요.
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
    // 반짝임
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

// ---------- 두 손가락으로 누르는 동안 가장자리부터 서리는 얼음 (결정 없이 부드러운 서리만) ----------
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

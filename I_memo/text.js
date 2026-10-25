// =====================================================
// text.js : 자판으로 치는 글 메모
//
// [생각]
//   손으로 쓰는 글씨도, 자판으로 치는 글도 결국 "김을 닦아낸 자리" 입니다.
//   그래서 타이핑한 글자도 유리에서 김이 지워지며 나타나고,
//   길게 쓸수록 창이 넓게 닦여 창밖이 더 많이 드러납니다.
//   (짧은 낙서 = 손가락 / 긴 이야기 = 자판)
//
// [규칙은 손글씨와 똑같습니다]
//   그냥 두면 김이 다시 차서 사라지고,
//   입김을 불면 그 자리의 글자만 지워지고,
//   얼리면 성에가 되어 남고,
//   흘려보내면 물방울 안에 담깁니다.
//
// 좌표는 글 덩어리의 왼쪽 위를 기준으로 한 '속 좌표(px)' 로 두고,
// 덩어리의 위치만 0~1 로 저장해서 창 크기가 바뀌어도 자리를 지킵니다.
// =====================================================

// 주의 : p5 에는 textSize·textBounds 처럼 text/font 로 시작하는 함수가 이미 있어서,
// 여기서 만드는 함수에는 앞에 memo 를 붙여 이름이 겹치지 않게 했습니다.

// 손글씨 느낌 글꼴이 있으면 먼저 쓰고, 없으면 기본 고딕으로
const TEXT_FONT =
  "'Nanum Pen Script', 'Gaegu', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

const TEXT = {
  editing: null, // 지금 치고 있는 글 메모
  el: null, // 화면에 보이지 않는 입력칸 (키보드를 올리는 역할)
  caretT0: 0,
};

// 글자 크기는 굵기 슬라이더를 같이 씁니다 (굵게 = 크게)
function memoTextSize() {
  return U.clamp(wipeWidth() * 1.9, 18, 64);
}

// 글자 폭을 재기 위한 보이지 않는 캔버스
let _meas = null;
function measCtx() {
  if (!_meas) _meas = document.createElement("canvas").getContext("2d");
  return _meas;
}
function memoFontStr(px) {
  return Math.round(px) + "px " + TEXT_FONT;
}

// ---------- 글자 배치 ----------
// 줄 끝에 닿으면 다음 줄로 넘깁니다 (한글은 글자 단위로 넘겨도 자연스러워요)
function layoutText(t) {
  const px = t.sizeR * Math.min(VW, VH);
  const key = VW + "x" + VH + "|" + Math.round(px);
  if (t._key === key && t._str === t.str) return;

  const c = measCtx();
  c.font = memoFontStr(px);
  const maxW = Math.max(px * 2, t.wrapR * VW);
  const lh = px * 1.42;
  const chars = [];
  let cx = 0,
    line = 0;
  for (let i = 0; i < t.str.length; i++) {
    const ch = t.str[i];
    if (ch === "\n") {
      line++;
      cx = 0;
      chars.push({ c: "", x: cx, y: line * lh, w: 0, br: true });
      continue;
    }
    const w = c.measureText(ch).width;
    if (cx + w > maxW && cx > 0) {
      line++;
      cx = 0;
    }
    chars.push({ c: ch, x: cx, y: line * lh, w: w });
    cx += w;
  }
  t.chars = chars;
  t.caret = { x: cx, y: line * lh };
  t.px = px;
  t.lh = lh;
  t._key = key;
  t._str = t.str;
}

// 글자마다 아주 조금씩 삐뚤게 (자판 글씨도 손으로 쓴 것처럼 보이게)
function jitter(seed, i) {
  const a = U.hash01(seed + i * 7.13);
  const b = U.hash01(seed + i * 3.77 + 99);
  return { dx: (a - 0.5) * 0.09, dy: (b - 0.5) * 0.12, rot: (a - 0.5) * 0.07 };
}

// ---------- 새 글 메모 ----------
function newTextMemo(xPx, yPx) {
  const px = memoTextSize();
  const m = Math.max(16, VW * 0.04);
  // 키보드가 아래쪽을 가리므로 글은 화면 위쪽에서 시작하게 둡니다
  const x = U.clamp(xPx, m, VW * 0.7);
  const y = U.clamp(yPx, px, VH * 0.42);
  const t = {
    id: MEMO.nextId++,
    kind: "text",
    str: "",
    x: x / VW,
    y: y / VH,
    sizeR: px / Math.min(VW, VH),
    wrapR: (VW - x - m) / VW,
    gone: [],
    t0: Date.now(),
    lifeMs: FOG_RETURN_MS,
    frozen: false,
    seed: (Math.random() * 1e9) | 0,
  };
  layoutText(t);
  MEMO.strokes.push(t);
  return t;
}

// ---------- 입력칸 ----------
function bindTextInput() {
  const el = document.getElementById("typer");
  TEXT.el = el;
  el.addEventListener("input", () => {
    const t = TEXT.editing;
    if (!t) return;
    t.str = el.value;
    t.t0 = Date.now(); // 쓰는 동안에는 김이 다시 차지 않게
    layoutText(t);
    keepCaretVisible(t);
    TEXT.caretT0 = performance.now();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      stopTyping();
    }
  });
  el.addEventListener("blur", () => {
    if (TEXT.editing) stopTyping();
  });
}

// 폰에서는 키보드가 화면 아래쪽을 가립니다.
// 글이 길어져 커서가 키보드에 가리면, 글 덩어리를 위로 밀어 올려 줍니다.
function keepCaretVisible(t) {
  const vh = window.visualViewport ? window.visualViewport.height : VH;
  const bottom = vh - t.px * 1.3;
  const cy = t.y * VH + t.caret.y;
  if (cy > bottom) t.y = (t.y * VH - (cy - bottom)) / VH;
  const top = t.px * 0.9;
  if (t.y * VH < top) t.y = top / VH;
}

function startTyping(xPx, yPx) {
  if (TEXT.editing) stopTyping();
  const t = newTextMemo(xPx, yPx);
  TEXT.editing = t;
  TEXT.caretT0 = performance.now();
  const el = TEXT.el;
  if (el) {
    el.value = "";
    // 키보드를 띄우려면 사용자가 손을 뗀 그 순간에 바로 focus 해야 합니다 (특히 아이폰)
    el.focus({ preventScroll: true });
  }
  hideIntroHint();
  showHint("빈 곳을 톡 하면 끝나요", 3000);
  return t;
}

function stopTyping() {
  const t = TEXT.editing;
  TEXT.editing = null;
  if (TEXT.el) TEXT.el.blur();
  if (!t) return;
  // 한 글자도 안 쳤으면 없던 일로
  if (!t.str.trim()) {
    const i = MEMO.strokes.indexOf(t);
    if (i >= 0) MEMO.strokes.splice(i, 1);
  }
}

function isTyping() {
  return !!TEXT.editing;
}

// ---------- 그리기 ----------
// 글 덩어리를 한 글자씩 훑으며 callback 을 부릅니다.
// cb(글자, 가운데x, 가운데y, 기울기, 글자폭)
function eachGlyph(t, cb) {
  const src = t.src || t; // 물방울로 모일 때는 원본을 참조
  layoutText(src);
  const ox = src.x * VW,
    oy = src.y * VH;
  const g = src.gone || [];
  const px = src.px;
  for (let i = 0; i < src.chars.length; i++) {
    const ch = src.chars[i];
    if (g[i] || !ch.c) continue;
    const j = jitter(src.seed, i);
    cb(
      ch.c,
      ox + ch.x + ch.w * 0.5 + j.dx * px,
      oy + ch.y + j.dy * px,
      j.rot,
      ch.w,
      px,
      i,
    );
  }
}

// 김 서린 유리에서 글자 자리를 지우기 (손글씨와 같은 질감)
// mode : "halo" = 닦인 자리 가장자리의 밝은 테두리 / "erase" = 실제로 지우기
function memoTextPass(ctx, t, lk, mode) {
  const src = t.src || t;
  layoutText(src);
  const px = src.px;
  ctx.font = memoFontStr(px);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.save();
  if (t.gs !== undefined) {
    // 물방울로 모여드는 중 : 가운데로 오그라듦
    ctx.translate(t.gc.x, t.gc.y);
    ctx.scale(t.gs, t.gs);
    ctx.translate(-t.gc.x, -t.gc.y);
  }
  eachGlyph(t, (c, x, y, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (mode === "halo") {
      ctx.strokeStyle = "rgba(255,255,255," + 0.2 * lk.a + ")";
      ctx.lineWidth = px * 0.3;
      ctx.strokeText(c, 0, 0);
    } else {
      ctx.strokeStyle = "rgba(0,0,0," + 0.4 * lk.a + ")";
      ctx.lineWidth = px * 0.3;
      ctx.strokeText(c, 0, 0);
      ctx.fillStyle = "rgba(0,0,0," + lk.a + ")";
      ctx.fillText(c, 0, 0);
      ctx.strokeStyle = "rgba(0,0,0," + lk.a + ")";
      ctx.lineWidth = px * 0.1;
      ctx.strokeText(c, 0, 0);
    }
    ctx.restore();
  });
  ctx.restore();
}

// 치는 중에 깜빡이는 커서
function drawCaret(ctx, now) {
  const t = TEXT.editing;
  if (!t) return;
  layoutText(t);
  const on = ((now - TEXT.caretT0) % 1060) < 620;
  if (!on) return;
  const x = t.x * VW + t.caret.x;
  const y = t.y * VH + t.caret.y;
  const h = t.px * 0.92;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(2, t.px * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 2, y - h / 2);
  ctx.lineTo(x + 2, y + h / 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- 입김으로 글자 지우기 ----------
// 원 안에 들어온 글자만 하나씩 사라집니다 (문장 가운데가 지워지는 모습)
function trimText(t, cx, cy, rr) {
  const r2 = rr * rr;
  let left = 0,
    cut = false;
  if (!t.gone) t.gone = [];
  eachGlyph(t, (c, x, y, rot, w, px, i) => {
    const dx = x - cx,
      dy = y - cy;
    if (dx * dx + dy * dy < r2) {
      t.gone[i] = true;
      cut = true;
    } else left++;
  });
  return { empty: left === 0, cut: cut };
}

// ---------- 성에(얼리기)용 ----------
// 글자를 하나씩 순서대로 덮으며 얼어붙습니다
function memoTextUnion(ctx, t, k, add, p) {
  const src = t.src || t;
  layoutText(src);
  const px = src.px;
  const n = src.chars.length || 1;
  ctx.font = memoFontStr(px);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  eachGlyph(t, (c, x, y, rot, w, _px, i) => {
    if (i / n > p) return; // 아직 얼지 않은 글자
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.lineWidth = px * 0.18 * k + add;
    ctx.strokeText(c, 0, 0);
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
}

// 반짝임이 맺힐 자리
function memoTextSparkles(t) {
  const sp = [];
  let i = 0;
  eachGlyph(t, (c, x, y) => {
    if (i++ % 3 === 0) sp.push(x, y, U.hash01(x + y) * TAU);
  });
  return sp;
}

// ---------- 물방울 안에 글 그리기 ----------
function memoTextBounds(t) {
  layoutText(t);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  eachGlyph(t, (c, x, y, rot, w, px) => {
    if (x - w / 2 < x0) x0 = x - w / 2;
    if (x + w / 2 > x1) x1 = x + w / 2;
    if (y - px / 2 < y0) y0 = y - px / 2;
    if (y + px / 2 > y1) y1 = y + px / 2;
  });
  if (x0 > x1) return null;
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}

// 물방울(또는 펼친 화면) 안에 s 배율로 글을 그립니다
function drawTextScaled(ctx, t, s) {
  layoutText(t);
  const px = t.px * s;
  ctx.font = memoFontStr(px);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  eachGlyph(t, (c, x, y, rot) => {
    ctx.save();
    ctx.translate(x * s, y * s);
    ctx.rotate(rot);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = Math.max(1.5, px * 0.26);
    ctx.strokeText(c, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
}

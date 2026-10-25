const TEXT_FONT =
  "'Nanum Pen Script', 'Gaegu', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

const TEXT = {
  editing: null,
  el: null,
  caretT0: 0,
};

function memoTextSize() {
  return U.clamp(wipeWidth() * 1.9, 18, 64);
}

let _meas = null;
function measCtx() {
  if (!_meas) _meas = document.createElement("canvas").getContext("2d");
  return _meas;
}
function memoFontStr(px) {
  return Math.round(px) + "px " + TEXT_FONT;
}

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

function jitter(seed, i) {
  const a = U.hash01(seed + i * 7.13);
  const b = U.hash01(seed + i * 3.77 + 99);
  return { dx: (a - 0.5) * 0.09, dy: (b - 0.5) * 0.12, rot: (a - 0.5) * 0.07 };
}

function newTextMemo(xPx, yPx) {
  const px = memoTextSize();
  const m = Math.max(16, VW * 0.04);

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

function bindTextInput() {
  const el = document.getElementById("typer");
  TEXT.el = el;
  el.addEventListener("input", () => {
    const t = TEXT.editing;
    if (!t) return;
    t.str = el.value;
    t.t0 = Date.now();
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

  if (!t.str.trim()) {
    const i = MEMO.strokes.indexOf(t);
    if (i >= 0) MEMO.strokes.splice(i, 1);
  }
}

function isTyping() {
  return !!TEXT.editing;
}

function eachGlyph(t, cb) {
  const src = t.src || t;
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
    if (i / n > p) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.lineWidth = px * 0.18 * k + add;
    ctx.strokeText(c, 0, 0);
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
}

function memoTextSparkles(t) {
  const sp = [];
  let i = 0;
  eachGlyph(t, (c, x, y) => {
    if (i++ % 3 === 0) sp.push(x, y, U.hash01(x + y) * TAU);
  });
  return sp;
}

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

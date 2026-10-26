
const TEXT_FONT =
  "'Hippie', 'Nanum Pen Script', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

const TEXT = {
  editing: null,
  el: null,
  caretT0: 0,
  selected: null,
  placing: false,
  drag: null,
  dragging: false,
};

function memoTextSize() {
  return U.clamp(Math.min(VW, VH) * 0.036, 17, 28);
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
  const key = VW + "x" + VH + "|" + Math.round(px) + "|" + Math.round(t.wrapR * 1000);
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
  const x = U.clamp(xPx, m, VW - m * 3);
  const y = U.clamp(yPx, px, sillTop() - px);
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
    scheduleSave();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      stopTyping();
    }
  });
  el.addEventListener("blur", () => {
    if (TEXT.dragging || performance.now() - (TEXT.uiTouch || 0) < 700) {
      setTimeout(() => {
        if (TEXT.editing) el.focus({ preventScroll: true });
      }, 0);
      return;
    }
    if (TEXT.editing) stopTyping();
  });

  if (document.fonts && document.fonts.load) {
    try {
      const p = document.fonts.load("24px " + TEXT_FONT.split(",")[0].trim());
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      for (const s of MEMO.strokes) if (s.kind === "text") s._key = "";
      for (const m of DROPS.archive) for (const st of m.strokes) if (st.text) st._key = "";
    });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (TEXT.editing && !TEXT.dragging) keepCaretVisible(TEXT.editing);
    });
  }
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
  syncTypeBtn();
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
  TEXT.selected = null;
  TEXT.placing = false;
  endTextDrag();
  syncTypeBtn();
  if (TEXT.el) TEXT.el.blur();
  if (!t) return;
  if (!t.str.trim()) {
    const i = MEMO.strokes.indexOf(t);
    if (i >= 0) MEMO.strokes.splice(i, 1);
  }
  scheduleSave();
}

function isTyping() {
  return !!TEXT.editing;
}

function startPlacing() {
  if (TEXT.editing) stopTyping();
  TEXT.placing = true;
  syncTypeBtn();
  hideIntroHint();
  showHint("글을 쓸 곳을 톡 하세요", 4000);
}
function cancelPlacing() {
  TEXT.placing = false;
  syncTypeBtn();
}
function keepTypingOnUI(el) {
  if (!el) return;
  el.addEventListener("pointerdown", () => {
    TEXT.uiTouch = performance.now();
  });
  el.addEventListener("mousedown", (e) => {
    if (TEXT.editing) e.preventDefault();
  });
}

function syncTypeBtn() {
  const b = document.getElementById("typeBtn");
  if (b) b.classList.toggle("on", TEXT.placing || !!TEXT.editing);
}
function isPlacing() {
  return TEXT.placing;
}

function handleR() {
  return U.clamp(Math.min(VW, VH) * 0.015, 7, 10);
}

function activeText() {
  return TEXT.editing || TEXT.selected;
}

function selectText(t) {
  if (TEXT.editing && TEXT.editing !== t) stopTyping();
  TEXT.selected = t;
}

function clearTextSelection() {
  if (TEXT.editing) stopTyping();
  TEXT.selected = null;
}

function textBoxRect(t) {
  layoutText(t);
  const px = t.px;
  const pad = px * 0.42;

  let wMax = 0, lines = 1;
  for (const ch of t.chars) {
    if (!ch.br) wMax = Math.max(wMax, ch.x + ch.w);
    lines = Math.max(lines, Math.round(ch.y / t.lh) + 1);
  }
  wMax = Math.max(wMax, t.caret.x);
  lines = Math.max(lines, Math.round(t.caret.y / t.lh) + 1);
  wMax = Math.max(wMax, px * 1.2);

  return {
    x: t.x * VW - pad,
    y: t.y * VH - px * 0.62 - pad,
    w: wMax + pad * 2,
    h: (lines - 1) * t.lh + px * 1.24 + pad * 2,
  };
}

function textHandleAt(x, y) {
  const t = activeText();
  if (!t) return null;
  const r = textBoxRect(t);
  const hr = Math.max(handleR() * 2.8, 20);
  if (Math.hypot(x - (r.x + r.w), y - (r.y + r.h)) < hr) return "size";
  return null;
}

function textMemoAt(x, y) {
  for (let i = MEMO.strokes.length - 1; i >= 0; i--) {
    const s = MEMO.strokes[i];
    if (s.kind !== "text" || s.frozen) continue;
    if (!s.str && s !== activeText()) continue;
    const r = textBoxRect(s);
    if (x > r.x - 8 && x < r.x + r.w + 8 && y > r.y - 8 && y < r.y + r.h + 8) return s;
  }
  return null;
}

function editText(t) {
  if (TEXT.editing === t) return;
  if (TEXT.editing) stopTyping();
  TEXT.placing = false;
  TEXT.editing = t;
  t.t0 = Date.now();
  TEXT.caretT0 = performance.now();
  syncTypeBtn();
  const el = TEXT.el;
  if (el) {
    el.value = t.str;
    try {
      el.setSelectionRange(t.str.length, t.str.length);
    } catch (e) {}
    el.focus({ preventScroll: true });
  }
}

function beginTextDrag(kind, x, y, target) {
  const t = target || activeText();
  if (!t) return;
  layoutText(t);
  TEXT.drag = {
    kind: kind,
    t: t,
    sx: x,
    sy: y,
    x0: t.x,
    y0: t.y,
    sizeR0: t.sizeR,
    wrapR0: t.wrapR,
    ox: t.x * VW,
    oy: t.y * VH,
    d0: Math.max(30, Math.hypot(x - t.x * VW, y - t.y * VH)),
  };
  TEXT.dragging = true;
}

function moveTextDrag(x, y) {
  const d = TEXT.drag;
  if (!d) return;
  const t = d.t;
  const m = Math.max(12, VW * 0.03);
  layoutText(t);

  if (d.kind === "move") {
    t.x = U.clamp(d.x0 * VW + (x - d.sx), m, VW - m - t.px * 1.5) / VW;
    t.y = U.clamp(d.y0 * VH + (y - d.sy), t.px * 0.9, sillTop() - t.px) / VH;
    t.wrapR = Math.min(t.wrapR, (VW - t.x * VW - m) / VW);
  } else {
    const unit = Math.min(VW, VH);
    const raw = Math.hypot(x - d.ox, y - d.oy) / d.d0;
    const k = U.clamp(Math.pow(raw, 0.75), 0.25, 5);
    t.sizeR = U.clamp(d.sizeR0 * k, 13 / unit, (unit * 0.13) / unit);
    const realK = t.sizeR / d.sizeR0;
    t.wrapR = U.clamp(
      d.wrapR0 * realK,
      (t.sizeR * unit * 2.5) / VW,
      (VW - t.x * VW - m) / VW,
    );
  }
  layoutText(t);
}

function endTextDrag() {
  TEXT.drag = null;
  TEXT.dragging = false;
  scheduleSave();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawHandle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0, TAU);
  ctx.fillStyle = "rgba(20,32,48,0.22)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.fill();

  ctx.strokeStyle = "#1b2735";
  ctx.lineWidth = Math.max(1.1, r * 0.15);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const a = r * 0.46;
  const t2 = a * 0.72;
  ctx.beginPath();
  ctx.moveTo(x - a, y - a);
  ctx.lineTo(x + a, y + a);
  ctx.moveTo(x + a, y + a - t2);
  ctx.lineTo(x + a, y + a);
  ctx.lineTo(x + a - t2, y + a);
  ctx.moveTo(x - a, y - a + t2);
  ctx.lineTo(x - a, y - a);
  ctx.lineTo(x - a + t2, y - a);
  ctx.stroke();
}

function drawTextFrame(ctx) {
  const t = activeText();
  if (!t) return;
  const r = textBoxRect(t);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.4;
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.stroke();
  ctx.setLineDash([]);
  drawHandle(ctx, r.x + r.w, r.y + r.h, handleR());
  ctx.restore();
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

function drawTextScaled(ctx, t, s, ice) {
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
    if (ice) {
      ctx.strokeStyle = "rgba(142,184,236,0.6)";
      ctx.lineWidth = Math.max(2, px * 0.4);
      ctx.strokeText(c, 0, 0);
      ctx.strokeStyle = "rgba(236,247,255,0.95)";
      ctx.lineWidth = Math.max(1.2, px * 0.17);
      ctx.strokeText(c, 0, 0);
      ctx.fillStyle = "rgba(246,252,255,0.98)";
      ctx.fillText(c, 0, 0);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = Math.max(1.5, px * 0.26);
      ctx.strokeText(c, 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.97)";
      ctx.fillText(c, 0, 0);
    }
    ctx.restore();
  });
}


const DROPS = {
  archive: [],
  list: [],
  open: null,
  dimOut: 0,
  hidden: [],
  spacing: 0,
  shelf: { open: false, p: 0, scroll: 0 },
};

function sillH() { return Math.max(46, VH * 0.085); }
function sillTop() { return VH - sillH(); }
function dropBaseR() { return U.clamp(Math.min(VW, VH) * 0.06, 22, 32); }

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
  mem._bb = {
    key: key,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    w: Math.max(x1 - x0, 1), h: Math.max(y1 - y0, 1),
    span: Math.max(x1 - x0, y1 - y0, 60),
  };
  return mem._bb;
}

function paintMemoScaled(ctx, mem, s, k, lwMax) {
  const bb = memoBBox(mem);
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.translate(-bb.cx * s, -bb.cy * s);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const st of mem.strokes) {
    if (st.text) { drawTextScaled(ctx, st, s, st.ice); continue; }
    const lw = U.clamp(st.w * s * 0.32, 1.1, lwMax);
    tracePts(ctx, st.pts, VW * s, VH * s);
    if (st.ice) {
      ctx.strokeStyle = "rgba(142,184,236,0.55)";
      ctx.lineWidth = lw * 3.4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(236,247,255,0.95)";
      ctx.lineWidth = lw * 1.7;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = lw * 0.55;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = lw * 2.3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.96)";
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function makeInner(mem, k) {
  return function (ctx, r) {
    const bb = memoBBox(mem);
    paintMemoScaled(ctx, mem, (r * 1.32) / bb.span, k, Math.max(1.4, r * 0.1));
  };
}

function makeDropObj(mem, state) {
  return {
    mem: mem, state: state, x: 0, y: 0, r: 0, R: dropBaseR(), tx: 0, ty: 0,
    v: 0, t0: performance.now(), nseed: Math.random() * 100, hidden: false, sx: 1, sy: 1, alpha: 1,
  };
}

function rebuildDrops() {
  DROPS.list = DROPS.archive.map((mem) => makeDropObj(mem, "rest"));
  layoutDrops(1);
  for (const d of DROPS.list) { d.x = d.tx; d.y = d.ty; d.r = d.R; }
}

const MAX_PER_ROW = 10;

function layoutDrops(dt) {
  const vis = DROPS.list.filter((d) => d.state !== "evap").sort((a, b) => a.mem.ts - b.mem.ts);
  const DR = dropBaseR();
  const margin = 14 + DR;
  const dw = drawerRect().w + 18;
  const usable = Math.max(DR * 4, VW - 2 * margin - dw);

  const perRow = Math.min(MAX_PER_ROW, Math.max(2, Math.floor(usable / (DR * 2.95)) + 1));
  const spacing = Math.min(usable / Math.max(1, perRow - 1), DR * 3);
  const startX = margin + (usable - (perRow - 1) * spacing) / 2;
  DROPS.spacing = spacing;

  const hiddenN = Math.max(0, vis.length - perRow);
  const top = sillTop();
  DROPS.hidden = [];
  vis.forEach((d, i) => {
    d.R = DR;
    const k = i - hiddenN;
    d.hidden = k < 0;
    if (d.hidden) { DROPS.hidden.push(d); return; }
    d.tx = startX + k * spacing;
    d.ty = top - d.R * 0.8;
  });
}

function drawerRect() {
  const R = dropBaseR();
  const w = R * 2.1, h = R * 1.9;
  return { x: VW - w - 12, y: sillTop() - h * 0.66, w: w, h: h };
}

function hitDrawer(x, y) {
  if (!DROPS.hidden.length || DROPS.open || DROPS.shelf.open) return false;
  const r = drawerRect();
  return x > r.x - 8 && x < r.x + r.w + 8 && y > r.y - 8 && y < r.y + r.h + 12;
}

function drawDrawer(ctx) {
  const n = DROPS.hidden.length;
  if (!n || DROPS.shelf.open) return;
  const r = drawerRect(), rad = r.w * 0.22;

  ctx.save();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = "rgba(226,238,252,0.3)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.save();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.clip();
  const br = r.w * 0.2;
  for (let i = 0; i < Math.min(3, n); i++) {
    const bx = r.x + r.w * (0.3 + i * 0.2);
    const by = r.y + r.h * (0.66 - i * 0.07);
    ctx.globalAlpha = 0.5 + i * 0.16;
    ctx.fillStyle = "rgba(170,205,245,0.85)";
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.32, br * 0.26, 0, TAU); ctx.fill();
  }
  ctx.restore();

  const fs = U.clamp(r.w * 0.3, 9, 13);
  ctx.font = labelFont(fs);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(8,16,28,0.5)";
  ctx.shadowBlur = fs * 0.8;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(String(n), r.x + r.w * 0.5, r.y + r.h * 0.28);
  ctx.restore();
}

function openShelf() { DROPS.shelf.open = true; DROPS.shelf.scroll = 0; }
function closeShelf() { DROPS.shelf.open = false; }

function shelfGeom() {
  const list = DROPS.hidden.slice().reverse();
  const R = dropBaseR() * 0.9;
  const gap = R * 1.1;
  const cell = R * 2 + gap;
  const side = Math.max(14, VW * 0.05);
  const cols = Math.max(2, Math.floor((VW - side * 2 + gap) / cell));
  const gw = cols * cell - gap;
  const x0 = (VW - gw) / 2 + R;
  const y0 = Math.max(78, VH * 0.17) + R;
  const rowH = cell + R * 0.6;
  const cells = list.map((d, i) => ({
    d: d, r: R,
    x: x0 + (i % cols) * cell,
    y: y0 + Math.floor(i / cols) * rowH - DROPS.shelf.scroll,
  }));
  const rows = Math.ceil(list.length / cols) || 1;
  return { cells: cells, r: R, rowH: rowH, bottom: y0 + rows * rowH + R };
}

function shelfMaxScroll() {
  const g = shelfGeom();
  return Math.max(0, g.bottom + DROPS.shelf.scroll - (VH - 24));
}

function shelfIconPos(c) {
  return { x: c.x + c.r * 0.8, y: c.y - c.r * 0.72, r: U.clamp(c.r * 0.28, 7, 9.5) };
}

function hitShelfCell(x, y) {
  if (!DROPS.shelf.open) return null;
  for (const c of shelfGeom().cells) {
    if (Math.hypot(x - c.x, y - c.y) < c.r * 1.2) return c.d;
  }
  return null;
}

function hitShelfIcon(x, y) {
  if (!DROPS.shelf.open) return null;
  for (const c of shelfGeom().cells) {
    const ic = shelfIconPos(c);
    if (Math.hypot(x - ic.x, y - ic.y) < ic.r + 7) return c.d;
  }
  return null;
}

function removeMemo(d) {
  DROPS.archive = DROPS.archive.filter((m) => m !== d.mem);
  DROPS.list = DROPS.list.filter((x) => x !== d);
  saveState();
}

function drawShelf(ctx) {
  const sh = DROPS.shelf;
  if (sh.p < 0.005) return;
  const e = U.easeOut(sh.p);

  ctx.save();
  ctx.globalAlpha = e;
  ctx.fillStyle = "rgba(8,14,24,0.66)";
  ctx.fillRect(0, 0, VW, VH);

  const g = shelfGeom();
  const fs = U.clamp(g.r * 0.34, 8, 11);

  ctx.font = labelFont(U.clamp(VW * 0.038, 14, 18));
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("지난 메모 " + DROPS.hidden.length, VW / 2, Math.max(52, VH * 0.11));

  ctx.font = labelFont(fs);
  ctx.textBaseline = "top";
  for (const c of g.cells) {
    if (c.y < -c.r * 2 || c.y > VH + c.r * 2) continue;
    paintDrop(ctx, c.x, c.y, c.r, { spread: 3.2, inner: makeInner(c.d.mem, 1) });
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(stamp(c.d.mem.ts), c.x, c.y + c.r * 1.05 + 5);

    const ic = shelfIconPos(c);
    const k = ic.r * 0.36;
    ctx.fillStyle = "rgba(18,30,46,0.6)";
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ic.x - k, ic.y - k); ctx.lineTo(ic.x + k, ic.y + k);
    ctx.moveTo(ic.x + k, ic.y - k); ctx.lineTo(ic.x - k, ic.y + k);
    ctx.stroke();
  }
  ctx.restore();
}

function archiveAll() {
  if (isTyping()) stopTyping();
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
        ? { text: 1, ice: !!s.frozen, str: s.str, x: s.x, y: s.y, sizeR: s.sizeR, wrapR: s.wrapR, gone: (s.gone || []).slice(), seed: s.seed }
        : { ice: !!s.frozen, pts: s.pts.slice(), w: s.w },
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

function updateDrops(now, dt) {
  const o = DROPS.open;
  if (o) {
    o.p = U.clamp(o.p + o.dir * (dt / 0.36), 0, 1);
    if (o.dir < 0 && o.p <= 0) DROPS.open = null;
  } else if (DROPS.dimOut > 0) {
    DROPS.dimOut = Math.max(0, DROPS.dimOut - dt * 1.6);
  }
  const sh = DROPS.shelf;
  if (sh.open && !DROPS.hidden.length) sh.open = false;
  sh.p = U.clamp(sh.p + (sh.open ? 1 : -1) * (dt / 0.28), 0, 1);

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
      const nz = U.noise1(d.nseed + now * 0.0021);
      const u = U.clamp((nz - 0.22) / 0.4, 0, 1);
      const vT = 170 + 1500 * u * u;
      d.v += (vT - d.v) * Math.min(1, dt * 4.5);
      d.y += d.v * dt;
      const prog = U.clamp((d.y - d.y0) / Math.max(60, d.ty - d.y0), 0, 1);
      d.x = d.x0 + (U.noise1(d.nseed * 2 + d.y * 0.012) - 0.5) * d.R * 1.1 * Math.sin(prog * Math.PI);
      const st = 1 + Math.min(0.34, d.v / 3400);
      d.sy = st; d.sx = 1 / Math.sqrt(st);
      if (d.trail) extendStroke(d.trail, d.x, d.y);
      if (d.y >= d.ty) {
        d.state = "land"; d.t0 = now; d.y = d.ty;
        if (d.trail) { d.trail.lifeMs = 2000; d.trail.t0 = Date.now() - 2000 * 0.6; d.trail = null; }
      }
    } else if (d.state === "land") {
      const p = (now - d.t0) / 650;
      const s = Math.sin(p * Math.PI * 2.4) * Math.exp(-p * 4.2) * 0.24;
      d.sy = 1 - s; d.sx = 1 + s * 0.85;
      d.y = d.ty;
      d.x += (d.tx - d.x) * Math.min(1, dt * 5);
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

function drawSill(ctx) {
  const top = sillTop(), h = VH - top;
  const k = 0.4 + 0.6 * (1 - SKY.dark);
  const c = (r, g, b) => "rgb(" + (r * k | 0) + "," + (g * k | 0) + "," + (b * k | 0) + ")";

  const wet = ctx.createLinearGradient(0, top - 18, 0, top);
  wet.addColorStop(0, "rgba(235,246,255,0)");
  wet.addColorStop(1, "rgba(235,246,255," + (0.3 * k) + ")");
  ctx.fillStyle = wet;
  ctx.fillRect(0, top - 18, VW, 18);

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
  const gr = ctx.createLinearGradient(0, top, 0, top + 7);
  gr.addColorStop(0, "rgba(20,30,44,0.28)");
  gr.addColorStop(1, "rgba(20,30,44,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, top, VW, 7);
}

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
  drawDropLabels(ctx);
  drawDropIcons(ctx);
  drawDrawer(ctx);
}

function stamp(ts, withTime) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  const day = p(d.getFullYear() % 100) + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate());
  return withTime ? day + " \u00b7 " + p(d.getHours()) + ":" + p(d.getMinutes()) : day;
}

const LABEL_CACHE = new Map();
function labelSprite(label, fs, fg, glow, blur) {
  const key = label + "|" + Math.round(fs * 10) + "|" + fg + "|" + glow;
  const hit = LABEL_CACHE.get(key);
  if (hit) return hit;

  const pad = Math.ceil(blur * 1.8) + 2;
  const probe = measCtx();
  probe.font = labelFont(fs);
  const w = Math.ceil(probe.measureText(label).width);
  const W = w + pad * 2, H = Math.ceil(fs * 1.9) + pad * 2;

  const pd = Math.min(3, PD || 2);
  const c = document.createElement("canvas");
  c.width = Math.ceil(W * pd); c.height = Math.ceil(H * pd);
  const x = c.getContext("2d");
  x.scale(pd, pd);
  x.font = labelFont(fs);
  x.textAlign = "center";
  x.textBaseline = "top";
  x.fillStyle = fg;
  x.shadowColor = glow;
  x.shadowBlur = blur;
  x.fillText(label, W / 2, pad);
  x.shadowColor = "transparent";
  x.shadowBlur = 0;
  x.fillText(label, W / 2, pad);

  const spr = { c: c, w: W, h: H, ox: W / 2, oy: pad };
  if (LABEL_CACHE.size > 60) LABEL_CACHE.clear();
  LABEL_CACHE.set(key, spr);
  return spr;
}

function labelFont(px) {
  return "500 " + px.toFixed(1) + "px -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
}

function drawDropLabels(ctx) {
  let fs = U.clamp(dropBaseR() * 0.34, 7.5, 11);
  ctx.save();

  ctx.font = labelFont(fs);
  const avail = Math.max(40, (DROPS.spacing || dropBaseR() * 3) - 8);
  const w = ctx.measureText("00/00/00").width;
  if (w > avail) fs = Math.max(6.5, fs * (avail / w));
  ctx.font = labelFont(fs);

  const dk = SKY ? SKY.dark : 0;
  const t = U.smooth(U.clamp((dk - 0.42) / 0.16, 0, 1));
  const fg = U.rgb(U.mix([38, 54, 76], [250, 253, 255], t), 0.92);
  const glow = U.rgb(U.mix([255, 255, 255], [4, 10, 20], t), 0.8);
  const blur = Math.max(3, fs * 0.8);

  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest") continue;
    if (DROPS.open && DROPS.open.drop === d) continue;
    const label = stamp(d.mem.ts);
    const y = d.y + d.R * 0.98 + 10;
    ctx.globalAlpha = d.alpha === undefined ? 1 : d.alpha;
    const spr = labelSprite(label, fs, fg, glow, blur);
    ctx.drawImage(spr.c, d.x - spr.ox, y - spr.oy, spr.w, spr.h);
  }
  ctx.restore();
}

function dropIconPos(d) {
  return { x: d.x + d.R * 0.8, y: d.y - d.R * 0.72, r: U.clamp(dropBaseR() * 0.26, 6.5, 8.5) };
}

function hitDropIcon(x, y) {
  if (DROPS.open) return null;
  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest") continue;
    const ic = dropIconPos(d);
    if (Math.hypot(x - ic.x, y - ic.y) < ic.r + 7) return d;
  }
  return null;
}

function drawDropIcons(ctx) {
  for (const d of DROPS.list) {
    if (d.hidden || d.state !== "rest" || (DROPS.open && DROPS.open.drop === d)) continue;
    const ic = dropIconPos(d), k = ic.r * 0.36;
    ctx.save();
    ctx.fillStyle = "rgba(18,30,46,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ic.x - k, ic.y - k); ctx.lineTo(ic.x + k, ic.y + k);
    ctx.moveTo(ic.x + k, ic.y - k); ctx.lineTo(ic.x - k, ic.y + k);
    ctx.stroke();
    ctx.restore();
  }
}

function evaporateDrop(d) {
  d.r0 = d.r; d.state = "evap"; d.t0 = performance.now(); d.alpha = 1;
  DROPS.archive = DROPS.archive.filter((m) => m !== d.mem);
  startBreath(d.x, d.y, d.R * 1.8, false);
  saveState();
}

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

function openDrop(d) {
  DROPS.open = { drop: d, p: 0, dir: 1 };
  DROPS.dimOut = 0;
}
function closeOpen() { if (DROPS.open) DROPS.open.dir = -1; }

function openRect() {
  const o = DROPS.open;
  if (!o) return null;
  const e = U.easeOut(o.p), d = o.drop;

  const k = U.lerp((d.r * 2) / VW, 1, e);
  const cx = U.lerp(d.x, VW / 2, e);
  const cy = U.lerp(d.y, VH / 2, e);
  return { x: cx - (VW * k) / 2, y: cy - (VH * k) / 2, w: VW * k, h: VH * k, cx: cx, cy: cy, e: e, k: k };
}

function openGeom() {
  const R = openRect();
  if (!R) return null;
  const d = DROPS.open.drop;
  return { x: R.cx, y: R.cy, r: U.lerp(d.r, Math.min(VW, VH) * 0.33, R.e), e: R.e, rect: R };
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

  const d = o.drop, R = g.rect;
  const rad = U.lerp(Math.min(22, VW * 0.06), 0, R.e);

  if (R.e < 0.99) {
    ctx.save();
    ctx.shadowColor = "rgba(4,10,20,0.5)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    roundRectPath(ctx, R.x, R.y, R.w, R.h, rad);
    ctx.fillStyle = "rgba(12,22,36,0.6)";
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundRectPath(ctx, R.x, R.y, R.w, R.h, rad);
  ctx.clip();

  ctx.drawImage(SCENE.c, R.x, R.y, R.w, R.h);
  if (FOGB) {
    ctx.globalAlpha = 0.24;
    ctx.drawImage(FOGB.c, R.x, R.y, R.w, R.h);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = getIcePattern();
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(12,22,38,0.18)";
  ctx.fillRect(R.x, R.y, R.w, R.h);

  const bb = memoBBox(d.mem);
  ctx.save();
  ctx.translate(R.x + bb.cx * R.k, R.y + bb.cy * R.k);
  paintMemoScaled(ctx, d.mem, R.k, 1, Math.max(1.6, 14 * R.k));
  ctx.restore();

  if (d.mem.ice) {
    ctx.save();
    ctx.globalAlpha = 0.16 * R.e;
    ctx.fillStyle = getIcePattern();
    ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.globalAlpha = R.e;
    ctx.fillStyle = "rgba(168,206,246,0.11)";
    ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.restore();
  }

  const sh = ctx.createLinearGradient(R.x, R.y, R.x + R.w * 0.75, R.y + R.h);
  sh.addColorStop(0, "rgba(255,255,255,0.15)");
  sh.addColorStop(0.42, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(255,255,255,0.06)");
  ctx.fillStyle = sh;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.restore();

  if (R.e < 0.99) {
    ctx.save();
    roundRectPath(ctx, R.x + 0.75, R.y + 0.75, R.w - 1.5, R.h - 1.5, rad);
    ctx.strokeStyle = "rgba(255,255,255," + 0.5 * (1 - R.e) + ")";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  if (R.e > 0.7) {
    const when = stamp(d.mem.ts, true);
    ctx.save();
    ctx.globalAlpha = (R.e - 0.7) / 0.3;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = labelFont(14);
    ctx.letterSpacing = "0.02em";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(when, VW / 2, VH - U.clamp(VH * 0.035, 22, 40));
    ctx.restore();
  }
}

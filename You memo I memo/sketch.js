
let VW, VH, PD;
let SKY = null;
let FOGW = null;
let OVL = null;
let READY = false;
let lastBuild = 0;
let resizeTimer = null;
let introShown = false;

function currentHour() {
  const q = new URLSearchParams(location.search).get("hour");
  if (q !== null && !isNaN(parseFloat(q))) return parseFloat(q);
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function setup() {
  VW = windowWidth; VH = windowHeight; PD = U.pickPD(VW, VH);
  createCanvas(VW, VH);
  pixelDensity(PD);
  const el = drawingContext.canvas;
  el.style.touchAction = "none";

  loadState();
  rebuildAll();
  rebuildDrops();
  bindGestures(el);
  bindUI();
  READY = true;

  if (!MEMO.strokes.length && !DROPS.archive.length) showHint("유리 위를 문질러 보세요", 5200, true);
}

function rebuildAll() {
  SCENE = U.layer(VW, VH, PD);
  SKY = renderScene(SCENE, currentHour());
  buildFog(SKY);
  FOGW = U.layer(VW, VH, PD);
  FROSTL = U.layer(VW, VH, PD);
  ICEB = U.layer(VW, VH, PD);
  ICET = U.layer(VW, VH, PD);
  frostDirty = true;
  buildOverlay();
  lastBuild = Date.now();
}

function refreshScene() {
  SKY = renderScene(SCENE, currentHour());
  buildFog(SKY);
  lastBuild = Date.now();
}

function buildOverlay() {
  OVL = U.layer(VW, VH, PD);
  const x = OVL.x;
  const vg = x.createRadialGradient(VW / 2, VH * 0.46, Math.min(VW, VH) * 0.34, VW / 2, VH * 0.5, Math.max(VW, VH) * 0.82);
  vg.addColorStop(0, "rgba(6,12,22,0)");
  vg.addColorStop(1, "rgba(6,12,22,0.4)");
  x.fillStyle = vg;
  x.fillRect(0, 0, VW, VH);
  const sh = x.createLinearGradient(0, 0, VW, VH * 0.75);
  sh.addColorStop(0, "rgba(255,255,255,0.075)");
  sh.addColorStop(0.35, "rgba(255,255,255,0)");
  sh.addColorStop(0.72, "rgba(255,255,255,0.035)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = sh;
  x.fillRect(0, 0, VW, VH);
}

function windowResized() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (Math.abs(windowWidth - VW) < 2 && Math.abs(windowHeight - VH) < 2) return;
    VW = windowWidth; VH = windowHeight; PD = U.pickPD(VW, VH);
    resizeCanvas(VW, VH);
    pixelDensity(PD);
    rebuildAll();
    if (isTyping()) keepCaretVisible(TEXT.editing);
  }, 200);
}

function draw() {
  if (!READY) return;
  const now = performance.now(), wall = Date.now();
  const dt = Math.min(0.05, (deltaTime || 16) / 1000);

  if (wall - lastBuild > 300000) refreshScene();

  updateGestures(now, dt);
  if (isTyping() && !TEXT.dragging) keepCaretVisible(TEXT.editing);
  updateBreaths(now);
  MEMO.strokes = MEMO.strokes.filter((s) => s.frozen || strokeLook(s, wall));
  updateDrops(now, dt);

  const ctx = drawingContext;
  ctx.drawImage(SCENE.c, 0, 0, VW, VH);

  const fx = FOGW.x;
  fx.globalCompositeOperation = "source-over";
  fx.clearRect(0, 0, VW, VH);
  fx.drawImage(FOGB.c, 0, 0, VW, VH);
  paintMask(fx, MEMO.strokes.concat(AMBIENT, gatherStrokes(now)), wall);
  ctx.drawImage(FOGW.c, 0, 0, VW, VH);

  drawFrost(ctx, now);
  drawBlooms(ctx, now);
  drawSill(ctx);
  drawDrops(ctx, now);
  drawTextFrame(ctx);
  drawCaret(ctx, now);
  drawShelf(ctx);
  drawOpenView(ctx);
  drawCues(ctx);
  syncOpenUI();
  ctx.drawImage(OVL.c, 0, 0, VW, VH);
}

let openUIOn = false;
function syncOpenUI() {
  const on = !!DROPS.open || DROPS.shelf.open;
  if (on === openUIOn) return;
  openUIOn = on;
  document.body.classList.toggle("viewing", on);
}

let hintTimer = null;
function showHint(text, ms, isIntro) {
  const el = document.getElementById("hint");
  if (!el) return;
  introShown = !!isIntro;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove("show"), ms || 2600);
}
function hideIntroHint() {
  if (!introShown) return;
  introShown = false;
  const el = document.getElementById("hint");
  if (el) el.classList.remove("show");
}

function bindSize() {
  const btn = document.getElementById("sizeBtn");
  const dot = document.getElementById("sizeDot");
  function show() {
    wipeWidth();
    const d = BRUSH_DOTS[brushStep];
    dot.style.width = d + "px";
    dot.style.height = d + "px";
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    nextBrush();
    show();
  });
  show();
}

function bindUI() {
  bindSize();
  bindTextInput();
  ["sizeBtn", "typeBtn", "resetBtn", "helpBtn"].forEach((id) =>
    keepTypingOnUI(document.getElementById(id)),
  );

  const tb = document.getElementById("typeBtn");
  tb.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isTyping()) stopTyping();
    else if (isPlacing()) cancelPlacing();
    else startPlacing();
  });
  const btn = document.getElementById("helpBtn"), panel = document.getElementById("helpPanel");
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.classList.toggle("show"); });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove("show");
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetAll();
    panel.classList.remove("show");
  });
}

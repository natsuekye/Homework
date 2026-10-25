// =====================================================
// sketch.js : p5.js 의 setup / draw 에서 모든 조각을 조립하는 메인 파일
//
// 매 프레임 쌓는 순서 (아래에서 위로)
//   1) 선명한 창밖 풍경           (SCENE)
//   2) 김 서린 유리               (FOGB 를 복사한 뒤, 손가락이 지난 자리를 지움)
//   3) 성에                       (frost.js)
//   4) 입김이 번지는 모습
//   5) 창틀 → 물방울
//   6) 누르고 있는 중 표시 → 펼쳐 보기 화면
//   7) 가장자리 어둡게 + 유리 반사광
// =====================================================

let VW, VH, PD;           // 화면 크기와 선명도
let SKY = null;           // 현재 하늘 상태 (밤/낮 정도 등)
let FOGW = null;          // 매 프레임 쓰는 김 서린 유리 작업용 레이어
let OVL = null;           // 가장자리 어둡게 + 반사광
let READY = false;
let lastBuild = 0;
let resizeTimer = null;
let introShown = false;

// 창밖 하늘은 '지금 몇 시인지' 를 그대로 따라갑니다. (5분마다 다시 그려요)
// 확인용으로 주소 뒤에 ?hour=19.5 를 붙이면 그 시각으로 고정해 볼 수 있어요.
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

  if (!MEMO.strokes.length && !DROPS.archive.length) showHint("유리를 손가락으로 문질러 보세요", 5200, true);
}

// 풍경 + 유리 + 레이어 전부 다시 만들기 (처음 / 창 크기 변경 시)
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
  buildEdgeFrost();
  lastBuild = Date.now();
}

// 시간이 흘러 하늘만 갱신 (5분마다)
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
  }, 200);
}

function draw() {
  if (!READY) return;
  const now = performance.now(), wall = Date.now();
  const dt = Math.min(0.05, (deltaTime || 16) / 1000);

  if (wall - lastBuild > 300000) refreshScene();   // 5분마다 하늘 갱신

  // --- 갱신 ---
  updateGestures(now, dt);
  updateBreaths(now);
  MEMO.strokes = MEMO.strokes.filter((s) => s.frozen || strokeLook(s, wall));   // 김이 다시 찬 획은 제거
  updateDrops(now, dt);

  // --- 그리기 ---
  const ctx = drawingContext;
  ctx.drawImage(SCENE.c, 0, 0, VW, VH);                       // 1) 선명한 풍경

  const fx = FOGW.x;                                          // 2) 김 서린 유리
  fx.globalCompositeOperation = "source-over";
  fx.clearRect(0, 0, VW, VH);
  fx.drawImage(FOGB.c, 0, 0, VW, VH);
  paintMask(fx, MEMO.strokes.concat(AMBIENT, gatherStrokes(now)), wall);
  ctx.drawImage(FOGW.c, 0, 0, VW, VH);

  drawFrost(ctx, now);                                        // 3) 성에
  drawBlooms(ctx, now);                                       // 4) 입김
  drawSill(ctx);                                              // 5) 창틀과 물방울
  drawDrops(ctx, now);
  drawCaret(ctx, now);                                        // 6) 치는 중인 커서
  drawCues(ctx);                                              //    누르는 중 표시, 펼쳐 보기
  drawOpenView(ctx);
  ctx.drawImage(OVL.c, 0, 0, VW, VH);                         // 7) 마무리
}

// ---------- 안내 문구 / 도움말 / 키보드 ----------
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

// 굵기 슬라이더 (직접 만든 슬라이더라서 아이폰 사파리에서도 안정적으로 드래그돼요)
// 글씨 크기 버튼 : 누를 때마다 작게 → 보통 → 크게 → 작게
// (슬라이더처럼 끌 필요가 없어서 폰에서 다루기 쉬워요)
function bindSize() {
  const btn = document.getElementById("sizeBtn");
  const dot = document.getElementById("sizeDot");
  function show() {
    wipeWidth(); // 저장해 둔 단계 불러오기
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

  // Aa 버튼 : 자판 입력 시작 (두 번 톡 치는 것과 같은 기능)
  const tb = document.getElementById("typeBtn");
  tb.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isTyping()) stopTyping();
    else startTyping(VW * 0.12, VH * 0.2);
  });
  const btn = document.getElementById("helpBtn"), panel = document.getElementById("helpPanel");
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.classList.toggle("show"); });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove("show");
  });

  // 모두 지우기 : 실수로 누르지 않도록 두 번 눌러야 실행돼요
  const rb = document.getElementById("resetBtn");
  let armed = false, armTimer = null;
  rb.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      rb.textContent = "정말 지울까요?";
      rb.classList.add("armed");
      armTimer = setTimeout(disarm, 3000);
    } else {
      disarm();
      resetAll();
      panel.classList.remove("show");
      showHint("창문 위 메모를 모두 지웠어요")
    }
  });
  function disarm() {
    armed = false; clearTimeout(armTimer);
    rb.textContent = "모두 지우기";
    rb.classList.remove("armed");
  }
}

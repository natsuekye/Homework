// =====================================================
// dropgfx.js : 물방울 한 개를 현실감 있게 그리는 함수
// - 유리에 맺힌 물방울은 렌즈 역할을 해서 "뒤쪽 풍경이 거꾸로, 넓게 압축되어" 보여요.
//   → 선명한 풍경 레이어를 위아래·좌우 뒤집어서 둥글게 잘라 넣었어요.
// - 그 위에 어두운 테두리, 하단의 밝은 빛(집광), 좌상단 반사광을 얹으면 물방울처럼 보입니다.
// - 김 서린 유리 위의 작은 물방울(fog.js)과 창틀의 아카이브 물방울(drops.js)이 모두 이 함수를 써요.
// =====================================================

// 선명한 풍경 레이어 (sketch.js가 만들어서 넣어 줍니다)
let SCENE = null;

// o 옵션
//   sx, sy   : 가로/세로 늘어남 (흘러내릴 때 길쭉, 착지할 때 납작)
//   alpha    : 전체 투명도
//   spread   : 물방울이 담아내는 풍경의 폭 (반지름의 몇 배)
//   inner    : 물방울 안에 추가로 그릴 것 (메모 글씨) function(ctx, r)
//   ice      : true 이면 성에가 낀 느낌
//   shadow   : 유리 위에 드리우는 그림자
function paintDrop(ctx, x, y, r, o) {
  o = o || {};
  const sx = o.sx || 1, sy = o.sy || 1;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (r < 0.4 || alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(sx, sy);

  // 1. 유리 위에 드리우는 그림자 (오른쪽 아래로 부드럽게)
  if (o.shadow !== false) {
    const sg = ctx.createRadialGradient(r * 0.28, r * 0.5, r * 0.15, r * 0.28, r * 0.55, r * 1.45);
    sg.addColorStop(0, "rgba(8,16,28,0.34)");
    sg.addColorStop(1, "rgba(8,16,28,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(r * 0.28, r * 0.55, r * 1.45, 0, TAU); ctx.fill();
  }

  // 2. 물방울 안쪽 : 뒤집힌 풍경
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  if (SCENE) {
    const spread = o.spread || 3.4;
    const S = Math.max(8, r * spread);
    const cx = U.clamp(x, S / 2, SCENE.w - S / 2), cy = U.clamp(y, S / 2, SCENE.h - S / 2);
    const pd = SCENE.pd;
    ctx.save();
    ctx.scale(-1, -1);
    try {
      ctx.drawImage(SCENE.c, (cx - S / 2) * pd, (cy - S / 2) * pd, S * pd, S * pd, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    } catch (e) { /* 경계 밖이면 그냥 건너뜀 */ }
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(120,150,190,0.5)";
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  // 물의 색 + 안쪽을 살짝 어둡게(글씨가 잘 보이게)
  ctx.fillStyle = "rgba(18,34,56," + (o.inner ? 0.34 : 0.16) + ")";
  ctx.fillRect(-r, -r, r * 2, r * 2);
  // 위쪽이 살짝 밝은 물의 두께감
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, "rgba(255,255,255,0.16)");
  body.addColorStop(0.5, "rgba(255,255,255,0)");
  body.addColorStop(1, "rgba(160,200,255,0.12)");
  ctx.fillStyle = body;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  if (o.inner) o.inner(ctx, r);

  if (o.ice) {
    const ig = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    ig.addColorStop(0, "rgba(235,246,255,0.28)");
    ig.addColorStop(1, "rgba(190,220,255,0.5)");
    ctx.fillStyle = ig;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  ctx.restore();

  // 3. 어두운 가장자리 (물이 얇아지며 빛을 꺾는 부분)
  const rim = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
  rim.addColorStop(0, "rgba(8,16,28,0)");
  rim.addColorStop(0.8, "rgba(8,16,28,0.2)");
  rim.addColorStop(1, "rgba(8,16,28,0.6)");
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  // 큰 물방울일수록 반사 표현을 줄여서(촌스러워 보이지 않게) 글씨가 잘 보이도록
  const big = U.clamp((r - 30) / 120, 0, 1);

  // 4. 아래쪽 안에 모이는 밝은 빛 (집광)
  if (r > 5) {
    ctx.strokeStyle = "rgba(255,255,255," + (0.4 - 0.24 * big) + ")";
    ctx.lineWidth = Math.max(1, r * (0.11 - 0.07 * big));
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.84, Math.PI * 0.12, Math.PI * 0.62); ctx.stroke();
  }

  // 5. 가장자리 얇은 흰 선
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, r - 0.5), 0, TAU); ctx.stroke();

  // 6. 좌상단 반사광 (큰 것 + 작은 것)
  ctx.fillStyle = "rgba(255,255,255," + (0.88 - 0.55 * big) + ")";
  ctx.beginPath(); ctx.ellipse(-r * 0.46, -r * 0.5, r * (0.3 - 0.12 * big), r * (0.17 - 0.08 * big), -0.72, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath(); ctx.arc(r * 0.4, r * 0.38, Math.max(0.6, r * 0.065), 0, TAU); ctx.fill();

  ctx.restore();
}

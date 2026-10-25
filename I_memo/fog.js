// =====================================================
// fog.js : "김이 서린 유리"의 기본 상태를 만드는 파일
// 만드는 순서
//   1) 선명한 풍경을 블러 처리 (사파리에서도 되는 축소→확대 방식)
//   2) 하얀 안개를 덮고, 안개가 짙은 곳/옅은 곳 얼룩을 더함
//   3) 아주 작은 물방울(응결) 수천 개 + 조금 큰 물방울 몇 백 개
//   4) 처음부터 유리에 흘러내린 물줄기 자국 (AMBIENT) 과 그 끝의 물방울
// 이 결과(FOGB)는 매 프레임 그대로 복사해서 쓰고, 그 위를 손가락으로 "지웁니다".
// =====================================================

let FOGB = null;      // 김이 서린 유리 (지워지기 전)
let AMBIENT = [];     // 원래부터 있던 물줄기 자국 (획과 같은 모양의 데이터)

// 원래부터 있던 물줄기 자국 만들기 (시드 고정 → 창 크기가 바뀌어도 같은 모양)
const AMBIENT_ENABLED = false;   // true 로 바꾸면 처음부터 유리에 흘러내린 물줄기 자국이 다시 생겨요

function genAmbient() {
  if (!AMBIENT_ENABLED) { AMBIENT = []; return; }
  const rnd = U.rng(77);
  const n = U.clamp(Math.round(VW / 240), 3, 7);
  const list = [];
  for (let i = 0; i < n; i++) {
    const x0 = VW * (0.06 + rnd() * 0.88);
    const y0 = VH * (0.06 + rnd() * 0.42);
    const len = VH * (0.16 + rnd() * 0.26);
    const w = 3.2 + rnd() * 3.2;
    const beadR = w * 0.9 + 1.5;
    const yEnd = Math.min(y0 + len, VH * 0.84);
    const ph = rnd() * 10, seed = rnd() * 100;
    const pts = [];
    for (let y = y0; y < yEnd - beadR; y += 6) {
      const x = x0 + Math.sin(y * 0.02 + ph) * 2.2 + (U.noise1(y * 0.03 + seed) - 0.5) * 5;
      pts.push(x / VW, y / VH);
    }
    if (pts.length < 4) continue;
    const lastX = pts[pts.length - 2] * VW;
    list.push({ kind: "ambient", pts: pts, w: w, frozen: true, bead: { x: lastX, y: yEnd, r: beadR } });
  }
  AMBIENT = list;
}

function buildFog(S) {
  const L = U.layer(VW, VH, PD), x = L.x;

  // 1. 흐릿한 풍경
  U.softBlur(SCENE.c, L, 3);

  // 2. 하얀 안개 + 위아래 색 차이 (사진처럼 위는 차갑고 아래는 따뜻한 빛)
  const fogCol = U.mix([236, 241, 247], [176, 186, 208], S.dark * 0.85);
  x.fillStyle = U.rgb(fogCol, 0.62 - 0.1 * S.dark);
  x.fillRect(0, 0, VW, VH);
  const tone = x.createLinearGradient(0, 0, 0, VH);
  tone.addColorStop(0, "rgba(80,104,140,0.2)");
  tone.addColorStop(0.55, "rgba(255,255,255,0)");
  tone.addColorStop(1, "rgba(255,240,222,0.16)");
  x.fillStyle = tone;
  x.fillRect(0, 0, VW, VH);

  // 안개 농도 얼룩 (옅은 곳은 풍경이 더 비치고, 짙은 곳은 하얗게)
  x.globalAlpha = 0.26 - 0.1 * S.dark;
  x.drawImage(U.blobNoise(6, 31, [255, 255, 255]), 0, 0, VW, VH);
  x.globalAlpha = 0.18;
  x.drawImage(U.blobNoise(9, 57, [60, 84, 120]), 0, 0, VW, VH);
  x.globalAlpha = 1;

  // 3-a. 아주 작은 응결 물방울 (그림자 → 몸통 → 반사광 순서로 한꺼번에)
  const rnd = U.rng(909);
  const N = Math.floor((VW * VH) / 280);   // 작은 응결 방울 개수 (숫자가 클수록 적어짐)
  const px = new Float32Array(N), py = new Float32Array(N), pr = new Float32Array(N);
  const centers = [];
  for (let i = 0; i < 9; i++) centers.push([rnd() * VW, rnd() * VH, 60 + rnd() * 160]);
  for (let i = 0; i < N; i++) {
    if (rnd() < 0.3) {
      const c = centers[(rnd() * centers.length) | 0];
      px[i] = c[0] + (rnd() + rnd() + rnd() - 1.5) * c[2];
      py[i] = c[1] + (rnd() + rnd() + rnd() - 1.5) * c[2];
    } else {
      px[i] = rnd() * VW; py[i] = rnd() * VH;
    }
    pr[i] = 0.5 + Math.pow(rnd(), 2.6) * 1.6;
  }
  const pass = (fill, dx, dy, k) => {
    x.fillStyle = fill;
    x.beginPath();
    for (let i = 0; i < N; i++) {
      const r = pr[i] * k;
      x.moveTo(px[i] + dx * pr[i] + r, py[i] + dy * pr[i]);
      x.arc(px[i] + dx * pr[i], py[i] + dy * pr[i], r, 0, TAU);
    }
    x.fill();
  };
  pass("rgba(30,46,72," + (0.15 + 0.05 * S.dark) + ")", 0.35, 0.5, 1);
  pass("rgba(255,255,255,0.1)", 0, 0, 1);
  pass("rgba(255,255,255," + (0.5 - 0.15 * S.dark) + ")", -0.3, -0.35, 0.45);

  // 3-b. 조금 큰 물방울 : 뒤집힌 풍경이 보이는 진짜 물방울
  const M = U.clamp(Math.floor((VW * VH) / 11000), 45, 220);   // 조금 큰 물방울 개수 (숫자가 클수록 적어짐)
  for (let i = 0; i < M; i++) {
    paintDrop(x, rnd() * VW, rnd() * VH * 0.92, 2.4 + Math.pow(rnd(), 2) * 5, { spread: 3, shadow: true });
  }

  // 4. 원래 있던 물줄기 끝의 물방울 (자국은 매 프레임 "지우기"로 표현됨)
  genAmbient();
  for (const a of AMBIENT) {
    paintDrop(x, a.bead.x, a.bead.y + a.bead.r * 0.15, a.bead.r, { spread: 3.2 });
  }

  FOGB = L;
}

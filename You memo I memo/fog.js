let FOGB = null;
let AMBIENT = [];

const AMBIENT_ENABLED = false;

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

  U.softBlur(SCENE.c, L, 3);

  const fogCol = U.mix([236, 241, 247], [176, 186, 208], S.dark * 0.85);
  x.fillStyle = U.rgb(fogCol, 0.62 - 0.1 * S.dark);
  x.fillRect(0, 0, VW, VH);
  const tone = x.createLinearGradient(0, 0, 0, VH);
  tone.addColorStop(0, "rgba(80,104,140,0.2)");
  tone.addColorStop(0.55, "rgba(255,255,255,0)");
  tone.addColorStop(1, "rgba(255,240,222,0.16)");
  x.fillStyle = tone;
  x.fillRect(0, 0, VW, VH);

  x.globalAlpha = 0.26 - 0.1 * S.dark;
  x.drawImage(U.blobNoise(6, 31, [255, 255, 255]), 0, 0, VW, VH);
  x.globalAlpha = 0.18;
  x.drawImage(U.blobNoise(9, 57, [60, 84, 120]), 0, 0, VW, VH);
  x.globalAlpha = 1;

  const rnd = U.rng(909);
  const N = Math.floor((VW * VH) / 280);
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

  const M = U.clamp(Math.floor((VW * VH) / 11000), 45, 220);
  for (let i = 0; i < M; i++) {
    paintDrop(x, rnd() * VW, rnd() * VH * 0.92, 2.4 + Math.pow(rnd(), 2) * 5, { spread: 3, shadow: true });
  }

  genAmbient();
  for (const a of AMBIENT) {
    paintDrop(x, a.bead.x, a.bead.y + a.bead.r * 0.15, a.bead.r, { spread: 3.2 });
  }

  FOGB = L;
}

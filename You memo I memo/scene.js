const SKY_KEYS = [
  { h: 0,    top: [7, 10, 26],    hor: [24, 32, 62],    far: [30, 38, 70],    mid: [18, 24, 48],   near: [9, 12, 28],   lights: 1.0,  stars: 1.0 },
  { h: 4.6,  top: [10, 15, 40],   hor: [36, 44, 78],    far: [40, 50, 84],    mid: [24, 30, 58],   near: [11, 15, 32],  lights: 0.85, stars: 0.9 },
  { h: 5.9,  top: [44, 58, 110],  hor: [222, 146, 132], far: [130, 116, 148], mid: [78, 72, 104],  near: [34, 36, 58],  lights: 0.55, stars: 0.15 },
  { h: 6.9,  top: [84, 126, 198], hor: [250, 192, 142], far: [176, 166, 184], mid: [116, 118, 146], near: [62, 66, 90], lights: 0.18, stars: 0 },
  { h: 9.0,  top: [86, 150, 226], hor: [150, 198, 240], far: [166, 188, 212], mid: [116, 140, 170], near: [66, 84, 106], lights: 0.03, stars: 0 },
  { h: 12.5, top: [52, 124, 222], hor: [126, 184, 242], far: [152, 182, 212], mid: [102, 130, 162], near: [58, 74, 98], lights: 0,    stars: 0 },
  { h: 16.0, top: [68, 136, 228], hor: [142, 193, 240], far: [160, 184, 210], mid: [110, 134, 166], near: [64, 80, 102], lights: 0.02, stars: 0 },
  { h: 17.8, top: [96, 132, 202], hor: [252, 200, 130], far: [196, 164, 164], mid: [134, 114, 134], near: [74, 66, 88], lights: 0.25, stars: 0 },
  { h: 18.7, top: [60, 72, 132],  hor: [255, 132, 88],  far: [154, 104, 124], mid: [92, 70, 106],  near: [42, 36, 64],  lights: 0.65, stars: 0.05 },
  { h: 19.6, top: [30, 38, 90],   hor: [156, 78, 114],  far: [74, 60, 104],   mid: [46, 40, 80],   near: [25, 23, 52],  lights: 0.92, stars: 0.35 },
  { h: 20.9, top: [13, 19, 50],   hor: [46, 46, 90],    far: [40, 44, 82],    mid: [24, 28, 58],   near: [13, 15, 34],  lights: 1.0,  stars: 0.85 },
];
SKY_KEYS.push(Object.assign({}, SKY_KEYS[0], { h: 24 }));

function skyState(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = SKY_KEYS[0], b = SKY_KEYS[1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i].h && h <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = U.smooth((h - a.h) / (b.h - a.h));
  const S = { hour: h };
  ["top", "hor", "far", "mid", "near"].forEach((k) => (S[k] = U.mix(a[k], b[k], t)));
  ["lights", "stars"].forEach((k) => (S[k] = U.lerp(a[k], b[k], t)));
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  S.dark = U.clamp(1 - (lum(S.top) + lum(S.hor)) / 300, 0, 1);
  return S;
}

function glow(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, U.rgb(col, a));
  g.addColorStop(0.4, U.rgb(col, a * 0.35));
  g.addColorStop(1, U.rgb(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function renderScene(L, hour) {
  const ctx = L.x, w = L.w, h = L.h;
  const S = skyState(hour);
  const hy = h * 0.82;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, U.rgb(S.top));
  sky.addColorStop(0.62, U.rgb(U.mix(S.top, S.hor, 0.45)));
  sky.addColorStop(1, U.rgb(S.hor));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (S.stars > 0.02) {
    const sr = U.rng(11);
    for (let i = 0; i < 190; i++) {
      const sx = sr() * w, sy = sr() * h * 0.95, rr = 0.4 + sr() * 1.1, aa = 0.35 + sr() * 0.65;
      ctx.fillStyle = "rgba(255,250,235," + (aa * S.stars) + ")";
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
    }
  }

  const sunT = (S.hour - 6.2) / 12.6;
  if (sunT > -0.1 && sunT < 1.1) {
    const tt = U.clamp(sunT, 0, 1);
    const sx = w * (0.14 + 0.72 * sunT);
    const sy = hy * (1 - 0.86 * Math.sin(Math.PI * sunT));
    const low = 1 - Math.sin(Math.PI * tt);
    const gc = U.mix([255, 246, 222], [255, 138, 66], low);
    glow(ctx, sx, sy, w * 0.34, gc, 0.55);
    glow(ctx, sx, sy, w * 0.1, gc, 0.9);
    ctx.fillStyle = U.rgb(U.mix([255, 252, 240], [255, 214, 160], low));
    ctx.beginPath(); ctx.arc(sx, sy, Math.min(w, h) * 0.04, 0, TAU); ctx.fill();
  }

  const moonT = ((S.hour - 19 + 24) % 24) / 12.4;
  const moonA = U.smooth(U.clamp((S.dark - 0.35) / 0.3, 0, 1));
  if (moonT < 1 && moonA > 0.01) {
    const mx = w * (0.14 + 0.72 * moonT);
    const my = hy * (1 - 0.8 * Math.sin(Math.PI * moonT));
    const mr = Math.min(w, h) * 0.034;
    glow(ctx, mx, my, mr * 7, [180, 200, 255], 0.28 * moonA);
    ctx.fillStyle = "rgba(242,242,230," + moonA + ")";
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    const cr = U.rng(5);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(160,165,175," + (0.22 * moonA) + ")";
      ctx.beginPath(); ctx.arc(mx + (cr() - 0.5) * mr, my + (cr() - 0.5) * mr, mr * (0.12 + cr() * 0.16), 0, TAU); ctx.fill();
    }
  }

  const cloudBase = U.mix(U.mix([255, 255, 255], S.hor, 0.38), S.top, S.dark * 0.7);
  const cloudCol = cloudBase.map((v) => v * (1 - 0.72 * S.dark));
  const cr = U.rng(23);
  for (let i = 0; i < 7; i++) {
    const cx = cr() * w, cy = h * (0.05 + cr() * 0.6), cw = w * (0.12 + cr() * 0.18);
    const puffs = 9 + ((cr() * 6) | 0);
    for (let j = 0; j < puffs; j++) {
      const px = cx + (cr() - 0.5) * cw * 1.7, py = cy + (cr() - 0.5) * cw * 0.26, pr = cw * (0.18 + cr() * 0.24);
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, U.rgb(cloudCol, 0.62));
      g.addColorStop(1, U.rgb(cloudCol, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    }
  }

  return S;
}

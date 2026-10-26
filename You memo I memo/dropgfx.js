
let SCENE = null;

function softHighlight(ctx, cx, cy, hw, hh, rot, a) {
  if (hw <= 0.3 || a <= 0.01) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, hh / hw);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
  g.addColorStop(0, "rgba(255,255,255," + a + ")");
  g.addColorStop(0.38, "rgba(255,255,255," + a * 0.58 + ")");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, hw, 0, TAU); ctx.fill();
  ctx.restore();
}

function softArc(ctx, radius, mid, span, a) {
  if (radius <= 0.5 || a <= 0.01) return;
  const passes = [[0.30, 0.07], [0.21, 0.11], [0.13, 0.18], [0.07, 0.3]];
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < passes.length; i++) {
    const sp = span * (1 - i * 0.13);
    ctx.strokeStyle = "rgba(255,255,255," + passes[i][1] * a + ")";
    ctx.lineWidth = radius * passes[i][0];
    ctx.beginPath();
    ctx.arc(0, 0, radius, mid - sp / 2, mid + sp / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paintDrop(ctx, x, y, r, o) {
  o = o || {};
  const sx = o.sx || 1, sy = o.sy || 1;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (r < 0.4 || alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(sx, sy);

  if (o.shadow !== false) {
    const sg = ctx.createRadialGradient(r * 0.28, r * 0.5, r * 0.15, r * 0.28, r * 0.55, r * 1.45);
    sg.addColorStop(0, "rgba(8,16,28,0.34)");
    sg.addColorStop(1, "rgba(8,16,28,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(r * 0.28, r * 0.55, r * 1.45, 0, TAU); ctx.fill();
  }

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
    } catch (e) {  }
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(120,150,190,0.5)";
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  ctx.fillStyle = "rgba(18,34,56," + (o.inner ? 0.14 : 0.08) + ")";
  ctx.fillRect(-r, -r, r * 2, r * 2);
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, "rgba(150,186,230,0.18)");
  body.addColorStop(0.45, "rgba(255,255,255,0)");
  body.addColorStop(1, "rgba(255,255,255,0.26)");
  ctx.fillStyle = body;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  const caus = ctx.createRadialGradient(0, r * 0.5, 0, 0, r * 0.5, r * 0.9);
  caus.addColorStop(0, "rgba(255,255,255,0.3)");
  caus.addColorStop(0.5, "rgba(255,255,255,0.1)");
  caus.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = caus;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  if (o.inner) o.inner(ctx, r);

  const tint = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  tint.addColorStop(0, "rgba(235,246,255,0.28)");
  tint.addColorStop(1, "rgba(190,220,255,0.5)");
  ctx.fillStyle = tint;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  const rim = ctx.createRadialGradient(0, 0, r * 0.78, 0, 0, r);
  rim.addColorStop(0, "rgba(10,20,34,0)");
  rim.addColorStop(0.8, "rgba(10,20,34,0.08)");
  rim.addColorStop(0.95, "rgba(10,20,34,0.22)");
  rim.addColorStop(1, "rgba(10,20,34,0.36)");
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  const big = U.clamp((r - 30) / 120, 0, 1);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, r - 0.5), 0, TAU); ctx.stroke();

  softHighlight(ctx, -r * 0.42, -r * 0.46, r * (0.3 - 0.1 * big), r * (0.3 - 0.1 * big) * 0.52,
    -0.72, 0.88 - 0.5 * big);
  softArc(ctx, r * 0.76, Math.PI * 0.47, Math.PI * 0.66, 0.85 - 0.45 * big);

  ctx.restore();
}

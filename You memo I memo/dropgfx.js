let SCENE = null;

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

  ctx.fillStyle = "rgba(18,34,56," + (o.inner ? 0.34 : 0.16) + ")";
  ctx.fillRect(-r, -r, r * 2, r * 2);

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

  const rim = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
  rim.addColorStop(0, "rgba(8,16,28,0)");
  rim.addColorStop(0.8, "rgba(8,16,28,0.2)");
  rim.addColorStop(1, "rgba(8,16,28,0.6)");
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  const big = U.clamp((r - 30) / 120, 0, 1);

  if (r > 5) {
    ctx.strokeStyle = "rgba(255,255,255," + (0.4 - 0.24 * big) + ")";
    ctx.lineWidth = Math.max(1, r * (0.11 - 0.07 * big));
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.84, Math.PI * 0.12, Math.PI * 0.62); ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, r - 0.5), 0, TAU); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255," + (0.88 - 0.55 * big) + ")";
  ctx.beginPath(); ctx.ellipse(-r * 0.46, -r * 0.5, r * (0.3 - 0.12 * big), r * (0.17 - 0.08 * big), -0.72, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath(); ctx.arc(r * 0.4, r * 0.38, Math.max(0.6, r * 0.065), 0, TAU); ctx.fill();

  ctx.restore();
}

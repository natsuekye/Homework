
const TAU = Math.PI * 2;

const U = {
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (t) => t * t * (3 - 2 * t),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash01(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  },

  noise1(x) {
    const i = Math.floor(x), f = x - i;
    const a = U.hash01(i), b = U.hash01(i + 1);
    return a + (b - a) * U.smooth(f);
  },

  mix(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  },
  rgb(c, a = 1) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
  },

  pickPD(w, h) {
    let pd = Math.min(window.devicePixelRatio || 1, 2);
    const maxPixels = 3.6e6;
    while (pd > 1 && w * h * pd * pd > maxPixels) pd -= 0.25;
    return Math.max(1, pd);
  },

  layer(w, h, pd) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * pd));
    c.height = Math.max(1, Math.round(h * pd));
    const x = c.getContext("2d");
    x.scale(pd, pd);
    return { c, x, w, h, pd };
  },

  softBlur(srcCanvas, destLayer, levels) {
    const make = (w, h) => {
      const c = document.createElement("canvas");
      c.width = Math.max(2, w);
      c.height = Math.max(2, h);
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in x) x.imageSmoothingQuality = "high";
      return c;
    };
    const chain = [srcCanvas];
    let cur = srcCanvas;
    for (let i = 0; i < levels; i++) {
      const c = make((cur.width + 1) >> 1, (cur.height + 1) >> 1);
      c.getContext("2d").drawImage(cur, 0, 0, c.width, c.height);
      chain.push(c);
      cur = c;
    }
    let up = chain[chain.length - 1];
    for (let k = chain.length - 2; k >= 0; k--) {
      const c = make(chain[k].width, chain[k].height);
      c.getContext("2d").drawImage(up, 0, 0, c.width, c.height);
      up = c;
    }
    destLayer.x.drawImage(up, 0, 0, destLayer.w, destLayer.h);
  },

  blobNoise(cells, seed, tint) {
    const rnd = U.rng(seed);
    let c = document.createElement("canvas");
    c.width = cells; c.height = cells;
    let x = c.getContext("2d");
    const img = x.createImageData(cells, cells);
    for (let i = 0; i < cells * cells; i++) {
      img.data[i * 4] = tint[0]; img.data[i * 4 + 1] = tint[1]; img.data[i * 4 + 2] = tint[2];
      img.data[i * 4 + 3] = (rnd() * 255) | 0;
    }
    x.putImageData(img, 0, 0);
    for (let s = 0; s < 5; s++) {
      const n = document.createElement("canvas");
      n.width = c.width * 2; n.height = c.height * 2;
      const nx = n.getContext("2d");
      nx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in nx) nx.imageSmoothingQuality = "high";
      nx.drawImage(c, 0, 0, n.width, n.height);
      c = n;
    }
    return c;
  },
};

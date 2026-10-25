// =====================================================
// util.js : 여러 파일에서 같이 쓰는 도우미 함수 모음
// - 전부 U 라는 이름표 아래에 모아 두었습니다 (p5 함수 이름과 겹치지 않게)
// - 캔버스 레이어(투명한 도화지)를 만드는 함수와, 사파리에서도 되는 "블러"가 여기에 있어요
// =====================================================

const TAU = Math.PI * 2;

const U = {
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (t) => t * t * (3 - 2 * t),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  // 시드를 주면 항상 같은 순서의 난수가 나오는 난수 생성기 (풍경 모양이 매번 안 바뀌게)
  rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // 숫자 하나로 0~1 사이의 고정된 값을 만들기 (물방울마다 크기를 조금씩 다르게)
  hash01(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  },

  // 1차원 값 노이즈 (물방울이 멈췄다 흐르는 움직임에 사용)
  noise1(x) {
    const i = Math.floor(x), f = x - i;
    const a = U.hash01(i), b = U.hash01(i + 1);
    return a + (b - a) * U.smooth(f);
  },

  // 두 색(배열 [r,g,b])을 섞기
  mix(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  },
  rgb(c, a = 1) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
  },

  // 화면 선명도(pixelDensity) 정하기: 너무 큰 캔버스는 사파리가 메모리 부족으로 죽으므로 제한
  pickPD(w, h) {
    let pd = Math.min(window.devicePixelRatio || 1, 2);
    const maxPixels = 3.6e6;
    while (pd > 1 && w * h * pd * pd > maxPixels) pd -= 0.25;
    return Math.max(1, pd);
  },

  // 보이지 않는 도화지(레이어) 만들기. 그릴 때는 화면 크기(CSS px) 기준 좌표를 그대로 쓰면 됩니다.
  layer(w, h, pd) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * pd));
    c.height = Math.max(1, Math.round(h * pd));
    const x = c.getContext("2d");
    x.scale(pd, pd);
    return { c, x, w, h, pd };
  },

  // 캔버스를 절반씩 줄였다가 다시 키우는 블러.
  // ctx.filter = 'blur()' 는 아이폰 사파리에서 동작하지 않기 때문에,
  // "작게 줄이고 → 부드럽게 다시 늘리기" 로 어디서나 되는 블러를 만듭니다.
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

  // 부드러운 구름 모양 노이즈 (작은 무작위 격자를 계속 2배로 키우면 부드러운 얼룩이 됩니다)
  // 반환: 흰색의 투명도로 얼룩이 표현된 캔버스
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

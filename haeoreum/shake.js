const Shake = (() => {
  const subs = [];
  let listening = false;
  let lastX = null;
  let peaks = [];
  let firstDir = 0;
  let coolUntil = 0;

  const grav = { x: 0, y: 0, z: 0 };
  let sign = 1;

  const supported = () => 'DeviceMotionEvent' in window;
  const needsPermission = () => supported() && typeof DeviceMotionEvent.requestPermission === 'function';

  function start() {
    if (listening || !supported()) return;
    listening = true;
    window.addEventListener('devicemotion', onMotion);
  }

  async function enable() {
    if (!needsPermission()) { start(); return true; }
    try {
      const r = await DeviceMotionEvent.requestPermission();
      if (r === 'granted') { start(); return true; }
    } catch (e) {}
    return false;
  }

  const has = v => v && v.x !== null && v.x !== undefined;

  function onMotion(e) {
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;

    const quiet = !has(a) || Math.hypot(a.x, a.y || 0, a.z || 0) < 2;
    if (has(g) && quiet) {
      grav.x = grav.x * 0.9 + g.x * 0.1;
      grav.y = grav.y * 0.9 + (g.y || 0) * 0.1;
      grav.z = grav.z * 0.9 + (g.z || 0) * 0.1;
      const ay = Math.abs(grav.y), az = Math.abs(grav.z);
      if (Math.max(ay, az) > 6 && Math.max(ay, az) > Math.abs(grav.x)) {
        sign = (ay > az ? grav.y : grav.z) >= 0 ? 1 : -1;
      }
    }

    let x = null;
    if (has(a)) x = a.x;
    else if (has(g)) {
      if (lastX !== null) x = g.x - lastX;
      lastX = g.x;
    }
    if (x === null) return;
    x *= sign * (CONFIG.SHAKE_FLIP ? -1 : 1);

    const now = performance.now();
    if (now < coolUntil || Math.abs(x) < CONFIG.SHAKE_THRESHOLD) return;
    if (peaks.length && now - peaks[peaks.length - 1] < 90) return;
    peaks = peaks.filter(t => now - t < CONFIG.SHAKE_WINDOW_MS);
    if (!peaks.length) firstDir = x > 0 ? 1 : -1;
    peaks.push(now);
    if (peaks.length >= CONFIG.SHAKE_COUNT) {
      peaks = [];
      coolUntil = now + 1200;
      const dir = firstDir > 0 ? 'right' : 'left';
      subs.forEach(fn => fn(dir));
    }
  }

  if (supported() && !needsPermission()) start();
  else if (needsPermission()) {
    try {
      DeviceMotionEvent.requestPermission()
        .then(r => { if (r === 'granted') { start(); if (typeof Check !== 'undefined') Check.render(); } })
        .catch(() => {});
    } catch (e) {}
  }

  return {
    on(fn) { subs.push(fn); },
    enable,
    needsPermission,
    isOn: () => listening,
  };
})();

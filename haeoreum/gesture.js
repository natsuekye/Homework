const Cam = (() => {
  const root = document.getElementById('cam');
  const video = document.getElementById('camVideo');
  const msg = document.getElementById('camMsg');
  const rec = document.getElementById('camRec');
  const guessAva = document.getElementById('guessAva');
  const guessName = document.getElementById('guessName');
  const guessSub = document.getElementById('guessSub');
  const ring = document.getElementById('guessRing');
  const testBox = document.getElementById('camTest');
  const result = document.getElementById('camResult');
  const RING_LEN = 2 * Math.PI * 19;

  const feed = document.createElement('canvas');
  feed.width = feed.height = 224;
  const fctx = feed.getContext('2d', { willReadFrequently: true });

  let stream = null;
  let classifier = null;
  let modelState = 'idle';
  let latest = null;
  let testHold = null;
  let cand = null;
  let phase = 'off';
  let raf = 0;

  let recorder = null, chunks = [], recStart = 0, recMime = '';

  document.getElementById('camClose').addEventListener('click', close);

  const testRow = document.getElementById('camTestRow');
  MEMBERS.forEach(m => {
    const b = h('button', { class: 'test-face', 'aria-label': m.name + ' 손짓 시험' }, avatar(m, 44), h('span', {}, m.name));
    const up = () => { if (testHold === m.id) testHold = null; b.classList.remove('on'); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); testHold = m.id; b.classList.add('on'); });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    testRow.append(b);
  });

  async function open() {
    if (phase !== 'off') return;
    phase = 'scan';
    cand = null; latest = null; testHold = null;
    result.hidden = true;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('show'));
    setGuess(null, 0, '');
    msg.hidden = false;
    msg.textContent = '카메라를 켜는 중이에요';

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false,
      });
    } catch (e) {
      msg.textContent = '카메라를 쓸 수 없어요. 브라우저 설정에서 카메라를 허용해 주세요.';
      return;
    }
    if (phase === 'off') { stopStream(); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});

    ensureModel().then(() => {
      if (phase === 'off') return;
      testBox.hidden = modelState !== 'none';
      if (modelState === 'ready') { smooth = {}; classifier.classifyStart(feed, 10, onResults); }
      msg.hidden = true;
    });
    msg.textContent = modelState === 'ready' ? '' : '손짓 모델을 불러오는 중이에요';
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    phase = 'off';
    cancelAnimationFrame(raf);
    if (classifier && modelState === 'ready') classifier.classifyStop();
    if (tail) endTail(); else stopRecording(true);
    stopStream();
    root.classList.remove('show');
    setTimeout(() => { root.hidden = true; }, 220);
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function loadMl5() {
    if (typeof ml5 !== 'undefined') return Promise.resolve();
    if (loadMl5.p) return loadMl5.p;
    loadMl5.p = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = CONFIG.ML5_URL;
      sc.onload = resolve;
      sc.onerror = () => reject(new Error('ml5를 불러오지 못함'));
      document.head.append(sc);
    });
    return loadMl5.p;
  }

  function ensureModel() {
    if (modelState === 'ready' || modelState === 'none') return Promise.resolve();
    if (modelState === 'loading') return ensureModel.p;
    modelState = 'loading';
    ensureModel.p = (async () => {
      try {
        let base = new URL(CONFIG.MODEL_URL, location.href).href;
        if (!base.endsWith('/')) base += '/';
        const libP = loadMl5();
        const res = await fetch(base + 'model.json');
        if (!res.ok) throw new Error('model.json 없음');
        await libP;
        classifier = await ml5.imageClassifier(base + 'model.json');
        if (classifier && classifier.ready) await classifier.ready;
        if (!classifier.model || typeof classifier.model.predict !== 'function') throw new Error('모델 파일을 읽지 못함');
        try { await classifier.classify(feed); } catch (e) {}
        modelState = 'ready';
      } catch (e) {
        console.warn('[손인사] 모델 없이 시험 모드로 시작해요:', e.message);
        modelState = 'none';
      }
    })();
    return ensureModel.p;
  }

  let smooth = {};
  function onResults(results) {
    if (!results || !results.length) return;
    const a = CONFIG.SMOOTHING;
    const now = {};
    results.forEach(r => { now[r.label] = r.confidence; });
    const labels = new Set([...Object.keys(smooth), ...Object.keys(now)]);
    labels.forEach(l => { smooth[l] = (smooth[l] || 0) * (1 - a) + (now[l] || 0) * a; });
    let best = null, conf = 0;
    labels.forEach(l => { if (smooth[l] > conf) { conf = smooth[l]; best = l; } });
    const m = best ? memberByLabel(best) : null;
    latest = { mid: m ? m.id : null, conf, label: best, at: performance.now() };
  }

  function loop() {
    if (phase === 'off') return;
    raf = requestAnimationFrame(loop);
    drawFeed();
    if (phase !== 'scan') return;

    const now = performance.now();
    let mid = null, conf = 0;
    if (testHold) { mid = testHold; conf = 1; }
    else if (latest && now - latest.at < 500) {
      conf = latest.conf;
      if (latest.mid && conf >= CONFIG.CONFIDENCE) mid = latest.mid;
    }

    if (mid) {
      if (!cand || cand.mid !== mid) {
        if (cand) stopRecording(true);
        cand = { mid, since: now, lastSeen: now };
        startRecording();
      }
      cand.lastSeen = now;
      const p = (now - cand.since) / CONFIG.HOLD_MS;
      setGuess(cand.mid, p, '그대로 잠깐만요');
      if (p >= 1) confirm(cand.mid);
    } else {
      if (cand && now - cand.lastSeen > CONFIG.GRACE_MS) {
        cand = null;
        stopRecording(true);
      }
      if (!cand) {
        const hint = latest && modelState === 'ready' && latest.mid
          ? `${memberById(latest.mid).name}? 조금 더 또렷하게 (${Math.round(latest.conf * 100)}%)`
          : '';
        setGuess(null, 0, hint);
      }
    }
  }

  function drawFeed() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const s = Math.min(vw, vh);
    fctx.save();
    fctx.translate(224, 0);
    fctx.scale(-1, 1);
    fctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, 224, 224);
    fctx.restore();
  }

  function setGuess(mid, p, sub) {
    const m = mid ? memberById(mid) : null;
    guessAva.replaceChildren(m ? avatar(m, 46) : h('span', { class: 'guess-empty', html: icon('hand', 24) }));
    guessName.textContent = m ? m.name : '손짓을 보여 주세요';
    guessSub.textContent = sub || '내 손짓을 1초 동안 유지하면 출근이 기록돼요';
    ring.style.strokeDashoffset = RING_LEN * (1 - Math.max(0, Math.min(1, p)));
  }

  function confirm(mid) {
    phase = 'result';
    cand = null;
    const m = memberById(mid);
    const a = Store.attendance()[mid];
    const now = Date.now();
    Store.setMe(mid);

    if (a && !a.out && now - a.in < CONFIG.REPEAT_GUARD_MS) {
      stopRecording(true);
      return showResult(m, `${m.name}님은 벌써 출근했어요`, `출근 ${hm(a.in)} · 퇴근 인사는 10분 뒤부터 받을게요`,
        [['다시 등록', 'ghost', rescan], ['확인', 'primary', close]]);
    }
    if (a && !a.out) {
      stopRecording(true);
      return showResult(m, `${m.name}님, 퇴근할까요?`, `출근 ${hm(a.in)}`, [
        ['아니요', 'ghost', close],
        ['퇴근하기', 'primary', () => {
          Store.checkout(mid, Date.now());
          showResult(m, '오늘도 수고했어요!', `퇴근 ${hm(Date.now())}`, [['확인', 'primary', close]]);
        }],
      ]);
    }
    if (a && a.out) {
      stopRecording(true);
      return showResult(m, '오늘은 이미 퇴근했어요', `퇴근 ${hm(a.out)}`, [
        ['닫기', 'ghost', close],
        ['다시 출근하기', 'primary', () => { checkIn(m, null); }],
      ]);
    }
    checkIn(m, finishClip());
  }

  function checkIn(m, clipP) {
    const ts = Date.now();
    const prev = Store.attendance()[m.id] || null;
    Store.checkin(m.id, ts);
    const token = { cancelled: false };
    const note = h('p', { class: 'result-note' }, clipP ? '인사 영상 저장 중…' : '');
    showResult(m, `${m.name}님, 안녕하세요!`, `출근 ${hm(ts)}`, [
      ['다시 등록', 'ghost', () => {
        token.cancelled = true;
        if (tail) endTail();
        Store.setAttendance(m.id, prev);
        if (!prev || !prev.clip) Clips.remove(Store.today(), m.id);
        rescan();
      }],
      ['확인', 'primary', close],
    ], note);
    if (!clipP) return;
    clipP.then(async clip => {
      if (token.cancelled) return;
      if (!clip) { note.textContent = '이 브라우저에서는 영상을 저장하지 못했어요'; return; }
      await Clips.put(Store.today(), m.id, clip.blob, clip.type, clip.ms);
      Store.markClip(m.id);
      note.textContent = '오늘의 인사가 스토리로 남았어요';
    });
  }

  function rescan() {
    result.hidden = true;
    cand = null; latest = null; testHold = null; smooth = {};
    phase = 'scan';
    setGuess(null, 0, '');
  }

  function showResult(m, title, sub, buttons, extra) {
    result.replaceChildren(h('div', { class: 'result-card' },
      h('div', { class: 'result-ava' }, avatar(m, 92)),
      h('p', { class: 'result-title' }, title),
      h('p', { class: 'result-sub' }, sub),
      extra || null,
      h('div', { class: 'result-btns' },
        buttons.map(([label, kind, fn]) => h('button', { class: 'btn ' + kind, onclick: fn }, label))),
    ));
    result.hidden = false;
  }

  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return list.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }

  function startRecording() {
    if (!stream || recorder) return;
    const mime = pickMime();
    if (mime === null) return;
    try {
      recorder = new MediaRecorder(stream, mime
        ? { mimeType: mime, videoBitsPerSecond: CONFIG.CLIP_BPS }
        : { videoBitsPerSecond: CONFIG.CLIP_BPS });
    } catch (e) { recorder = null; return; }
    recMime = recorder.mimeType || mime || 'video/webm';
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.start();
    recStart = performance.now();
    rec.hidden = false;
  }

  function stopRecording(discard) {
    const r = recorder;
    recorder = null;
    rec.hidden = true;
    if (!r) return Promise.resolve(null);
    const ms = performance.now() - recStart;
    return new Promise(resolve => {
      r.onstop = () => {
        if (discard || !chunks.length) return resolve(null);
        resolve({ blob: new Blob(chunks, { type: recMime }), type: recMime, ms });
      };
      try { r.stop(); } catch (e) { resolve(null); }
    });
  }

  let tail = null;
  function finishClip() {
    if (!recorder) return null;
    const left = CONFIG.MAX_CLIP_MS - (performance.now() - recStart);
    const wait = Math.max(0, Math.min(CONFIG.TAIL_MS, left));
    return new Promise(resolve => {
      tail = { resolve, timer: setTimeout(endTail, wait) };
    });
  }
  function endTail() {
    if (!tail) return;
    const t = tail;
    tail = null;
    clearTimeout(t.timer);
    t.resolve(stopRecording(false));
  }

  return { open, close, modelState: () => modelState, ensureModel };
})();

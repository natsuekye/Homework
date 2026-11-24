const Story = (() => {
  const root = document.getElementById('story');
  const video = document.getElementById('storyVideo');
  const bars = document.getElementById('storyBars');
  const who = document.getElementById('storyWho');
  const empty = document.getElementById('storyEmpty');
  let list = [], idx = 0, url = null, raf = 0, clipMs = 2500, token = 0;

  document.getElementById('storyClose').addEventListener('click', close);
  document.getElementById('storyPrev').addEventListener('click', () => go(idx - 1));
  document.getElementById('storyNext').addEventListener('click', () => go(idx + 1));
  video.addEventListener('ended', () => go(idx + 1));

  function todaysList() {
    const att = Store.attendance();
    return MEMBERS.filter(m => att[m.id] && att[m.id].clip)
      .sort((a, b) => att[a.id].in - att[b.id].in)
      .map(m => m.id);
  }

  function open(startMid) {
    list = todaysList();
    if (!list.length) return;
    idx = Math.max(0, list.indexOf(startMid));
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('show'));
    show();
  }

  function close() {
    cancelAnimationFrame(raf);
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (url) { URL.revokeObjectURL(url); url = null; }
    root.classList.remove('show');
    setTimeout(() => { root.hidden = true; }, 220);
  }

  function go(i) {
    if (i < 0) i = 0;
    if (i >= list.length) return close();
    idx = i;
    show();
  }

  async function show() {
    const my = ++token;
    const mid = list[idx];
    const m = memberById(mid);
    const a = Store.attendance()[mid];

    bars.replaceChildren(...list.map((_, i) =>
      h('span', { class: 'sbar' }, h('span', { class: 'sbar-fill', style: `width:${i < idx ? 100 : 0}%` }))
    ));
    who.replaceChildren(
      avatar(m, 34),
      h('div', {},
        h('p', { class: 'story-name' }, m.name),
        h('p', { class: 'story-time' }, a.out ? `출근 ${hm(a.in)} · 퇴근 ${hm(a.out)}` : `출근 ${hm(a.in)}`),
      ),
    );

    cancelAnimationFrame(raf);
    const clip = await Clips.get(Store.today(), mid);
    if (my !== token) return;
    if (url) { URL.revokeObjectURL(url); url = null; }

    if (!clip) {
      video.hidden = true;
      empty.hidden = false;
      empty.replaceChildren(avatar(m, 96), h('p', {}, '이 휴대폰에는 영상이 없어요'));
      clipMs = 2200;
      const t0 = performance.now();
      tick(() => (performance.now() - t0) / clipMs, true);
      return;
    }

    empty.hidden = true;
    video.hidden = false;
    url = URL.createObjectURL(clip.blob);
    clipMs = clip.ms || 2500;
    video.src = url;
    video.play().catch(() => {});
    tick(() => video.currentTime * 1000 / clipMs, false);
  }

  function tick(progress, autoNext) {
    const fill = bars.children[idx] && bars.children[idx].firstChild;
    const loop = () => {
      const p = Math.min(1, progress());
      if (fill) fill.style.width = (p * 100) + '%';
      if (p >= 1 && autoNext) return go(idx + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  return { open, close };
})();

const App = (() => {
  let view = 'home';
  let day = Store.today();
  const RENDER = { home: () => Home.render(), check: () => Check.render(), cal: () => Cal.render() };

  document.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = icon(el.dataset.ico, 24); });
  document.getElementById('waveBtn').querySelector('.tab-ico').innerHTML = icon('hand', 28);

  document.querySelectorAll('.tab[data-view]').forEach(b =>
    b.addEventListener('click', () => go(b.dataset.view)));
  document.getElementById('waveBtn').addEventListener('click', () => Cam.open());
  document.getElementById('meTab').addEventListener('click', meSheet);
  document.getElementById('meBtn').addEventListener('click', meSheet);

  function go(v, slot) {
    view = v;
    document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
    document.querySelectorAll('.tab[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    window.scrollTo(0, 0);
    if (v === 'check') Check.enter(slot);
    else RENDER[v]();
  }

  function render() {
    RENDER[view]();
    Home.renderMeBtn();
  }

  function meSheet() {
    const me = memberById(Store.me());
    const reset = h('div', { class: 'reset-box' });
    const drawReset = ask => reset.replaceChildren(ask
      ? h('div', { class: 'row2' },
          h('button', { class: 'btn ghost', onclick: () => drawReset(false) }, '취소'),
          h('button', { class: 'btn danger', onclick: () => {
            Store.reset();
            Sheet.close();
            toast('처음 상태로 돌렸어요');
          } }, '지우기'))
      : h('button', { class: 'btn danger-ghost', onclick: () => drawReset(true) }, '기록 모두 지우기'));
    drawReset(false);

    Sheet.open('', h('div', { class: 'stack' },
      h('div', { class: 'me-card' },
        me ? avatar(me, 64) : h('button', { class: 'me-empty big', 'aria-label': '나 고르기',
          onclick: () => pickMember('', null, id => { Store.setMe(id); toast(`${memberById(id).name}(으)로 정했어요`); }) }, '?'),
        h('div', { class: 'profile-main' },
          h('p', { class: 'profile-name' }, me ? me.name : '아직 몰라요'),
          h('p', { class: 'sheet-note' }, me ? '손 인사로 출근하면 그 사람으로 바뀌어요.' : '손 인사로 출근하거나 물음표를 눌러 골라 주세요.')),
        me ? editProfileBtn(me.id) : null,
      ),
      h('p', { class: 'sheet-note' }, '프로토타입이라 기록은 이 휴대폰 브라우저에만 저장돼요. 인사 영상은 그날 자정이 지나면 사라져요.'),
      reset,
    ));
  }

  setInterval(() => {
    if (Store.today() !== day) {
      day = Store.today();
      Clips.prune(day);
      render();
    }
  }, 30000);

  Store.on(render);
  Clips.prune(day);
  go('home');

  setTimeout(() => Cam.ensureModel(), 500);

  return { go };
})();

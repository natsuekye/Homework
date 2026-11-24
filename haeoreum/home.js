const Home = (() => {
  const body = document.getElementById('homeBody');

  function render() {
    const now = new Date();
    const today = Store.today();
    document.getElementById('homeDate').textContent = koDate(now);
    renderMeBtn();

    const att = Store.attendance(today);
    const statuses = MEMBERS.map(m => ({ m, st: memberStatus(m.id, today) }));
    const present = statuses.filter(x => x.st.key === 'in');

    const hero = h('section', { class: 'card hero' },
      h('span', { class: 'hero-book', html: BOOK_SVG }),
      h('div', { class: 'hero-text' },
        h('p', { class: 'hero-label' }, '지금 도서관에'),
        h('p', { class: 'hero-num' }, present.length ? `${present.length}명 있어요` : '아무도 없어요'),
        h('p', { class: 'hero-sub' }, present.length
          ? present.map(x => x.m.name).join(', ')
          : (closedInfo(today) ? `오늘은 ${closedInfo(today).label} 휴관일이에요` : '손 인사를 하면 여기에 얼굴이 떠요')),
      ),
      h('div', { class: 'hero-faces' },
        present.length
          ? present.slice(0, 4).map(x => avatar(x.m, 34))
          : h('span', { class: 'hero-empty', html: icon('hand', 22) })
      ),
    );

    const grid = h('div', { class: 'faces' },
      statuses.map(({ m, st }) => {
        const hasClip = att[m.id] && att[m.id].clip;
        return h('button', {
          class: 'face st-' + st.key,
          onclick: () => hasClip ? Story.open(m.id) : profile(m.id),
        },
          avatar(m, 40, hasClip ? 'story' : (st.key === 'plan' ? 'plan' : null)),
          h('span', { class: 'face-name' }, m.name),
          h('span', { class: 'chip chip-' + st.key, title: st.time ? `${st.label} ${st.time}` : st.label }, shortStatus(st)),
        );
      })
    );
    const faces = h('section', { class: 'block' }, grid);

    const slotRow = (slot, label) => {
      const tasks = Store.tasksFor(today, slot);
      const done = tasks.filter(t => Store.checksFor(today, slot)[t.id]).length;
      const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
      return h('button', { class: 'todo-row', onclick: () => App.go('check', slot) },
        h('span', { class: 'todo-label' }, label),
        h('span', { class: 'mini-bar' }, h('span', { style: `width:${pct}%` })),
        h('span', { class: 'todo-num' }, `${done}/${tasks.length}`),
      );
    };
    const todo = h('section', { class: 'card' },
      h('div', { class: 'block-head' }, h('h2', {}, `${WEEK_KO[now.getDay()]}요일 할 일`)),
      slotRow('am', '오전'), slotRow('pm', '오후'),
    );

    const sch = Store.schedulesOn(today);
    const plan = h('section', { class: 'card' },
      h('div', { class: 'block-head' },
        h('h2', {}, '오늘 일정'),
        h('button', { class: 'link', onclick: () => App.go('cal') }, '달력 보기'),
      ),
      sch.length
        ? h('div', { class: 'plan-list' }, sch.map(s => scheduleRow(s)))
        : h('p', { class: 'empty' }, '오늘 등록된 일정이 없어요'),
    );

    body.replaceChildren(hero, faces, todo, plan);
  }

  function shortStatus(st) {
    if (st.key === 'in' || st.key === 'plan') return st.time;
    return st.label;
  }

  const BOOK_SVG = `<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
    <path class="page" d="M0 16 Q0 11 4.5 9.2 C9 7.4 14 6 22 6 C32 6 41 11 50 20 C59 11 68 6 78 6 C86 6 91 7.4 95.5 9.2 Q100 11 100 16 L100 53.3 Q100 60 95.4 60 L4.6 60 Q0 60 0 53.3 Z"/>
  </svg>`;

  function renderMeBtn() {
    const btn = document.getElementById('meBtn');
    const me = memberById(Store.me());
    btn.replaceChildren(me ? avatar(me, 40) : h('span', { class: 'me-empty' }, '?'));
  }

  function profile(mid) {
    const m = memberById(mid);
    const today = Store.today();
    const st = memberStatus(mid, today);
    const mine = Store.schedulesOn(today).filter(s => s.member === mid);
    const offToday = mine.find(s => s.kind === 'off' && s.date === today && !s.weekly);
    const isMe = Store.me() === mid;

    const box = h('div', { class: 'profile' },
      h('div', { class: 'profile-top' },
        avatar(m, 76),
        h('div', { class: 'profile-main' },
          h('p', { class: 'profile-name' }, m.name, isMe ? h('span', { class: 'me-tag' }, '나') : null),
          h('span', { class: 'chip chip-' + st.key }, st.time ? `${st.label} ${st.time}` : st.label),
        ),
        editProfileBtn(mid),
      ),
      mine.length
        ? h('div', { class: 'plan-list' }, mine.map(s => scheduleRow(s, true)))
        : h('p', { class: 'empty' }, '오늘 일정이 없어요'),
      h('p', { class: 'sheet-note' }, st.key === 'in' || st.key === 'out'
        ? '오늘 인사 영상이 아직 저장되지 않았어요.'
        : '손 인사로 출근하면 그날의 인사 영상이 여기에 남아요.'),
      isMe ? h('button', {
        class: 'btn ' + (offToday ? 'ghost' : 'soft'),
        onclick: () => {
          if (offToday) { Store.removeSchedule(offToday.id); toast('못 와요 표시를 지웠어요'); }
          else {
            Store.addSchedule({ member: mid, kind: 'off', date: today, start: '', end: '', weekly: false, memo: '' });
            toast('오늘 못 온다고 알렸어요');
          }
          Sheet.close();
        },
      }, offToday ? '못 와요 취소하기' : '오늘 못 가요') : null,
    );
    Sheet.open('', box);
  }

  return { render, profile, renderMeBtn };
})();

const KIND = { work: '근무', off: '못 와요', etc: '기타' };
function scheduleRow(s, compact) {
  const m = memberById(s.member);
  const time = s.kind === 'off' ? '하루 종일' : `${s.start}–${s.end}`;
  return h('div', { class: 'plan-row kind-' + s.kind },
    compact ? null : avatar(m, 34),
    h('div', { class: 'plan-main' },
      h('p', { class: 'plan-title' },
        compact ? null : h('b', {}, m.name),
        h('span', { class: 'kind' }, KIND[s.kind]),
        s.weekly ? h('span', { class: 'tag' }, '매주') : null,
        s.ex ? h('span', { class: 'tag ex' }, '예시') : null,
      ),
      h('p', { class: 'plan-sub' }, s.memo ? `${time} · ${s.memo}` : time),
    ),
  );
}

const Check = (() => {
  const body = document.getElementById('checkBody');
  const bar = document.getElementById('checkBar');
  const count = document.getElementById('checkCount');
  const listBtn = document.getElementById('checkListBtn');
  const SLOT_NAME = { am: '오전', pm: '오후' };

  let slot = new Date().getHours() >= CONFIG.PM_FROM_HOUR ? 'pm' : 'am';
  let mode = 'cards';
  const later = { am: [], pm: [] };
  const history = [];
  let busy = false;
  let editing = null;

  document.querySelectorAll('#slotSeg button').forEach(b =>
    b.addEventListener('click', () => setSlot(b.dataset.slot)));
  listBtn.addEventListener('click', () => { mode = mode === 'cards' ? 'list' : 'cards'; editing = null; render(); });

  function setSlot(s) { slot = s; editing = null; render(); }

  function enter(s) {
    mode = 'cards';
    editing = null;
    if (s) slot = s;
    render();
  }

  function queueOf(tasks, checks) {
    const todo = tasks.filter(t => !checks[t.id]).map(t => t.id);
    later[slot] = later[slot].filter(id => todo.includes(id));
    return todo.filter(id => !later[slot].includes(id)).concat(later[slot]);
  }

  function render() {
    const today = Store.today();
    document.getElementById('checkDay').textContent = koDate(new Date());
    document.querySelectorAll('#slotSeg button').forEach(b =>
      b.classList.toggle('on', b.dataset.slot === slot));
    listBtn.innerHTML = icon(mode === 'cards' ? 'list' : 'cards', 22);
    listBtn.setAttribute('aria-label', mode === 'cards' ? '목록으로 보기' : '카드로 보기');

    const tasks = Store.tasksFor(today, slot);
    const checks = Store.checksFor(today, slot);
    const queue = queueOf(tasks, checks);
    const done = tasks.length - queue.length;
    bar.style.width = tasks.length ? (done / tasks.length * 100) + '%' : '0%';
    count.textContent = `${done} / ${tasks.length}`;

    if (mode === 'list') return body.replaceChildren(listView(checks));
    if (!queue.length) return body.replaceChildren(doneView(tasks, checks));
    body.replaceChildren(deckView(tasks, queue, done));
  }

  function deckView(tasks, queue, done) {
    const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
    const top3 = queue.slice(0, 3);
    const deck = h('div', { class: 'deck' });

    top3.slice().reverse().forEach((tid, ri) => {
      const depth = top3.length - 1 - ri;
      const t = byId[tid];
      const card = h('div', { class: 'tcard', style: `--depth:${depth}`, 'data-tid': tid },
        h('div', { class: 'tcard-inner' },
          h('div', { class: 'tface front' },
            h('p', { class: 'tcard-no' }, `${SLOT_NAME[slot]} · ${done + 1}번째`,
              later[slot].includes(tid) ? h('span', { class: 'tag' }, '보류했던 일') : null),
            h('p', { class: 'tcard-title' }, t.title),
            t.days && t.days.length ? h('span', { class: 'tag day' }, daysLabel(t.days)) : null,
            h('p', { class: 'tcard-hint' }, (t.steps || []).length ? `눌러서 방법 보기 · ${t.steps.length}단계` : '눌러서 뒤집기'),
            h('div', { class: 'shake-done yes' },
              h('span', { class: 'shake-check', html: icon('check', 34) }), h('span', {}, '완료')),
            h('div', { class: 'shake-done no' },
              h('span', { class: 'shake-check', html: icon('later', 30) }), h('span', {}, '보류')),
          ),
          h('div', { class: 'tface back' },
            h('p', { class: 'tcard-no' }, '이렇게 해요'),
            h('ol', { class: 'steps' }, (t.steps || []).map(s => h('li', {}, s))),
            h('p', { class: 'tcard-hint' }, '다시 누르면 앞면'),
          ),
        ),
      );
      if (depth === 0) card.addEventListener('click', () => { if (!busy) card.classList.toggle('flip'); });
      deck.append(card);
    });

    const sensor = Shake.needsPermission() && !Shake.isOn()
      ? h('button', { class: 'btn primary shake-on', onclick: async () => {
          if (await Shake.enable()) { toast('이제 휴대폰을 흔들어 넘길 수 있어요'); render(); }
          else toast('센서를 쓸 수 없어요. 설정에서 동작 및 방향 접근을 허용해 주세요');
        } }, h('span', { html: icon('shake', 18) }), '흔들어서 넘기기 켜기')
      : null;
    const guide = h('div', { class: 'shake-guide' },
      h('div', { class: 'sg-item no' }, h('span', { class: 'sg-arrow', html: icon('left', 18) }),
        h('span', {}, h('b', {}, '왼쪽으로 흔들기'), h('br'), '보류 · 맨 뒤로')),
      h('div', { class: 'sg-item yes' },
        h('span', {}, h('b', {}, '오른쪽으로 흔들기'), h('br'), '완료'),
        h('span', { class: 'sg-arrow', html: icon('right', 18) })),
    );
    const undo = history.length
      ? h('button', { class: 'link undo', onclick: undoLast }, '방금 것 되돌리기')
      : null;
    return h('div', { class: 'deck-wrap' }, deck, sensor || guide, undo);
  }

  function act(dir) {
    if (busy || mode !== 'cards') return;
    const card = body.querySelector('.deck .tcard:last-child');
    if (!card) return;
    const tid = card.dataset.tid;
    const go = me => {
      busy = true;
      card.classList.remove('flip');
      card.classList.add(dir > 0 ? 'shaken-yes' : 'shaken-no');
      if (navigator.vibrate) navigator.vibrate(dir > 0 ? 60 : [30, 40, 30]);
      setTimeout(() => {
        card.classList.add('fly');
        card.style.transform = `translate(${dir * 140}%, -4%) rotate(${dir * 18}deg)`;
      }, 600);
      setTimeout(() => {
        busy = false;
        if (dir > 0) {
          history.push({ slot, tid, act: 'done' });
          later[slot] = later[slot].filter(id => id !== tid);
          Store.check(Store.today(), slot, tid, me);
        } else {
          history.push({ slot, tid, act: 'later' });
          later[slot] = later[slot].filter(id => id !== tid).concat(tid);
          render();
        }
      }, 880);
    };
    go(Store.me());
  }

  Shake.on(dir => {
    if (document.getElementById('view-check').hidden) return;
    if (Sheet.isOpen() || !document.getElementById('cam').hidden) return;
    act(dir === 'right' ? 1 : -1);
  });

  window.addEventListener('keydown', e => {
    if (document.getElementById('view-check').hidden || Sheet.isOpen()) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') act(1);
    if (e.key === 'ArrowLeft') act(-1);
  });

  function undoLast() {
    const last = history.pop();
    if (!last) return;
    slot = last.slot;
    if (last.act === 'done') {
      later[slot] = later[slot].filter(id => id !== last.tid);
      Store.uncheck(Store.today(), slot, last.tid);
    } else {
      later[slot] = later[slot].filter(id => id !== last.tid);
      render();
    }
  }

  function doneView(tasks, checks) {
    const other = slot === 'am' ? 'pm' : 'am';
    return h('div', { class: 'done' },
      h('div', { class: 'done-badge', html: icon('check', 40) }),
      h('p', { class: 'done-title' }, tasks.length ? `${SLOT_NAME[slot]} 할 일 끝!` : '오늘은 할 일이 없어요'),
      h('p', { class: 'done-sub' }, '누가 무엇을 했는지 남겨 둘게요'),
      h('div', { class: 'card done-list' }, tasks.map(t => doneRow(t, checks[t.id]))),
      h('button', { class: 'btn soft', onclick: () => setSlot(other) }, `${SLOT_NAME[other]} 할 일 보기`),
    );
  }

  function doneRow(t, c) {
    const m = c && memberById(c.by);
    return h('div', { class: 'drow' },
      m ? avatar(m, 26) : h('span', { class: 'drow-dot' }),
      h('span', { class: 'drow-title' }, t.title),
      h('span', { class: 'drow-by' }, c ? (m ? `${m.name} ${hm(c.at)}` : hm(c.at)) : '안 함'),
    );
  }

  function listView(checks) {
    const today = Store.today();
    const wd = parseYmd(today).getDay();
    const all = Store.allTasks(slot);
    const list = h('div', { class: 'card list-card' });

    all.forEach(t => {
      if (editing === t.id) return list.append(taskForm(t));
      const isToday = onDay(t, wd);
      const c = checks[t.id];
      const m = c && memberById(c.by);
      const sub = [
        t.days && t.days.length ? daysLabel(t.days) : null,
        c ? (m ? `${m.name} · ${hm(c.at)}` : hm(c.at)) : null,
      ].filter(Boolean).join('  ·  ');
      const toggle = () => {
        if (!isToday) return;
        if (c) Store.uncheck(today, slot, t.id);
        else Store.check(today, slot, t.id, Store.me());
      };
      const row = h('div', { class: 'lrow' + (c ? ' on' : '') + (isToday ? '' : ' off'), 'data-tid': t.id },
        h('button', { class: 'lcheck', disabled: !isToday, 'aria-label': t.title + (c ? ' 체크 풀기' : ' 체크'),
          html: c ? icon('check', 16) : '', onclick: toggle }),
        h('div', { class: 'lrow-main', role: 'button', tabindex: '0', onclick: toggle,
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } },
          h('span', { class: 'lrow-title' }, t.title),
          sub ? h('span', { class: 'lrow-by' }, sub) : null),
        h('button', { class: 'icon-mini', 'aria-label': t.title + ' 고치기', html: icon('pencil', 17),
          onclick: () => { editing = t.id; render(); focusForm(); } }),
        h('button', { class: 'icon-mini del', 'aria-label': t.title + ' 지우기', html: icon('x', 17),
          onclick: () => { Store.removeTask(slot, t.id); toast('할 일을 지웠어요'); } }),
      );
      bindDrag(row, list);
      list.append(row);
    });

    if (editing === 'new') list.append(taskForm(null));
    else list.append(h('button', { class: 'lrow add', onclick: () => { editing = 'new'; render(); focusForm(); } },
      h('span', { class: 'lcheck plus', html: icon('plus', 16) }),
      h('span', { class: 'lrow-title' }, '할 일 추가')));

    return h('div', { class: 'stack' }, list,
      h('p', { class: 'list-hint' }, '줄을 꾹 누른 채 끌면 순서가 바뀌어요. 카드도 이 순서대로 나와요.'));
  }

  function focusForm() {
    const el = document.getElementById('taskTitle');
    if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function taskForm(t) {
    const title = h('input', { id: 'taskTitle', class: 'input', placeholder: '예: 신문 정리하기', maxlength: '40', value: t ? t.title : '' });
    let days = t && t.days ? t.days.filter(d => OPEN_DAYS.includes(d)) : [];
    const dayRow = h('div', { class: 'day-row' });
    const drawDays = () => dayRow.replaceChildren(
      h('button', { class: 'dchip' + (days.length ? '' : ' on'), onclick: () => { days = []; drawDays(); } }, '매일'),
      ...OPEN_DAYS.map(d => h('button', {
        class: 'dchip' + (days.includes(d) ? ' on' : ''),
        'aria-pressed': days.includes(d) ? 'true' : 'false',
        onclick: () => {
          days = days.includes(d) ? days.filter(x => x !== d) : days.concat(d);
          if (days.length === OPEN_DAYS.length) days = [];
          drawDays();
        },
      }, WEEK_KO[d])),
    );
    drawDays();
    const steps = h('textarea', { id: 'taskSteps', class: 'input', rows: '3', placeholder: '방법을 한 줄에 하나씩 (카드 뒷면에 보여요)' });
    steps.value = t ? (t.steps || []).join('\n') : '';
    const save = () => {
      const tt = title.value.trim();
      if (!tt) { title.focus(); return; }
      const data = {
        title: tt,
        days: days.length ? WEEK_ORDER.filter(d => days.includes(d)) : null,
        steps: steps.value.split('\n').map(s => s.trim()).filter(Boolean),
      };
      editing = null;
      if (t) { Store.updateTask(slot, t.id, data); toast('할 일을 고쳤어요'); }
      else { Store.addTask(slot, data); toast('할 일을 추가했어요'); }
    };
    title.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    return h('div', { class: 'lform' },
      title, dayRow, steps,
      h('div', { class: 'row2' },
        h('button', { class: 'btn line', onclick: () => { editing = null; render(); } }, '취소'),
        h('button', { class: 'btn primary', onclick: save }, t ? '저장' : '추가')),
    );
  }

  const HOLD_MS = 350;
  const MOVE_TOL = 12;
  let dragging = false;
  document.addEventListener('touchmove', e => { if (dragging) e.preventDefault(); }, { passive: false });

  function bindDrag(row, list) {
    let x0 = 0, y0 = 0, rows = [], from = 0, to = 0, step = 0, timer = 0, active = false, pid = null, suppress = false;

    row.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      if (e.target.closest('.lcheck, .icon-mini')) return;
      x0 = e.clientX; y0 = e.clientY; pid = e.pointerId;
      clearTimeout(timer);
      row.classList.add('holding');
      timer = setTimeout(() => {
        row.classList.remove('holding');
        rows = [...list.querySelectorAll('.lrow[data-tid]')];
        from = to = rows.indexOf(row);
        step = row.offsetHeight;
        active = dragging = true;
        try { row.setPointerCapture(pid); } catch (err) {}
        row.classList.add('dragging');
        list.classList.add('sorting');
        if (navigator.vibrate) navigator.vibrate(20);
      }, HOLD_MS);
    });
    row.addEventListener('pointermove', e => {
      if (!active) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > MOVE_TOL) { clearTimeout(timer); row.classList.remove('holding'); }
        return;
      }
      const dy = e.clientY - y0;
      row.style.transform = `translateY(${dy}px) scale(1.02)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / step)));
      rows.forEach((r, i) => {
        if (r === row) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -step;
        if (from > to && i < from && i >= to) shift = step;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    });
    const end = () => {
      clearTimeout(timer);
      row.classList.remove('holding');
      if (!active) return;
      active = dragging = false;
      suppress = true;
      list.classList.remove('sorting');
      rows.forEach(r => { r.style.transform = ''; });
      row.classList.remove('dragging');
      if (to !== from) Store.moveTask(slot, row.dataset.tid, rows[to].dataset.tid, to > from);
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    row.addEventListener('click', e => {
      if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; }
    }, true);
    row.addEventListener('contextmenu', e => e.preventDefault());
  }

  return { render, setSlot, enter };
})();

const Cal = (() => {
  const grid = document.getElementById('calGrid');
  const dayBox = document.getElementById('calDay');
  const filterRow = document.getElementById('calFilter');
  let month = firstOfMonth(new Date());
  let selected = Store.today();
  let filter = null;

  document.getElementById('calPrev').addEventListener('click', () => shift(-1));
  document.getElementById('calNext').addEventListener('click', () => shift(1));

  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function shift(n) {
    month = new Date(month.getFullYear(), month.getMonth() + n, 1);
    render();
  }

  const visible = list => filter ? list.filter(s => s.member === filter) : list;

  function render() {
    const y = month.getFullYear(), mo = month.getMonth();
    document.getElementById('calTitle').textContent = `${y}년 ${mo + 1}월`;
    renderFilter();

    const today = Store.today();
    const cells = WEEK_KO.map((w, i) => h('span', { class: 'wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') }, w));
    for (let i = 0; i < month.getDay(); i++) cells.push(h('span', { class: 'cell blank' }));
    const days = new Date(y, mo + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const ds = ymd(new Date(y, mo, d));
      const list = visible(Store.schedulesOn(ds));
      const wd = (month.getDay() + d - 1) % 7;
      const dots = list.slice(0, 4).map(s => {
        const m = memberById(s.member);
        return h('i', { class: 'dot k-' + s.kind, style: `--c:${m.deep}` });
      });
      if (list.length > 4) dots.push(h('b', { class: 'more' }, '+' + (list.length - 4)));
      const closed = closedInfo(ds);
      cells.push(h('button', {
        class: 'cell' + (ds === today ? ' today' : '') + (ds === selected ? ' sel' : '') +
               (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') +
               (closed ? ' closed' : '') + (closed && closed.holiday ? ' holiday' : ''),
        'aria-label': `${mo + 1}월 ${d}일, ${closed ? closed.label + ' 휴관일, ' : ''}일정 ${list.length}개`,
        onclick: () => { selected = ds; render(); },
      }, h('span', { class: 'num' }, d), h('span', { class: 'dots' }, dots)));
    }
    grid.replaceChildren(...cells);
    renderDay();
  }

  function renderFilter() {
    const chip = (id, label, ava) => h('button', {
      class: 'fchip' + (filter === id ? ' on' : ''),
      onclick: () => { filter = filter === id && id !== null ? null : id; render(); },
    }, ava || null, label);
    filterRow.replaceChildren(
      chip(null, '모두'),
      ...MEMBERS.map(m => chip(m.id, m.name, avatar(m, 24))),
    );
  }

  function renderDay() {
    const d = parseYmd(selected);
    const list = visible(Store.schedulesOn(selected));
    dayBox.replaceChildren(...[
      h('div', { class: 'block-head' },
        h('h2', {}, `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KO[d.getDay()]}요일`),
        h('button', { class: 'btn primary small', onclick: () => editSheet(null, Store.me() || MEMBERS[0].id) },
          h('span', { html: icon('plus', 16) }), '일정'),
      ),
      closedBanner(selected),
      list.length
        ? h('div', { class: 'card plan-list' }, list.map(s =>
            h('button', { class: 'plan-btn', onclick: () => editSheet(s) }, scheduleRow(s))))
        : (closedInfo(selected) ? null : h('div', { class: 'card' }, h('p', { class: 'empty' }, '이날은 일정이 없어요'))),
    ].filter(Boolean));
  }

  function closedBanner(ds) {
    const c = closedInfo(ds);
    if (!c) return null;
    return h('div', { class: 'closed-banner' },
      h('span', { class: 'closed-tag' }, '휴관일'),
      h('p', {}, c.holiday ? `${c.holiday} · 도서관이 쉬는 날이에요` : `${c.label}은 도서관이 쉬는 날이에요`));
  }

  function editSheet(s, me) {
    const isNew = !s;
    const v = s ? { ...s } : {
      member: me, kind: 'work', date: selected, start: '10:00', end: '13:00', weekly: false, memo: '',
    };

    const who = h('div', { class: 'who-row' });
    const drawWho = () => who.replaceChildren(...MEMBERS.map(m => h('button', {
      class: 'who' + (v.member === m.id ? ' on' : ''),
      onclick: () => { v.member = m.id; drawWho(); },
    }, avatar(m, 38), h('span', {}, m.name))));
    drawWho();

    const kindSeg = h('div', { class: 'seg small' });
    const timeRow = h('div', { class: 'row2' });
    const drawKind = () => {
      kindSeg.replaceChildren(...Object.entries(KIND).map(([k, label]) => h('button', {
        class: v.kind === k ? 'on' : '',
        onclick: () => { v.kind = k; drawKind(); },
      }, label)));
      timeRow.hidden = v.kind === 'off';
    };
    drawKind();

    const date = h('input', { id: 'schDate', class: 'input', type: 'date', value: v.date });
    const start = h('input', { id: 'schStart', class: 'input', type: 'time', value: v.start || '10:00' });
    const end = h('input', { id: 'schEnd', class: 'input', type: 'time', value: v.end || '13:00' });
    timeRow.append(h('label', { class: 'field' }, h('span', {}, '시작'), start),
                   h('label', { class: 'field' }, h('span', {}, '끝'), end));
    const weekly = h('input', { id: 'schWeekly', type: 'checkbox', checked: !!v.weekly });
    const memo = h('input', { id: 'schMemo', class: 'input', placeholder: '메모 (선택)', maxlength: '40', value: v.memo || '' });
    const err = h('p', { class: 'err' });

    const save = h('button', { class: 'btn primary', onclick: () => {
      const data = {
        member: v.member, kind: v.kind, date: date.value || selected,
        start: v.kind === 'off' ? '' : start.value, end: v.kind === 'off' ? '' : end.value,
        weekly: weekly.checked, memo: memo.value.trim(),
      };
      if (data.kind !== 'off' && !(data.start < data.end)) {
        err.textContent = '끝나는 시간이 시작보다 늦어야 해요';
        return;
      }
      if (isNew) Store.addSchedule(data); else Store.updateSchedule(s.id, data);
      selected = data.date;
      month = firstOfMonth(parseYmd(data.date));
      Sheet.close();
      toast(isNew ? '일정을 적었어요' : '일정을 고쳤어요');
    } }, '저장');

    const del = isNew ? null : h('button', { class: 'btn danger-ghost', onclick: () => {
      Store.removeSchedule(s.id);
      Sheet.close();
      toast('일정을 지웠어요');
    } }, '일정 지우기');

    Sheet.open('일정', h('div', { class: 'stack form' },
      h('p', { class: 'field-label' }, '누구'), who,
      h('p', { class: 'field-label' }, '종류'), kindSeg,
      h('label', { class: 'field' }, h('span', {}, '날짜'), date),
      timeRow,
      h('label', { class: 'switch' }, weekly, h('span', { class: 'switch-ui' }), h('span', {}, '매주 같은 요일에 반복')),
      memo,
      (s && s.weekly) ? h('p', { class: 'sheet-note' }, '매주 반복 일정은 고치면 모든 주가 함께 바뀌어요.') : null,
      err, save, del,
    ));
  }

  return { render, select(ds) { selected = ds; month = firstOfMonth(parseYmd(ds)); } };
})();

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5h-6v5H5.5A1.5 1.5 0 0 1 4 19z"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="m8.5 12.3 2.4 2.4 4.8-5"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="4"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
  me: '<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.3-3.2 3.8-4.8 6.5-4.8s5.2 1.6 6.5 4.8"/>',
  hand: '<path d="M8.5 12.5V6.8a1.4 1.4 0 0 1 2.8 0v4.7M11.3 11.5V5.2a1.4 1.4 0 0 1 2.8 0v6.3M14.1 11.5V6.4a1.4 1.4 0 0 1 2.8 0v6.8M16.9 10.3a1.4 1.4 0 0 1 2.8 0v4.1a6.6 6.6 0 0 1-6.6 6.6h-.9a6 6 0 0 1-4.9-2.6l-2.6-3.8a1.5 1.5 0 0 1 2.4-1.8l1.4 1.6"/>',
  list: '<path d="M9 7h10M9 12h10M9 17h10"/><g fill="currentColor" stroke="none"><circle cx="5" cy="7" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="5" cy="17" r="1.4"/></g>',
  cards: '<rect x="6" y="4" width="13" height="16" rx="3.5"/><path d="M3.5 7.5v10a3 3 0 0 0 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4.5 19.5h3.8L19 8.8a2.2 2.2 0 0 0-3.1-3.1L5.2 16.4z"/><path d="m14.2 7.4 3.1 3.1"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  later: '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  left: '<path d="M14.5 6 8.5 12l6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  grip: '<circle cx="9" cy="6.5" r="1.1"/><circle cx="15" cy="6.5" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="17.5" r="1.1"/><circle cx="15" cy="17.5" r="1.1"/>',
  shake: '<rect x="8" y="3.5" width="8" height="17" rx="2.2"/><path d="M11 17.5h2M4.5 9v6M19.5 9v6M2 10.5v3M22 10.5v3"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 4.8-4.5 3.4 3 2.6-2.3 4.2 3.8"/>',
};
function icon(name, size) {
  return `<svg viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function avatar(m, size, ring) {
  const url = Store.photo(m.id);
  const mono = m.custom ? Array.from(m.name)[0] : m.mono;
  const el = h('span', {
    class: 'ava' + (ring ? ' ring-' + ring : '') + (url ? ' has-photo' : ''),
    style: `--ava:${size}px; --c:${m.color}; --d:${m.deep}; font-size:${Math.round(size * 0.42)}px`,
  });
  if (url) el.append(h('img', { src: url, alt: '' }));
  else el.textContent = mono;
  return el;
}

function pickPhoto(mid, done) {
  const input = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  document.body.append(input);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 192, s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = S;
      c.getContext('2d').drawImage(img,
        (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
      URL.revokeObjectURL(url);
      Store.setPhoto(mid, c.toDataURL('image/jpeg', 0.85));
      toast('프로필 사진을 바꿨어요');
      if (done) done();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('이 사진은 열 수 없어요'); };
    img.src = url;
  });
  input.click();
}

function editProfileBtn(mid) {
  return h('button', { class: 'edit-fab', 'aria-label': '프로필 수정', html: icon('pencil', 18),
    onclick: () => editProfile(mid) });
}

function editProfile(mid) {
  const m = memberById(mid);
  const box = h('div', { class: 'stack pe' });
  const draw = () => {
    const has = !!Store.photo(mid);
    const pic = h('button', { class: 'pe-pic', 'aria-label': '사진 고르기', onclick: () => pickPhoto(mid, draw) },
      avatar(m, 96),
      h('span', { class: 'pe-cam', html: icon('image', 16) }));
    const name = h('input', { id: 'peName', class: 'input', maxlength: '12', value: m.name, placeholder: m.label });
    box.replaceChildren(
      h('div', { class: 'pe-top' },
        pic,
        has ? h('button', { class: 'link', onclick: () => { Store.setPhoto(mid, null); draw(); } }, '기본 이미지로')
            : h('p', { class: 'sheet-note' }, '동그라미를 눌러 사진을 넣어요')),
      h('label', { class: 'field' }, h('span', {}, '이름'), name),
      h('p', { class: 'sheet-note' }, `손짓 모델의 클래스 이름은 '${m.label}' 그대로 둬도 돼요.`),
      h('button', { class: 'btn primary', onclick: () => {
        Store.setName(mid, name.value.trim());
        Sheet.close();
        toast('프로필을 바꿨어요');
      } }, '저장'),
    );
  };
  draw();
  Sheet.open('프로필 수정', box);
}

function memberStatus(mid, dateStr) {
  const date = dateStr || Store.today();
  const a = Store.attendance(date)[mid];
  if (a && !a.out) return { key: 'in', label: '근무 중', time: hm(a.in) };
  if (a && a.out) return { key: 'out', label: '퇴근', time: hm(a.out) };
  if (Store.isOff(mid, date)) return { key: 'off', label: '못 와요', time: '' };
  const w = Store.schedulesOn(date).find(s => s.member === mid && s.kind === 'work');
  if (w) return { key: 'plan', label: '예정', time: w.start };
  return { key: 'none', label: '쉬는 날', time: '' };
}

const Sheet = (() => {
  const wrap = document.getElementById('sheetWrap');
  const title = document.getElementById('sheetTitle');
  const body = document.getElementById('sheetBody');
  let onClose = null;

  document.getElementById('sheetDim').addEventListener('click', () => close());

  function open(t, node, closeCb) {
    title.textContent = t || '';
    title.hidden = !t;
    body.replaceChildren(node);
    onClose = closeCb || null;
    wrap.hidden = false;
    requestAnimationFrame(() => wrap.classList.add('show'));
  }
  function close() {
    wrap.classList.remove('show');
    setTimeout(() => { if (!wrap.classList.contains('show')) wrap.hidden = true; }, 260);
    if (onClose) { const f = onClose; onClose = null; f(); }
  }
  return { open, close, isOpen: () => !wrap.hidden };
})();

let toastTimer = 0;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 250);
  }, 2200);
}

function pickMember(title, current, onPick, note) {
  const grid = h('div', { class: 'pick-grid' },
    MEMBERS.map(m => h('button', {
      class: 'pick' + (m.id === current ? ' on' : ''),
      onclick: () => { Sheet.close(); onPick(m.id); },
    }, avatar(m, 52), h('span', {}, m.name)))
  );
  Sheet.open(title, h('div', {}, note ? h('p', { class: 'sheet-note' }, note) : null, grid));
}

const Store = (() => {
  const KEY = 'haeoreum.v1';
  const subs = [];
  let state = load();

  function blank() {
    return {
      v: 1,
      me: null,
      checkins: {},
      schedules: seedSchedules(new Date()),
      checks: {},
      tasks: JSON.parse(JSON.stringify(TASKS_DEFAULT)),
      photos: {},
      names: {},
    };
  }

  function applyNames() {
    MEMBERS.forEach(m => {
      const n = state.names && state.names[m.id];
      m.name = n || m.label;
      m.custom = !!n;
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1) {
          s.photos = s.photos || {}; s.names = s.names || {};
          ['am', 'pm'].forEach(k => (s.tasks[k] || []).forEach(t => {
            if ('day' in t) { if (!('days' in t)) t.days = t.day === null ? null : [t.day]; delete t.day; }
          }));
          s.schedules = s.schedules.filter(x => !(x.ex && closedInfo(x.date)));
          return s;
        }
      }
    } catch (e) {}
    return blank();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    subs.forEach(fn => fn());
  }

  applyNames();

  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    state = load();
    applyNames();
    subs.forEach(fn => fn());
  });

  const today = () => ymd(new Date());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  return {
    on(fn) { subs.push(fn); },
    today,

    me() { return state.me; },
    setMe(id) { state.me = id; save(); },

    photo(mid) { return state.photos[mid] || null; },
    setPhoto(mid, url) {
      if (url) state.photos[mid] = url; else delete state.photos[mid];
      save();
    },

    setName(mid, name) {
      const m = memberById(mid);
      if (!m) return;
      if (name && name !== m.label) state.names[mid] = name; else delete state.names[mid];
      applyNames();
      save();
    },

    attendance(date) { return state.checkins[date || today()] || {}; },
    checkin(mid, ts) {
      const d = today();
      state.checkins[d] = state.checkins[d] || {};
      state.checkins[d][mid] = { in: ts, out: null, clip: false };
      save();
    },
    checkout(mid, ts) {
      const rec = (state.checkins[today()] || {})[mid];
      if (!rec) return;
      rec.out = ts;
      save();
    },
    setAttendance(mid, rec) {
      const d = today();
      state.checkins[d] = state.checkins[d] || {};
      if (rec) state.checkins[d][mid] = { ...rec }; else delete state.checkins[d][mid];
      save();
    },
    markClip(mid) {
      const rec = (state.checkins[today()] || {})[mid];
      if (rec) { rec.clip = true; save(); }
    },

    schedulesOn(dateStr) {
      const d = parseYmd(dateStr);
      const closed = !!closedInfo(dateStr);
      return state.schedules.filter(s => {
        if (s.date === dateStr) return true;
        if (!s.weekly || closed) return false;
        const start = parseYmd(s.date);
        return d >= start && d.getDay() === start.getDay();
      }).sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
    },
    addSchedule(s) { state.schedules.push({ ...s, id: uid() }); save(); },
    updateSchedule(id, patch) {
      const s = state.schedules.find(x => x.id === id);
      if (s) { Object.assign(s, patch, { ex: false }); save(); }
    },
    removeSchedule(id) {
      state.schedules = state.schedules.filter(x => x.id !== id);
      save();
    },
    isOff(mid, dateStr) {
      return this.schedulesOn(dateStr).some(s => s.member === mid && s.kind === 'off');
    },

    tasksFor(dateStr, slot) {
      const wd = parseYmd(dateStr).getDay();
      return state.tasks[slot].filter(t => onDay(t, wd));
    },
    allTasks(slot) { return state.tasks[slot]; },
    addTask(slot, t) { state.tasks[slot].push({ ...t, id: uid() }); save(); },
    updateTask(slot, id, patch) {
      const t = state.tasks[slot].find(x => x.id === id);
      if (t) { Object.assign(t, patch); save(); }
    },
    moveTask(slot, id, targetId, after) {
      const list = state.tasks[slot];
      const item = list.find(t => t.id === id);
      if (!item || id === targetId) return;
      const rest = list.filter(t => t.id !== id);
      let at = rest.findIndex(t => t.id === targetId);
      if (at < 0) return;
      if (after) at += 1;
      rest.splice(at, 0, item);
      state.tasks[slot] = rest;
      save();
    },
    removeTask(slot, id) {
      state.tasks[slot] = state.tasks[slot].filter(t => t.id !== id);
      save();
    },
    checksFor(dateStr, slot) {
      return ((state.checks[dateStr] || {})[slot]) || {};
    },
    check(dateStr, slot, tid, by) {
      state.checks[dateStr] = state.checks[dateStr] || { am: {}, pm: {} };
      state.checks[dateStr][slot][tid] = { by, at: Date.now() };
      save();
    },
    uncheck(dateStr, slot, tid) {
      const c = (state.checks[dateStr] || {})[slot];
      if (c) { delete c[tid]; save(); }
    },

    reset() {
      const photos = state.photos, names = state.names;
      state = blank();
      state.photos = photos;
      state.names = names;
      save();
      Clips.clear();
    },
  };
})();

const Clips = (() => {
  const mem = new Map();
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(resolve => {
      try {
        const req = indexedDB.open('haeoreum-clips', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('clips');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    if (!db) return null;
    return new Promise(resolve => {
      const t = db.transaction('clips', mode);
      const r = fn(t.objectStore('clips'));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = () => resolve(null);
    });
  }

  const key = (date, mid) => date + '|' + mid;

  return {
    async put(date, mid, blob, type, ms) {
      const v = { blob, type, ms, at: Date.now() };
      mem.set(key(date, mid), v);
      await tx('readwrite', s => s.put(v, key(date, mid)));
    },
    async remove(date, mid) {
      mem.delete(key(date, mid));
      await tx('readwrite', s => s.delete(key(date, mid)));
    },
    async get(date, mid) {
      const k = key(date, mid);
      if (mem.has(k)) return mem.get(k);
      const v = await tx('readonly', s => s.get(k));
      if (v) mem.set(k, v);
      return v || null;
    },
    async prune(today) {
      for (const k of [...mem.keys()]) if (!k.startsWith(today + '|')) mem.delete(k);
      const keys = await tx('readonly', s => s.getAllKeys());
      if (!keys) return;
      const old = keys.filter(k => !String(k).startsWith(today + '|'));
      if (old.length) await tx('readwrite', s => { old.forEach(k => s.delete(k)); });
    },
    async clear() {
      mem.clear();
      await tx('readwrite', s => s.clear());
    },
  };
})();

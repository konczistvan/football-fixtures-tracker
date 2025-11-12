(function (w) {
  const App = (w.App = w.App || {});

  const LS_KEY = 'pl:events:v1';
  const REMIND_DEFAULT_MIN = 30;

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function save(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list || [])); } catch (e) {}
  }

  const state = {
    items: load(),
    timers: new Map(), // id -> timeout id
  };

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function normalizeISO(d) {
    // Store in ISO UTC
    return new Date(d).toISOString();
  }

  function scheduleOne(ev) {
    const fireAt = new Date(ev.time).getTime() - (ev.remindMin || REMIND_DEFAULT_MIN) * 60000;
    const delay = fireAt - Date.now();
    if (delay <= 0) return; // already passed
    const id = setTimeout(() => notify(ev), delay);
    state.timers.set(ev.id, id);
  }

  function notify(ev) {
    try {
      const title = 'Match reminder';
      const body = `${ev.title} starts in ${ev.remindMin} min`;
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, { body });
        setTimeout(() => n.close && n.close(), 6000);
      } else {
        alert(`${title}: ${body}`);
      }
    } catch (e) {}
  }

  function requestPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }
  }

  function render() {
    const listEl = document.getElementById('events-list');
    const empty = document.getElementById('events-empty');
    if (!listEl) return;
    const upcoming = state.items
      .filter((e) => new Date(e.time).getTime() >= Date.now() - 60000)
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    if (!upcoming.length) {
      if (empty) empty.hidden = false;
      listEl.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;
    listEl.innerHTML = upcoming
      .slice(0, 20)
      .map((e) => {
        const d = new Date(e.time);
        const when = `${d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        return `
        <div class="row">
          <div class="right"><span class="muted">${when}</span></div>
          <div class="center"><span class="chip chip-time">${e.remindMin}m before</span></div>
          <div><span class="team"><span class="label">${App.escape(e.title)}</span></span></div>
          <div style="grid-column: 1/-1; text-align:right; margin-top:4px;">
            <button class="tab" data-event-id="${e.id}" data-action="remove-event">Remove</button>
          </div>
        </div>`;
      })
      .join('');
  }

  function rearm() {
    // clear all
    state.timers.forEach((t) => clearTimeout(t));
    state.timers.clear();
    // schedule future
    state.items.forEach(scheduleOne);
  }

  App.Events = {
    addFromMatch(match, remindMin) {
      const title = `${App.teamLabel(match.homeTeam)} vs ${App.teamLabel(match.awayTeam)}`;
      const ev = {
        id: uid(),
        title,
        time: normalizeISO(match.utcDate),
        matchId: match.id,
        remindMin: Math.max(0, parseInt(remindMin || REMIND_DEFAULT_MIN, 10)) || REMIND_DEFAULT_MIN,
      };
      state.items.push(ev);
      save(state.items);
      scheduleOne(ev);
      render();
      requestPermission();
    },
    addCustom({ title, timeLocal, remindMin }) {
      const iso = normalizeISO(timeLocal);
      const ev = {
        id: uid(),
        title: title || 'Event',
        time: iso,
        remindMin: Math.max(0, parseInt(remindMin || REMIND_DEFAULT_MIN, 10)) || REMIND_DEFAULT_MIN,
      };
      state.items.push(ev);
      save(state.items);
      scheduleOne(ev);
      render();
      requestPermission();
    },
    remove(id) {
      const idx = state.items.findIndex((x) => x.id === id);
      if (idx >= 0) state.items.splice(idx, 1);
      const t = state.timers.get(id);
      if (t) clearTimeout(t);
      state.timers.delete(id);
      save(state.items);
      render();
    },
    render,
    initUI() {
      requestPermission();
      render();
      rearm();
      // refresh rendering every minute to keep ordering fresh
      setInterval(render, 60 * 1000);
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-event"]');
        if (btn) {
          const id = btn.getAttribute('data-event-id');
          if (id) App.Events.remove(id);
        }
      });
      const addBtn = document.getElementById('add-custom-event');
      if (addBtn) addBtn.addEventListener('click', () => App.showEventModal());
      const form = document.getElementById('event-form');
      if (form) {
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const title = form.querySelector('[name="title"]').value.trim();
          const dt = form.querySelector('[name="datetime"]').value;
          const remind = form.querySelector('[name="remind"]').value;
          if (!dt) return;
          App.Events.addCustom({ title, timeLocal: dt, remindMin: remind });
          App.hideEventModal();
          form.reset();
        });
      }
      const close = document.getElementById('event-close');
      if (close) close.addEventListener('click', App.hideEventModal);
    },
  };

  // Quick-add via fixtures: exposed hook
  App.quickAddEvent = function (match) {
    let m = REMIND_DEFAULT_MIN;
    try {
      const v = prompt('Remind me before kickoff (minutes):', String(REMIND_DEFAULT_MIN));
      if (v === null) return; // cancelled
      m = Math.max(0, parseInt(v, 10)) || REMIND_DEFAULT_MIN;
    } catch (e) {}
    App.Events.addFromMatch(match, m);
  };

  // Modal helpers for custom event
  App.showEventModal = function () {
    const m = document.getElementById('event-modal');
    if (m) {
      m.hidden = false;
      m.classList.add('show');
    }
  };
  App.hideEventModal = function () {
    const m = document.getElementById('event-modal');
    if (m) {
      m.classList.remove('show');
      m.hidden = true;
    }
  };
})(window);


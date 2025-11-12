(function (w) {
  const App = (w.App = w.App || {});

  const LS_KEY = 'pl:notes:v1';
  const state = {
    items: load(), // { [matchId]: [{ text, ts }] }
    captcha: { a: 0, b: 0 },
    currentMatch: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.items || {})); } catch (e) {}
  }

  function regenCaptcha() {
    state.captcha.a = 1 + Math.floor(Math.random() * 9);
    state.captcha.b = 1 + Math.floor(Math.random() * 9);
    const el = document.getElementById('captcha-q');
    if (el) el.textContent = `${state.captcha.a} + ${state.captcha.b} = ?`;
    const input = document.getElementById('captcha-a');
    if (input) input.value = '';
  }

  function validCaptcha() {
    const input = document.getElementById('captcha-a');
    const v = Number((input && input.value) || 0);
    return v === state.captcha.a + state.captcha.b;
  }

  function renderNotesList(matchId) {
    const listEl = document.getElementById('notes-list');
    if (!listEl) return;
    const notes = (state.items[matchId] || []).slice().sort((a, b) => b.ts - a.ts);
    if (!notes.length) {
      listEl.innerHTML = '<div class="muted">No notes yet.</div>';
      return;
    }
    listEl.innerHTML = notes
      .map((n) => {
        const d = new Date(n.ts);
        const when = `${d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        return `<div class="row"><div class="right"><span class="muted">${when}</span></div><div class="center"></div><div><span class="team"><span class="label">${App.escape(n.text)}</span></span></div></div>`;
      })
      .join('');
  }

  function updateBadges() {
    // add count badges to finished matches in fixtures list (if present)
    document.querySelectorAll('#calendar-fixtures .row').forEach((row) => {
      const add = row.querySelector('[data-action="add-note"]');
      const id = add && add.getAttribute('data-match-id');
      if (!id) return;
      const count = (state.items[id] || []).length;
      let badge = row.querySelector('.chip-note-count');
      if (!count) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        const center = row.querySelector('.center');
        if (center) {
          badge = document.createElement('span');
          badge.className = 'chip chip-finished chip-note-count';
          center.appendChild(badge);
        }
      }
      if (badge) badge.textContent = `${count} notes`;
    });
  }

  App.openNoteModal = function (match) {
    state.currentMatch = match;
    const title = document.getElementById('note-title');
    if (title) title.textContent = `${App.teamLabel(match.homeTeam)} vs ${App.teamLabel(match.awayTeam)}`;
    const when = document.getElementById('note-when');
    if (when) {
      const d = new Date(match.utcDate);
      when.textContent = `${d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    renderNotesList(String(match.id));
    regenCaptcha();
    const m = document.getElementById('note-modal');
    if (m) {
      m.hidden = false;
      m.classList.add('show');
    }
  };
  App.hideNoteModal = function () {
    const m = document.getElementById('note-modal');
    if (m) {
      m.classList.remove('show');
      m.hidden = true;
    }
  };

  App.initNotesUI = function () {
    const form = document.getElementById('note-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!state.currentMatch) return;
        if (!validCaptcha()) {
          alert('Captcha check failed.');
          regenCaptcha();
          return;
        }
        const text = form.querySelector('[name="text"]').value.trim();
        if (!text) return;
        const id = String(state.currentMatch.id);
        state.items[id] = state.items[id] || [];
        state.items[id].push({ text, ts: Date.now() });
        save();
        form.reset();
        regenCaptcha();
        renderNotesList(id);
        updateBadges();
      });
    }
    const close = document.getElementById('note-close');
    if (close) close.addEventListener('click', App.hideNoteModal);

    // delegation for add-note and view-notes in fixtures list
    document.addEventListener('click', (e) => {
      const btnAdd = e.target.closest('[data-action="add-note"]');
      if (btnAdd) {
        const idStr = btnAdd.getAttribute('data-match-id');
        const id = Number(idStr);
        const input = document.querySelector('#fixture-date');
        const dateStr = input && input.value;
        if (!id || !dateStr) return;
        (async () => {
          try {
            let data = await App.call(`/matches`, { competitions: App.COMP, dateFrom: dateStr, dateTo: dateStr, status: 'FINISHED' });
            let list = data.matches || [];
            if (!list.length) {
              data = await App.call(`/competitions/${App.COMP}/matches`, { dateFrom: dateStr, dateTo: dateStr, status: 'FINISHED' });
              list = data.matches || [];
            }
            const match = list.find((m) => Number(m.id) === id);
            if (match) App.openNoteModal(match);
          } catch (err) { console.error(err); }
        })();
      }
    });
  };

  // Expose badge updater for fixtures module
  App.updateNoteBadges = updateBadges;
})(window);

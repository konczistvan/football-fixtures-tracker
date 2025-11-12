(function (w) {
  const App = (w.App = w.App || {});
  const MAX_FIXTURES = 6;

  App.loadFixturesByDate = async function (dateStr) {
    const container = document.querySelector('#calendar-fixtures');
    const empty = document.querySelector('#calendar-empty');

    if (!dateStr) {
      if (container) container.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    let data = await App.call(`/matches`, {
      competitions: App.COMP,
      dateFrom: dateStr,
      dateTo: dateStr,
      status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED',
    });
    let list = data.matches || [];

    if (!list.length) {
      data = await App.call(`/competitions/${App.COMP}/matches`, {
        dateFrom: dateStr,
        dateTo: dateStr,
        status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED',
      });
      list = data.matches || [];
    }

    if (!list.length) {
      if (container) container.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    const html = list
      .slice(0, MAX_FIXTURES)
      .map((m) => {
        const status = m.status;
        let center = '';
        if (status === 'FINISHED') {
          center = `<span class="score">${m.score?.fullTime?.home ?? 0} &ndash; ${m.score?.fullTime?.away ?? 0}</span><span class="chip chip-finished">FT</span>`;
        } else if (status === 'IN_PLAY' || status === 'PAUSED') {
          center = `<span class="chip chip-live">LIVE</span>`;
        } else {
          center = `<span class="chip chip-time">${App.timeOnly(new Date(m.utcDate))}</span>`;
        }
        const actions = (status === 'FINISHED')
          ? `<button class="chip" data-action="add-note" data-match-id="${m.id}">Note</button>`
          : `<button class="chip" data-action="add-event" data-match-id="${m.id}">Remind</button>`;
        return `
      <div class="row">
        <div class="right"><span class="team"><img class="crest" src="${App.crestUrl(m.homeTeam)}" alt="${m.homeTeam?.name || ''}" /> <button class="team-link" data-team-id="${m.homeTeam?.id}">${App.teamLabel(m.homeTeam)}</button></span></div>
        <div class="center">${center} ${actions}</div>
        <div><span class="team"><img class="crest" src="${App.crestUrl(m.awayTeam)}" alt="${m.awayTeam?.name || ''}" /> <button class="team-link" data-team-id="${m.awayTeam?.id}">${App.teamLabel(m.awayTeam)}</button></span></div>
      </div>
    `;
      })
      .join('');
    App.animateSwap(container, html);
    if (App.updateNoteBadges) App.updateNoteBadges();
  };

  App.setCalendarDate = function (d) {
    const input = document.querySelector('#fixture-date');
    if (input) input.value = App.isoDate(d);
    App.loadFixturesByDate(App.isoDate(d));
  };

  App.initFixturesUI = function () {
    const input = document.querySelector('#fixture-date');
    const prev = document.querySelector('#prev-day');
    const next = document.querySelector('#next-day');
    const today = document.querySelector('#today');

    App.setCalendarDate(new Date());
    if (input) {
      input.addEventListener('change', (e) => {
        const v = e.target.value;
        App.loadFixturesByDate(v);
      });
    }
    if (prev)
      prev.addEventListener('click', () => {
        const cur = input && input.value ? new Date(input.value) : new Date();
        cur.setDate(cur.getDate() - 1);
        App.setCalendarDate(cur);
      });
    if (next)
      next.addEventListener('click', () => {
        const cur = input && input.value ? new Date(input.value) : new Date();
        cur.setDate(cur.getDate() + 1);
        App.setCalendarDate(cur);
      });
    if (today) today.addEventListener('click', () => App.setCalendarDate(new Date()));
    // Delegated quick-add event handling
    document.addEventListener('click', (e) => {
      const btnEvent = e.target.closest('[data-action="add-event"]');
      if (btnEvent) {
        const id = Number(btnEvent.getAttribute('data-match-id'));
        const input = document.querySelector('#fixture-date');
        const dateStr = input && input.value;
        if (!dateStr) return;
        (async () => {
          try {
            let data = await App.call(`/matches`, { competitions: App.COMP, dateFrom: dateStr, dateTo: dateStr, status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED' });
            let list = data.matches || [];
            if (!list.length) {
              data = await App.call(`/competitions/${App.COMP}/matches`, { dateFrom: dateStr, dateTo: dateStr, status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED' });
              list = data.matches || [];
            }
            const match = list.find((m) => Number(m.id) === id);
            if (match && App.quickAddEvent) App.quickAddEvent(match);
          } catch (err) { console.error(err); }
        })();
      }
    });
  };
})(window);

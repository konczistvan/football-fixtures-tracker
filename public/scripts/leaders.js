(function (w) {
  const App = (w.App = w.App || {});

  function renderLeaders(items) {
    const list = document.querySelector('#leaders-list');
    const empty = document.querySelector('#leaders-empty');
    if (!list) return;
    if (!items || !items.length) {
      if (empty) empty.hidden = false;
      list.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = items
      .slice(0, 10)
      .map((it, i) => {
        const ph = 'anon.svg';
        const src = it.face || ph;
        return `
      <div class="item">
        <div class="rank">${i + 1}</div>
        <img class="face" src="${src}" alt="${it.name || ''}" onerror="this.onerror=null;this.src='${ph}'" />
        <div class="who"><div class="name">${it.name} <span class="muted">${it.team ? '&middot; ' + it.team : ''}</span></div></div>
        <div class="stat">${it.value}</div>
      </div>
    `;
      })
      .join('');
  }

  App.loadTopScorers = async function () {
    try {
      const data = await App.call(`/pl-stats/scorers`);
      const arr = (data.items || []).map((s) => ({ name: s.name, team: s.team, face: s.face || '', value: s.value }));
      if (arr.length) return renderLeaders(arr);
    } catch (e) {}
    try {
      const data = await App.call(`/competitions/${App.COMP}/scorers`);
      const arr = (data.scorers || []).map((s) => ({
        name: s.player?.name || 'Player',
        team: s.team?.name || '',
        crest: App.crestUrl({ id: s.team?.id, crest: s.team?.crest }),
        value: s.numberOfGoals ?? s.goals ?? 0,
      }));
      renderLeaders(arr);
    } catch (e) {
      renderLeaders([]);
    }
  };

  App.loadTopAssists = async function () {
    try {
      const data = await App.call(`/pl-stats/assists`);
      const arr = (data.items || []).map((s) => ({ name: s.name, team: s.team, face: s.face || '', value: s.value }));
      if (arr.length) return renderLeaders(arr);
    } catch (e) {}
    try {
      const data = await App.call(`/competitions/${App.COMP}/scorers`);
      const arr = (data.scorers || [])
        .map((s) => ({
          name: s.player?.name || 'Player',
          team: s.team?.name || '',
          crest: App.crestUrl({ id: s.team?.id, crest: s.team?.crest }),
          value: s.assists ?? null,
        }))
        .filter((x) => x.value !== null)
        .sort((a, b) => b.value - a.value)
        .slice(0, 20);
      if (!arr.length) {
        const empty = document.querySelector('#leaders-empty');
        if (empty) empty.textContent = 'Assists not provided by this API for this competition.';
        renderLeaders([]);
      } else {
        renderLeaders(arr);
      }
    } catch (e) {
      const empty = document.querySelector('#leaders-empty');
      if (empty) empty.textContent = 'Assists not provided by this API for this competition.';
      renderLeaders([]);
    }
  };

  App.loadTopCleanSheets = async function () {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 60);
    try {
      const f = await App.call(`/pl-stats/cleansheets`);
      const arr1 = (f.items || []).map((s) => ({ name: s.name, team: s.team, face: s.face || '', value: s.value }));
      if (arr1.length) return renderLeaders(arr1);
    } catch (e) {}
    try {
      const data = await App.call(`/competitions/${App.COMP}/matches`, {
        status: 'FINISHED',
        dateFrom: App.isoDate(from),
        dateTo: App.isoDate(to),
      });
      const teamCS = new Map();
      (data.matches || []).forEach((m) => {
        const home = m.homeTeam || {};
        const away = m.awayTeam || {};
        const h = m.score?.fullTime?.home ?? 0;
        const a = m.score?.fullTime?.away ?? 0;
        if (h === 0 && away?.id) teamCS.set(away.id, (teamCS.get(away.id) || 0) + 1);
        if (a === 0 && home?.id) teamCS.set(home.id, (teamCS.get(home.id) || 0) + 1);
      });
      const topTeams = Array.from(teamCS.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      const details = await Promise.all(
        topTeams.map(([id, cs]) =>
          App.call(`/teams/${id}`)
            .then((t) => ({
              cs,
              team: t.name || '',
              crest: App.crestUrl({ id: t.id, crest: t.crest }),
              gk: (t.squad || []).find((p) => /Goalkeeper/i.test(p.position || ''))?.name || 'Goalkeeper',
            }))
            .catch(() => ({ cs, team: '', crest: '', gk: 'Goalkeeper' }))
        )
      );
      const arr = details.map((d) => ({ name: d.gk, team: d.team, crest: d.crest, value: d.cs }));
      renderLeaders(arr);
    } catch (e) {
      const empty = document.querySelector('#leaders-empty');
      if (empty) empty.textContent = 'Clean sheet goalkeeper stats not fully available; showing teams failed.';
      renderLeaders([]);
    }
  };

  function setActiveTab(key) {
    document
      .querySelectorAll('.tab')
      .forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
  }

  App.initLeaders = function () {
    const container = document.querySelector('.tabs');
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      setActiveTab(tab);
      if (tab === 'scorers') App.loadTopScorers();
      else if (tab === 'assists') App.loadTopAssists();
      else if (tab === 'cleansheets') App.loadTopCleanSheets();
    });
    setActiveTab('scorers');
    App.loadTopScorers();
  };
})(window);


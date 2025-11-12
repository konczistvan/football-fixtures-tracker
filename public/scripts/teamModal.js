(function (w) {
  const App = (w.App = w.App || {});

  App.showTeamModal = function () {
    const m = document.getElementById('team-modal');
    if (m) {
      m.hidden = false;
      m.classList.add('show');
    }
  };
  App.hideTeamModal = function () {
    const m = document.getElementById('team-modal');
    if (m) {
      m.classList.remove('show');
      m.hidden = true;
    }
  };

  function categorize(pos) {
    const p = String(pos || '').toLowerCase();
    if (p.includes('goal') || p.includes('keeper') || p === 'gk') return 'Goalkeeper';
    if (
      p.includes('def') ||
      p.includes('back') ||
      p.includes('centre back') ||
      p.includes('center back') ||
      p.includes('cb') ||
      p.includes('rb') ||
      p.includes('lb') ||
      p.includes('full back') ||
      p.includes('defence')
    )
      return 'Defender';
    if (p.includes('mid') || p.includes('cm') || p.includes('dm') || p.includes('am') || p.includes('midfield'))
      return 'Midfielder';
    if (p.includes('attack') || p.includes('forw') || p.includes('strik') || p.includes('wing') || p.includes('fw'))
      return 'Forward';
    return 'Midfielder';
  }

  App.renderSquad = function (squad) {
    const wrap = document.getElementById('team-squad');
    if (!wrap) return;
    const list = squad || [];
    if (!list.length) {
      wrap.innerHTML = '<div class="muted">No squad data.</div>';
      return;
    }
    const groups = { Goalkeeper: [], Defender: [], Midfielder: [], Forward: [] };
    list.forEach((p) => groups[categorize(p.position || p.role || '')].push(p));
    const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
    const html = order
      .map((k) => {
        const arr = groups[k];
        if (!arr.length) return '';
        const rows = arr
          .map((p) => `<div class="squad-item"><span class="name">${p.name || ''}</span><span class="pos">${k}</span></div>`)
          .join('');
        return `<div class="squad-group"><div class="group-title">${k}</div>${rows}</div>`;
      })
      .join('');
    wrap.innerHTML = html;
  };

  App.renderTeamMatches = function (list, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const rows = (list || [])
      .map((m) => {
        const d = new Date(m.utcDate);
        const dateChip = `<span class=\"chip chip-date\">${App.shortDate(d)}</span>`;
        const center = m.status === 'FINISHED'
          ? `${dateChip} <span class=\"score\">${m.score?.fullTime?.home ?? 0} &ndash; ${m.score?.fullTime?.away ?? 0}</span>`
          : `${dateChip} <span class=\"chip chip-time\">${App.timeOnly(d)}</span>`;
        return `
      <div class="row">
        <div class="right"><span class="team"><img class="crest" src="${App.crestUrl(m.homeTeam)}" alt="" /> ${App.teamLabel(m.homeTeam)}</span></div>
        <div class="center">${center}</div>
        <div><span class="team"><img class="crest" src="${App.crestUrl(m.awayTeam)}" alt="" /> ${App.teamLabel(m.awayTeam)}</span></div>
      </div>`;
      })
      .join('');
    el.innerHTML = rows || '<div class="muted">No matches.</div>';
  };

  App.openTeamModal = async function (teamId) {
    try {
      App.showTeamModal();
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const to = new Date();
      to.setDate(to.getDate() + 60);
      const [team, matchesAll] = await Promise.all([
        App.call(`/teams/${teamId}`),
        App.call(`/teams/${teamId}/matches`, { dateFrom: App.isoDate(from), dateTo: App.isoDate(to) }),
      ]);
      const crest = App.crestUrl(team);
      const title = document.getElementById('team-title');
      if (title) title.textContent = App.teamLabel(team);
      const sub = document.getElementById('team-sub');
      if (sub) sub.textContent = team.area?.name || '';
      const crestImg = document.getElementById('team-crest');
      if (crestImg) crestImg.src = crest;
      App.renderSquad(team.squad || team.players || team.squadMembers || []);
      const matches = matchesAll.matches || [];
      const now = new Date();
      const upcoming = matches
        .filter((m) => new Date(m.utcDate) >= now)
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
        .slice(0, 5);
      const finished = matches
        .filter((m) => m.status === 'FINISHED')
        .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
        .slice(0, 5);
      App.renderTeamMatches(upcoming, 'team-next');
      App.renderTeamMatches(finished, 'team-last');
    } catch (e) {
      console.error('Team modal error', e);
      App.hideTeamModal();
      alert('Failed to load team data.');
    }
  };

  App.initTeamModalDelegation = function () {
    document.addEventListener('click', async (e) => {
      const link = e.target.closest('.team-link');
      if (link) {
        e.preventDefault();
        const id = link.dataset.teamId;
        if (id) await App.openTeamModal(parseInt(id, 10));
        return;
      }
      const close = e.target.closest('#team-close');
      if (close) App.hideTeamModal();
      if (e.target && e.target.id === 'team-modal') App.hideTeamModal();
    });
  };
})(window);


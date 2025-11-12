(function (w) {
  const App = (w.App = w.App || {});

  const MAX_TABLE_ROWS = 1000;

  App.loadStandings = async function () {
    const data = await App.call(`/competitions/${App.COMP}/standings`);
    const rows = (data.standings && data.standings[0] && data.standings[0].table) || [];
    const tbody = document.querySelector('#standings tbody');
    const empty = document.querySelector('#standings-empty');

    if (!rows.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    const html = rows
      .slice(0, MAX_TABLE_ROWS)
      .map(
        (r) => `
    <tr>
      <td>${r.position}</td>
      <td class="team"><img class="crest" src="${App.crestUrl(r.team)}" alt="${r.team.name}" /> <button class="team-link" data-team-id="${r.team.id}">${App.teamLabel(r.team)}</button></td>
      <td>${r.playedGames}</td>
      <td>${r.won}</td>
      <td>${r.draw}</td>
      <td>${r.lost}</td>
      <td>${r.goalsFor}</td>
      <td>${r.goalsAgainst}</td>
      <td>${r.goalDifference}</td>
      <td><b>${r.points}</b></td>
    </tr>
  `
      )
      .join('');
    if (tbody) App.animateSwap(tbody, html);
  };
})(window);


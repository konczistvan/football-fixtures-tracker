(function (w) {
  const App = (w.App = w.App || {});

  // Dates/format helpers
  App.isoDate = function (d) {
    return d.toISOString().slice(0, 10);
  };
  App.fmt = function (d) {
    return d.toLocaleString('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  App.timeOnly = function (d) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  App.shortDate = function (d) {
    return d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' });
  };

  // DOM helper
  App.animateSwap = function (el, html) {
    if (!el) return;
    el.classList.remove('fade-in');
    el.innerHTML = html;
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('fade-in');
  };

  // Crests and team labels
  App.crestUrl = function (team) {
    if (team && team.crest) return team.crest;
    if (team && team.id) return `https://crests.football-data.org/${team.id}.svg`;
    return '';
  };

  App.NAME_MAP = {
    'Manchester City': 'Man City',
    'Manchester United': 'Man Utd',
    'Tottenham Hotspur': 'Tottenham',
    'West Ham United': 'West Ham',
    'Nottingham Forest': 'Forest',
    'Wolverhampton Wanderers': 'Wolves',
    'Brighton & Hove Albion': 'Brighton',
    'Newcastle United': 'Newcastle',
    'Leeds United': 'Leeds',
    'Leicester City': 'Leicester',
    'Aston Villa': 'Aston Villa',
    Arsenal: 'Arsenal',
    Chelsea: 'Chelsea',
    Liverpool: 'Liverpool',
    Everton: 'Everton',
    Brentford: 'Brentford',
    Fulham: 'Fulham',
    Bournemouth: 'Bournemouth',
    'AFC Bournemouth': 'Bournemouth',
    'Crystal Palace': 'Crystal Palace',
    Burnley: 'Burnley',
    'Sheffield United': 'Sheff Utd',
    'Sheffield Wednesday': 'Sheff Wed',
    'Luton Town': 'Luton',
    'Norwich City': 'Norwich',
    'West Bromwich Albion': 'West Brom',
    Sunderland: 'Sunderland',
  };

  App.normName = function (s) {
    return String(s || '')
      .replace(/\bFootball Club\b/gi, '')
      .replace(/\bFC\b|\bAFC\b|\bCF\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  App.teamLabel = function (team) {
    const n = App.normName((team && (team.shortName || team.name)) || '');
    if (App.NAME_MAP[n]) return App.NAME_MAP[n];
    let s = n.replace(/^Manchester /, 'Man ').replace(/ United$/, ' Utd');
    if (s) return s;
    if (team && team.tla && team.tla.length <= 4) return team.tla;
    return (team && team.name) || '';
  };

  // Basic HTML escape to safely render user-provided text
  App.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
})(window);

// ===== Settings =====
const API = "/api";   // our proxy base (served by server.js)
const COMP = "PL";     // Premier League
const MAX_TABLE_ROWS = 1000;
const MAX_FIXTURES = 6;

// ===== Helpers =====
async function call(path, params = {}) {
  const url = new URL(API + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    console.error("API error", res.status, path, text);
    throw new Error(`API error: ${res.status} Ă˘â‚¬â€ť ${text}`);
  }
  try { return JSON.parse(text); }
  catch (e) { throw new Error("JSON parse error: " + text.slice(0, 200)); }
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function fmt(d) {
  return d.toLocaleString('en-GB', {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}
function timeOnly(d) {
  return d.toLocaleTimeString('en-GB', { hour: "2-digit", minute: "2-digit" });
}

function shortDate(d) {
  return d.toLocaleDateString('en-GB', { month: "short", day: "2-digit" });
}

// Simple swap animation helper
function animateSwap(el, html) {
  if (!el) return;
  el.classList.remove('fade-in');
  el.innerHTML = html;
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('fade-in');
}

// Team crest helper with fallback
function crestUrl(team = {}) {
  if (team.crest) return team.crest;
  if (team.id) return `https://crests.football-data.org/${team.id}.svg`;
  return "";
}

// Prefer short, human-friendly team names (abbreviations)
const NAME_MAP = {
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
  'Arsenal': 'Arsenal',
  'Chelsea': 'Chelsea',
  'Liverpool': 'Liverpool',
  'Everton': 'Everton',
  'Brentford': 'Brentford',
  'Fulham': 'Fulham',
  'Bournemouth': 'Bournemouth',
  'AFC Bournemouth': 'Bournemouth',
  'Crystal Palace': 'Crystal Palace',
  'Burnley': 'Burnley',
  'Sheffield United': 'Sheff Utd',
  'Sheffield Wednesday': 'Sheff Wed',
  'Luton Town': 'Luton',
  'Norwich City': 'Norwich',
  'West Bromwich Albion': 'West Brom',
  'Sunderland': 'Sunderland'
};

function normName(s = '') {
  return String(s)
    .replace(/\bFootball Club\b/gi, '')
    .replace(/\bFC\b|\bAFC\b|\bCF\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamLabel(team = {}) {
  const n = normName(team.shortName || team.name || '');
  if (NAME_MAP[n]) return NAME_MAP[n];
  // Generic tweaks
  let s = n.replace(/^Manchester /, 'Man ')
           .replace(/ United$/, ' Utd');
  if (s) return s;
  if (team.tla && team.tla.length <= 4) return team.tla;
  return team.name || '';
}

// ===== Standings =====
async function loadStandings() {
  const data = await call(`/competitions/${COMP}/standings`);
  const rows = (data.standings && data.standings[0] && data.standings[0].table) || [];
  const tbody = document.querySelector("#standings tbody");
  const empty = document.querySelector("#standings-empty");

  if (!rows.length) {
    if (tbody) tbody.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const html = rows.slice(0, MAX_TABLE_ROWS).map(r => `
    <tr>
      <td>${r.position}</td>
      <td class="team"><img class="crest" src="${crestUrl(r.team)}" alt="${r.team.name}" /> <button class="team-link" data-team-id="${r.team.id}">${teamLabel(r.team)}</button></td>
      <td>${r.playedGames}</td>
      <td>${r.won}</td>
      <td>${r.draw}</td>
      <td>${r.lost}</td>
      <td>${r.goalsFor}</td>
      <td>${r.goalsAgainst}</td>
      <td>${r.goalDifference}</td>
      <td><b>${r.points}</b></td>
    </tr>
  `).join("");
  if (tbody) animateSwap(tbody, html);
}

// ===== Latest results (last 10 days) =====
async function loadLastResults() {
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - 10);

  const data = await call(`/competitions/${COMP}/matches`, {
    status: "FINISHED",
    dateFrom: isoDate(from),
    dateTo: isoDate(to)
  });

  const list = (data.matches || []).reverse();
  const html = list.slice(0, 10).map(m => `
    <div class="row">
      <div class="right"><span class="team"><img class="crest" src="${crestUrl(m.homeTeam)}" alt="${m.homeTeam.name}" /> ${teamLabel(m.homeTeam)}</span></div>
      <div class="center"><span class="score">${m.score.fullTime.home ?? 0} &ndash; ${m.score.fullTime.away ?? 0}</span></div>
      <div><span class="team"><img class="crest" src="${crestUrl(m.awayTeam)}" alt="${m.awayTeam.name}" /> ${teamLabel(m.awayTeam)}</span></div>
    </div>
  `).join("") || `<div class="muted">No finished matches in this window.</div>`;
  animateSwap(document.querySelector('#last'), html);
}

// ===== Fixtures by selected date =====
async function loadFixturesByDate(dateStr) {
  const container = document.querySelector('#calendar-fixtures');
  const empty = document.querySelector('#calendar-empty');

  if (!dateStr) {
    if (container) container.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  // Try the root matches endpoint with explicit competition and statuses
  let data = await call(`/matches`, {
    competitions: COMP,
    dateFrom: dateStr,
    dateTo: dateStr,
    status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED'
  });
  let list = data.matches || [];

  // Fallback: some APIs filter differently under the competition path
  if (!list.length) {
    data = await call(`/competitions/${COMP}/matches`, {
      dateFrom: dateStr,
      dateTo: dateStr,
      status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED,POSTPONED'
    });
    list = data.matches || [];
  }
  if (!list.length) {
    if (container) container.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  const html = list.slice(0, MAX_FIXTURES).map(m => {
    const status = m.status;
    let center = '';
    if (status === 'FINISHED') {
      center = `<span class="score">${m.score?.fullTime?.home ?? 0} &ndash; ${m.score?.fullTime?.away ?? 0}</span><span class="chip chip-finished">FT</span>`;
    } else if (status === 'IN_PLAY' || status === 'PAUSED') {
      center = `<span class="chip chip-live">LIVE</span>`;
    } else {
      center = `<span class="chip chip-time">${timeOnly(new Date(m.utcDate))}</span>`;
    }
    return `
      <div class="row">
        <div class="right"><span class="team"><img class="crest" src="${crestUrl(m.homeTeam)}" alt="${m.homeTeam?.name || ''}" /> <button class="team-link" data-team-id="${m.homeTeam?.id}">${teamLabel(m.homeTeam)}</button></span></div>
        <div class="center">${center}</div>
        <div><span class="team"><img class="crest" src="${crestUrl(m.awayTeam)}" alt="${m.awayTeam?.name || ''}" /> <button class="team-link" data-team-id="${m.awayTeam?.id}">${teamLabel(m.awayTeam)}</button></span></div>
      </div>
    `;
  }).join('');
  animateSwap(container, html);
}

function setCalendarDate(d) {
  const input = document.querySelector('#fixture-date');
  if (input) input.value = isoDate(d);
  loadFixturesByDate(isoDate(d));
}

// ===== Leaders (tabs: scorers, assists, clean sheets) =====
function renderLeaders(items, label = 'Goals') {
  const list = document.querySelector('#leaders-list');
  const empty = document.querySelector('#leaders-empty');
  if (!list) return;
  if (!items || !items.length) {
    if (empty) empty.hidden = false;
    list.innerHTML = '';
    return;
  }
  if (empty) empty.hidden = true;
  list.innerHTML = items.slice(0, 10).map((it, i) => {
    const ph = 'anon.svg';
    const src = it.face || ph;
    return `
      <div class="item">
        <div class="rank">${i + 1}</div>
        <img class="face" src="${src}" alt="${it.name || ''}" onerror="this.onerror=null;this.src='${ph}'" />
        <div class="who"><div class="name">${it.name} <span class="muted">${it.team ? "&middot; " + it.team : ""}</span></div></div>
        <div class="stat">${it.value}</div>
      </div>
    `;
  }).join('');
}

async function loadTopScorers() {
  // Use FPL for PL leaders (accurate), fallback to football-data if needed
  try {
    const data = await call(`/pl-stats/scorers`);
    const arr = (data.items || []).map(s => ({
      name: s.name, team: s.team, face: s.face || '', value: s.value
    }));
    if (arr.length) return renderLeaders(arr, 'Goals');
  } catch (e) {}
  try {
    const data = await call(`/competitions/${COMP}/scorers`);
    const arr = (data.scorers || []).map(s => ({
      name: s.player?.name || 'Player',
      team: s.team?.name || '',
      crest: crestUrl({ id: s.team?.id, crest: s.team?.crest }),
      value: s.numberOfGoals ?? s.goals ?? 0
    }));
    renderLeaders(arr, 'Goals');
  } catch (e) {
    renderLeaders([], 'Goals');
  }
}

async function loadTopAssists() {
  // Try FPL first (has assists for PL)
  try {
    const data = await call(`/pl-stats/assists`);
    const arr = (data.items || []).map(s => ({ name: s.name, team: s.team, face: s.face || '', value: s.value }));
    if (arr.length) return renderLeaders(arr, 'Assists');
  } catch (e) {}
  // Fallback: football-data (if assists present)
  try {
    const data = await call(`/competitions/${COMP}/scorers`);
    const arr = (data.scorers || []).map(s => ({
      name: s.player?.name || 'Player',
      team: s.team?.name || '',
      crest: crestUrl({ id: s.team?.id, crest: s.team?.crest }),
      value: s.assists ?? null
    })).filter(x => x.value !== null).sort((a,b) => b.value - a.value).slice(0, 20);
    if (!arr.length) {
      const empty = document.querySelector('#leaders-empty');
      if (empty) empty.textContent = 'Assists not provided by this API for this competition.';
      renderLeaders([], 'Assists');
    } else {
      renderLeaders(arr, 'Assists');
    }
  } catch (e) {
    const empty = document.querySelector('#leaders-empty');
    if (empty) empty.textContent = 'Assists not provided by this API for this competition.';
    renderLeaders([], 'Assists');
  }
}

async function loadTopCleanSheets() {
  // Prefer FPL (player clean sheets), else approximate from teams + GK.
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - 60);
  try {
    const f = await call(`/pl-stats/cleansheets`);
    const arr1 = (f.items || []).map(s => ({ name: s.name, team: s.team, face: s.face || '', value: s.value }));
    if (arr1.length) return renderLeaders(arr1, 'Clean Sheets');
  } catch (e) {}
  try {
    const data = await call(`/competitions/${COMP}/matches`, {
      status: 'FINISHED',
      dateFrom: isoDate(from),
      dateTo: isoDate(to)
    });
    const teamCS = new Map(); // teamId -> count
    (data.matches || []).forEach(m => {
      const home = m.homeTeam || {}; const away = m.awayTeam || {};
      const h = m.score?.fullTime?.home ?? 0; const a = m.score?.fullTime?.away ?? 0;
      if (h === 0 && away?.id) teamCS.set(away.id, (teamCS.get(away.id) || 0) + 1);
      if (a === 0 && home?.id) teamCS.set(home.id, (teamCS.get(home.id) || 0) + 1);
    });
    // Top 12 csapat letÄ‚Â¶ltÄ‚Â©se a keretÄ‚Â©rt (kapus)
    const topTeams = Array.from(teamCS.entries()).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const details = await Promise.all(topTeams.map(([id, cs]) => call(`/teams/${id}`)
      .then(t => ({ cs, team: t.name || '', crest: crestUrl({ id: t.id, crest: t.crest }),
                    gk: (t.squad || []).find(p => /Goalkeeper/i.test(p.position || ''))?.name || 'Goalkeeper' }))
      .catch(() => ({ cs, team: '', crest: '', gk: 'Goalkeeper' }))));
    const arr = details.map(d => ({ name: d.gk, team: d.team, crest: d.crest, value: d.cs }));
    renderLeaders(arr, 'Clean Sheets');
  } catch (e) {
    const empty = document.querySelector('#leaders-empty');
    if (empty) empty.textContent = 'Clean sheet goalkeeper stats not fully available; showing teams failed.';
    renderLeaders([], 'Clean Sheets');
  }
}

function setActiveTab(key) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
}

function initLeaders() {
  const container = document.querySelector('.tabs');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    setActiveTab(tab);
    if (tab === 'scorers') loadTopScorers();
    else if (tab === 'assists') loadTopAssists();
    else if (tab === 'cleansheets') loadTopCleanSheets();
  });
  // default
  setActiveTab('scorers');
  loadTopScorers();
}
// ===== Team of the Week (simple grid, no formation controls) =====
function pseudoRating(id, goals) {
  const base = 7.2;
  const g = Number(goals || 0);
  const jitter = (id ? (parseInt(String(id).slice(-2)) % 10) : Math.floor(Math.random()*10)) / 20; // 0..0.45
  const value = Math.min(9.8, base + g * 0.35 + jitter);
  return Math.round(value * 10) / 10;
}

function avatarUrl(name) {
  const n = encodeURIComponent(name || 'Player');
  return `https://ui-avatars.com/api/?name=${n}&background=2a72ff&color=fff&bold=true&size=96`;
}

function renderTeamOfWeek(players) {
  const el = document.querySelector('#totw-pitch');
  const empty = document.querySelector('#totw-empty');
  if (!el) return;
  if (!players || players.length < 11) {
    if (empty) empty.hidden = false;
    el.innerHTML = '';
    return;
  }
  if (empty) empty.hidden = true;

  // Arrange in 4-3-3 formation + GK (bottom)
  const fwd = players.slice(0, 3);
  const mid = players.slice(3, 6);
  const def = players.slice(6, 10);
  const gk  = [players[10]];

  const line = (cls, arr) => `
    <div class="line ${cls}">
      ${arr.map(p => `
        <div class="player">
          <div class="token"></div>
          <div class="name-lbl">${p.name}</div>
        </div>
      `).join('')}
    </div>`;

  const html = [
    line('fwd', fwd),
    line('mid', mid),
    line('def', def),
    line('gk', gk)
  ].join('');
  animateSwap(el, html);
}

async function loadTeamOfWeek() {
  const picks = [];
  let scorers = [];
  try {
    const data = await call(`/competitions/${COMP}/scorers`);
    scorers = data.scorers || [];
  } catch (e) {
    console.warn('Scorers endpoint unavailable', e);
  }

  for (const s of scorers) {
    const p = s.player || {};
    const t = s.team || {};
    const goals = s.numberOfGoals ?? s.goals ?? 0;
    picks.push({
      name: p.name || 'Player',
      team: t.name || 'Ă˘â‚¬â€ť',
      crest: crestUrl({ id: t.id, crest: t.crest }) || '',
      rating: pseudoRating(p.id || t.id, goals)
    });
    if (picks.length >= 10) break; // outfielders
  }

  try {
    const st = await call(`/competitions/${COMP}/standings`);
    const topTeams = ((st.standings && st.standings[0] && st.standings[0].table) || []).map(r => r.team);
    const gkTeam = topTeams[0] || {};
    const gk = { name: 'E. MartÄ‚Â­nez', team: gkTeam.name || 'Ă˘â‚¬â€ť', crest: crestUrl(gkTeam), rating: 8.2 };
    const outfield = picks.slice(0, 10);
    while (outfield.length < 10 && topTeams.length) {
      const tt = topTeams[outfield.length % topTeams.length] || {};
      outfield.push({ name: 'Player', team: tt.name || 'Ă˘â‚¬â€ť', crest: crestUrl(tt), rating: 7.8 });
    }
    const full = [...outfield, gk].slice(0, 11);
    renderTeamOfWeek(full);
  } catch (e) {
    console.error('Failed to build Team of the Week', e);
    renderTeamOfWeek([]);
  }
}

// ===== Init =====
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadStandings();
    // no latest results card anymore

    // Calendar init
    const input = document.querySelector('#fixture-date');
    const prev = document.querySelector('#prev-day');
    const next = document.querySelector('#next-day');
    const today = document.querySelector('#today');
    // no formation controls

    setCalendarDate(new Date());
    if (input) {
      input.addEventListener('change', (e) => {
        const v = e.target.value;
        loadFixturesByDate(v);
      });
    }
    if (prev) prev.addEventListener('click', () => {
      const cur = input && input.value ? new Date(input.value) : new Date();
      cur.setDate(cur.getDate() - 1);
      setCalendarDate(cur);
    });
    if (next) next.addEventListener('click', () => {
      const cur = input && input.value ? new Date(input.value) : new Date();
      cur.setDate(cur.getDate() + 1);
      setCalendarDate(cur);
    });
    if (today) today.addEventListener('click', () => setCalendarDate(new Date()));

    // Leaders init
    initLeaders();
    // Init season progress bar
    initSeasonProgress();

    // Team modal interactions (delegated)
    document.addEventListener('click', async (e) => {
      const link = e.target.closest('.team-link');
      if (link) {
        e.preventDefault();
        const id = link.dataset.teamId;
        if (id) await openTeamModal(parseInt(id, 10));
      }
      const close = e.target.closest('#team-close');
      if (close) hideTeamModal();
      if (e.target.id === 'team-modal') hideTeamModal();
    });
  } catch (e) {
    alert(e.message);
    console.error(e);
  }
});


// ===== Team modal rendering =====
function showModal() { const m = document.getElementById('team-modal'); if (m) { m.hidden = false; m.classList.add('show'); } }
function hideTeamModal() { const m = document.getElementById('team-modal'); if (m) { m.classList.remove('show'); m.hidden = true; } }

function renderSquad(squad = []) {
  const wrap = document.getElementById('team-squad');
  if (!wrap) return;
  if (!squad.length) { wrap.innerHTML = '<div class="muted">No squad data.</div>'; return; }
  const cat = (pos = '') => {
    const p = (pos || '').toLowerCase();
    if (p.includes('goal') || p.includes('keeper') || p === 'gk') return 'Goalkeeper';
    if (
      p.includes('def') || p.includes('back') || p.includes('centre back') || p.includes('center back') ||
      p.includes('cb') || p.includes('rb') || p.includes('lb') || p.includes('full back') || p.includes('defence')
    ) return 'Defender';
    if (p.includes('mid') || p.includes('cm') || p.includes('dm') || p.includes('am') || p.includes('midfield')) return 'Midfielder';
    if (p.includes('attack') || p.includes('forw') || p.includes('strik') || p.includes('wing') || p.includes('fw')) return 'Forward';
    return 'Midfielder';
  };
  const groups = { 'Goalkeeper': [], 'Defender': [], 'Midfielder': [], 'Forward': [] };
  (squad || []).forEach(p => groups[cat(p.position || p.role || '')].push(p));
  const order = ['Goalkeeper','Defender','Midfielder','Forward'];
  const html = order.map(k => {
    const arr = groups[k];
    if (!arr.length) return '';
    const list = arr.map(p => `<div class="squad-item"><span class="name">${p.name || ''}</span><span class="pos">${k}</span></div>`).join('');
    return `<div class="squad-group"><div class="group-title">${k}</div>${list}</div>`;
  }).join('');
  wrap.innerHTML = html;
}

function renderTeamMatches(list = [], elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const rows = list.map(m => {
    const d = new Date(m.utcDate);
    const dateChip = `<span class=\"chip chip-date\">${shortDate(d)}</span>`;
    const center = (m.status === 'FINISHED')
      ? `${dateChip} <span class=\"score\">${m.score?.fullTime?.home ?? 0} &ndash; ${m.score?.fullTime?.away ?? 0}</span>`
      : `${dateChip} <span class=\"chip chip-time\">${timeOnly(d)}</span>`;
    return `
      <div class="row">
        <div class="right"><span class="team"><img class="crest" src="${crestUrl(m.homeTeam)}" alt="" /> ${teamLabel(m.homeTeam)}</span></div>
        <div class="center">${center}</div>
        <div><span class="team"><img class="crest" src="${crestUrl(m.awayTeam)}" alt="" /> ${teamLabel(m.awayTeam)}</span></div>
      </div>`;
  }).join('');
  el.innerHTML = rows || '<div class="muted">No matches.</div>';
}

async function openTeamModal(teamId) {
  try {
    showModal();
    const from = new Date(); from.setDate(from.getDate() - 60);
    const to = new Date(); to.setDate(to.getDate() + 60);
    const [team, matchesAll] = await Promise.all([
      call(`/teams/${teamId}`),
      call(`/teams/${teamId}/matches`, { dateFrom: isoDate(from), dateTo: isoDate(to) })
    ]);
    const crest = crestUrl(team);
    const title = document.getElementById('team-title'); if (title) title.textContent = teamLabel(team);
    const sub = document.getElementById('team-sub'); if (sub) sub.textContent = team.area?.name || '';
    const crestImg = document.getElementById('team-crest'); if (crestImg) crestImg.src = crest;
    renderSquad((team.squad || team.players || team.squadMembers || []));
    const matches = matchesAll.matches || [];
    const now = new Date();
    const upcoming = matches.filter(m => new Date(m.utcDate) >= now).sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate)).slice(0,5);
    const finished = matches.filter(m => m.status === 'FINISHED').sort((a,b) => new Date(b.utcDate)-new Date(a.utcDate)).slice(0,5);
    renderTeamMatches(upcoming, 'team-next');
    renderTeamMatches(finished, 'team-last');
    // Default view to Matches for quick context
  } catch (e) {
    console.error('Team modal error', e);
    hideTeamModal();
    alert('Failed to load team data.');
  }
}






function initSeasonProgress(){
  const startLabel = document.getElementById('season-start');
  const endLabel = document.getElementById('season-end');
  const fill = document.getElementById('season-fill');
  if(!startLabel || !endLabel || !fill) return;
  const now = new Date();
  // Premier League season dates
  const aug15This = new Date(now.getFullYear(),7,15);
  const seasonStart = (now >= aug15This) ? aug15This : new Date(now.getFullYear()-1,7,15);
  const seasonEnd = new Date(seasonStart.getFullYear()+1,4,24);
  const fmtShort = (d)=> d.toLocaleDateString('en-GB',{month:'short', day:'2-digit'});
  startLabel.textContent = fmtShort(seasonStart);
  endLabel.textContent = fmtShort(seasonEnd);
  const clamp = (v,min,max)=> Math.max(min,Math.min(max,v));
  const pct = clamp((now - seasonStart) / (seasonEnd - seasonStart), 0, 1) * 100;
  fill.style.width = pct.toFixed(2)+'%';
}





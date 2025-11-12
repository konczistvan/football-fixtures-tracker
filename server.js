// --- .env betöltése, KÖTELEZŐEN felülírva a gépi env-t ---
const dotenv = require("dotenv");
dotenv.config({ override: true });   // << fontos!

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

const UPSTREAM = "https://api.football-data.org/v4";
// --- Premier League stats via Fantasy Premier League API (for accurate leaders)
// Provides: /api/pl-stats/:kind where kind in {scorers, assists, cleansheets}
app.get('/api/pl-stats/:kind', async (req, res) => {
  try {
    const kind = String(req.params.kind || '').toLowerCase();
    if (!['scorers','assists','cleansheets'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    const r = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (!r.ok) return res.status(502).json({ error: 'Upstream error', status: r.status });
    const data = await r.json();
    const teams = new Map((data.teams || []).map(t => [t.id, t.name]));
    const players = data.elements || [];

    const valueField = kind === 'scorers' ? 'goals_scored'
                      : kind === 'assists' ? 'assists'
                      : 'clean_sheets';

    // Build player mini-face from FPL photo code
    const faceUrl = (p) => {
      const code = String(p.photo || '').split('.')[0];
      if (!code) return '';
      // higher-res headshot; falls back via frontend if not available
      return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
    };

    let filtered = players;
    if (kind === 'cleansheets') {
      // Only goalkeepers (element_type = 1)
      filtered = players.filter(p => Number(p.element_type) === 1);
    }

    const list = filtered
      .map(p => ({
        name: p.web_name || `${p.first_name || ''} ${p.second_name || ''}`.trim(),
        team: teams.get(p.team) || '',
        value: p[valueField] || 0,
        face: faceUrl(p)
      }))
      .filter(x => x.value && x.team && x.name)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    res.json({ kind, items: list });
  } catch (e) {
    console.error('pl-stats error', e);
    res.status(500).json({ error: 'pl-stats failed', detail: String(e) });
  }
});

// (no additional third-party API proxy enabled by default)

// --- Token beolvasása és debug ---
const token = (process.env.FD_TOKEN || "").trim();
console.log("FD token length:", token.length);
if (!token) {
  console.warn("⚠️  Nincs FD_TOKEN a .env-ben! (állítsd be és indítsd újra a szervert)");
}

// --- Egész-API proxy: /api/... -> football-data.org/v4/... ---
app.get(/^\/api\/(.*)$/, async (req, res) => {
  try {
    const subpath = "/" + (req.params[0] || "");
    const qs = new URLSearchParams(req.query).toString();
    const url = `${UPSTREAM}${subpath}${qs ? "?" + qs : ""}`;

    console.log("→", url, "| using token length:", token.length);

    const r = await fetch(url, {
      headers: {
        "X-Auth-Token": token,          // itt küldjük a tokent
        "Accept": "application/json"
      }
    });

    console.log("←", r.status, r.statusText);

    const body = await r.text();
    res
      .status(r.status)
      .set("Content-Type", r.headers.get("content-type") || "application/json")
      .send(body);
  } catch (e) {
    console.error("Proxy error:", e);
    res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
});

// --- Gyors debug endpoint ---
app.get("/api-debug", (req, res) => {
  res.json({ tokenLength: token.length, hasToken: !!token });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy + frontend fut: http://localhost:${port}`);
});

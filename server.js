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
// Note: some hosts (e.g., Cloudflare) may be picky about headers; send a browser-ish UA.
const FPL_URL = process.env.FPL_URL || 'https://fantasy.premierleague.com/api/bootstrap-static/';
app.get('/api/pl-stats/:kind', async (req, res) => {
  try {
    const kind = String(req.params.kind || '').toLowerCase();
    if (!['scorers','assists','cleansheets'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    const r = await fetch(FPL_URL, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
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

// --- Optional: API-Football (RapidAPI) passthrough (if you want to use other endpoints)
// Configure on Render or .env:
// RAPID_BASE=https://api-football-v1.p.rapidapi.com/v3
// RAPID_KEY=your-rapidapi-key
// RAPID_HOST=api-football-v1.p.rapidapi.com
const RAPID_BASE = process.env.RAPID_BASE || '';
const RAPID_KEY = (process.env.RAPID_KEY || '').trim();
const RAPID_HOST = process.env.RAPID_HOST || '';
if (RAPID_BASE && RAPID_KEY) {
  app.get(/^\/api-rapid\/(.*)$/, async (req, res) => {
    try {
      const subpath = '/' + (req.params[0] || '');
      const qs = new URLSearchParams(req.query).toString();
      const url = `${RAPID_BASE}${subpath}${qs ? '?' + qs : ''}`;
      const r = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': RAPID_KEY,
          ...(RAPID_HOST ? { 'X-RapidAPI-Host': RAPID_HOST } : {}),
          'Accept': 'application/json',
        },
      });
      const body = await r.text();
      res.status(r.status).set('Content-Type', r.headers.get('content-type') || 'application/json').send(body);
    } catch (e) {
      console.error('Rapid proxy error', e);
      res.status(500).json({ error: 'Rapid proxy error', detail: String(e) });
    }
  });
}

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

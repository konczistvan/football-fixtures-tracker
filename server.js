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
// Use a browser-like UA to avoid upstream 403 on some hosts
const FPL_URL = process.env.FPL_URL || 'https://fantasy.premierleague.com/api/bootstrap-static/';
// Simple in-memory cache to speed up repeated requests across tabs.
let FPL_CACHE = { data: null, expires: 0, source: '' };
app.get('/api/pl-stats/:kind', async (req, res) => {
  try {
    const kind = String(req.params.kind || '').toLowerCase();
    if (!['scorers','assists','cleansheets'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    async function fetchFPL(url) {
      return fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Referer': 'https://fantasy.premierleague.com/',
          'Origin': 'https://fantasy.premierleague.com',
          'Accept-Language': 'en-GB,en;q=0.9'
        },
      });
    }
    // Use cache unless refresh requested
    const wantRefresh = 'refresh' in (req.query || {});
    let data = null, used = FPL_CACHE.source, lastStatus = null, lastText = '';
    if (!wantRefresh && FPL_CACHE.data && Date.now() < FPL_CACHE.expires) {
      data = FPL_CACHE.data;
    } else {
      // Try direct + multiple proxy fallbacks
      const allOrigins = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://fantasy.premierleague.com/api/bootstrap-static/');
      const candidates = [
        FPL_URL,
        'https://fantasy.premierleague.com/api/bootstrap-static/',
        'https://cors.isomorphic-git.org/https://fantasy.premierleague.com/api/bootstrap-static/',
        allOrigins,
        'https://r.jina.ai/http://fantasy.premierleague.com/api/bootstrap-static/'
      ];
      for (const u of candidates) {
        try {
          const resp = (u.startsWith('https://cors.isomorphic-git.org/') || u.startsWith('https://r.jina.ai/') || u.startsWith('https://api.allorigins.win/'))
            ? await fetch(u)
            : await fetchFPL(u);
          lastStatus = resp.status;
          if (!resp.ok) continue;
          const text = await resp.text();
          lastText = text;
          let parsed = null;
          try { parsed = JSON.parse(text); } catch (_) { parsed = null; }
          if (!parsed) {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) {
              try { parsed = JSON.parse(m[0]); } catch (_) { parsed = null; }
            }
          }
          if (parsed && parsed.elements) { data = parsed; used = u; break; }
        } catch (e) { /* try next */ }
      }
      if (!data) return res.status(502).json({ error: 'Upstream error', status: lastStatus || 'all_failed', sample: (lastText||'').slice(0,160) });
      // Cache for 5 minutes
      FPL_CACHE = { data, expires: Date.now() + 5 * 60 * 1000, source: used };
    }
    if (req.query && 'debug' in req.query) {
      res.set('Cache-Control', 'no-store');
      return res.json({ source: used, status: lastStatus || 200, keys: Object.keys(data||{}), counts: { teams: (data.teams||[]).length, elements: (data.elements||[]).length } });
    }
    // Slight cache for clients too
    res.set('Cache-Control', 'public, max-age=60');
    const teams = new Map((data.teams || []).map(t => [t.id, t.name]));
    const players = data.elements || [];

    const valueField = kind === 'scorers' ? 'goals_scored'
                      : kind === 'assists' ? 'assists'
                      : 'clean_sheets';

    // Build player mini-face via local proxy to avoid hotlink restrictions
    const faceUrls = (p) => {
      const code = String(p.photo || '').split('.')[0];
      if (!code) return { large: '', small: '' };
      return {
        large: `/img/fpl/p${code}.png?size=250`,
        small: `/img/fpl/p${code}.png?size=110`,
      };
    };

    let filtered = players;
    if (kind === 'cleansheets') {
      // Only goalkeepers (element_type = 1)
      filtered = players.filter(p => Number(p.element_type) === 1);
    }

    const list = filtered
      .map(p => {
        const f = faceUrls(p);
        return {
          name: p.web_name || `${p.first_name || ''} ${p.second_name || ''}`.trim(),
          team: teams.get(p.team) || '',
          value: p[valueField] || 0,
          face: f.large,
          faceAlt: f.small,
        };
      })
      .filter(x => x.value && x.team && x.name)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    res.json({ kind, items: list });
  } catch (e) {
    console.error('pl-stats error', e);
    res.status(500).json({ error: 'pl-stats failed', detail: String(e) });
  }
});

// Local proxy for FPL headshots to ensure images load on all hosts
app.get('/img/fpl/:file', async (req, res) => {
  try {
    const file = String(req.params.file || '');
    const size = String(req.query.size || '250') === '110' ? '110x140' : '250x250';
    if (!/^p\d+\.png$/.test(file)) return res.status(400).send('Bad image');
    const url = `https://resources.premierleague.com/premierleague/photos/players/${size}/${file}`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
    if (!r.ok) return res.status(r.status).send('Image upstream error');
    res.set('Content-Type', r.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error('image proxy error', e);
    res.status(500).send('Image proxy error');
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

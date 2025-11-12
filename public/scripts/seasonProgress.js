(function (w) {
  const App = (w.App = w.App || {});

  App.initSeasonProgress = function () {
    const startLabel = document.getElementById('season-start');
    const endLabel = document.getElementById('season-end');
    const fill = document.getElementById('season-fill');
    if (!startLabel || !endLabel || !fill) return;
    const now = new Date();
    // season dates fixed: start 15 Aug, end 24 May
    const aug15This = new Date(now.getFullYear(), 7, 15);
    const seasonStart = now >= aug15This ? aug15This : new Date(now.getFullYear() - 1, 7, 15);
    const seasonEnd = new Date(seasonStart.getFullYear() + 1, 4, 24);
    const fmtShort = (d) => d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' });
    startLabel.textContent = fmtShort(seasonStart);
    endLabel.textContent = fmtShort(seasonEnd);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const pct = clamp((now - seasonStart) / (seasonEnd - seasonStart), 0, 1) * 100;
    fill.style.width = pct.toFixed(2) + '%';
  };
})(window);


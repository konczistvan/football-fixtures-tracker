(function (w) {
  const App = (w.App = w.App || {});

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // Remove any stray text nodes directly under <body> (prevents odd symbols at the top-left)
      Array.from(document.body.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
          n.parentNode && n.parentNode.removeChild(n);
        }
      });

      await App.loadStandings();
      App.initFixturesUI();
      if (App.Events && App.Events.initUI) App.Events.initUI();
      if (App.initNotesUI) App.initNotesUI();
      App.initLeaders();
      App.initSeasonProgress();
      App.initTeamModalDelegation();
    } catch (e) {
      alert(e.message);
      console.error(e);
    }
  });
})(window);

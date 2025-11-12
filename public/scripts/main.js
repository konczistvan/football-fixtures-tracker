(function (w) {
  const App = (w.App = w.App || {});

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await App.loadStandings();
      App.initFixturesUI();
      App.initLeaders();
      App.initSeasonProgress();
      App.initTeamModalDelegation();
    } catch (e) {
      alert(e.message);
      console.error(e);
    }
  });
})(window);


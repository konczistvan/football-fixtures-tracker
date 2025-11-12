(function (w) {
  const App = (w.App = w.App || {});
  App.API_BASE = '/api';
  App.COMP = 'PL';

  App.call = async function (path, params) {
    const url = new URL(App.API_BASE + path, window.location.origin);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.error('API error', res.status, path, text);
      throw new Error('API error: ' + res.status + ' — ' + text);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('JSON parse error: ' + text.slice(0, 200));
    }
  };
})(window);


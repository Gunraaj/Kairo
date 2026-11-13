(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var paramTheme = params.get('theme');
    var stored = localStorage.getItem('kairo_theme');
    var theme = paramTheme || (stored ? JSON.parse(stored).value : null);
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
})();

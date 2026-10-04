// Restore the shared preference before styles render, avoiding a light flash.
(function () {
  try {
    document.documentElement.setAttribute('data-bs-theme', localStorage.getItem('tgmn-dark-mode') === 'dark' ? 'dark' : 'light');
  } catch { /* Keep the default theme when browser storage is unavailable. */ }
})();

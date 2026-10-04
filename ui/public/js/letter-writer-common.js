(function () {
  'use strict';
  const authReady = setupAuth('/', true, location.pathname.slice(1));
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function notice(message, error = false) {
    $('#notice').className = `alert alert-${error ? 'danger' : 'success'}`;
    $('#notice').textContent = message;
  }
  async function api(path, method = 'GET', body) {
    const options = { method };
    if (body !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const response = await (await authReady).apiFetch('/api/letter-writer' + path, options);
    if (!response) throw new Error('نشست منقضی شده است؛ دوباره وارد شوید');
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || data.error || 'درخواست انجام نشد');
      if (Array.isArray(data.error?.missingInformation)) error.missingInformation = data.error.missingInformation;
      throw error;
    }
    return data;
  }
  window.WriterUI = { $, esc, notice, api };
})();

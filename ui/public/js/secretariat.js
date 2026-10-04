(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const authReady = setupAuth('/', true, 'secretariat');
  const savedScore = Number(localStorage.getItem('secretariat-min-score'));
  if (Number.isInteger(savedScore) && savedScore >= 30 && savedScore <= 90) $('#minScore').value = savedScore;
  const updateScoreLabel = () => { $('#minScoreValue').textContent = `${$('#minScore').value}٪`; };
  updateScoreLabel();
  let hasSearched = false;
  let searchRequest = 0;
  $('#minScore').addEventListener('input', updateScoreLabel);
  $('#minScore').addEventListener('change', () => {
    localStorage.setItem('secretariat-min-score', $('#minScore').value);
    if (hasSearched && $('#query').value.trim()) $('#searchForm').requestSubmit();
  });
  const notice = (message, error = false) => {
    $('#notice').className = `alert alert-${error ? 'danger' : 'success'}`;
    $('#notice').textContent = message;
  };
  async function api(url) {
    const response = await (await authReady).apiFetch('/api/secretariat' + url);
    if (!response) throw new Error('نشست منقضی شده است');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || result.error || 'درخواست انجام نشد');
    return result;
  }
  function renderLetters(items) {
    $('#listTitle').textContent = 'نتایج جستجو';
    $('#count').textContent = `${items.length} نامه`;
    $('#letters').innerHTML = items.length ? items.map(item => item.ltrConfidential
      ? `<button class="letter-card" type="button" data-key="${esc(item.ltrKey)}">
        <div class="d-flex justify-content-between align-items-center gap-2"><strong>شماره ${esc(item.ltrNumber || '—')}</strong><span class="badge text-bg-danger">محرمانه</span></div>
        <div class="letter-meta mt-2">تاریخ ${esc(item.ltrLetterDate || '—')}</div></button>`
      : `<button class="letter-card" type="button" data-key="${esc(item.ltrKey)}">
        <div class="d-flex justify-content-between gap-2"><strong>${esc(item.ltrSubject)}</strong><span class="letter-meta">${esc(item.ltrLetterDate || '')}</span></div>
        <div class="letter-meta mt-2">شماره ${esc(item.ltrNumber || '—')}${Number.isFinite(item.lexicalScore) ? ` · <span title="درصد کلمات عبارت جستجو که در نامه یا پیوست آن پیدا شده‌اند">مشابهت عین کلمات: ${(item.lexicalScore * 100).toFixed(1)}٪</span>` : ''}${Number.isFinite(item.semanticScore) ? ` · <span title="شباهت کسینوسی متن؛ این عدد درصد اطمینان نیست">مشابهت معنایی: ${(item.semanticScore * 100).toFixed(1)}٪</span>` : ''}</div>
        <div class="letter-meta mt-2">فرستنده: ${esc(item.ltrSender || '—')} · گیرنده: ${esc(item.ltrRecipient || '—')}</div>
        ${item.excerpt ? `<p class="letter-excerpt mt-2 mb-0">${esc(item.excerpt)}</p>` : ''}
      </button>`).join('') : '<p class="text-secondary">نامه‌ای با ارتباط کافی پیدا نشد.</p>';
  }
  async function showLetter(key) {
    const { letter, files } = await api('/letters/' + encodeURIComponent(key));
    if (letter.ltrConfidential) {
      $('#detail').innerHTML = `<div class="d-flex justify-content-between align-items-center gap-2"><h2 class="h5 mb-0">شماره ${esc(letter.ltrNumber || '—')}</h2><span class="badge text-bg-danger">محرمانه</span></div><div class="letter-meta mt-3">تاریخ ${esc(letter.ltrLetterDate || '—')}</div>`;
      return;
    }
    $('#detail').innerHTML = `<h2 class="h5">${esc(letter.ltrSubject)}</h2>
      <dl class="row small mt-3"><dt class="col-4">شماره</dt><dd class="col-8">${esc(letter.ltrNumber || '—')}</dd>
      <dt class="col-4">تاریخ</dt><dd class="col-8">${esc(letter.ltrLetterDate || '—')}</dd>
      <dt class="col-4">فرستنده</dt><dd class="col-8">${esc(letter.ltrSender || '—')}</dd>
      <dt class="col-4">گیرنده</dt><dd class="col-8">${esc(letter.ltrRecipient || '—')}</dd></dl>
      ${letter.ltrBody ? `<div class="letter-body border-top pt-3">${esc(letter.ltrBody)}</div>` : ''}
      <h3 class="h6 mt-4">فایل‌ها و پیوست‌ها</h3>
      <div class="d-grid gap-2">${files.map(file => `<button class="btn btn-outline-secondary text-start" data-download="${esc(file.sflKey)}" data-name="${esc(file.sflName)}" type="button"><i class="fa-solid fa-download ms-2"></i>${esc(file.sflName)}</button>`).join('') || '<span class="text-secondary">فایلی ثبت نشده است.</span>'}</div>`;
    $('#detail').dataset.key = key;
  }
  async function download(key, fileKey, name) {
    const response = await (await authReady).apiFetch(`/api/secretariat/letters/${encodeURIComponent(key)}/files/${encodeURIComponent(fileKey)}`);
    if (!response) throw new Error('نشست منقضی شده است');
    if (!response.ok) throw new Error('دریافت فایل انجام نشد');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#searchForm').addEventListener('submit', async event => {
    event.preventDefault();
    const currentRequest = ++searchRequest;
    const button = $('#searchForm button[type=submit]');
    button.disabled = true;
    try {
      const result = await api('/search?q=' + encodeURIComponent($('#query').value) + '&minScore=' + $('#minScore').value);
      if (currentRequest !== searchRequest) return;
      hasSearched = true;
      renderLetters(result.results);
      $('#detail').innerHTML = '<p class="text-secondary mb-0">برای مشاهده جزئیات، یک نامه را انتخاب کنید.</p>';
    }
    catch (error) { if (currentRequest === searchRequest) notice(error.message, true); }
    finally { if (currentRequest === searchRequest) button.disabled = false; }
  });
  $('#letters').addEventListener('click', event => {
    const key = event.target.closest('[data-key]')?.dataset.key;
    if (key) showLetter(key).catch(error => notice(error.message, true));
  });
  $('#detail').addEventListener('click', event => {
    const button = event.target.closest('[data-download]');
    if (button) download($('#detail').dataset.key, button.dataset.download, button.dataset.name).catch(error => notice(error.message, true));
  });
  if (!localStorage.getItem('accessToken')) { notice('برای استفاده از دبیرخانه وارد حساب کاربری شوید.', true); return; }
  api('/access').then(access => {
    if (access.admin) $('#adminLink').classList.remove('d-none');
  }).catch(error => notice(error.message, true));
})();

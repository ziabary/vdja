(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const authReady = setupAuth('/', true, 'secretariat-admin');
  const notice = (message, error = false) => {
    $('#notice').className = `alert alert-${error ? 'danger' : 'success'}`;
    $('#notice').textContent = message;
  };
  async function api(url, options = {}) {
    const response = await (await authReady).apiFetch('/api/secretariat' + url, options);
    if (!response) throw new Error('نشست منقضی شده است');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || result.error || 'درخواست انجام نشد');
    return result;
  }
  async function loadSources() {
    const { sources } = await api('/sources');
    $('#sources').innerHTML = sources.length ? sources.map(source => {
      const config = source.srcConfig ? JSON.parse(source.srcConfig) : null;
      return `<div class="border rounded p-3">
        <div class="d-flex justify-content-between"><strong>${esc(source.srcName)}</strong><span class="badge ${source.srcEnabled ? 'text-bg-success' : 'text-bg-secondary'}">${source.srcEnabled ? 'فعال' : 'غیرفعال'}</span></div>
        <div class="small text-secondary text-break mt-1" dir="ltr">${esc(source.srcUrl || (config ? `${source.srcKind}://${config.host}:${config.port}/${config.database}/${config.table}` : ''))}</div>
        <div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-outline-primary" data-sync="${source.srcID}" ${source.srcEnabled ? '' : 'disabled'}>همگام‌سازی</button>
        <button class="btn btn-sm btn-outline-secondary" data-toggle="${source.srcID}" data-enabled="${source.srcEnabled ? 'false' : 'true'}">${source.srcEnabled ? 'غیرفعال کردن' : 'فعال کردن'}</button></div>
      </div>`;
    }).join('') : '<p class="text-secondary">هنوز منبعی ثبت نشده است.</p>';
  }
  const LETTERS_PER_PAGE = 10;
  let lettersPage = 1;
  let lettersTotalPages = 1;
  async function loadAdminLetters(page = lettersPage) {
    const previous = $('#lettersPrevious');
    const next = $('#lettersNext');
    previous.disabled = true;
    next.disabled = true;
    $('#wizardLetters').setAttribute('aria-busy', 'true');
    try {
      const { total, letters } = await api(`/admin/letters?limit=${LETTERS_PER_PAGE}&offset=${(page - 1) * LETTERS_PER_PAGE}`);
      const totalPages = Math.max(1, Math.ceil(total / LETTERS_PER_PAGE));
      if (page > totalPages) { await loadAdminLetters(totalPages); return; }
      const rows = letters.map(letter => `<tr>
        <td><strong>${esc(letter.ltrNumber || 'بدون شماره')}</strong><div class="small mt-1">${esc(letter.ltrSubject)}</div>
        <div class="small text-secondary mt-1">${esc(letter.ltrLetterDate || '')}${letter.ltrSender ? ` · ${esc(letter.ltrSender)}` : ''}${letter.ltrRecipient ? ` ← ${esc(letter.ltrRecipient)}` : ''}</div></td>
        <td>${letter.attachments.length ? letter.attachments.map(file => file.key
          ? `<button class="btn btn-sm btn-link p-0 text-decoration-none" type="button" data-letter="${esc(letter.ltrKey)}" data-file="${esc(file.key)}" data-name="${esc(file.name)}">${esc(file.name)} <i class="fa-solid fa-download" aria-hidden="true"></i></button>`
          : `<span>${esc(file.name)}</span>`).join('<br>') : '<span class="text-secondary">بدون پیوست</span>'}</td>
        <td><span class="badge ${letter.ltrConfidential ? 'text-bg-danger' : 'text-bg-success'}">${letter.ltrConfidential ? 'محرمانه' : 'عادی'}</span>${letter.ltrStatus === 'deleting' ? '<div class="small text-danger mt-1">حذف ناتمام؛ دوباره تلاش کنید</div>' : ''}</td>
        <td><div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-outline-secondary" type="button" data-confidentiality="${esc(letter.ltrKey)}" data-confidential="${letter.ltrConfidential ? 'false' : 'true'}" ${letter.ltrStatus !== 'ready' ? 'disabled' : ''}>${letter.ltrConfidential ? 'خروج از محرمانگی' : 'محرمانه کردن'}</button><button class="btn btn-sm btn-outline-danger" type="button" data-delete="${esc(letter.ltrKey)}" data-number="${esc(letter.ltrNumber || letter.ltrSubject)}">حذف</button></div></td>
      </tr>`).join('');
      $('#wizardLetters').innerHTML = rows || '<tr><td colspan="4" class="text-secondary">هنوز نامه‌ای ثبت نشده است.</td></tr>';
      lettersPage = page;
      lettersTotalPages = totalPages;
      $('#wizardCount').textContent = total;
      $('#lettersPage').textContent = `صفحهٔ ${lettersPage} از ${lettersTotalPages}`;
    } finally {
      previous.disabled = lettersPage <= 1;
      next.disabled = lettersPage >= lettersTotalPages;
      $('#wizardLetters').setAttribute('aria-busy', 'false');
    }
  }
  async function downloadWizardFile(letterKey, fileKey, name) {
    const response = await (await authReady).apiFetch(`/api/secretariat/letters/${encodeURIComponent(letterKey)}/files/${encodeURIComponent(fileKey)}`);
    if (!response || !response.ok) throw new Error('دریافت پیوست انجام نشد');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#wizardLetters').addEventListener('click', async event => {
    const file = event.target.closest('[data-file]');
    if (file) downloadWizardFile(file.dataset.letter, file.dataset.file, file.dataset.name)
      .catch(error => notice(error.message, true));
    const confidentiality = event.target.closest('[data-confidentiality]');
    if (confidentiality) {
      const buttons = [...confidentiality.closest('tr').querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const confidential = confidentiality.dataset.confidential === 'true';
        await api(`/letters/${encodeURIComponent(confidentiality.dataset.confidentiality)}/confidentiality`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confidential }),
        });
        notice(confidential ? 'نامه محرمانه شد.' : 'نامه از محرمانگی خارج شد.');
        await loadAdminLetters();
      } catch (error) { notice(error.message, true); }
      finally { buttons.forEach(button => { button.disabled = false; }); }
      return;
    }
    const remove = event.target.closest('[data-delete]');
    if (!remove || !confirm(`نامهٔ «${remove.dataset.number}» همراه با تمام فایل‌ها و پیوست‌های آن حذف شود؟`)) return;
    remove.disabled = true;
    try {
      await api(`/letters/${encodeURIComponent(remove.dataset.delete)}`, { method: 'DELETE' });
      notice('نامه و فایل‌های مرتبط حذف شدند.');
      await loadAdminLetters();
    } catch (error) {
      notice(error.message, true);
      remove.disabled = false;
      loadAdminLetters().catch(() => {});
    }
  });
  $('#lettersPrevious').addEventListener('click', () => loadAdminLetters(lettersPage - 1).catch(error => notice(error.message, true)));
  $('#lettersNext').addEventListener('click', () => loadAdminLetters(lettersPage + 1).catch(error => notice(error.message, true)));
  $('#letterForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter; button.disabled = true;
    try {
      const confidential = event.target.elements.confidential.checked;
      await api('/letters', { method: 'POST', body: new FormData(event.target) });
      event.target.reset(); notice(confidential ? 'نامهٔ محرمانه ثبت و نمایه‌سازی شد.' : 'نامه ثبت و نمایه‌سازی شد.');
      if (!$('#wizardPanel').classList.contains('d-none')) await loadAdminLetters(1);
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#sourceForm [name=kind]').addEventListener('change', event => {
    const rest = event.target.value === 'rest';
    $('#restConfig').classList.toggle('d-none', !rest);
    $('#dbConfig').classList.toggle('d-none', rest);
    $('#restConfig [name=url]').required = rest;
  });
  $('#sourceForm').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    values.enabled = $('#sourceForm [name=enabled]').checked;
    if (values.kind !== 'rest') {
      values.config = Object.fromEntries([...$('#dbConfig').querySelectorAll('input')].map(input => [input.name, input.value]));
      delete values.url; delete values.tokenEnv;
    }
    try {
      await api('/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      event.target.reset(); notice('منبع افزوده شد.'); await loadSources();
    } catch (error) { notice(error.message, true); }
  });
  $('#sources').addEventListener('click', async event => {
    const sync = event.target.closest('[data-sync]');
    const toggle = event.target.closest('[data-toggle]');
    try {
      if (sync) { const result = await api(`/sources/${sync.dataset.sync}/sync`, { method: 'POST' }); notice(`${result.imported} نامه وارد شد و ${result.skipped} نامه تکراری بود.`); }
      if (toggle) { await api(`/sources/${toggle.dataset.toggle}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: toggle.dataset.enabled === 'true' }) }); notice('وضعیت منبع تغییر کرد.'); }
      if (sync || toggle) await loadSources();
      if (sync) await loadAdminLetters(1);
    } catch (error) { notice(error.message, true); }
  });
  $('#wizardForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter; button.disabled = true;
    try {
      const result = await api('/wizard?uploadWizard=true', { method: 'POST', body: new FormData(event.target) });
      $('#wizardResults').innerHTML = `<div class="alert alert-success">${result.created.length} نامه ساخته شد؛ ${result.skipped.length} فایل تکراری بود؛ ${result.errors.length} فایل خطا داشت.</div>
        ${result.errors.map(item => `<div class="text-danger mb-2">${esc(item.fileName)}: ${esc(item.message)}</div>`).join('')}`;
      await loadAdminLetters(1);
      bootstrap.Tab.getOrCreateInstance($('#wizardListTab')).show();
      if (!result.errors.length) event.target.reset();
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; }
  });
  if (!localStorage.getItem('accessToken')) { notice('برای ورود به بک‌آفیس ابتدا وارد حساب شوید.', true); return; }
  api('/access').then(access => {
    if (!access.operator) { notice('دسترسی به بک‌آفیس دبیرخانه ندارید.', true); return; }
    $('#adminContent').classList.remove('d-none');
    $('#roleBadge').textContent = access.admin ? 'مدیر' : 'اپراتور';
    $('#sourcesPanel').classList.toggle('d-none', !access.admin);
    $('#uploadPanel').classList.toggle('col-lg-6', access.admin);
    if (access.admin) loadSources().catch(error => notice(error.message, true));
    if (access.admin) {
      $('#wizardPanel').classList.remove('d-none');
      loadAdminLetters(1).catch(error => notice(error.message, true));
      if (new URLSearchParams(location.search).get('uploadWizard') === 'true')
        $('#wizardUploadNav').classList.remove('d-none');
    }
  }).catch(error => notice(error.message, true));
})();

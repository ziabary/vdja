(function () {
  'use strict';
  const { $, esc, notice, api } = window.WriterUI;
  let templates = [];
  let busy = false;
  let generatedSubject = '';
  const leaveMessage = 'با خروج از صفحه نامه‌نویس، متن نامه حذف خواهد شد و قابل بازیابی نیست. پیش از خروج، متن را کپی یا دانلود کنید. آیا از خروج مطمئن هستید؟';
  let navigationConfirmed = false;
  let leaveDialogOpen = false;
  let replayingLink = null;
  const hasLetter = () => Boolean($('#letterBody').value.trim());
  function warnBeforeUnload(event) {
    if (!hasLetter() || navigationConfirmed) return;
    event.preventDefault();
    // Browsers display their own message for refresh, tab close and history navigation.
    event.returnValue = '';
  }
  function updateLeaveGuard() {
    navigationConfirmed = false;
    window.removeEventListener('beforeunload', warnBeforeUnload);
    if (hasLetter()) window.addEventListener('beforeunload', warnBeforeUnload);
  }
  window.addEventListener('pageshow', updateLeaveGuard);
  window.addEventListener('pagehide', () => {
    // Clear the draft before a browser history cache can retain this page.
    $('#letterBody').value = '';
    $('#letterPreview').replaceChildren();
    $('#printLetter').replaceChildren();
    $('#subjectSuggestion').textContent = '';
    $('#resultMeta').textContent = '';
    generatedSubject = '';
    $('#resultContent').classList.add('d-none');
    $('#emptyResult').classList.remove('d-none');
    updateLeaveGuard();
  });
  document.addEventListener('click', async event => {
    const link = event.target.closest?.('a[href]');
    if (link && link === replayingLink) return;
    navigationConfirmed = false;
    if (!hasLetter() || !link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
    const destination = new URL(link.href, location.href);
    if (!['http:', 'https:'].includes(destination.protocol)) return;
    if (link.getAttribute('href').startsWith('#') || (destination.hash && destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (leaveDialogOpen) return;
    leaveDialogOpen = true;
    try {
      const { confirmed } = await confirmDialog({
        title: 'هشدار حذف نامه', message: leaveMessage,
        confirmText: 'خروج و حذف نامه', cancelText: 'ماندن در صفحه', confirmClass: 'btn-danger',
      });
      if (!confirmed) return;
      navigationConfirmed = true;
      replayingLink = link;
      try { link.click(); } finally { replayingLink = null; }
    } finally { leaveDialogOpen = false; }
  }, true);
  function renderLetter() {
    const source = $('#letterBody').value;
    if (typeof window.marked?.parse !== 'function') {
      $('#letterPreview').innerHTML = esc(source).replace(/\n/g, '<br>');
      return;
    }
    // Parse in an inert fragment, then allow only letter formatting and safe links.
    const template = document.createElement('template');
    template.innerHTML = window.marked.parse(source, { gfm: true, breaks: true });
    template.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,math,img').forEach(node => node.remove());
    const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'DEL', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
    template.content.querySelectorAll('*').forEach(node => {
      if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml') { node.remove(); return; }
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      Array.from(node.attributes).forEach(attribute => {
        if (!(node.tagName === 'A' && ['href', 'title'].includes(attribute.name.toLowerCase()))) node.removeAttribute(attribute.name);
      });
      if (node.tagName === 'A') {
        const href = (node.getAttribute('href') || '').trim();
        if (!/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(href)) node.removeAttribute('href');
        if (node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer nofollow');
        }
      }
    });
    $('#letterPreview').innerHTML = template.innerHTML;
  }
  function showEditor(editing) {
    if (!editing) renderLetter();
    $('#letterPreview').classList.toggle('d-none', editing);
    $('#letterEditor').classList.toggle('d-none', !editing);
    [['#previewButton', !editing], ['#editButton', editing]].forEach(([selector, active]) => {
      const button = $(selector);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('btn-outline-primary', !active);
    });
    if (editing) $('#letterBody').focus();
  }
  $('#previewButton').addEventListener('click', () => showEditor(false));
  $('#editButton').addEventListener('click', () => showEditor(true));
  $('#letterBody').addEventListener('input', renderLetter);
  $('#letterBody').addEventListener('input', updateLeaveGuard);
  function clearDetailsError() {
    $('#details').classList.remove('is-invalid');
    $('#details').removeAttribute('aria-invalid');
  }
  $('#details').addEventListener('input', clearDetailsError);
  function updateTemplate() {
    const template = templates.find(item => item.key === $('#templateKey').value);
    $('#templateHelp').textContent = template?.description || 'ساختار نامه بر اساس موضوع شما انتخاب می‌شود.';
    $('#styleKey').options[0].textContent = template ? 'سبک پیش‌فرض قالب' : 'سبک پایه مدیر';
    $('#styleKey').value = '';
  }
  function setBusy(value) {
    busy = value;
    $('#letterFields').disabled = value;
    $('.writer-result').setAttribute('aria-busy', String(value));
    $('#generating').classList.toggle('d-none', !value);
    $('#generateButton').textContent = value ? 'در حال نگارش…' : 'نوشتن نامه';
    $('#regenerateButton').disabled = value;
    $('#letterBody').disabled = value;
    $('.writer-actions').querySelectorAll('button').forEach(button => { button.disabled = value; });
    $('.writer-view-controls').querySelectorAll('button').forEach(button => { button.disabled = value; });
  }
  $('#templateKey').addEventListener('change', updateTemplate);
  $('#letterForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.target));
    clearDetailsError();
    setBusy(true);
    $('#emptyResult').classList.add('d-none');
    $('#notice').classList.add('d-none');
    try {
      const result = await api('/generate', 'POST', body);
      $('#letterBody').value = result.body;
      updateLeaveGuard();
      showEditor(false);
      generatedSubject = result.subject || body.subject;
      $('#subjectSuggestion').textContent = !body.subject.trim() && result.subject ? `موضوع پیشنهادی: ${result.subject}` : '';
      $('#resultMeta').textContent = `${result.templateName} · ${result.styleName}`;
      $('#resultContent').classList.remove('d-none');
      notice('نامه آماده شد؛ می‌توانید متن را ویرایش کنید.');
    } catch (error) {
      notice(error.message, true);
      if (error.missingInformation?.length) {
        $('#details').classList.add('is-invalid');
        $('#details').setAttribute('aria-invalid', 'true');
        $('#notice').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      if (!$('#letterBody').value) $('#emptyResult').classList.remove('d-none');
    } finally {
      setBusy(false);
      if ($('#details').getAttribute('aria-invalid') === 'true') $('#details').focus({ preventScroll: true });
    }
  });
  $('#regenerateButton').addEventListener('click', async () => {
    const { confirmed } = await confirmDialog({ title: 'نگارش دوباره', message: 'متن فعلی با نامه جدید جایگزین می‌شود. ادامه می‌دهید؟', confirmText: 'نگارش دوباره' });
    if (confirmed) $('#letterForm').requestSubmit();
  });
  $('#copyButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#letterBody').value);
      notice('متن نامه کپی شد.');
    } catch {
      showEditor(true);
      $('#letterBody').focus(); $('#letterBody').select();
      notice('متن انتخاب شد؛ با کلیدهای کپی آن را کپی کنید.');
    }
  });
  $('#downloadButton').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + $('#letterBody').value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (generatedSubject || 'نامه').replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) + '.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#printButton').addEventListener('click', () => {
    renderLetter();
    $('#printLetter').innerHTML = $('#letterPreview').innerHTML;
    window.print();
  });
  Promise.all([api('/catalog'), api('/access')]).then(([catalog, access]) => {
    templates = catalog.templates;
    $('#templateKey').innerHTML = '<option value="">فرمت آزاد</option>' + templates.map(item => `<option value="${esc(item.key)}">${esc(item.name)}</option>`).join('');
    $('#styleKey').innerHTML = '<option value="">سبک پایه مدیر</option>' + catalog.styles.map(item => `<option value="${esc(item.key)}">${esc(item.name)}</option>`).join('');
    $('#adminLink').classList.toggle('d-none', !access.admin);
    $('#letterFields').disabled = false;
  }).catch(error => notice(error.message, true));
})();

(function () {
  'use strict';
  const { $, esc, notice, api } = window.WriterUI;
  let catalog = { styles: [], templates: [] };
  let saving = false;
  function resetEditor(kind) {
    const form = $(`#${kind}Form`);
    form.reset();
    delete form.dataset.key;
    $(`#${kind}FormTitle`).textContent = kind === 'style' ? 'افزودن سبک' : 'افزودن قالب';
    $(`#cancel${kind === 'style' ? 'Style' : 'Template'}`).classList.add('d-none');
  }
  function render() {
    const selectedStyle = $('#templateStyle').value;
    $('#templateStyle').innerHTML = '<option value="">سبک پایه مدیر</option>' + catalog.styles.map(style =>
      `<option value="${esc(style.key)}">${esc(style.name)}${style.enabled ? '' : ' (غیرفعال)'}</option>`).join('');
    $('#templateStyle').value = catalog.styles.some(style => style.key === selectedStyle) ? selectedStyle : '';
    $('#stylesList').innerHTML = catalog.styles.map(style => `<article class="writer-item">
      <div class="d-flex justify-content-between gap-2"><h3 class="h6">${esc(style.name)}</h3><span class="badge ${style.enabled ? 'text-bg-success' : 'text-bg-secondary'}">${style.enabled ? 'فعال' : 'غیرفعال'}</span></div>
      <p class="small text-secondary mt-2">${esc(style.instructions)}</p>
      <div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" type="button" data-edit="${esc(style.key)}">ویرایش</button><button class="btn btn-sm btn-outline-danger" type="button" data-delete="${esc(style.key)}">حذف</button></div>
    </article>`).join('') || '<p class="text-secondary">سبکی ثبت نشده است؛ قواعد پایه مدیر همچنان اعمال می‌شود.</p>';
    $('#templatesList').innerHTML = catalog.templates.map(template => `<article class="writer-item">
      <div class="d-flex justify-content-between gap-2"><h3 class="h6">${esc(template.name)}</h3><span class="badge ${template.enabled ? 'text-bg-success' : 'text-bg-secondary'}">${template.enabled ? 'فعال' : 'غیرفعال'}</span></div>
      <p class="small text-secondary mt-2">${esc(template.description)}</p>
      <div class="small mb-3">سبک: ${esc(catalog.styles.find(style => style.key === template.styleKey)?.name || 'سبک پایه مدیر')}</div>
      <div class="small text-secondary mb-3">${template.requiresFirstPerson ? 'الزام صریح به اول‌شخص' : 'نگارش مجهول و غیرشخصی'}</div>
      <details class="mb-3"><summary class="small">مشاهده ساختار و دستورها</summary><p class="small mt-2">${esc(template.structure)}</p><p class="small text-secondary">${esc(template.instructions)}</p></details>
      <div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" type="button" data-edit="${esc(template.key)}">ویرایش</button><button class="btn btn-sm btn-outline-danger" type="button" data-delete="${esc(template.key)}">حذف</button></div>
    </article>`).join('') || '<p class="text-secondary">هنوز قالبی ثبت نشده است. کاربران می‌توانند از فرمت آزاد استفاده کنند.</p>';
  }
  async function refresh() {
    catalog = await api('/admin/catalog');
    render();
  }
  function edit(kind, key) {
    if (saving) return;
    const item = catalog[kind === 'style' ? 'styles' : 'templates'].find(row => row.key === key);
    if (!item) return;
    const form = $(`#${kind}Form`);
    form.reset();
    form.dataset.key = key;
    for (const [name, value] of Object.entries(item)) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value ?? '';
    }
    $(`#${kind}FormTitle`).textContent = `ویرایش ${kind === 'style' ? 'سبک' : 'قالب'}: ${item.name}`;
    $(`#cancel${kind === 'style' ? 'Style' : 'Template'}`).classList.remove('d-none');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.name.focus({ preventScroll: true });
  }
  async function remove(kind, key) {
    if (saving) return;
    const collection = kind === 'style' ? 'styles' : 'templates';
    const item = catalog[collection].find(row => row.key === key);
    if (!item) return;
    const { confirmed } = await confirmDialog({ title: 'حذف ' + (kind === 'style' ? 'سبک' : 'قالب'), message: `«${esc(item.name)}» حذف شود؟`, confirmText: 'حذف', confirmClass: 'btn-danger' });
    if (!confirmed || saving) return;
    saving = true;
    try {
      await api(`/admin/${collection}/${encodeURIComponent(key)}`, 'DELETE');
      if ($(`#${kind}Form`).dataset.key === key) resetEditor(kind);
      await refresh();
      notice('حذف انجام شد.');
    } catch (error) { notice(error.message, true); }
    finally { saving = false; }
  }
  for (const kind of ['style', 'template']) {
    const form = $(`#${kind}Form`);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving) return;
      const body = Object.fromEntries(new FormData(form));
      body.enabled = form.elements.enabled.checked;
      if (kind === 'template') body.requiresFirstPerson = form.elements.requiresFirstPerson.checked;
      const key = form.dataset.key;
      const buttons = form.querySelectorAll('button');
      buttons.forEach(button => { button.disabled = true; });
      saving = true;
      try {
        await api(`/admin/${kind === 'style' ? 'styles' : 'templates'}${key ? '/' + encodeURIComponent(key) : ''}`, key ? 'PUT' : 'POST', body);
        resetEditor(kind);
        await refresh();
        notice(kind === 'style' ? 'سبک ذخیره شد.' : 'قالب ذخیره شد.');
      } catch (error) { notice(error.message, true); }
      finally { buttons.forEach(button => { button.disabled = false; }); saving = false; }
    });
    $(`#cancel${kind === 'style' ? 'Style' : 'Template'}`).addEventListener('click', () => resetEditor(kind));
    $(`#${kind === 'style' ? 'styles' : 'templates'}List`).addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.dataset.edit) edit(kind, button.dataset.edit);
      if (button?.dataset.delete) remove(kind, button.dataset.delete);
    });
  }
  $('#settingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const button = event.target.querySelector('button');
    button.disabled = true; saving = true;
    try {
      await api('/admin/settings', 'PUT', { instructions: $('#policy').value });
      notice('قواعد پایه ذخیره شد و در همه نامه‌های بعدی اعمال می‌شود.');
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; saving = false; }
  });
  refresh().then(() => {
    $('#policy').value = catalog.settings?.instructions || '';
    $('#adminContent').classList.remove('d-none');
  }).catch(error => notice(error.message, true));
})();

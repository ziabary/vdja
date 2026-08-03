(function () {
  "use strict";

  const api = window.createCrmApi();
  const stageMeta = {
    lead: { label: "سرنخ جدید", probability: 25 },
    qualification: { label: "ارزیابی اولیه", probability: 35 },
    demo: { label: "دمو و بررسی فنی", probability: 50 },
    proposal: { label: "پیشنهاد ارسال‌شده", probability: 60 },
    negotiation: { label: "مذاکره", probability: 72 },
    decision: { label: "تصمیم‌گیری", probability: 85 },
    won: { label: "نهایی‌شده", probability: 100 },
    lost: { label: "ازدست‌رفته", probability: 0 }
  };
  const activeStages = ["lead", "qualification", "demo", "proposal", "negotiation", "decision"];
  const allStages = [...activeStages, "won", "lost"];
  const channelMeta = {
    email: { label: "ایمیل", icon: "fa-envelope" },
    call: { label: "تماس", icon: "fa-phone" },
    whatsapp: { label: "پیام", icon: "fa-message" },
    meeting: { label: "جلسه", icon: "fa-users" },
    ticket: { label: "تیکت", icon: "fa-ticket" },
    proposal: { label: "پیشنهاد", icon: "fa-file-signature" },
    note: { label: "یادداشت", icon: "fa-note-sticky" },
    customer: { label: "مشتری", icon: "fa-building" },
    opportunity: { label: "فرصت", icon: "fa-handshake" },
    contact: { label: "فرد تماس", icon: "fa-address-card" },
    task: { label: "وظیفه", icon: "fa-list-check" },
    reply: { label: "پاسخ", icon: "fa-reply" }
  };
  const roleLabels = {
    owner: "مالک CRM",
    manager: "مدیر فروش",
    sales: "کارشناس فروش",
    support: "کارشناس خدمات مشتریان",
    viewer: "مشاهده‌گر"
  };
  const state = {
    role: "viewer",
    bootstrap: null,
    currentRoute: { view: "dashboard", id: null },
    customerFilters: { query: "", health: "", tier: "" },
    productFilter: "all",
    opportunityFilter: "all",
    assistantContext: {},
    searchTimer: null,
    draggedOpportunityId: null
  };

  const dom = {
    view: document.getElementById("crmView"),
    main: document.getElementById("crmMain"),
    sidebar: document.getElementById("crmSidebar"),
    mobileBackdrop: document.getElementById("crmMobileBackdrop"),
    btnMenu: document.getElementById("btnCrmMenu"),
    currentUser: document.getElementById("crmCurrentUser"),
    currentRole: document.getElementById("crmCurrentRole"),
    avatar: document.querySelector(".crm-sidebar-profile .crm-avatar"),
    workspaceName: document.getElementById("crmWorkspaceName"),
    teamNav: document.getElementById("crmTeamNav"),
    globalSearch: document.getElementById("crmGlobalSearch"),
    searchResults: document.getElementById("crmSearchResults"),
    assistant: document.getElementById("crmAssistantDrawer"),
    assistantBackdrop: document.getElementById("crmAssistantBackdrop"),
    assistantContext: document.getElementById("crmAssistantContext"),
    assistantMessages: document.getElementById("crmAssistantMessages"),
    assistantInput: document.getElementById("crmAssistantInput"),
    assistantForm: document.getElementById("crmAssistantForm"),
    modalBackdrop: document.getElementById("crmModalBackdrop"),
    modalTitle: document.getElementById("crmModalTitle"),
    modalBody: document.getElementById("crmModalBody"),
    navTaskBadge: document.getElementById("navTaskBadge"),
    navOpportunityBadge: document.getElementById("navOpportunityBadge"),
    navConversationBadge: document.getElementById("navConversationBadge")
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const faNumber = (value, options) => Number(value || 0).toLocaleString("fa-IR", options);
  const array = value => Array.isArray(value) ? value : [];
  const canWrite = () => Boolean(state.bootstrap?.permissions?.canWrite);
  const canManage = () => Boolean(state.bootstrap?.permissions?.canManage);
  const canManageTeam = () => Boolean(state.bootstrap?.permissions?.canManageTeam);

  function formatMoney(value, compact = true) {
    const number = Number(value || 0);
    const currency = state.bootstrap?.workspace?.currency || "تومان";
    if (!compact) return `${faNumber(number)} ${escapeHtml(currency)}`;
    if (number >= 1000000000) return `${faNumber(Math.round(number / 100000000) / 10, { maximumFractionDigits: 1 })} میلیارد ${currency}`;
    if (number >= 1000000) return `${faNumber(Math.round(number / 100000) / 10, { maximumFractionDigits: 1 })} میلیون ${currency}`;
    return `${faNumber(number)} ${currency}`;
  }

  function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const options = { calendar: "persian", year: "numeric", month: "short", day: "numeric" };
    if (withTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleString("fa-IR", options);
  }

  function formatShortDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("fa-IR", { calendar: "persian", month: "short", day: "numeric" });
  }

  function toDateInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function toDateTimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function initials(name = "") {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("") || "؟";
  }

  function healthClass(value) {
    if (Number(value) < 65) return "danger";
    if (Number(value) < 80) return "warning";
    return "";
  }

  function productTypeLabel(type) {
    if (type === "hardware") return "سخت‌افزار";
    if (type === "service") return "خدمت";
    return "نرم‌افزار";
  }

  function productBadge(type) {
    if (type === "hardware") return "text-bg-info";
    if (type === "service") return "text-bg-success";
    return "text-bg-primary";
  }

  function safeIcon(value, fallback = "fa-box") {
    const icon = String(value || "").toLowerCase();
    return /^fa-[a-z0-9-]+$/.test(icon) ? icon : fallback;
  }

  function priorityLabel(priority) {
    return ({ high: "بالا", medium: "متوسط", low: "کم" })[priority] || priority || "متوسط";
  }

  function notify(message, type = "success") {
    if (typeof window.toast === "function") window.toast(message, type);
    else console.log(`[${type}] ${message}`);
  }

  function showLoading(show = true) {
    document.getElementById("loading")?.classList.toggle("hidden", !show);
  }

  async function withLoading(work, options = {}) {
    if (options.global !== false) showLoading(true);
    try {
      return await work();
    } catch (error) {
      console.error(error);
      if (!options.silent) notify(error?.message || "خطا در اجرای عملیات", "danger");
      throw error;
    } finally {
      if (options.global !== false) showLoading(false);
    }
  }

  function routeTo(route) {
    const normalized = String(route || "dashboard").replace(/^#/, "");
    if (location.hash === `#${normalized}`) renderRoute();
    else location.hash = normalized;
  }

  function parseRoute() {
    const route = location.hash.replace(/^#/, "") || "dashboard";
    const [view, id] = route.split("/");
    return { view, id: id || null };
  }

  function activateNavigation(view) {
    const navView = view === "customer" ? "customers" : view;
    document.querySelectorAll(".crm-nav-item").forEach(item => item.classList.toggle("active", item.dataset.route === navView));
  }

  function closeMobileMenu() {
    dom.sidebar.classList.remove("open");
    dom.mobileBackdrop.classList.remove("open");
  }

  function openAssistant(context = {}) {
    state.assistantContext = context;
    dom.assistant.classList.add("open");
    dom.assistantBackdrop.classList.add("open");
    dom.assistant.setAttribute("aria-hidden", "false");
    const label = context.customerName ? `مشتری: ${context.customerName}` : context.conversationSubject ? `مکالمه: ${context.conversationSubject}` : "کل سامانه";
    dom.assistantContext.innerHTML = `<i class="fa-solid fa-database"></i> زمینه: ${escapeHtml(label)}`;
    setTimeout(() => dom.assistantInput.focus(), 150);
  }

  function closeAssistant() {
    dom.assistant.classList.remove("open");
    dom.assistantBackdrop.classList.remove("open");
    dom.assistant.setAttribute("aria-hidden", "true");
  }

  function openModal(title, html, onOpen) {
    dom.modalTitle.textContent = title;
    dom.modalBody.innerHTML = html;
    dom.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (onOpen) requestAnimationFrame(() => onOpen(dom.modalBody));
  }

  function closeModal() {
    dom.modalBackdrop.classList.add("hidden");
    dom.modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  async function confirmAction(message, title = "تأیید عملیات") {
    if (typeof window.confirmDialog === "function") {
      const result = await window.confirmDialog({ title, message, confirmText: "تأیید", confirmClass: "btn-danger" });
      return Boolean(result?.confirmed);
    }
    return window.confirm(message);
  }

  function pageHeader(title, subtitle, actions = "") {
    return `<header class="crm-page-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="crm-header-actions">${actions}</div></header>`;
  }

  function kpiCard(label, value, note, icon, modifier = "", noteClass = "") {
    return `<article class="crm-kpi"><div><div class="crm-kpi-label">${label}</div><div class="crm-kpi-value fa-num">${value}</div><div class="crm-kpi-note ${noteClass}">${note}</div></div><div class="crm-kpi-icon ${modifier}"><i class="fa-solid ${icon}"></i></div></article>`;
  }

  function channelIcon(channel) {
    return channelMeta[channel] || { label: "تعامل", icon: "fa-message" };
  }

  function empty(icon, text, compact = false) {
    return `<div class="crm-empty ${compact ? "crm-empty-compact" : ""}"><i class="fa-solid ${icon}"></i>${escapeHtml(text)}</div>`;
  }

  function userOptions(selected = "", includeEmpty = false) {
    const users = array(state.bootstrap?.users);
    return `${includeEmpty ? '<option value="">بدون مسئول</option>' : ""}${users.map(user => `<option value="${escapeHtml(user.id)}" ${String(user.id) === String(selected) ? "selected" : ""}>${escapeHtml(user.name)} — ${escapeHtml(user.role || roleLabels[user.roleKey] || "عضو CRM")}</option>`).join("")}`;
  }

  function customerOptions(customers, selected = "", includeEmpty = false) {
    return `${includeEmpty ? '<option value="">بدون مشتری</option>' : '<option value="">انتخاب مشتری</option>'}${array(customers).map(customer => `<option value="${customer.id}" ${customer.id === selected ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}`;
  }

  function productOptions(products, selected = "", includeEmpty = true) {
    return `${includeEmpty ? '<option value="">بدون محصول مشخص</option>' : '<option value="">انتخاب محصول</option>'}${array(products).map(product => `<option value="${product.id}" ${product.id === selected ? "selected" : ""}>${escapeHtml(product.shortName)} — ${productTypeLabel(product.type)}</option>`).join("")}`;
  }

  function readForm(form) {
    const output = {};
    new FormData(form).forEach((value, key) => { output[key] = typeof value === "string" ? value.trim() : value; });
    form.querySelectorAll('input[type="checkbox"][name]').forEach(input => { output[input.name] = input.checked; });
    return output;
  }

  function updateRoleUi() {
    const user = state.bootstrap?.currentUser || {};
    state.role = state.bootstrap?.currentRole || user.roleKey || "viewer";
    dom.currentUser.textContent = user.name || user.username || "کاربر سامانه";
    dom.currentRole.textContent = user.role || roleLabels[state.role] || "عضو CRM";
    dom.workspaceName.textContent = state.bootstrap?.workspace?.name || "فضای عملیاتی CRM";
    if (user.avatar) dom.avatar.innerHTML = `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name || "کاربر")}">`;
    else dom.avatar.innerHTML = `<span>${escapeHtml(initials(user.name || user.username || "کاربر"))}</span>`;
    dom.teamNav?.classList.toggle("hidden", !state.bootstrap?.workspace);
  }

  function updateBadges(kpis = {}) {
    const set = (el, value) => {
      if (!el) return;
      const number = Number(value || 0);
      el.textContent = faNumber(number);
      el.classList.toggle("hidden", number < 1);
    };
    set(dom.navTaskBadge, kpis.taskCount);
    set(dom.navOpportunityBadge, kpis.activeCount);
    set(dom.navConversationBadge, kpis.unreadCount);
  }

  async function refreshBadges() {
    try { updateBadges((await api.getDashboard()).kpis); } catch (error) { console.warn("CRM badge refresh failed", error); }
  }

  async function loadBootstrapData() {
    const bootstrap = await api.getBootstrap();
    bootstrap.customers = await api.listCustomers();
    state.bootstrap = bootstrap;
    updateRoleUi();
  }

  async function reloadBootstrap() {
    await loadBootstrapData();
    await refreshBadges();
  }

  /* ---------------------------------------------------------------------- */
  /* Dashboard                                                              */
  /* ---------------------------------------------------------------------- */

  async function renderDashboard() {
    const data = await withLoading(() => api.getDashboard());
    updateBadges(data.kpis);
    state.assistantContext = {};
    const taskRows = array(data.tasks).map(task => `
      <div class="crm-task-item ${task.done ? "done" : ""}">
        <button class="crm-task-check" data-action="toggle-task" data-id="${task.id}" title="تغییر وضعیت"><i class="fa-solid fa-check"></i></button>
        <div class="crm-task-info"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.customer?.name || "بدون مشتری")} · ${formatDate(task.dueAt, true)} · ${escapeHtml(priorityLabel(task.priority))}</small></div>
        <div class="d-flex gap-1">${task.customerId ? `<button class="btn btn-sm btn-outline-secondary" data-action="open-customer" data-id="${task.customerId}" title="پرونده مشتری"><i class="fa-solid fa-building"></i></button>` : ""}${canWrite() ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-task" data-id="${task.id}" title="ویرایش"><i class="fa-solid fa-pen"></i></button>` : ""}</div>
      </div>`).join("");

    const opportunityRows = array(data.opportunities).map(item => `
      <tr data-action="open-opportunity" data-id="${item.id}">
        <td><div class="crm-customer-cell"><span class="crm-customer-logo">${escapeHtml(item.customer?.short || "؟")}</span><span><strong>${escapeHtml(item.customer?.name || "مشتری حذف‌شده")}</strong><small>${escapeHtml(item.title)}</small></span></div></td>
        <td>${item.product ? `<span class="badge ${productBadge(item.product.type)}">${productTypeLabel(item.product.type)}</span> ${escapeHtml(item.product.shortName)}` : "—"}</td>
        <td>${escapeHtml(stageMeta[item.stage]?.label || item.stage)}</td><td class="fa-num fw-bold">${formatMoney(item.value)}</td>
        <td><span class="crm-health ${item.probability < 50 ? "danger" : item.probability < 75 ? "warning" : ""}"><i class="crm-health-dot"></i>${faNumber(item.probability)}٪</span></td>
      </tr>`).join("");

    const conversationRows = array(data.conversations).map(item => {
      const channel = channelIcon(item.channel);
      return `<button class="crm-list-item w-100 text-start border-0 bg-transparent" data-action="open-conversation" data-id="${item.id}"><span class="crm-channel-icon"><i class="fa-solid ${channel.icon}"></i></span><span class="crm-list-item-main"><strong>${escapeHtml(item.customer?.name || "")}</strong><span>${escapeHtml(item.subject)}</span></span><span class="crm-list-item-time">${formatShortDate(item.updatedAt || item.createdAt)}</span></button>`;
    }).join("");

    const riskRows = array(data.atRiskCustomers).map(customer => `<div class="crm-list-item"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.nextAction || "اقدام بعدی ثبت نشده")}</span></span><button class="btn btn-sm btn-outline-danger" data-action="open-customer" data-id="${customer.id}">${faNumber(customer.health)}</button></div>`).join("");
    const maxProduct = Math.max(...array(data.productPipeline).map(item => Number(item.value || 0)), 1);
    const productRows = array(data.productPipeline).map(item => `<div class="crm-bar-row"><span>${escapeHtml(item.name)}</span><span class="crm-bar-track"><span style="width:${Math.max(4, Number(item.value || 0) / maxProduct * 100)}%"></span></span><strong class="fa-num">${formatMoney(item.value)}</strong></div>`).join("");
    const actions = canWrite() ? `<button class="btn btn-outline-primary" data-action="new-task"><i class="fa-solid fa-list-check"></i> وظیفه جدید</button><button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> فرصت فروش جدید</button>` : "";

    dom.view.innerHTML = `
      ${pageHeader(state.role === "manager" || state.role === "owner" ? "نمای مدیریتی فروش" : state.role === "support" ? "سلامت مشتریان و تعهدات امروز" : "امروز در CRM", "مرور اقدام‌های ضروری، فرصت‌های فروش و تعاملات مشتریان", actions)}
      <section class="crm-kpi-grid">
        ${kpiCard("ارزش سبد فعال", formatMoney(data.kpis?.pipelineValue), `ارزش وزنی: ${formatMoney(data.kpis?.weightedPipeline)}`, "fa-sack-dollar")}
        ${kpiCard("فرصت‌های فعال", faNumber(data.kpis?.activeCount), "نرم‌افزار، سخت‌افزار و خدمات", "fa-handshake", "success")}
        ${kpiCard("پیگیری‌های باز", faNumber(data.kpis?.taskCount), `${faNumber(data.kpis?.unreadCount)} مکالمه خوانده‌نشده`, "fa-list-check", "warning")}
        ${kpiCard("مشتریان در معرض ریسک", faNumber(data.kpis?.riskCount), "سلامت رابطه زیر ۶۵", "fa-triangle-exclamation", "danger")}
      </section>
      <section class="crm-ai-brief mb-3"><div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><strong>جمع‌بندی عملیاتی</strong></div><p>${escapeHtml(data.brief || "هنوز داده کافی ثبت نشده است.")}</p><div class="crm-inline-actions"><button class="btn btn-sm btn-primary" data-ai-prompt="امروز بهتر است با چه مشتریانی تماس بگیرم؟"><i class="fa-solid fa-phone"></i> اولویت تماس‌ها</button><button class="btn btn-sm btn-outline-primary" data-ai-prompt="کدام فرصت‌های فروش در خطر از دست رفتن‌اند؟"><i class="fa-solid fa-triangle-exclamation"></i> تحلیل ریسک فروش</button><button class="btn btn-sm btn-outline-primary" data-ai-prompt="بهترین فرصت‌های فروش مکمل کدام‌اند؟"><i class="fa-solid fa-puzzle-piece"></i> فروش مکمل</button></div></section>
      <div class="crm-grid-2">
        <div class="crm-stack">
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">فرصت‌های مهم</h2><a href="#opportunities" class="small">برد فروش</a></div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>مشتری و فرصت</th><th>محصول</th><th>مرحله</th><th>ارزش</th><th>احتمال</th></tr></thead><tbody>${opportunityRows || `<tr><td colspan="5">${empty("fa-handshake", "هنوز فرصت فروشی ثبت نشده است.", true)}</td></tr>`}</tbody></table></div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">سبد فروش به تفکیک محصول</h2><a href="#reports" class="small">گزارش کامل</a></div><div class="crm-bar-chart">${productRows || empty("fa-chart-column", "داده‌ای برای نمایش وجود ندارد.", true)}</div></div></section>
        </div>
        <div class="crm-stack">
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">اقدام‌های امروز و نزدیک</h2>${canWrite() ? '<button class="btn btn-sm btn-outline-primary" data-action="new-task"><i class="fa-solid fa-plus"></i></button>' : ""}</div><div>${taskRows || empty("fa-list-check", "وظیفه بازی وجود ندارد.", true)}</div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">آخرین مکالمات</h2><a href="#conversations" class="small">ورودی یکپارچه</a></div><div class="crm-list">${conversationRows || empty("fa-inbox", "هنوز مکالمه‌ای ثبت نشده است.", true)}</div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">مشتریان نیازمند توجه</h2><a href="#customers" class="small">همه مشتریان</a></div><div class="crm-list">${riskRows || empty("fa-heart-circle-check", "مشتری پرریسکی وجود ندارد.", true)}</div></div></section>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Customers                                                              */
  /* ---------------------------------------------------------------------- */

  async function renderCustomers() {
    const customers = await withLoading(() => api.listCustomers(state.customerFilters));
    state.assistantContext = {};
    const tiers = [...new Set(["مشتری کلیدی", "سازمانی", "متوسط", "دولتی", ...customers.map(item => item.tier).filter(Boolean)])];
    const rows = customers.map(customer => {
      const activeValue = array(customer.opportunities).filter(item => activeStages.includes(item.stage)).reduce((sum, item) => sum + Number(item.value || 0), 0);
      return `<tr data-action="open-customer" data-id="${customer.id}"><td><div class="crm-customer-cell"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml([customer.industry, customer.city].filter(Boolean).join(" · ") || "بدون دسته‌بندی")}</small></span></div></td><td><span class="badge text-bg-secondary">${escapeHtml(customer.tier || "سازمانی")}</span></td><td><span class="crm-health ${healthClass(customer.health)}"><i class="crm-health-dot"></i>${faNumber(customer.health)} از ۱۰۰</span></td><td>${formatShortDate(customer.lastInteraction)}</td><td class="fa-num">${formatMoney(activeValue)}</td><td>${escapeHtml(customer.owner?.name || "—")}</td><td><span class="text-muted">${escapeHtml(customer.nextAction || "—")}</span></td><td><button class="btn btn-sm btn-outline-secondary" data-action="open-customer" data-id="${customer.id}"><i class="fa-solid fa-chevron-left"></i></button></td></tr>`;
    }).join("");
    const actions = canWrite() ? `<button class="btn btn-outline-primary" data-action="new-customer"><i class="fa-solid fa-building-circle-check"></i> مشتری جدید</button><button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> ثبت فرصت</button>` : "";
    dom.view.innerHTML = `${pageHeader("مشتریان", "پرونده یکپارچه مشتریان خریدار محصولات، خدمات و راهکارهای سازمان", actions)}<section class="crm-filterbar"><i class="fa-solid fa-filter text-muted"></i><input class="form-control" id="customerSearchInput" value="${escapeHtml(state.customerFilters.query)}" placeholder="نام مشتری، صنعت، شهر یا برچسب..." /><select class="form-select" id="customerHealthFilter"><option value="">همه وضعیت‌ها</option><option value="risk" ${state.customerFilters.health === "risk" ? "selected" : ""}>در معرض ریسک</option><option value="healthy" ${state.customerFilters.health === "healthy" ? "selected" : ""}>سلامت بالا</option></select><select class="form-select" id="customerTierFilter"><option value="">همه گروه‌ها</option>${tiers.map(tier => `<option value="${escapeHtml(tier)}" ${state.customerFilters.tier === tier ? "selected" : ""}>${escapeHtml(tier)}</option>`).join("")}</select>${(state.customerFilters.query || state.customerFilters.health || state.customerFilters.tier) ? '<button class="btn btn-sm btn-outline-danger" data-action="clear-customer-filters"><i class="fa-solid fa-xmark"></i> پاک‌کردن</button>' : ""}</section><section class="crm-card crm-card-flat"><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>مشتری</th><th>گروه</th><th>سلامت رابطه</th><th>آخرین تعامل</th><th>فرصت فعال</th><th>مسئول حساب</th><th>اقدام بعدی</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="8">${empty("fa-building", "مشتری مطابق این فیلتر پیدا نشد.")}</td></tr>`}</tbody></table></div></section>`;
    const queryInput = document.getElementById("customerSearchInput");
    const healthFilter = document.getElementById("customerHealthFilter");
    const tierFilter = document.getElementById("customerTierFilter");
    let timer;
    queryInput?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.customerFilters.query = queryInput.value.trim(); renderCustomers(); }, 350); });
    healthFilter?.addEventListener("change", () => { state.customerFilters.health = healthFilter.value; renderCustomers(); });
    tierFilter?.addEventListener("change", () => { state.customerFilters.tier = tierFilter.value; renderCustomers(); });
  }

  async function renderCustomer(customerId) {
    const customer = await withLoading(() => api.getCustomer(customerId));
    state.assistantContext = { customerId: customer.id, customerName: customer.name };
    const activeValue = array(customer.opportunities).filter(item => activeStages.includes(item.stage)).reduce((sum, item) => sum + Number(item.value || 0), 0);
    const contactRows = array(customer.contacts).map(contact => `<div class="crm-contact"><span class="crm-avatar">${escapeHtml(initials(contact.name))}</span><span><strong>${escapeHtml(contact.name)} ${contact.isPrimary ? '<i class="fa-solid fa-star text-warning" title="فرد اصلی"></i>' : ""}</strong><small>${escapeHtml([contact.title, contact.decisionRole].filter(Boolean).join(" · ") || "بدون عنوان")}</small></span><div class="d-flex gap-1">${contact.phone ? `<a class="btn btn-sm btn-outline-secondary" href="tel:${escapeHtml(contact.phone)}"><i class="fa-solid fa-phone"></i></a>` : ""}${contact.email ? `<a class="btn btn-sm btn-outline-secondary" href="mailto:${escapeHtml(contact.email)}"><i class="fa-solid fa-envelope"></i></a>` : ""}${canWrite() ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-contact" data-id="${contact.id}" data-customer-id="${customer.id}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete-contact" data-id="${contact.id}" data-customer-id="${customer.id}"><i class="fa-solid fa-trash"></i></button>` : ""}</div></div>`).join("");
    const assetRows = array(customer.assets).map(asset => `<div class="crm-product-asset"><i class="fa-solid ${safeIcon(asset.product?.icon)}"></i><span><strong>${escapeHtml(asset.name || asset.product?.shortName || "محصول/خدمت")}</strong><small>${faNumber(asset.quantity)} واحد · ${escapeHtml(asset.contract || "بدون قرارداد")} ${asset.expiresAt ? `· انقضا ${formatShortDate(asset.expiresAt)}` : ""}</small></span><div class="d-flex align-items-center gap-1"><span class="badge text-bg-success">${escapeHtml(asset.status || "فعال")}</span>${canWrite() ? `<button class="btn btn-sm btn-outline-danger" data-action="delete-asset" data-id="${asset.id}" data-customer-id="${customer.id}"><i class="fa-solid fa-trash"></i></button>` : ""}</div></div>`).join("");
    const activityRows = array(customer.activities).map(activity => { const meta = channelIcon(activity.type); return `<div class="crm-timeline-item"><span class="crm-timeline-icon"><i class="fa-solid ${meta.icon}"></i></span><div class="crm-timeline-content"><div class="crm-timeline-meta"><strong>${escapeHtml(activity.title)}</strong><span>${formatDate(activity.createdAt, true)}</span></div><p>${escapeHtml(activity.detail || "")}</p></div></div>`; }).join("");
    const oppRows = array(customer.opportunities).map(item => `<tr data-action="open-opportunity" data-id="${item.id}"><td><strong>${escapeHtml(item.title)}</strong></td><td>${escapeHtml(item.product?.shortName || "—")}</td><td>${escapeHtml(stageMeta[item.stage]?.label || item.stage)}</td><td class="fa-num">${formatMoney(item.value)}</td><td>${faNumber(item.probability)}٪</td><td><button class="btn btn-sm btn-outline-secondary" data-action="open-opportunity" data-id="${item.id}"><i class="fa-solid fa-chevron-left"></i></button></td></tr>`).join("");
    const tickets = array(customer.tickets).map(ticket => `<div class="crm-list-item"><span class="crm-channel-icon"><i class="fa-solid fa-ticket"></i></span><span class="crm-list-item-main"><strong>${escapeHtml(ticket.title)}</strong><span>${formatShortDate(ticket.createdAt)} · اولویت ${escapeHtml(ticket.priority)}${ticket.externalRef ? ` · ${escapeHtml(ticket.externalRef)}` : ""}</span></span><div class="d-flex align-items-center gap-1"><span class="badge ${ticket.status === "باز" ? "text-bg-danger" : ticket.status === "بسته" ? "text-bg-success" : "text-bg-warning"}">${escapeHtml(ticket.status)}</span>${canWrite() ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-ticket" data-id="${ticket.id}" data-customer-id="${customer.id}"><i class="fa-solid fa-pen"></i></button>` : ""}</div></div>`).join("");
    const headerActions = canWrite() ? `<button class="btn btn-outline-secondary" data-action="edit-customer" data-id="${customer.id}"><i class="fa-solid fa-pen"></i> ویرایش</button><button class="btn btn-outline-primary" data-action="new-task" data-customer-id="${customer.id}"><i class="fa-solid fa-list-check"></i> پیگیری</button><button class="btn btn-primary" data-action="new-opportunity" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i> فرصت جدید</button>` : "";
    dom.view.innerHTML = `${pageHeader('<a href="#customers" class="small ms-2"><i class="fa-solid fa-arrow-right"></i></a> پرونده مشتری', "نمای ۳۶۰ درجه از خرید، محصولات مستقر، مکالمات، خدمات و فرصت‌های فروش", headerActions)}
      <section class="crm-card crm-customer-hero"><div class="crm-customer-identity"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><div><h1>${escapeHtml(customer.name)}</h1><p>${escapeHtml([customer.industry, customer.city, customer.owner?.name ? `مسئول: ${customer.owner.name}` : ""].filter(Boolean).join(" · "))}</p><div class="mt-2">${array(customer.tags).map(tag => `<span class="badge text-bg-secondary ms-1">${escapeHtml(tag)}</span>`).join("")}</div></div></div><div class="crm-customer-metric"><small>سلامت رابطه</small><strong class="${healthClass(customer.health) === "danger" ? "text-danger" : healthClass(customer.health) === "warning" ? "text-warning" : "text-success"}">${faNumber(customer.health)} از ۱۰۰</strong></div><div class="crm-customer-metric"><small>ارزش رابطه</small><strong>${formatMoney(customer.lifetimeValue)}</strong></div><div class="crm-customer-metric"><small>فرصت فعال</small><strong>${formatMoney(activeValue)}</strong></div><div class="crm-customer-metric"><small>تمدید بعدی</small><strong>${formatShortDate(customer.renewalDate)}</strong></div></section>
      <section class="crm-ai-brief mb-3"><div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><strong>خلاصه هوشمند پرونده</strong></div><p>${escapeHtml(customer.aiSummary || "برای این مشتری هنوز خلاصه هوشمند تولید نشده است.")}</p><div class="crm-inline-actions">${canWrite() ? `<button class="btn btn-sm btn-primary" data-action="generate-customer-summary" data-id="${customer.id}"><i class="fa-solid fa-arrows-rotate"></i> تولید/به‌روزرسانی خلاصه</button>` : ""}<button class="btn btn-sm btn-outline-primary" data-ai-prompt="وضعیت این مشتری را تحلیل کن" data-customer-id="${customer.id}" data-customer-name="${escapeHtml(customer.name)}"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل عمیق‌تر</button></div></section>
      <div class="crm-grid-equal mb-3"><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">افراد کلیدی</h2>${canWrite() ? `<button class="btn btn-sm btn-outline-primary" data-action="new-contact" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i></button>` : ""}</div><div class="crm-contact-list">${contactRows || empty("fa-address-book", "فرد تماسی ثبت نشده است.", true)}</div></div></section><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">محصولات و قراردادهای فعال</h2>${canWrite() ? `<button class="btn btn-sm btn-outline-primary" data-action="new-asset" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i></button>` : ""}</div><div class="crm-product-assets">${assetRows || empty("fa-box-open", "محصول یا خدمتی ثبت نشده است.", true)}</div></div></section></div>
      <div class="crm-grid-equal mb-3"><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">تیکت‌ها و مسائل باز</h2>${canWrite() ? `<button class="btn btn-sm btn-outline-primary" data-action="new-ticket" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i></button>` : ""}</div><div class="crm-list">${tickets || empty("fa-ticket", "تیکتی ثبت نشده است.", true)}</div></div></section><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">خط زمانی تعاملات</h2>${canWrite() ? `<button class="btn btn-sm btn-outline-primary" data-action="new-note" data-customer-id="${customer.id}"><i class="fa-solid fa-note-sticky"></i> یادداشت</button>` : ""}</div><div class="crm-timeline">${activityRows || empty("fa-clock-rotate-left", "هنوز رویدادی ثبت نشده است.", true)}</div></div></section></div>
      <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">فرصت‌های فروش این مشتری</h2>${canWrite() ? `<button class="btn btn-sm btn-primary" data-action="new-opportunity" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i> فرصت جدید</button>` : ""}</div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>عنوان</th><th>محصول</th><th>مرحله</th><th>ارزش</th><th>احتمال</th><th></th></tr></thead><tbody>${oppRows || `<tr><td colspan="6">${empty("fa-handshake", "فرصتی ثبت نشده است.", true)}</td></tr>`}</tbody></table></div></div></section>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Opportunities                                                          */
  /* ---------------------------------------------------------------------- */

  async function renderOpportunities() {
    const opportunities = await withLoading(() => api.listOpportunities());
    state.assistantContext = {};
    const columns = activeStages.map(stage => {
      const items = opportunities.filter(item => item.stage === stage && (state.opportunityFilter === "all" || item.product?.type === state.opportunityFilter));
      const cards = items.map(item => `<article class="crm-opportunity-card ${item.risk ? "is-risk" : ""}" draggable="${canWrite() ? "true" : "false"}" data-opportunity-id="${item.id}" data-action="open-opportunity" data-id="${item.id}"><h3>${escapeHtml(item.title)}</h3><div class="crm-opportunity-customer">${escapeHtml(item.customer?.name || "مشتری حذف‌شده")}</div><div class="crm-opportunity-product"><i class="fa-solid ${safeIcon(item.product?.icon)}"></i>${escapeHtml(item.product?.shortName || "بدون محصول")}</div><div class="crm-opportunity-meta"><span class="crm-opportunity-value">${formatMoney(item.value)}</span><span class="crm-probability"><i class="crm-probability-bar"><i style="width:${Number(item.probability || 0)}%"></i></i>${faNumber(item.probability)}٪</span></div>${item.nextAction ? `<div class="small text-muted mt-2"><i class="fa-solid fa-forward-step"></i> ${escapeHtml(item.nextAction)}</div>` : ""}${item.risk ? `<div class="crm-opportunity-warning"><i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(item.risk)}</span></div>` : ""}<select class="form-select form-select-sm crm-stage-mobile" data-action="change-stage" data-id="${item.id}" ${canWrite() ? "" : "disabled"}>${allStages.map(key => `<option value="${key}" ${key === item.stage ? "selected" : ""}>${stageMeta[key].label}</option>`).join("")}</select></article>`).join("");
      const value = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
      return `<section class="crm-kanban-column" data-stage="${stage}"><div class="crm-kanban-header"><strong>${stageMeta[stage].label}</strong><span>${faNumber(items.length)} · ${formatMoney(value)}</span></div>${cards || empty("fa-inbox", "فرصتی در این مرحله نیست.", true)}</section>`;
    }).join("");
    const closed = opportunities.filter(item => ["won", "lost"].includes(item.stage));
    const actions = `${canWrite() ? '<button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> فرصت جدید</button>' : ""}<select id="opportunityTypeFilter" class="form-select"><option value="all">همه انواع</option><option value="hardware" ${state.opportunityFilter === "hardware" ? "selected" : ""}>سخت‌افزار</option><option value="software" ${state.opportunityFilter === "software" ? "selected" : ""}>نرم‌افزار</option><option value="service" ${state.opportunityFilter === "service" ? "selected" : ""}>خدمات</option></select>`;
    dom.view.innerHTML = `${pageHeader("برد فرصت‌های فروش", "مدیریت مراحل فروش نرم‌افزار، سخت‌افزار و خدمات", actions)}<section class="crm-kanban">${columns}</section>${closed.length ? `<section class="crm-card mt-3"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">فرصت‌های بسته‌شده اخیر</h2><span class="small text-muted">${faNumber(closed.length)} مورد</span></div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>عنوان</th><th>مشتری</th><th>نتیجه</th><th>ارزش</th><th></th></tr></thead><tbody>${closed.slice(0, 20).map(item => `<tr data-action="open-opportunity" data-id="${item.id}"><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.customer?.name || "")}</td><td><span class="badge ${item.stage === "won" ? "text-bg-success" : "text-bg-danger"}">${stageMeta[item.stage].label}</span></td><td>${formatMoney(item.value)}</td><td><button class="btn btn-sm btn-outline-secondary" data-action="open-opportunity" data-id="${item.id}"><i class="fa-solid fa-eye"></i></button></td></tr>`).join("")}</tbody></table></div></div></section>` : ""}`;
    document.getElementById("opportunityTypeFilter")?.addEventListener("change", event => { state.opportunityFilter = event.target.value; renderOpportunities(); });
    if (canWrite()) bindKanbanDrag();
  }

  function bindKanbanDrag() {
    dom.view.querySelectorAll(".crm-opportunity-card").forEach(card => {
      card.addEventListener("dragstart", event => { state.draggedOpportunityId = card.dataset.opportunityId; event.dataTransfer.effectAllowed = "move"; });
      card.addEventListener("dragend", () => { state.draggedOpportunityId = null; dom.view.querySelectorAll(".crm-kanban-column").forEach(column => column.classList.remove("drag-over")); });
    });
    dom.view.querySelectorAll(".crm-kanban-column").forEach(column => {
      column.addEventListener("dragover", event => { event.preventDefault(); column.classList.add("drag-over"); });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async event => {
        event.preventDefault(); column.classList.remove("drag-over");
        if (!state.draggedOpportunityId) return;
        await withLoading(() => api.updateOpportunityStage(state.draggedOpportunityId, column.dataset.stage));
        notify("مرحله فرصت به‌روزرسانی شد.");
        await renderOpportunities(); await refreshBadges();
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Conversations                                                          */
  /* ---------------------------------------------------------------------- */

  async function renderConversations(conversationId) {
    const conversations = await withLoading(() => api.listConversations());
    let selected = null;
    if (conversationId) selected = await api.getConversation(conversationId);
    else if (conversations.length && window.innerWidth > 720) selected = await api.getConversation(conversations[0].id);
    const selectedId = selected?.id || null;
    if (selected) state.assistantContext = { conversationId: selected.id, conversationSubject: selected.subject, customerId: selected.customerId, customerName: selected.customer?.name };
    else state.assistantContext = {};
    const list = conversations.map(item => { const channel = channelIcon(item.channel); return `<button class="crm-conversation-item ${item.unread ? "unread" : ""} ${item.id === selectedId ? "active" : ""}" data-action="open-conversation" data-id="${item.id}"><span class="crm-channel-icon"><i class="fa-solid ${channel.icon}"></i></span><span class="crm-conversation-item-main"><strong>${escapeHtml(item.customer?.name || "مشتری")}</strong><span>${escapeHtml(item.subject)}</span><span>${escapeHtml(item.preview || "")}</span></span><span class="crm-conversation-item-time">${formatShortDate(item.updatedAt || item.createdAt)}</span></button>`; }).join("");
    let reader = empty("fa-envelope-open-text", "یک مکالمه را انتخاب کنید.");
    let analysis = "";
    if (selected) {
      const messages = array(selected.messages).length ? selected.messages : [{ direction: "incoming", body: selected.body, createdAt: selected.createdAt }];
      const thread = messages.map(message => `<div class="crm-thread-message ${message.direction === "outgoing" ? "outgoing" : "incoming"}"><div>${escapeHtml(message.body).replaceAll("\n", "<br>")}</div><small>${message.direction === "outgoing" ? "پاسخ تیم" : escapeHtml(selected.contact?.name || selected.customer?.name || "مشتری")} · ${formatDate(message.createdAt, true)}</small></div>`).join("");
      reader = `<div class="crm-conversation-reader-header"><button class="btn btn-sm btn-outline-secondary on-mobile mb-2" data-action="close-mobile-reader"><i class="fa-solid fa-arrow-right"></i> بازگشت</button><div class="d-flex justify-content-between align-items-start gap-2"><div><span class="badge text-bg-secondary">${escapeHtml(channelIcon(selected.channel).label)}</span><span class="badge text-bg-light text-dark me-1">${escapeHtml(selected.status || "Open")}</span><h2>${escapeHtml(selected.subject)}</h2><div class="small text-muted">${escapeHtml(selected.customer?.name || "")} ${selected.contact?.name ? `· ${escapeHtml(selected.contact.name)}` : ""} · ${formatDate(selected.createdAt, true)}</div></div>${selected.customerId ? `<button class="btn btn-sm btn-outline-secondary" data-action="open-customer" data-id="${selected.customerId}"><i class="fa-solid fa-building"></i> پرونده مشتری</button>` : ""}</div></div><div class="crm-thread">${thread}</div><div class="crm-conversation-actions">${canWrite() ? `<button class="btn btn-primary" data-action="draft-reply" data-id="${selected.id}"><i class="fa-solid fa-reply"></i> تهیه پاسخ</button><button class="btn btn-outline-primary" data-action="analyze-conversation" data-id="${selected.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل دوباره</button><button class="btn btn-outline-secondary" data-action="conversation-to-opportunity" data-id="${selected.id}" data-customer-id="${selected.customerId}"><i class="fa-solid fa-handshake"></i> تبدیل به فرصت</button><button class="btn btn-outline-secondary" data-action="edit-conversation" data-id="${selected.id}"><i class="fa-solid fa-user-pen"></i> وضعیت و مسئول</button>` : ""}</div>`;
      const ai = selected.ai || {};
      analysis = `<div class="crm-analysis-block"><h3>تحلیل مکالمه</h3><div class="crm-analysis-row"><span>قصد مشتری</span><strong>${escapeHtml(ai.intent || "تحلیل نشده")}</strong></div><div class="crm-analysis-row"><span>احساس</span><strong>${escapeHtml(ai.sentiment || "—")}</strong></div><div class="crm-analysis-row"><span>فوریت</span><strong>${escapeHtml(ai.urgency || "—")}</strong></div><div class="crm-analysis-row"><span>بودجه</span><strong>${escapeHtml(ai.budget || "—")}</strong></div><div class="crm-analysis-row"><span>زمان تصمیم</span><strong>${escapeHtml(ai.decisionDate || "—")}</strong></div></div><div class="crm-analysis-block"><h3>محصولات مرتبط</h3><div>${array(ai.products).length ? ai.products.map(product => `<span class="badge text-bg-primary ms-1 mb-1">${escapeHtml(product)}</span>`).join("") : '<span class="text-muted small">محصولی استخراج نشده است.</span>'}</div></div><div class="crm-analysis-block"><h3>تعهدات استخراج‌شده</h3>${array(ai.commitments).length ? `<ul class="small mb-0">${ai.commitments.map(item => `<li class="mb-2">${escapeHtml(item)}</li>`).join("")}</ul>` : '<span class="text-muted small">تعهدی استخراج نشده است.</span>'}</div><div class="alert alert-primary small"><strong>اقدام بعدی:</strong><br>${escapeHtml(ai.nextAction || "تحلیل مکالمه را اجرا کنید.")}</div>`;
    }
    const actions = canWrite() ? `<button class="btn btn-outline-primary" data-action="new-conversation"><i class="fa-solid fa-plus"></i> ثبت مکالمه</button>` : "";
    dom.view.innerHTML = `${pageHeader("مرکز مکالمات", "ثبت ایمیل، تماس، پیام، جلسه و تیکت همراه با تحلیل هوشمند", `${actions}<button class="btn btn-primary" data-ai-prompt="مهم‌ترین مکالمات پاسخ‌داده‌نشده کدام‌اند؟"><i class="fa-solid fa-wand-magic-sparkles"></i> اولویت‌بندی هوشمند</button>`)}<section class="crm-card crm-inbox ${selectedId ? "reader-open" : ""}"><aside class="crm-inbox-list"><div class="crm-inbox-list-head"><strong>همه مکالمات</strong><div class="small text-muted mt-1">${faNumber(conversations.filter(item => item.unread).length)} مورد خوانده‌نشده</div></div>${list || empty("fa-inbox", "هنوز مکالمه‌ای ثبت نشده است.")}</aside><article class="crm-conversation-reader">${reader}</article><aside class="crm-conversation-analysis">${analysis}</aside></section>`;
    await refreshBadges();
  }

  /* ---------------------------------------------------------------------- */
  /* Products and reports                                                   */
  /* ---------------------------------------------------------------------- */

  async function renderProducts() {
    const products = await withLoading(() => api.listProducts({ type: state.productFilter }));
    state.assistantContext = {};
    const cards = products.map(product => `<article class="crm-card crm-product-card"><div class="crm-product-card-head"><span class="crm-product-card-icon"><i class="fa-solid ${safeIcon(product.icon)}"></i></span><div><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.category || "بدون دسته‌بندی")} · کد ${escapeHtml(product.code)}</p></div><span class="badge ${productBadge(product.type)}">${productTypeLabel(product.type)}</span></div><p class="crm-product-card-desc">${escapeHtml(product.description || "توضیحی ثبت نشده است.")}</p><div class="mb-3 d-flex justify-content-between small"><span class="text-muted">قیمت پایه</span><strong>${formatMoney(product.price, false)}</strong></div><div class="crm-product-stats"><span class="crm-product-stat"><small>مشتری فعال</small><strong>${faNumber(product.activeCustomers)}</strong></span><span class="crm-product-stat"><small>واحد نصب/مجوز</small><strong>${faNumber(product.installedUnits)}</strong></span><span class="crm-product-stat"><small>سبد باز</small><strong>${formatMoney(product.openPipeline)}</strong></span></div><div class="mt-3 d-flex gap-2"><button class="btn btn-sm btn-outline-primary flex-grow-1" data-ai-prompt="برای محصول ${escapeHtml(product.shortName)} چه فرصت‌های فروشی داریم؟"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل فرصت‌ها</button>${canWrite() ? `<button class="btn btn-sm btn-primary" data-action="new-opportunity" data-product-id="${product.id}"><i class="fa-solid fa-plus"></i></button>` : ""}${canManage() ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-product" data-id="${product.id}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${product.id}"><i class="fa-solid fa-trash"></i></button>` : ""}</div></article>`).join("");
    const actions = `<select id="productTypeFilter" class="form-select"><option value="all" ${state.productFilter === "all" ? "selected" : ""}>همه محصولات</option><option value="hardware" ${state.productFilter === "hardware" ? "selected" : ""}>سخت‌افزار</option><option value="software" ${state.productFilter === "software" ? "selected" : ""}>نرم‌افزار</option><option value="service" ${state.productFilter === "service" ? "selected" : ""}>خدمت</option></select>${canManage() ? '<button class="btn btn-outline-primary" data-action="new-product"><i class="fa-solid fa-box-open"></i> محصول جدید</button>' : ""}${canWrite() ? '<button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> ثبت فرصت</button>' : ""}`;
    dom.view.innerHTML = `${pageHeader("محصولات و راهکارها", "کاتالوگ فروش و نمای نصب‌شده، تمدیدها و فرصت‌های هر محصول", actions)}<section class="crm-product-grid">${cards || empty("fa-box-open", "هنوز محصول یا خدمتی تعریف نشده است.")}</section>`;
    document.getElementById("productTypeFilter")?.addEventListener("change", event => { state.productFilter = event.target.value; renderProducts(); });
  }

  async function renderReports() {
    const report = await withLoading(() => api.getReports());
    state.assistantContext = {};
    const maxFunnel = Math.max(...array(report.funnel).map(item => Number(item.value || 0)), 1);
    const funnelRows = array(report.funnel).map(item => `<div class="crm-funnel-row"><span>${escapeHtml(stageMeta[item.stage]?.label || item.stage)}</span><span class="crm-funnel-bar"><span style="width:${Math.max(4, Number(item.value || 0) / maxFunnel * 100)}%">${faNumber(item.count)} فرصت</span></span><strong>${formatMoney(item.value)}</strong></div>`).join("");
    const maxProduct = Math.max(...array(report.byProduct).map(item => Number(item.value || 0)), 1);
    const productRows = array(report.byProduct).map(item => `<div class="crm-bar-row"><span>${escapeHtml(item.name)} <small class="text-muted">${productTypeLabel(item.type)}</small></span><span class="crm-bar-track"><span style="width:${Math.max(4, Number(item.value || 0) / maxProduct * 100)}%"></span></span><strong>${formatMoney(item.value)}</strong></div>`).join("");
    const atRisk = array(report.customers).filter(customer => Number(customer.health) < 65);
    const healthy = array(report.customers).filter(customer => Number(customer.health) >= 80);
    dom.view.innerHTML = `${pageHeader("گزارش مدیریتی فروش", "تحلیل سبد فروش، ترکیب محصولات، قیف تبدیل و سلامت مشتریان", '<button class="btn btn-primary" data-ai-prompt="مهم‌ترین نکات مدیریتی فروش چیست؟"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل مدیریتی</button>')}<section class="crm-kpi-grid">${kpiCard("سبد سخت‌افزار", formatMoney(report.hardware), "فرصت‌های تجهیزات و زیرساخت", "fa-microchip")}${kpiCard("سبد نرم‌افزار", formatMoney(report.software), "مجوز، استقرار و توسعه", "fa-laptop-code", "success")}${kpiCard("سبد خدمات", formatMoney(report.service), "پشتیبانی، نصب و خدمات حرفه‌ای", "fa-headset", "warning")}${kpiCard("مشتریان پرریسک", faNumber(atRisk.length), "نیازمند برنامه حفظ مشتری", "fa-triangle-exclamation", "danger")}</section><section class="crm-ai-brief mb-3"><div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-chart-line"></i></span><strong>برداشت مدیریتی</strong></div><p>${escapeHtml(report.insight || "هنوز داده کافی برای تحلیل ثبت نشده است.")}</p></section><div class="crm-grid-equal"><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">قیف فروش</h2><span class="small text-muted">ارزش و تعداد فرصت</span></div><div class="crm-funnel">${funnelRows || empty("fa-filter-circle-dollar", "قیف فروش خالی است.", true)}</div></div></section><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">سبد به تفکیک محصول</h2><span class="small text-muted">نرم‌افزار، سخت‌افزار و خدمات</span></div><div class="crm-bar-chart">${productRows || empty("fa-chart-column", "محصولی در فرصت‌ها وجود ندارد.", true)}</div></div></section></div><div class="crm-grid-equal mt-3"><section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">مشتریان در معرض ریسک</h2>${atRisk.map(customer => `<div class="crm-list-item"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.nextAction || "اقدام بعدی ثبت نشده")}</span></span><button class="btn btn-sm btn-outline-danger" data-action="open-customer" data-id="${customer.id}">${faNumber(customer.health)}</button></div>`).join("") || empty("fa-heart", "مشتری پرریسکی وجود ندارد.", true)}</div></section><section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">فرصت‌های توسعه حساب</h2>${healthy.map(customer => `<div class="crm-list-item"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(array(customer.tags).join(" · ") || "سلامت رابطه بالا")}</span></span><button class="btn btn-sm btn-outline-primary" data-ai-prompt="برای ${escapeHtml(customer.name)} چه فروش مکملی پیشنهاد می‌کنی؟" data-customer-id="${customer.id}" data-customer-name="${escapeHtml(customer.name)}"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div>`).join("") || empty("fa-puzzle-piece", "داده کافی برای پیشنهاد توسعه حساب وجود ندارد.", true)}</div></section></div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Team and workspace                                                     */
  /* ---------------------------------------------------------------------- */

  async function renderTeam() {
    const members = await withLoading(() => api.listTeam());
    const workspace = state.bootstrap.workspace;
    const rows = members.map(member => `<tr><td><div class="crm-customer-cell"><span class="crm-avatar">${member.avatar ? `<img src="${escapeHtml(member.avatar)}" alt="">` : escapeHtml(initials(member.name))}</span><span><strong>${escapeHtml(member.name)}</strong><small class="ltr">${escapeHtml(member.username || "بدون نام کاربری")}</small></span></div></td><td>${escapeHtml(member.organization || "—")}</td><td>${canManageTeam() && member.roleKey !== "owner" ? `<select class="form-select form-select-sm" data-action="change-member-role" data-id="${member.id}">${["manager", "sales", "support", "viewer"].map(role => `<option value="${role}" ${member.roleKey === role ? "selected" : ""}>${roleLabels[role]}</option>`).join("")}</select>` : `<span class="badge text-bg-secondary">${escapeHtml(member.role)}</span>`}</td><td>${member.roleKey === "owner" ? "—" : canManageTeam() ? `<button class="btn btn-sm btn-outline-danger" data-action="remove-member" data-id="${member.id}" data-name="${escapeHtml(member.name)}"><i class="fa-solid fa-user-minus"></i></button>` : "—"}</td></tr>`).join("");
    const settings = canManageTeam() ? `<section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">تنظیمات فضای CRM</h2><form id="workspaceForm" class="crm-form-grid"><label class="form-label">نام فضای CRM <span class="text-danger">*</span><input class="form-control mt-1" name="name" required value="${escapeHtml(workspace.name)}"></label><label class="form-label">واحد پول<input class="form-control mt-1" name="currency" value="${escapeHtml(workspace.currency || "تومان")}"></label><div class="crm-form-actions full"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> ذخیره تنظیمات</button></div></form></div></section>` : "";
    const add = canManageTeam() ? `<section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">افزودن عضو</h2><p class="small text-muted">فرد باید قبلاً وارد سامانه شده و در پروفایل خود نام کاربری یکتا ثبت کرده باشد.</p><form id="addMemberForm" class="crm-form-grid"><label class="form-label">نام کاربری <span class="text-danger">*</span><input class="form-control mt-1 ltr" name="username" required placeholder="username"></label><label class="form-label">نقش<select class="form-select mt-1" name="role"><option value="sales">کارشناس فروش</option><option value="support">کارشناس خدمات مشتریان</option><option value="manager">مدیر فروش</option><option value="viewer">مشاهده‌گر</option></select></label><div class="crm-form-actions full"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-user-plus"></i> افزودن عضو</button></div></form></div></section>` : "";
    dom.view.innerHTML = `${pageHeader("تیم و تنظیمات", "اعضای مجاز، نقش‌های دسترسی و مشخصات فضای CRM", "")}<div class="crm-grid-equal mb-3">${settings}${add}</div><section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">اعضای CRM</h2><span class="small text-muted">${faNumber(members.length)} نفر</span></div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>کاربر</th><th>سازمان</th><th>نقش</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div></section>`;
    document.getElementById("workspaceForm")?.addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => api.updateWorkspace(input)); await reloadBootstrap(); notify("تنظیمات CRM ذخیره شد."); renderTeam(); });
    document.getElementById("addMemberForm")?.addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => api.addTeamMember(input)); await reloadBootstrap(); notify("عضو جدید اضافه شد."); renderTeam(); });
  }

  /* ---------------------------------------------------------------------- */
  /* Forms and modals                                                       */
  /* ---------------------------------------------------------------------- */

  async function customerModal(customer = null) {
    const isEdit = Boolean(customer);
    openModal(isEdit ? "ویرایش مشتری" : "ایجاد مشتری", `<form id="customerForm"><div class="crm-form-grid"><label class="form-label full">نام مشتری <span class="text-danger">*</span><input class="form-control mt-1" name="name" required value="${escapeHtml(customer?.name || "")}" placeholder="نام شرکت یا سازمان"></label><label class="form-label">نام کوتاه<input class="form-control mt-1" name="short" maxlength="16" value="${escapeHtml(customer?.short || "")}" placeholder="مثلاً فاپا"></label><label class="form-label">مسئول حساب<select class="form-select mt-1" name="ownerId">${userOptions(customer?.ownerId || state.bootstrap.currentUser?.id, true)}</select></label><label class="form-label">صنعت<input class="form-control mt-1" name="industry" value="${escapeHtml(customer?.industry || "")}" placeholder="بانکداری، صنعت، سلامت..."></label><label class="form-label">شهر<input class="form-control mt-1" name="city" value="${escapeHtml(customer?.city || "")}"></label><label class="form-label">گروه<select class="form-select mt-1" name="tier">${["مشتری کلیدی", "سازمانی", "متوسط", "دولتی"].map(value => `<option ${value === (customer?.tier || "سازمانی") ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-label">سلامت رابطه (۰ تا ۱۰۰)<input class="form-control mt-1" type="number" min="0" max="100" name="health" value="${Number(customer?.health ?? 75)}"></label><label class="form-label">ارزش عمر مشتری<input class="form-control mt-1 ltr" type="number" min="0" name="lifetimeValue" value="${Number(customer?.lifetimeValue || 0)}"></label><label class="form-label">درآمد سالانه تقریبی<input class="form-control mt-1 ltr" type="number" min="0" name="annualRevenue" value="${Number(customer?.annualRevenue || 0)}"></label><label class="form-label">تاریخ تمدید<input class="form-control mt-1 ltr" type="date" name="renewalDate" value="${toDateInput(customer?.renewalDate)}"></label><label class="form-label">مهلت اقدام بعدی<input class="form-control mt-1 ltr" type="datetime-local" name="nextActionDue" value="${toDateTimeInput(customer?.nextActionDue)}"></label><label class="form-label full">اقدام بعدی<textarea class="form-control mt-1" rows="2" name="nextAction">${escapeHtml(customer?.nextAction || "")}</textarea></label><label class="form-label full">برچسب‌ها<textarea class="form-control mt-1" rows="2" name="tags" placeholder="با ویرگول یا سطر جدید جدا کنید">${escapeHtml(array(customer?.tags).join("، "))}</textarea></label></div><div class="crm-form-actions">${isEdit && canManage() ? '<button class="btn btn-outline-danger ms-auto" type="button" data-action="delete-customer" data-id="' + customer.id + '"><i class="fa-solid fa-trash"></i> بایگانی</button>' : ""}<button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> ذخیره</button></div></form>`, root => root.querySelector("#customerForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); input.tags = input.tags.split(/[،,؛;\n]+/).map(item => item.trim()).filter(Boolean); const saved = await withLoading(() => isEdit ? api.updateCustomer(customer.id, input) : api.createCustomer(input)); closeModal(); await reloadBootstrap(); notify(isEdit ? "پرونده مشتری به‌روزرسانی شد." : "مشتری جدید ایجاد شد."); routeTo(`customer/${saved.id}`); }));
  }

  async function productModal(product = null) {
    const isEdit = Boolean(product);
    openModal(isEdit ? "ویرایش محصول یا خدمت" : "محصول یا خدمت جدید", `<form id="productForm"><div class="crm-form-grid"><label class="form-label">کد <span class="text-danger">*</span><input class="form-control mt-1 ltr" name="code" required value="${escapeHtml(product?.code || "")}" placeholder="PRD-001"></label><label class="form-label">نوع<select class="form-select mt-1" name="type"><option value="software" ${product?.type === "software" ? "selected" : ""}>نرم‌افزار</option><option value="hardware" ${product?.type === "hardware" ? "selected" : ""}>سخت‌افزار</option><option value="service" ${product?.type === "service" ? "selected" : ""}>خدمت</option></select></label><label class="form-label full">نام کامل <span class="text-danger">*</span><input class="form-control mt-1" name="name" required value="${escapeHtml(product?.name || "")}"></label><label class="form-label">نام کوتاه<input class="form-control mt-1" name="shortName" value="${escapeHtml(product?.shortName || "")}"></label><label class="form-label">دسته‌بندی<input class="form-control mt-1" name="category" value="${escapeHtml(product?.category || "")}"></label><label class="form-label">قیمت پایه<input class="form-control mt-1 ltr" type="number" min="0" name="price" value="${Number(product?.price || 0)}"></label><label class="form-label">آیکون Font Awesome<input class="form-control mt-1 ltr" name="icon" value="${escapeHtml(product?.icon || "fa-box")}" placeholder="fa-microchip"></label><label class="form-label full">توضیحات<textarea class="form-control mt-1" rows="4" name="description">${escapeHtml(product?.description || "")}</textarea></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> ذخیره</button></div></form>`, root => root.querySelector("#productForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => isEdit ? api.updateProduct(product.id, input) : api.createProduct(input)); closeModal(); await reloadBootstrap(); notify(isEdit ? "محصول به‌روزرسانی شد." : "محصول جدید ایجاد شد."); renderProducts(); }));
  }

  async function contactModal(customer, contact = null) {
    const isEdit = Boolean(contact);
    openModal(isEdit ? "ویرایش فرد تماس" : "افزودن فرد تماس", `<form id="contactForm"><div class="crm-form-grid"><label class="form-label full">نام و نام خانوادگی <span class="text-danger">*</span><input class="form-control mt-1" name="name" required value="${escapeHtml(contact?.name || "")}"></label><label class="form-label">عنوان شغلی<input class="form-control mt-1" name="title" value="${escapeHtml(contact?.title || "")}"></label><label class="form-label">نقش در تصمیم‌گیری<input class="form-control mt-1" name="decisionRole" value="${escapeHtml(contact?.decisionRole || "")}" placeholder="تصمیم‌گیر، تأثیرگذار، کاربر..."></label><label class="form-label">تلفن<input class="form-control mt-1 ltr" name="phone" value="${escapeHtml(contact?.phone || "")}"></label><label class="form-label">ایمیل<input class="form-control mt-1 ltr" type="email" name="email" value="${escapeHtml(contact?.email || "")}"></label><label class="form-check full"><input class="form-check-input" type="checkbox" name="isPrimary" ${contact?.isPrimary ? "checked" : ""}><span class="form-check-label">فرد تماس اصلی</span></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ذخیره</button></div></form>`, root => root.querySelector("#contactForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => isEdit ? api.updateContact(customer.id, contact.id, input) : api.addContact(customer.id, input)); closeModal(); notify("اطلاعات فرد تماس ذخیره شد."); renderCustomer(customer.id); }));
  }

  async function assetModal(customer) {
    openModal("افزودن محصول، خدمت یا قرارداد", `<form id="assetForm"><div class="crm-form-grid"><label class="form-label full">محصول یا خدمت<select class="form-select mt-1" name="productId">${productOptions(state.bootstrap.products)}</select></label><label class="form-label">عنوان سفارشی<input class="form-control mt-1" name="name" placeholder="در صورت نیاز"></label><label class="form-label">تعداد/مجوز<input class="form-control mt-1 ltr" type="number" step="0.01" min="0" name="quantity" value="1"></label><label class="form-label">وضعیت<input class="form-control mt-1" name="status" value="فعال"></label><label class="form-label">شماره یا عنوان قرارداد<input class="form-control mt-1" name="contract"></label><label class="form-label">تاریخ انقضا<input class="form-control mt-1 ltr" type="date" name="expiresAt"></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ثبت</button></div></form>`, root => root.querySelector("#assetForm").addEventListener("submit", async event => { event.preventDefault(); await withLoading(() => api.addAsset(customer.id, readForm(event.currentTarget))); closeModal(); notify("محصول یا قرارداد به پرونده افزوده شد."); renderCustomer(customer.id); }));
  }

  async function ticketModal(customer, ticket = null) {
    const isEdit = Boolean(ticket);
    openModal(isEdit ? "ویرایش تیکت" : "ثبت تیکت", `<form id="ticketForm"><div class="crm-form-grid"><label class="form-label full">عنوان <span class="text-danger">*</span><input class="form-control mt-1" name="title" required value="${escapeHtml(ticket?.title || "")}"></label><label class="form-label">وضعیت<select class="form-select mt-1" name="status">${["باز", "در حال بررسی", "منتظر مشتری", "بسته"].map(value => `<option ${value === (ticket?.status || "باز") ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-label">اولویت<select class="form-select mt-1" name="priority">${["کم", "متوسط", "بالا", "بحرانی"].map(value => `<option ${value === (ticket?.priority || "متوسط") ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-label">شناسه سامانه بیرونی<input class="form-control mt-1 ltr" name="externalRef" value="${escapeHtml(ticket?.externalRef || "")}"></label><label class="form-label full">شرح<textarea class="form-control mt-1" rows="4" name="description">${escapeHtml(ticket?.description || "")}</textarea></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ذخیره</button></div></form>`, root => root.querySelector("#ticketForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => isEdit ? api.updateTicket(customer.id, ticket.id, input) : api.addTicket(customer.id, input)); closeModal(); notify("تیکت ذخیره شد."); renderCustomer(customer.id); }));
  }

  async function noteModal(customer) {
    openModal("افزودن یادداشت", `<form id="noteForm"><div class="crm-form-grid"><label class="form-label full">عنوان<input class="form-control mt-1" name="title" placeholder="یادداشت جلسه، پیگیری، تصمیم..."></label><label class="form-label full">متن یادداشت <span class="text-danger">*</span><textarea class="form-control mt-1" rows="6" name="detail" required></textarea></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ثبت یادداشت</button></div></form>`, root => root.querySelector("#noteForm").addEventListener("submit", async event => { event.preventDefault(); await withLoading(() => api.addCustomerNote(customer.id, readForm(event.currentTarget))); closeModal(); notify("یادداشت ثبت شد."); renderCustomer(customer.id); }));
  }

  async function opportunityModal(opportunity = null, preset = {}) {
    const customers = state.bootstrap.customers || await api.listCustomers();
    const products = state.bootstrap.products || await api.listProducts();
    const value = opportunity || preset;
    const isEdit = Boolean(opportunity);
    openModal(isEdit ? "ویرایش فرصت فروش" : "فرصت فروش جدید", `<form id="opportunityForm"><div class="crm-form-grid"><label class="form-label">مشتری <span class="text-danger">*</span><select class="form-select mt-1" name="customerId" required ${isEdit ? "disabled" : ""}>${customerOptions(customers, value.customerId)}</select></label><label class="form-label">محصول یا راهکار<select class="form-select mt-1" name="productId">${productOptions(products, value.productId)}</select></label><label class="form-label full">عنوان فرصت <span class="text-danger">*</span><input class="form-control mt-1" name="title" required value="${escapeHtml(value.title || "")}" placeholder="مثلاً تأمین تجهیزات و خدمات استقرار"></label><label class="form-label">ارزش تقریبی<input class="form-control mt-1 ltr" type="number" min="0" name="value" value="${Number(value.value || 0)}"></label><label class="form-label">تعداد/مجوز<input class="form-control mt-1 ltr" type="number" step="0.01" min="0" name="quantity" value="${Number(value.quantity || 1)}"></label><label class="form-label">مرحله<select class="form-select mt-1" name="stage">${allStages.map(stage => `<option value="${stage}" ${stage === (value.stage || "lead") ? "selected" : ""}>${stageMeta[stage].label}</option>`).join("")}</select></label><label class="form-label">احتمال موفقیت<input class="form-control mt-1 ltr" type="number" min="0" max="100" name="probability" value="${Number(value.probability ?? stageMeta[value.stage || "lead"].probability)}"></label><label class="form-label">مسئول<select class="form-select mt-1" name="ownerId">${userOptions(value.ownerId || state.bootstrap.currentUser?.id, true)}</select></label><label class="form-label">تاریخ پیش‌بینی اختتام<input class="form-control mt-1 ltr" type="date" name="expectedClose" value="${toDateInput(value.expectedClose)}"></label><label class="form-label">منبع فرصت<input class="form-control mt-1" name="source" value="${escapeHtml(value.source || "")}"></label><label class="form-label full">اقدام بعدی<textarea class="form-control mt-1" rows="2" name="nextAction">${escapeHtml(value.nextAction || "")}</textarea></label><label class="form-label full">ریسک یا مانع<textarea class="form-control mt-1" rows="2" name="risk">${escapeHtml(value.risk || "")}</textarea></label></div><div class="crm-form-actions">${isEdit ? `<button class="btn btn-outline-danger ms-auto" type="button" data-action="delete-opportunity" data-id="${opportunity.id}"><i class="fa-solid fa-trash"></i> بایگانی</button>` : ""}<button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ذخیره</button></div></form>`, root => root.querySelector("#opportunityForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); if (isEdit) delete input.customerId; const saved = await withLoading(() => isEdit ? api.updateOpportunity(opportunity.id, input) : api.createOpportunity(input)); closeModal(); notify(isEdit ? "فرصت به‌روزرسانی شد." : "فرصت جدید ثبت شد."); await refreshBadges(); if (state.currentRoute.view === "customer") renderCustomer(state.currentRoute.id); else renderOpportunities(); }));
  }

  async function taskModal(task = null, preset = {}) {
    const customers = state.bootstrap.customers || await api.listCustomers();
    const value = task || preset;
    const isEdit = Boolean(task);
    openModal(isEdit ? "ویرایش وظیفه" : "وظیفه جدید", `<form id="taskForm"><div class="crm-form-grid"><label class="form-label full">عنوان وظیفه <span class="text-danger">*</span><input class="form-control mt-1" name="title" required value="${escapeHtml(value.title || "")}"></label><label class="form-label">مشتری<select class="form-select mt-1" name="customerId">${customerOptions(customers, value.customerId, true)}</select></label><label class="form-label">مسئول<select class="form-select mt-1" name="assignedId">${userOptions(value.assigned?.id || state.bootstrap.currentUser?.id, true)}</select></label><label class="form-label">مهلت<input class="form-control mt-1 ltr" type="datetime-local" name="dueAt" value="${toDateTimeInput(value.dueAt)}"></label><label class="form-label">اولویت<select class="form-select mt-1" name="priority"><option value="high" ${value.priority === "high" ? "selected" : ""}>بالا</option><option value="medium" ${!value.priority || value.priority === "medium" ? "selected" : ""}>متوسط</option><option value="low" ${value.priority === "low" ? "selected" : ""}>کم</option></select></label>${isEdit ? `<label class="form-check full"><input class="form-check-input" type="checkbox" name="done" ${value.done ? "checked" : ""}><span class="form-check-label">انجام‌شده</span></label>` : ""}</div><div class="crm-form-actions">${isEdit ? `<button class="btn btn-outline-danger ms-auto" type="button" data-action="delete-task" data-id="${task.id}"><i class="fa-solid fa-trash"></i> حذف</button>` : ""}<button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ذخیره</button></div></form>`, root => root.querySelector("#taskForm").addEventListener("submit", async event => { event.preventDefault(); const input = readForm(event.currentTarget); await withLoading(() => isEdit ? api.updateTask(task.id, input) : api.createTask(input)); closeModal(); notify("وظیفه ذخیره شد."); await refreshBadges(); renderDashboard(); }));
  }

  async function conversationModal() {
    const customers = state.bootstrap.customers || await api.listCustomers();
    openModal("ثبت مکالمه", `<form id="conversationForm"><div class="crm-form-grid"><label class="form-label">مشتری <span class="text-danger">*</span><select class="form-select mt-1" name="customerId" id="conversationCustomer" required>${customerOptions(customers)}</select></label><label class="form-label">فرد تماس<select class="form-select mt-1" name="contactId" id="conversationContact"><option value="">بدون فرد مشخص</option></select></label><label class="form-label">کانال<select class="form-select mt-1" name="channel">${Object.entries(channelMeta).filter(([key]) => ["email", "call", "whatsapp", "meeting", "ticket", "proposal"].includes(key)).map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join("")}</select></label><label class="form-label">مسئول<select class="form-select mt-1" name="assignedId">${userOptions(state.bootstrap.currentUser?.id, true)}</select></label><label class="form-label full">موضوع <span class="text-danger">*</span><input class="form-control mt-1" name="subject" required></label><label class="form-label full">متن مکالمه <span class="text-danger">*</span><textarea class="form-control mt-1" rows="8" name="body" required></textarea></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ثبت و تحلیل اولیه</button></div></form>`, root => {
      const customerSelect = root.querySelector("#conversationCustomer");
      const contactSelect = root.querySelector("#conversationContact");
      customerSelect.addEventListener("change", async () => { contactSelect.innerHTML = '<option value="">در حال دریافت...</option>'; if (!customerSelect.value) { contactSelect.innerHTML = '<option value="">بدون فرد مشخص</option>'; return; } const customer = await api.getCustomer(customerSelect.value); contactSelect.innerHTML = `<option value="">بدون فرد مشخص</option>${array(customer.contacts).map(contact => `<option value="${contact.id}">${escapeHtml(contact.name)} — ${escapeHtml(contact.title || "")}</option>`).join("")}`; });
      root.querySelector("#conversationForm").addEventListener("submit", async event => { event.preventDefault(); const saved = await withLoading(() => api.createConversation(readForm(event.currentTarget))); closeModal(); notify("مکالمه ثبت شد."); routeTo(`conversations/${saved.id}`); });
    });
  }

  async function conversationSettingsModal(conversation) {
    openModal("وضعیت و مسئول مکالمه", `<form id="conversationSettingsForm"><div class="crm-form-grid"><label class="form-label full">موضوع<input class="form-control mt-1" name="subject" required value="${escapeHtml(conversation.subject)}"></label><label class="form-label">وضعیت<select class="form-select mt-1" name="status">${["Open", "Assigned", "Replied", "Closed"].map(value => `<option ${value === conversation.status ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-label">مسئول<select class="form-select mt-1" name="assignedId">${userOptions(conversation.assigned?.id || "", true)}</select></label></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">انصراف</button><button class="btn btn-primary" type="submit">ذخیره</button></div></form>`, root => root.querySelector("#conversationSettingsForm").addEventListener("submit", async event => { event.preventDefault(); await withLoading(() => api.updateConversation(conversation.id, readForm(event.currentTarget))); closeModal(); notify("مکالمه به‌روزرسانی شد."); renderConversations(conversation.id); }));
  }

  async function opportunityDetailModal(id) {
    const item = (await api.listOpportunities()).find(row => row.id === id);
    if (!item) return notify("فرصت پیدا نشد.", "danger");
    openModal("جزئیات فرصت فروش", `<div class="crm-detail-list"><div><span>عنوان</span><strong>${escapeHtml(item.title)}</strong></div><div><span>مشتری</span><strong>${escapeHtml(item.customer?.name || "—")}</strong></div><div><span>محصول</span><strong>${escapeHtml(item.product?.name || "—")}</strong></div><div><span>مرحله</span><strong>${escapeHtml(stageMeta[item.stage]?.label || item.stage)}</strong></div><div><span>ارزش</span><strong>${formatMoney(item.value, false)}</strong></div><div><span>احتمال</span><strong>${faNumber(item.probability)}٪</strong></div><div><span>مسئول</span><strong>${escapeHtml(item.owner?.name || "—")}</strong></div><div><span>اختتام پیش‌بینی‌شده</span><strong>${formatDate(item.expectedClose)}</strong></div><div class="full"><span>اقدام بعدی</span><strong>${escapeHtml(item.nextAction || "—")}</strong></div><div class="full"><span>ریسک</span><strong>${escapeHtml(item.risk || "—")}</strong></div></div><div class="crm-form-actions"><button class="btn btn-outline-secondary" data-action="open-customer" data-id="${item.customerId}"><i class="fa-solid fa-building"></i> مشتری</button>${canWrite() ? `<button class="btn btn-primary" data-action="edit-opportunity" data-id="${item.id}"><i class="fa-solid fa-pen"></i> ویرایش</button>` : ""}</div>`);
  }

  async function draftReplyModal(id) {
    const conversation = await api.getConversation(id);
    openModal("پاسخ پیشنهادی", `<div class="crm-form-grid"><label class="form-label">لحن<select class="form-select mt-1" id="replyTone"><option value="formal">رسمی</option><option value="short">کوتاه</option><option value="friendly">دوستانه</option><option value="support">پشتیبانی</option><option value="sales">پیگیری فروش</option></select></label><div></div><label class="form-label full">متن پاسخ<textarea id="generatedReply" class="form-control mt-1 crm-generated-text" placeholder="برای تولید پاسخ، دکمه زیر را بزنید"></textarea></label></div><div class="crm-form-actions"><button class="btn btn-outline-primary" data-action="regenerate-reply" data-id="${id}"><i class="fa-solid fa-wand-magic-sparkles"></i> تولید پاسخ</button><button class="btn btn-outline-secondary" data-action="copy-reply"><i class="fa-solid fa-copy"></i> کپی</button><button class="btn btn-primary" data-action="accept-reply" data-id="${id}"><i class="fa-solid fa-check"></i> ثبت پاسخ</button></div>`, async () => generateReplyIntoModal(conversation.id, "formal"));
  }

  async function generateReplyIntoModal(id, tone) {
    const textarea = document.getElementById("generatedReply");
    if (!textarea) return;
    textarea.value = "در حال تهیه پاسخ پیشنهادی...";
    textarea.disabled = true;
    try { textarea.value = await api.generateReply(id, tone); }
    finally { textarea.disabled = false; }
  }

  async function conversationToOpportunity(conversationId, customerId) {
    const conversation = await api.getConversation(conversationId);
    const guessedProduct = array(state.bootstrap.products).find(product => array(conversation.ai?.products).some(name => String(name).includes(product.shortName) || product.shortName.includes(String(name))));
    closeModal();
    opportunityModal(null, { customerId, productId: guessedProduct?.id, title: conversation.subject, stage: "qualification", nextAction: conversation.ai?.nextAction, risk: String(conversation.ai?.sentiment || "").includes("نارضایتی") ? conversation.ai.sentiment : "" });
  }

  /* ---------------------------------------------------------------------- */
  /* Assistant and search                                                   */
  /* ---------------------------------------------------------------------- */

  function appendAssistantMessage(role, html, links = []) {
    const message = document.createElement("div");
    message.className = `crm-ai-message ${role}`;
    message.innerHTML = html;
    if (links.length) {
      const row = document.createElement("div"); row.className = "crm-inline-actions mt-2";
      links.forEach(link => { const button = document.createElement("button"); button.className = "btn btn-sm btn-outline-primary"; button.textContent = link.label; button.addEventListener("click", () => { routeTo(link.route); closeAssistant(); }); row.appendChild(button); });
      message.appendChild(row);
    }
    dom.assistantMessages.appendChild(message); dom.assistantMessages.scrollTop = dom.assistantMessages.scrollHeight; return message;
  }

  async function askAssistant(prompt, context = state.assistantContext) {
    const clean = String(prompt || "").trim(); if (!clean) return;
    openAssistant(context); appendAssistantMessage("user", escapeHtml(clean)); dom.assistantInput.value = "";
    const loading = appendAssistantMessage("assistant loading", '<i class="fa-solid fa-circle-notch fa-spin"></i> در حال تحلیل داده‌های CRM...');
    try { const result = await api.askAssistant(clean, context || {}); loading.remove(); appendAssistantMessage("assistant", result.html, result.links || []); }
    catch (error) { loading.innerHTML = escapeHtml(error?.message || "پاسخ‌گویی با خطا مواجه شد."); }
  }

  function renderSearchResults(result) {
    const groups = [
      { title: "مشتریان", items: result.customers, icon: "fa-building", route: item => `customer/${item.id}`, label: item => item.name, sub: item => [item.industry, item.city].filter(Boolean).join(" · ") },
      { title: "فرصت‌های فروش", items: result.opportunities, icon: "fa-handshake", route: () => "opportunities", label: item => item.title, sub: item => `${item.customer?.name || ""} · ${formatMoney(item.value)}` },
      { title: "محصولات", items: result.products, icon: "fa-box-open", route: () => "products", label: item => item.shortName, sub: item => `${productTypeLabel(item.type)} · ${item.category || ""}` },
      { title: "مکالمات", items: result.conversations, icon: "fa-inbox", route: item => `conversations/${item.id}`, label: item => item.subject, sub: item => item.customer?.name || "" }
    ];
    const content = groups.filter(group => array(group.items).length).map(group => `<div class="crm-search-group-title">${group.title}</div>${group.items.map(item => `<button class="crm-search-item" data-route-target="${group.route(item)}"><i class="fa-solid ${group.icon}"></i><span><strong>${escapeHtml(group.label(item))}</strong><small>${escapeHtml(group.sub(item))}</small></span></button>`).join("")}`).join("");
    dom.searchResults.innerHTML = content || '<div class="crm-empty py-4">نتیجه‌ای پیدا نشد.</div>'; dom.searchResults.classList.remove("hidden");
  }

  function handleGlobalSearch() {
    clearTimeout(state.searchTimer); const query = dom.globalSearch.value.trim();
    if (query.length < 2) return dom.searchResults.classList.add("hidden");
    state.searchTimer = setTimeout(async () => { try { renderSearchResults(await api.search(query)); } catch (error) { console.error(error); } }, 250);
  }

  /* ---------------------------------------------------------------------- */
  /* Routing and events                                                     */
  /* ---------------------------------------------------------------------- */

  async function renderRoute() {
    const route = parseRoute(); state.currentRoute = route; activateNavigation(route.view); closeMobileMenu(); dom.searchResults.classList.add("hidden"); window.scrollTo({ top: 0, behavior: "instant" });
    try {
      switch (route.view) {
        case "dashboard": await renderDashboard(); break;
        case "customers": await renderCustomers(); break;
        case "customer": await renderCustomer(route.id); break;
        case "opportunities": await renderOpportunities(); break;
        case "conversations": await renderConversations(route.id); break;
        case "products": await renderProducts(); break;
        case "reports": await renderReports(); break;
        case "team": await renderTeam(); break;
        default: routeTo("dashboard");
      }
    } catch (error) {
      console.error(error);
      dom.view.innerHTML = `${empty("fa-circle-exclamation", error?.message || "نمای CRM بارگذاری نشد.")}<div class="text-center"><button class="btn btn-primary" data-action="reload-view">تلاش دوباره</button></div>`;
    }
  }

  async function handleViewClick(event) {
    const target = event.target.closest("[data-action]"); if (!target || target.tagName === "SELECT") return;
    const action = target.dataset.action; const id = target.dataset.id; event.preventDefault();
    switch (action) {
      case "open-customer": closeModal(); routeTo(`customer/${id}`); break;
      case "open-conversation": closeModal(); routeTo(`conversations/${id}`); break;
      case "open-opportunity": await opportunityDetailModal(id); break;
      case "new-customer": customerModal(); break;
      case "edit-customer": customerModal(await api.getCustomer(id)); break;
      case "delete-customer": if (await confirmAction("این مشتری بایگانی شود؟ اطلاعات تاریخی حذف فیزیکی نمی‌شود.")) { await withLoading(() => api.deleteCustomer(id)); closeModal(); await reloadBootstrap(); notify("مشتری بایگانی شد."); routeTo("customers"); } break;
      case "new-product": productModal(); break;
      case "edit-product": productModal(array(state.bootstrap.products).find(item => item.id === id) || (await api.listProducts()).find(item => item.id === id)); break;
      case "delete-product": if (await confirmAction("این محصول بایگانی شود؟")) { await withLoading(() => api.deleteProduct(id)); await reloadBootstrap(); notify("محصول بایگانی شد."); renderProducts(); } break;
      case "new-contact": contactModal(await api.getCustomer(target.dataset.customerId)); break;
      case "edit-contact": { const customer = await api.getCustomer(target.dataset.customerId); contactModal(customer, array(customer.contacts).find(item => item.id === id)); break; }
      case "delete-contact": if (await confirmAction("این فرد تماس حذف شود؟")) { await withLoading(() => api.deleteContact(target.dataset.customerId, id)); notify("فرد تماس حذف شد."); renderCustomer(target.dataset.customerId); } break;
      case "new-asset": assetModal(await api.getCustomer(target.dataset.customerId)); break;
      case "delete-asset": if (await confirmAction("این محصول یا قرارداد از پرونده حذف شود؟")) { await withLoading(() => api.deleteAsset(target.dataset.customerId, id)); notify("از پرونده حذف شد."); renderCustomer(target.dataset.customerId); } break;
      case "new-ticket": ticketModal(await api.getCustomer(target.dataset.customerId)); break;
      case "edit-ticket": { const customer = await api.getCustomer(target.dataset.customerId); ticketModal(customer, array(customer.tickets).find(item => item.id === id)); break; }
      case "new-note": noteModal(await api.getCustomer(target.dataset.customerId)); break;
      case "generate-customer-summary": await withLoading(() => api.generateCustomerSummary(id)); notify("خلاصه پرونده به‌روزرسانی شد."); renderCustomer(id); break;
      case "new-opportunity": opportunityModal(null, { customerId: target.dataset.customerId, productId: target.dataset.productId }); break;
      case "edit-opportunity": { const opportunity = (await api.listOpportunities()).find(item => item.id === id); closeModal(); opportunityModal(opportunity); break; }
      case "delete-opportunity": if (await confirmAction("این فرصت بایگانی شود؟")) { await withLoading(() => api.deleteOpportunity(id)); closeModal(); notify("فرصت بایگانی شد."); await refreshBadges(); renderOpportunities(); } break;
      case "new-task": taskModal(null, { customerId: target.dataset.customerId }); break;
      case "edit-task": { const task = (await api.listTasks(true)).find(item => item.id === id); taskModal(task); break; }
      case "delete-task": if (await confirmAction("این وظیفه حذف شود؟")) { await withLoading(() => api.deleteTask(id)); closeModal(); notify("وظیفه حذف شد."); renderDashboard(); } break;
      case "toggle-task": await withLoading(() => api.toggleTask(id)); notify("وضعیت وظیفه به‌روزرسانی شد."); await renderDashboard(); break;
      case "new-conversation": conversationModal(); break;
      case "edit-conversation": conversationSettingsModal(await api.getConversation(id)); break;
      case "analyze-conversation": await withLoading(() => api.analyzeConversation(id)); notify("تحلیل مکالمه به‌روزرسانی شد."); renderConversations(id); break;
      case "draft-reply": draftReplyModal(id); break;
      case "conversation-to-opportunity": conversationToOpportunity(id, target.dataset.customerId); break;
      case "close-mobile-reader": routeTo("conversations"); break;
      case "clear-customer-filters": state.customerFilters = { query: "", health: "", tier: "" }; renderCustomers(); break;
      case "reload-view": renderRoute(); break;
      case "close-modal": closeModal(); break;
      case "copy-reply": { const textarea = document.getElementById("generatedReply"); await navigator.clipboard.writeText(textarea?.value || ""); notify("متن کپی شد."); break; }
      case "accept-reply": { const textarea = document.getElementById("generatedReply"); const text = textarea?.value?.trim(); if (!text) return notify("متن پاسخ خالی است.", "warning"); await withLoading(() => api.saveReply(id, text)); closeModal(); notify("پاسخ در پرونده ثبت شد."); renderConversations(id); break; }
      case "regenerate-reply": generateReplyIntoModal(id, document.getElementById("replyTone")?.value || "formal"); break;
      case "remove-member": if (await confirmAction(`دسترسی ${target.dataset.name || "این کاربر"} حذف شود؟`)) { await withLoading(() => api.removeTeamMember(id)); await reloadBootstrap(); notify("دسترسی عضو حذف شد."); renderTeam(); } break;
      default: break;
    }
  }

  async function handleViewChange(event) {
    const target = event.target.closest("[data-action]"); if (!target) return;
    if (target.dataset.action === "change-stage") { await withLoading(() => api.updateOpportunityStage(target.dataset.id, target.value)); notify("مرحله فرصت به‌روزرسانی شد."); renderOpportunities(); }
    if (target.dataset.action === "change-member-role") { await withLoading(() => api.updateTeamMember(target.dataset.id, { role: target.value })); await reloadBootstrap(); notify("نقش عضو تغییر کرد."); renderTeam(); }
  }

  function bindEvents() {
    window.addEventListener("hashchange", renderRoute);
    dom.view.addEventListener("click", handleViewClick); dom.view.addEventListener("change", handleViewChange); dom.modalBody.addEventListener("click", handleViewClick);
    document.addEventListener("click", event => {
      const aiButton = event.target.closest("[data-ai-prompt]");
      if (aiButton) { event.preventDefault(); const context = aiButton.dataset.customerId ? { customerId: aiButton.dataset.customerId, customerName: aiButton.dataset.customerName } : state.assistantContext; askAssistant(aiButton.dataset.aiPrompt, context); }
      const routeButton = event.target.closest("[data-route-target]");
      if (routeButton) { routeTo(routeButton.dataset.routeTarget); dom.searchResults.classList.add("hidden"); dom.globalSearch.value = ""; }
      if (!event.target.closest(".crm-global-search-wrap")) dom.searchResults.classList.add("hidden");
    });
    dom.btnMenu.addEventListener("click", () => { dom.sidebar.classList.add("open"); dom.mobileBackdrop.classList.add("open"); }); dom.mobileBackdrop.addEventListener("click", closeMobileMenu);
    document.getElementById("btnOpenAssistant").addEventListener("click", () => openAssistant(state.assistantContext)); document.getElementById("btnSidebarAssistant").addEventListener("click", () => openAssistant(state.assistantContext)); document.getElementById("btnCloseAssistant").addEventListener("click", closeAssistant); dom.assistantBackdrop.addEventListener("click", closeAssistant);
    dom.assistantForm.addEventListener("submit", event => { event.preventDefault(); askAssistant(dom.assistantInput.value, state.assistantContext); }); dom.globalSearch.addEventListener("input", handleGlobalSearch);
    document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); dom.globalSearch.focus(); } if (event.key === "Escape") { closeAssistant(); closeMobileMenu(); if (!dom.modalBackdrop.classList.contains("hidden")) closeModal(); } });
    document.getElementById("btnCloseCrmModal").addEventListener("click", closeModal); dom.modalBackdrop.addEventListener("click", event => { if (event.target === dom.modalBackdrop) closeModal(); });
  }

  async function initAuth() {
    if (typeof setupAuth !== "function") throw new Error("زیرساخت احراز هویت در دسترس نیست");
    auth = await setupAuth("rag", true, "crm");
    if (!auth?.token()) throw new Error("برای استفاده از CRM باید وارد سامانه شوید");
  }

  async function init() {
    bindEvents(); await initAuth(); await reloadBootstrap();
    if (!location.hash) location.hash = "dashboard"; else await renderRoute();
  }

  window.crmApp = { api, routeTo, renderRoute, openAssistant, newOpportunityModal: preset => opportunityModal(null, preset), newTaskModal: preset => taskModal(null, preset) };
  init().catch(error => { console.error(error); dom.view.innerHTML = empty("fa-circle-exclamation", error?.message || "راه‌اندازی CRM با خطا مواجه شد."); });
})();

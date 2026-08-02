(function () {
  "use strict";

  const api = window.createCrmApi({ delay: 160 });
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
  const channelMeta = {
    email: { label: "ایمیل", icon: "fa-envelope" },
    call: { label: "تماس", icon: "fa-phone" },
    whatsapp: { label: "پیام", icon: "fa-message" },
    meeting: { label: "جلسه", icon: "fa-users" },
    ticket: { label: "تیکت", icon: "fa-ticket" },
    proposal: { label: "پیشنهاد", icon: "fa-file-signature" }
  };
  const roleMeta = {
    sales: { name: "سارا محمدی", title: "کارشناس فروش سازمانی", avatar: "س‌م" },
    manager: { name: "رضا شریفی", title: "مدیر فروش", avatar: "ر‌ش" },
    support: { name: "مریم احمدی", title: "کارشناس خدمات مشتریان", avatar: "م‌ا" }
  };

  const state = {
    role: localStorage.getItem("fapco-crm-role") || "sales",
    bootstrap: null,
    currentRoute: { view: "dashboard", id: null },
    customerFilters: { query: "", health: "", tier: "" },
    productFilter: "all",
    opportunityFilter: "all",
    assistantContext: {},
    searchTimer: null
  };

  const dom = {
    view: document.getElementById("crmView"),
    main: document.getElementById("crmMain"),
    sidebar: document.getElementById("crmSidebar"),
    mobileBackdrop: document.getElementById("crmMobileBackdrop"),
    btnMenu: document.getElementById("btnCrmMenu"),
    roleSelector: document.getElementById("crmRoleSelector"),
    currentUser: document.getElementById("crmCurrentUser"),
    currentRole: document.getElementById("crmCurrentRole"),
    avatar: document.querySelector(".crm-sidebar-profile .crm-avatar"),
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

  function formatMoney(value, compact = true) {
    const number = Number(value || 0);
    if (!compact) return `${faNumber(number)} تومان`;
    if (number >= 1000000000) {
      const amount = Math.round(number / 100000000) / 10;
      return `${faNumber(amount, { maximumFractionDigits: 1 })} میلیارد تومان`;
    }
    if (number >= 1000000) {
      const amount = Math.round(number / 100000) / 10;
      return `${faNumber(amount, { maximumFractionDigits: 1 })} میلیون تومان`;
    }
    return `${faNumber(number)} تومان`;
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
    return date.toLocaleDateString("fa-IR", { calendar: "persian", month: "short", day: "numeric" });
  }

  function initials(name = "") {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  }

  function healthClass(value) {
    if (value < 65) return "danger";
    if (value < 80) return "warning";
    return "";
  }

  function productTypeLabel(type) {
    return type === "hardware" ? "سخت‌افزار" : "نرم‌افزار";
  }

  function notify(message, type = "success") {
    if (typeof window.toast === "function") window.toast(message, type);
    else console.log(`[${type}] ${message}`);
  }

  function showLoading(show = true) {
    document.getElementById("loading")?.classList.toggle("hidden", !show);
  }

  async function withLoading(work) {
    showLoading(true);
    try {
      return await work();
    } catch (error) {
      console.error(error);
      notify(error?.message || "خطا در اجرای عملیات", "danger");
      throw error;
    } finally {
      showLoading(false);
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
    document.querySelectorAll(".crm-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.route === navView);
    });
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
    const label = context.customerName
      ? `مشتری: ${context.customerName}`
      : context.conversationSubject
        ? `مکالمه: ${context.conversationSubject}`
        : "کل سامانه";
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

  function pageHeader(title, subtitle, actions = "") {
    return `
      <header class="crm-page-header">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="crm-header-actions">${actions}</div>
      </header>`;
  }

  function kpiCard(label, value, note, icon, modifier = "", noteClass = "") {
    return `
      <article class="crm-kpi">
        <div>
          <div class="crm-kpi-label">${label}</div>
          <div class="crm-kpi-value fa-num">${value}</div>
          <div class="crm-kpi-note ${noteClass}">${note}</div>
        </div>
        <div class="crm-kpi-icon ${modifier}"><i class="fa-solid ${icon}"></i></div>
      </article>`;
  }

  function channelIcon(channel) {
    return channelMeta[channel] || { label: "تعامل", icon: "fa-message" };
  }

  function roleBrief(data) {
    const { kpis } = data;
    if (state.role === "manager") {
      return `سبد فعال فروش فاپا ${formatMoney(kpis.pipelineValue)} ارزش دارد و ارزش وزنی آن ${formatMoney(kpis.weightedPipeline)} است. تمرکز مدیریتی امروز باید بر نهایی‌سازی خرید ترمینال‌های پایا، رفع ابهام قرارداد SecureBox و مداخله مستقیم در تمدید Service Desk داده‌پرداز خاور باشد.`;
    }
    if (state.role === "support") {
      return `دو مشتری امتیاز سلامت زیر ۶۵ دارند. آریا فولاد هم‌زمان دو تیکت باز و یک فرصت فروش مهم دارد؛ بنابراین رسیدگی سریع به تعهدات پشتیبانی مستقیماً بر فروش SecureBox اثر می‌گذارد. داده‌پرداز خاور نیز قبل از مذاکره تمدید به گزارش استفاده و برنامه بهبود نیاز دارد.`;
    }
    return `امروز ${faNumber(kpis.taskCount)} اقدام باز دارید. پیشنهاد SecureBox آریا فولاد مهلت نزدیک دارد، تمدید Service Desk داده‌پرداز خاور در معرض ریزش است و خرید ۶۰ ترمینال پایا T8 با ارسال برنامه نصب می‌تواند وارد مرحله نهایی شود.`;
  }

  async function renderDashboard() {
    const data = await withLoading(() => api.getDashboard(state.role));
    updateBadges(data.kpis);
    state.assistantContext = {};

    const taskRows = data.tasks.map((task) => `
      <div class="crm-task-item ${task.done ? "done" : ""}" data-task-id="${task.id}">
        <button class="crm-task-check" data-action="toggle-task" data-id="${task.id}" title="انجام شد">
          <i class="fa-solid fa-check"></i>
        </button>
        <div class="crm-task-info">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${escapeHtml(task.customer?.name || "بدون مشتری")} · ${formatDate(task.dueAt, true)}</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary" data-action="open-customer" data-id="${task.customerId}" title="پرونده مشتری">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      </div>`).join("");

    const opportunityRows = data.opportunities.map((item) => `
      <tr data-action="open-opportunity" data-id="${item.id}">
        <td><div class="crm-customer-cell"><span class="crm-customer-logo">${escapeHtml(item.customer.short)}</span><span><strong>${escapeHtml(item.customer.name)}</strong><small>${escapeHtml(item.title)}</small></span></div></td>
        <td><span class="badge ${item.product.type === "hardware" ? "text-bg-info" : "text-bg-primary"}">${productTypeLabel(item.product.type)}</span> ${escapeHtml(item.product.shortName)}</td>
        <td>${stageMeta[item.stage]?.label || item.stage}</td>
        <td class="fa-num fw-bold">${formatMoney(item.value)}</td>
        <td><span class="crm-health ${item.probability < 50 ? "danger" : item.probability < 75 ? "warning" : ""}"><i class="crm-health-dot"></i>${faNumber(item.probability)}٪</span></td>
      </tr>`).join("");

    const conversationRows = data.conversations.map((item) => {
      const channel = channelIcon(item.channel);
      return `
        <button class="crm-list-item w-100 text-start border-0 bg-transparent" data-action="open-conversation" data-id="${item.id}">
          <span class="crm-channel-icon"><i class="fa-solid ${channel.icon}"></i></span>
          <span class="crm-list-item-main"><strong>${escapeHtml(item.customer?.name || "")}</strong><span>${escapeHtml(item.subject)}</span></span>
          <span class="crm-list-item-time">${formatShortDate(item.createdAt)}</span>
        </button>`;
    }).join("");

    const riskRows = data.atRiskCustomers.map((customer) => `
      <div class="crm-list-item">
        <span class="crm-customer-logo">${escapeHtml(customer.short)}</span>
        <span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.nextAction)}</span></span>
        <button class="btn btn-sm btn-outline-danger" data-action="open-customer" data-id="${customer.id}">${faNumber(customer.health)}</button>
      </div>`).join("");

    const maxProduct = Math.max(...data.productPipeline.map((item) => item.value), 1);
    const productRows = data.productPipeline.map((item) => `
      <div class="crm-bar-row">
        <span>${escapeHtml(item.name)}</span>
        <span class="crm-bar-track"><span style="width:${Math.max(8, item.value / maxProduct * 100)}%"></span></span>
        <strong class="fa-num">${formatMoney(item.value)}</strong>
      </div>`).join("");

    dom.view.innerHTML = `
      ${pageHeader(
        state.role === "manager" ? "نمای مدیریتی فروش" : state.role === "support" ? "سلامت مشتریان و تعهدات امروز" : "امروز در فروش فاپا",
        "مرور اقدام‌های ضروری، فرصت‌های نرم‌افزاری و سخت‌افزاری و تعاملات مشتریان",
        `<button class="btn btn-outline-primary" data-action="new-task"><i class="fa-solid fa-list-check"></i> وظیفه جدید</button>
         <button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> فرصت فروش جدید</button>`
      )}

      <section class="crm-kpi-grid">
        ${kpiCard("ارزش سبد فعال", formatMoney(data.kpis.pipelineValue), `ارزش وزنی: ${formatMoney(data.kpis.weightedPipeline)}`, "fa-sack-dollar")}
        ${kpiCard("فرصت‌های فعال", faNumber(data.kpis.activeCount), "ترکیبی از نرم‌افزار، سخت‌افزار و خدمات", "fa-handshake", "success")}
        ${kpiCard("پیگیری‌های باز", faNumber(data.kpis.taskCount), "۲ اقدام دارای اولویت بالا", "fa-list-check", "warning", "bad")}
        ${kpiCard("مشتریان در معرض ریسک", faNumber(data.kpis.riskCount), "ریزش یا افت سلامت رابطه", "fa-triangle-exclamation", "danger", "bad")}
      </section>

      <section class="crm-ai-brief mb-3">
        <div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><strong>جمع‌بندی هوشمند</strong></div>
        <p>${roleBrief(data)}</p>
        <div class="crm-inline-actions">
          <button class="btn btn-sm btn-primary" data-ai-prompt="امروز بهتر است با چه مشتریانی تماس بگیرم؟"><i class="fa-solid fa-phone"></i> اولویت تماس‌ها</button>
          <button class="btn btn-sm btn-outline-primary" data-ai-prompt="کدام فرصت‌های فروش در خطر از دست رفتن‌اند؟"><i class="fa-solid fa-triangle-exclamation"></i> تحلیل ریسک فروش</button>
          <button class="btn btn-sm btn-outline-primary" data-ai-prompt="بهترین فرصت‌های فروش مکمل کدام‌اند؟"><i class="fa-solid fa-puzzle-piece"></i> فروش مکمل</button>
        </div>
      </section>

      <div class="crm-grid-2">
        <div class="crm-stack">
          <section class="crm-card">
            <div class="crm-card-body">
              <div class="crm-section-head"><h2 class="crm-section-title">فرصت‌های مهم</h2><a href="#opportunities" class="small">مشاهده برد فروش</a></div>
              <div class="crm-table-wrap">
                <table class="crm-table">
                  <thead><tr><th>مشتری و فرصت</th><th>محصول</th><th>مرحله</th><th>ارزش</th><th>احتمال</th></tr></thead>
                  <tbody>${opportunityRows}</tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="crm-card">
            <div class="crm-card-body">
              <div class="crm-section-head"><h2 class="crm-section-title">سبد فروش به تفکیک محصول</h2><a href="#reports" class="small">گزارش کامل</a></div>
              <div class="crm-bar-chart">${productRows}</div>
            </div>
          </section>
        </div>

        <div class="crm-stack">
          <section class="crm-card">
            <div class="crm-card-body">
              <div class="crm-section-head"><h2 class="crm-section-title">اقدام‌های امروز و نزدیک</h2><button class="btn btn-sm btn-outline-primary" data-action="new-task"><i class="fa-solid fa-plus"></i></button></div>
              <div>${taskRows || `<div class="crm-empty">وظیفه بازی وجود ندارد.</div>`}</div>
            </div>
          </section>

          <section class="crm-card">
            <div class="crm-card-body">
              <div class="crm-section-head"><h2 class="crm-section-title">آخرین مکالمات</h2><a href="#conversations" class="small">ورودی یکپارچه</a></div>
              <div class="crm-list">${conversationRows}</div>
            </div>
          </section>

          <section class="crm-card">
            <div class="crm-card-body">
              <div class="crm-section-head"><h2 class="crm-section-title">مشتریان نیازمند توجه</h2><a href="#customers" class="small">همه مشتریان</a></div>
              <div class="crm-list">${riskRows || `<div class="crm-empty">مشتری پرریسکی وجود ندارد.</div>`}</div>
            </div>
          </section>
        </div>
      </div>`;
  }

  async function renderCustomers() {
    const customers = await withLoading(() => api.listCustomers(state.customerFilters));
    state.assistantContext = {};
    const tiers = ["مشتری کلیدی", "سازمانی", "متوسط", "دولتی"];
    const rows = customers.map((customer) => {
      const activeValue = customer.opportunities.reduce((sum, item) => sum + item.value, 0);
      return `
        <tr data-action="open-customer" data-id="${customer.id}">
          <td><div class="crm-customer-cell"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.industry)} · ${escapeHtml(customer.city)}</small></span></div></td>
          <td><span class="badge text-bg-secondary">${escapeHtml(customer.tier)}</span></td>
          <td><span class="crm-health ${healthClass(customer.health)}"><i class="crm-health-dot"></i>${faNumber(customer.health)} از ۱۰۰</span></td>
          <td>${formatShortDate(customer.lastInteraction)}</td>
          <td class="fa-num">${formatMoney(activeValue)}</td>
          <td>${escapeHtml(customer.owner?.name || "—")}</td>
          <td><span class="text-muted">${escapeHtml(customer.nextAction)}</span></td>
          <td><button class="btn btn-sm btn-outline-secondary" data-action="open-customer" data-id="${customer.id}"><i class="fa-solid fa-chevron-left"></i></button></td>
        </tr>`;
    }).join("");

    dom.view.innerHTML = `
      ${pageHeader("مشتریان", "پرونده یکپارچه مشتریان خریدار محصولات، خدمات و راهکارهای فاپا", `<button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> ثبت فرصت برای مشتری</button>`)}
      <section class="crm-filterbar">
        <i class="fa-solid fa-filter text-muted"></i>
        <input class="form-control" id="customerSearchInput" value="${escapeHtml(state.customerFilters.query)}" placeholder="نام مشتری، صنعت، شهر یا برچسب..." />
        <select class="form-select" id="customerHealthFilter">
          <option value="">همه وضعیت‌ها</option>
          <option value="risk" ${state.customerFilters.health === "risk" ? "selected" : ""}>در معرض ریسک</option>
          <option value="healthy" ${state.customerFilters.health === "healthy" ? "selected" : ""}>سلامت بالا</option>
        </select>
        <select class="form-select" id="customerTierFilter">
          <option value="">همه گروه‌ها</option>
          ${tiers.map((tier) => `<option value="${tier}" ${state.customerFilters.tier === tier ? "selected" : ""}>${tier}</option>`).join("")}
        </select>
        ${(state.customerFilters.query || state.customerFilters.health || state.customerFilters.tier) ? `<button class="btn btn-sm btn-outline-danger" data-action="clear-customer-filters"><i class="fa-solid fa-xmark"></i> پاک‌کردن</button>` : ""}
      </section>
      <section class="crm-card crm-card-flat">
        <div class="crm-table-wrap">
          <table class="crm-table">
            <thead><tr><th>مشتری</th><th>گروه</th><th>سلامت رابطه</th><th>آخرین تعامل</th><th>فرصت فعال</th><th>مسئول حساب</th><th>اقدام بعدی</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="8"><div class="crm-empty"><i class="fa-solid fa-building"></i>مشتری مطابق این فیلتر پیدا نشد.</div></td></tr>`}</tbody>
          </table>
        </div>
      </section>`;

    const queryInput = document.getElementById("customerSearchInput");
    const healthFilter = document.getElementById("customerHealthFilter");
    const tierFilter = document.getElementById("customerTierFilter");
    let timer;
    queryInput?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.customerFilters.query = queryInput.value.trim();
        renderCustomers();
      }, 350);
    });
    healthFilter?.addEventListener("change", () => {
      state.customerFilters.health = healthFilter.value;
      renderCustomers();
    });
    tierFilter?.addEventListener("change", () => {
      state.customerFilters.tier = tierFilter.value;
      renderCustomers();
    });
  }

  async function renderCustomer(customerId) {
    const customer = await withLoading(() => api.getCustomer(customerId));
    if (!customer) {
      dom.view.innerHTML = `<div class="crm-empty"><i class="fa-solid fa-building"></i>پرونده مشتری پیدا نشد.</div>`;
      return;
    }
    state.assistantContext = { customerId: customer.id, customerName: customer.name };
    const activeValue = customer.opportunities.reduce((sum, item) => sum + item.value, 0);
    const contactRows = customer.contacts.map((contact) => `
      <div class="crm-contact">
        <span class="crm-avatar">${escapeHtml(initials(contact.name))}</span>
        <span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.title)} · ${escapeHtml(contact.decisionRole)}</small></span>
        <div class="d-flex gap-1"><a class="btn btn-sm btn-outline-secondary" href="tel:${escapeHtml(contact.phone)}" title="تماس"><i class="fa-solid fa-phone"></i></a><a class="btn btn-sm btn-outline-secondary" href="mailto:${escapeHtml(contact.email)}" title="ایمیل"><i class="fa-solid fa-envelope"></i></a></div>
      </div>`).join("");

    const assetRows = customer.assets.map((asset) => `
      <div class="crm-product-asset">
        <i class="fa-solid ${asset.product?.icon || "fa-box"}"></i>
        <span><strong>${escapeHtml(asset.product?.shortName || "محصول")}</strong><small>${asset.product?.type === "hardware" ? `${faNumber(asset.quantity)} دستگاه` : `${faNumber(asset.quantity)} کاربر/مجوز`} · ${escapeHtml(asset.contract)}</small></span>
        <span class="badge text-bg-success">${escapeHtml(asset.status)}</span>
      </div>`).join("");

    const activityRows = customer.activities.map((activity) => {
      const meta = channelIcon(activity.type);
      return `
        <div class="crm-timeline-item">
          <span class="crm-timeline-icon"><i class="fa-solid ${meta.icon}"></i></span>
          <div class="crm-timeline-content">
            <div class="crm-timeline-meta"><strong>${escapeHtml(activity.title)}</strong><span>${formatDate(activity.createdAt, true)}</span></div>
            <p>${escapeHtml(activity.detail)}</p>
          </div>
        </div>`;
    }).join("");

    const oppRows = customer.opportunities.map((item) => {
      const product = state.bootstrap.products.find((product) => product.id === item.productId);
      return `
        <tr data-action="open-opportunity" data-id="${item.id}">
          <td><strong>${escapeHtml(item.title)}</strong></td>
          <td>${escapeHtml(product?.shortName || "—")}</td>
          <td>${stageMeta[item.stage]?.label || item.stage}</td>
          <td class="fa-num">${formatMoney(item.value)}</td>
          <td>${faNumber(item.probability)}٪</td>
          <td><button class="btn btn-sm btn-outline-secondary" data-action="open-opportunity" data-id="${item.id}"><i class="fa-solid fa-chevron-left"></i></button></td>
        </tr>`;
    }).join("");

    const tickets = (customer.tickets || []).map((ticket) => `
      <div class="crm-list-item">
        <span class="crm-channel-icon"><i class="fa-solid fa-ticket"></i></span>
        <span class="crm-list-item-main"><strong>${escapeHtml(ticket.title)}</strong><span>${formatShortDate(ticket.createdAt)} · اولویت ${escapeHtml(ticket.priority)}</span></span>
        <span class="badge ${ticket.status === "باز" ? "text-bg-danger" : ticket.status === "بسته" ? "text-bg-success" : "text-bg-warning"}">${escapeHtml(ticket.status)}</span>
      </div>`).join("");

    dom.view.innerHTML = `
      ${pageHeader(`<a href="#customers" class="small ms-2"><i class="fa-solid fa-arrow-right"></i></a> پرونده مشتری`, "نمای ۳۶۰ درجه از خرید، محصولات مستقر، مکالمات، خدمات و فرصت‌های فروش", `<button class="btn btn-outline-primary" data-action="new-task" data-customer-id="${customer.id}"><i class="fa-solid fa-list-check"></i> ایجاد پیگیری</button><button class="btn btn-primary" data-action="new-opportunity" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i> فرصت جدید</button>`)}

      <section class="crm-card crm-customer-hero">
        <div class="crm-customer-identity">
          <span class="crm-customer-logo">${escapeHtml(customer.short)}</span>
          <div><h1>${escapeHtml(customer.name)}</h1><p>${escapeHtml(customer.industry)} · ${escapeHtml(customer.city)} · مسئول: ${escapeHtml(customer.owner?.name || "—")}</p><div class="mt-2">${customer.tags.map((tag) => `<span class="badge text-bg-secondary ms-1">${escapeHtml(tag)}</span>`).join("")}</div></div>
        </div>
        <div class="crm-customer-metric"><small>سلامت رابطه</small><strong class="${healthClass(customer.health) === "danger" ? "text-danger" : healthClass(customer.health) === "warning" ? "text-warning" : "text-success"}">${faNumber(customer.health)} از ۱۰۰</strong></div>
        <div class="crm-customer-metric"><small>ارزش رابطه</small><strong>${formatMoney(customer.lifetimeValue)}</strong></div>
        <div class="crm-customer-metric"><small>فرصت فعال</small><strong>${formatMoney(activeValue)}</strong></div>
        <div class="crm-customer-metric"><small>تمدید بعدی</small><strong>${formatShortDate(customer.renewalDate)}</strong></div>
      </section>

      <section class="crm-ai-brief mb-3">
        <div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><strong>خلاصه هوشمند پرونده</strong></div>
        <p>${escapeHtml(customer.aiSummary)}</p>
        <div class="crm-inline-actions">
          <button class="btn btn-sm btn-primary" data-ai-prompt="وضعیت این مشتری را تحلیل کن" data-customer-id="${customer.id}" data-customer-name="${escapeHtml(customer.name)}"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل عمیق‌تر</button>
          <button class="btn btn-sm btn-outline-primary" data-action="draft-customer-email" data-id="${customer.id}"><i class="fa-solid fa-envelope"></i> تهیه ایمیل پیگیری</button>
        </div>
      </section>

      <nav class="crm-tabs">
        <button class="crm-tab active">نمای کلی</button><button class="crm-tab">تعاملات</button><button class="crm-tab">فرصت‌ها</button><button class="crm-tab">محصولات و قراردادها</button><button class="crm-tab">تیکت‌ها</button>
      </nav>

      <div class="crm-grid-2">
        <div class="crm-stack">
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">فرصت‌های فروش</h2><button class="btn btn-sm btn-outline-primary" data-action="new-opportunity" data-customer-id="${customer.id}"><i class="fa-solid fa-plus"></i></button></div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>عنوان</th><th>محصول</th><th>مرحله</th><th>ارزش</th><th>احتمال</th><th></th></tr></thead><tbody>${oppRows || `<tr><td colspan="6"><div class="crm-empty">فرصت فعالی ثبت نشده است.</div></td></tr>`}</tbody></table></div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">خط زمانی تعاملات</h2><a href="#conversations" class="small">مرکز مکالمات</a></div><div class="crm-timeline">${activityRows || `<div class="crm-empty">تعاملی ثبت نشده است.</div>`}</div></div></section>
        </div>
        <div class="crm-stack">
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">محصولات و خدمات فعال</h2></div><div class="crm-product-assets">${assetRows || `<div class="crm-empty">محصول فعالی ثبت نشده است.</div>`}</div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">افراد کلیدی</h2></div><div class="crm-contact-list">${contactRows}</div></div></section>
          <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">تیکت‌های خدمات</h2></div><div>${tickets || `<div class="crm-empty">تیکت بازی وجود ندارد.</div>`}</div></div></section>
          <section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">اقدام بعدی</h2><div class="alert alert-primary mb-0"><strong>${escapeHtml(customer.nextAction)}</strong><div class="small mt-2">موعد: ${formatDate(customer.nextActionDue, true)}</div></div></div></section>
        </div>
      </div>`;
  }

  async function renderOpportunities() {
    let opportunities = await withLoading(() => api.listOpportunities());
    if (state.opportunityFilter !== "all") opportunities = opportunities.filter((item) => item.product?.type === state.opportunityFilter);
    state.assistantContext = {};

    const columns = activeStages.map((stage) => {
      const items = opportunities.filter((item) => item.stage === stage);
      const total = items.reduce((sum, item) => sum + item.value, 0);
      const cards = items.map((item) => `
        <article class="crm-opportunity-card ${item.risk ? "is-risk" : ""}" draggable="true" data-opportunity-id="${item.id}" data-action="open-opportunity" data-id="${item.id}">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="crm-opportunity-customer">${escapeHtml(item.customer.name)}</div>
          <div class="crm-opportunity-product"><i class="fa-solid ${item.product.icon}"></i><span>${escapeHtml(item.product.shortName)} · ${productTypeLabel(item.product.type)}</span></div>
          <div class="crm-opportunity-meta"><strong class="crm-opportunity-value">${formatMoney(item.value)}</strong><span class="crm-probability"><span class="crm-probability-bar"><i style="width:${item.probability}%"></i></span>${faNumber(item.probability)}٪</span></div>
          <div class="small text-muted mt-2">بستن: ${formatShortDate(item.expectedClose)}</div>
          ${item.risk ? `<div class="crm-opportunity-warning"><i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(item.risk)}</span></div>` : ""}
          <div class="crm-stage-mobile"><select class="form-select form-select-sm" data-action="change-stage" data-id="${item.id}">${activeStages.map((key) => `<option value="${key}" ${key === item.stage ? "selected" : ""}>${stageMeta[key].label}</option>`).join("")}</select></div>
        </article>`).join("");
      return `
        <section class="crm-kanban-column" data-stage="${stage}">
          <header class="crm-kanban-header"><strong>${stageMeta[stage].label} <span class="badge text-bg-secondary">${faNumber(items.length)}</span></strong><span>${formatMoney(total)}</span></header>
          <div class="crm-kanban-cards">${cards || `<div class="crm-empty py-4">فرصتی نیست</div>`}</div>
        </section>`;
    }).join("");

    const total = opportunities.reduce((sum, item) => sum + item.value, 0);
    dom.view.innerHTML = `
      ${pageHeader("فرصت‌های فروش", "مدیریت چرخه فروش نرم‌افزار، سخت‌افزار، استقرار و پشتیبانی", `<select id="opportunityTypeFilter" class="form-select"><option value="all">همه محصولات</option><option value="hardware" ${state.opportunityFilter === "hardware" ? "selected" : ""}>فقط سخت‌افزار</option><option value="software" ${state.opportunityFilter === "software" ? "selected" : ""}>فقط نرم‌افزار</option></select><button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> فرصت جدید</button>`)}
      <div class="d-flex flex-wrap gap-2 mb-3"><span class="crm-filter-chip"><i class="fa-solid fa-sack-dollar"></i> ارزش نمای فعلی: ${formatMoney(total)}</span><span class="crm-filter-chip"><i class="fa-solid fa-hand-pointer"></i> کارت‌ها را بین مراحل جابه‌جا کنید</span></div>
      <div class="crm-kanban">${columns}</div>`;

    document.getElementById("opportunityTypeFilter")?.addEventListener("change", (event) => {
      state.opportunityFilter = event.target.value;
      renderOpportunities();
    });
    setupKanban();
  }

  function setupKanban() {
    let draggedId = null;
    document.querySelectorAll(".crm-opportunity-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        draggedId = card.dataset.opportunityId;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
      });
      card.addEventListener("dragend", () => {
        draggedId = null;
        document.querySelectorAll(".crm-kanban-column").forEach((column) => column.classList.remove("drag-over"));
      });
    });
    document.querySelectorAll(".crm-kanban-column").forEach((column) => {
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        const id = draggedId || event.dataTransfer.getData("text/plain");
        const stage = column.dataset.stage;
        if (!id || !stage) return;
        await withLoading(() => api.updateOpportunityStage(id, stage));
        notify(`فرصت به مرحله «${stageMeta[stage].label}» منتقل شد.`);
        renderOpportunities();
      });
    });
  }

  async function renderConversations(conversationId) {
    const conversations = await withLoading(() => api.listConversations());
    const selectedId = conversationId || (window.innerWidth > 720 ? conversations[0]?.id : null);
    const selected = selectedId ? await api.getConversation(selectedId) : null;
    if (selected) state.assistantContext = { conversationId: selected.id, conversationSubject: selected.subject, customerId: selected.customerId, customerName: selected.customer?.name };

    const list = conversations.map((item) => {
      const channel = channelIcon(item.channel);
      return `
        <button class="crm-conversation-item ${item.id === selectedId ? "active" : ""} ${item.unread ? "unread" : ""}" data-action="open-conversation" data-id="${item.id}">
          <span class="crm-channel-icon"><i class="fa-solid ${channel.icon}"></i></span>
          <span class="crm-conversation-item-main"><strong>${escapeHtml(item.customer?.name || "")}</strong><span>${escapeHtml(item.subject)}</span><span>${escapeHtml(item.preview)}</span></span>
          <span class="crm-conversation-item-time">${formatShortDate(item.createdAt)}</span>
        </button>`;
    }).join("");

    const reader = selected ? `
      <div class="crm-conversation-reader-header">
        <button class="btn btn-sm btn-outline-secondary mb-2 d-md-none" data-action="close-mobile-reader"><i class="fa-solid fa-arrow-right"></i> بازگشت به فهرست</button>
        <div class="d-flex justify-content-between gap-3"><span class="badge text-bg-primary">${channelIcon(selected.channel).label}</span><span class="small text-muted">${formatDate(selected.createdAt, true)}</span></div>
        <h2>${escapeHtml(selected.subject)}</h2>
        <div class="small text-muted">از طرف ${escapeHtml(selected.contact?.name || "—")} · ${escapeHtml(selected.contact?.title || "")} در ${escapeHtml(selected.customer?.name || "")}</div>
      </div>
      <div class="crm-message-document">${escapeHtml(selected.body).replaceAll("\n", "<br>")}</div>
      <div class="crm-conversation-actions">
        <button class="btn btn-primary" data-action="draft-reply" data-id="${selected.id}"><i class="fa-solid fa-pen-to-square"></i> تهیه پاسخ پیشنهادی</button>
        <button class="btn btn-outline-primary" data-action="conversation-to-opportunity" data-id="${selected.id}" data-customer-id="${selected.customerId}"><i class="fa-solid fa-handshake"></i> تبدیل به فرصت</button>
        <button class="btn btn-outline-secondary" data-action="new-task" data-customer-id="${selected.customerId}"><i class="fa-solid fa-list-check"></i> ایجاد پیگیری</button>
        <button class="btn btn-outline-secondary" data-action="open-customer" data-id="${selected.customerId}"><i class="fa-solid fa-building"></i> پرونده مشتری</button>
      </div>` : `<div class="crm-empty"><i class="fa-solid fa-inbox"></i>مکالمه‌ای برای نمایش وجود ندارد.</div>`;

    const analysis = selected ? `
      <div class="crm-analysis-block"><h3><i class="fa-solid fa-wand-magic-sparkles text-primary"></i> تحلیل هوشمند مکالمه</h3>
        <div class="crm-analysis-row"><span>قصد مشتری</span><strong>${escapeHtml(selected.ai.intent)}</strong></div>
        <div class="crm-analysis-row"><span>لحن و احساس</span><strong>${escapeHtml(selected.ai.sentiment)}</strong></div>
        <div class="crm-analysis-row"><span>فوریت</span><strong>${escapeHtml(selected.ai.urgency)}</strong></div>
        <div class="crm-analysis-row"><span>بودجه/شرایط</span><strong>${escapeHtml(selected.ai.budget)}</strong></div>
        <div class="crm-analysis-row"><span>زمان تصمیم</span><strong>${escapeHtml(selected.ai.decisionDate)}</strong></div>
      </div>
      <div class="crm-analysis-block"><h3>محصولات و موضوعات</h3><div class="d-flex flex-wrap gap-1">${selected.ai.products.map((product) => `<span class="badge text-bg-primary">${escapeHtml(product)}</span>`).join("")}</div></div>
      <div class="crm-analysis-block"><h3>تعهدات استخراج‌شده</h3><ul class="small mb-0">${selected.ai.commitments.map((item) => `<li class="mb-2">${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="alert alert-primary small"><strong>اقدام بعدی:</strong><br>${escapeHtml(selected.ai.nextAction)}</div>` : "";

    dom.view.innerHTML = `
      ${pageHeader("مرکز مکالمات", "ایمیل، تماس، پیام، جلسه و تیکت در یک ورودی همراه با استخراج خودکار اطلاعات", `<button class="btn btn-outline-primary" data-ai-prompt="مهم‌ترین مکالمات پاسخ‌داده‌نشده کدام‌اند؟"><i class="fa-solid fa-wand-magic-sparkles"></i> اولویت‌بندی هوشمند</button>`)}
      <section class="crm-card crm-inbox ${selectedId ? "reader-open" : ""}">
        <aside class="crm-inbox-list"><div class="crm-inbox-list-head"><strong>همه مکالمات</strong><div class="small text-muted mt-1">${faNumber(conversations.filter((item) => item.unread).length)} مورد خوانده‌نشده</div></div>${list}</aside>
        <article class="crm-conversation-reader">${reader}</article>
        <aside class="crm-conversation-analysis">${analysis}</aside>
      </section>`;
  }

  async function renderProducts() {
    const products = await withLoading(() => api.listProducts({ type: state.productFilter }));
    state.assistantContext = {};
    const cards = products.map((product) => `
      <article class="crm-card crm-product-card">
        <div class="crm-product-card-head">
          <span class="crm-product-card-icon"><i class="fa-solid ${product.icon}"></i></span>
          <div><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.category)} · کد ${escapeHtml(product.code)}</p></div>
          <span class="badge ${product.type === "hardware" ? "text-bg-info" : "text-bg-primary"}">${productTypeLabel(product.type)}</span>
        </div>
        <p class="crm-product-card-desc">${escapeHtml(product.description)}</p>
        <div class="mb-3 d-flex justify-content-between small"><span class="text-muted">قیمت پایه</span><strong>${formatMoney(product.price, false)}</strong></div>
        <div class="crm-product-stats">
          <span class="crm-product-stat"><small>مشتری فعال</small><strong>${faNumber(product.activeCustomers)}</strong></span>
          <span class="crm-product-stat"><small>${product.type === "hardware" ? "تعداد نصب" : "استقرار"}</small><strong>${faNumber(product.installedUnits)}</strong></span>
          <span class="crm-product-stat"><small>سبد باز</small><strong>${formatMoney(product.openPipeline)}</strong></span>
        </div>
        <div class="mt-3 d-flex gap-2"><button class="btn btn-sm btn-outline-primary flex-grow-1" data-ai-prompt="برای محصول ${escapeHtml(product.shortName)} چه فرصت‌های فروشی داریم؟"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل فرصت‌ها</button><button class="btn btn-sm btn-primary" data-action="new-opportunity" data-product-id="${product.id}"><i class="fa-solid fa-plus"></i></button></div>
      </article>`).join("");

    dom.view.innerHTML = `
      ${pageHeader("محصولات و راهکارها", "کاتالوگ فروش فاپا و نمای نصب‌شده، تمدیدها و فرصت‌های هر محصول", `<select id="productTypeFilter" class="form-select"><option value="all" ${state.productFilter === "all" ? "selected" : ""}>همه محصولات</option><option value="hardware" ${state.productFilter === "hardware" ? "selected" : ""}>سخت‌افزار</option><option value="software" ${state.productFilter === "software" ? "selected" : ""}>نرم‌افزار</option></select><button class="btn btn-primary" data-action="new-opportunity"><i class="fa-solid fa-plus"></i> ثبت فرصت</button>`)}
      <section class="crm-product-grid">${cards}</section>`;

    document.getElementById("productTypeFilter")?.addEventListener("change", (event) => {
      state.productFilter = event.target.value;
      renderProducts();
    });
  }

  async function renderReports() {
    const report = await withLoading(() => api.getReports());
    state.assistantContext = {};
    const stageLabels = activeStages.map((stage) => stageMeta[stage].label);
    const maxFunnel = Math.max(...report.funnel.map((item) => item.value), 1);
    const funnelRows = report.funnel.map((item, index) => `
      <div class="crm-funnel-row">
        <span>${stageLabels[index]}</span>
        <span class="crm-funnel-bar"><span style="width:${Math.max(7, item.value / maxFunnel * 100)}%">${faNumber(item.count)} فرصت</span></span>
        <strong>${formatMoney(item.value)}</strong>
      </div>`).join("");
    const maxProduct = Math.max(...report.byProduct.map((item) => item.value), 1);
    const productRows = report.byProduct.map((item) => `
      <div class="crm-bar-row">
        <span>${escapeHtml(item.name)} <small class="text-muted">${productTypeLabel(item.type)}</small></span>
        <span class="crm-bar-track"><span style="width:${Math.max(7, item.value / maxProduct * 100)}%"></span></span>
        <strong>${formatMoney(item.value)}</strong>
      </div>`).join("");
    const atRisk = report.customers.filter((customer) => customer.health < 65);
    const healthy = report.customers.filter((customer) => customer.health >= 80);

    dom.view.innerHTML = `
      ${pageHeader("گزارش مدیریتی فروش", "تحلیل سبد فروش، ترکیب محصولات، قیف تبدیل و سلامت مشتریان", `<button class="btn btn-primary" data-ai-prompt="مهم‌ترین نکات مدیریتی فروش این ماه چیست؟"><i class="fa-solid fa-wand-magic-sparkles"></i> تحلیل مدیریتی</button>`)}
      <section class="crm-kpi-grid">
        ${kpiCard("سبد سخت‌افزار", formatMoney(report.hardware), "Gate، SecureBox و پایا T8", "fa-microchip")}
        ${kpiCard("سبد نرم‌افزار", formatMoney(report.software), "Vision AI، Service Desk و Asset Manager", "fa-laptop-code", "success")}
        ${kpiCard("مشتریان با سلامت بالا", faNumber(healthy.length), "ظرفیت فروش مکمل و توسعه حساب", "fa-heart", "success")}
        ${kpiCard("مشتریان پرریسک", faNumber(atRisk.length), "نیازمند برنامه حفظ مشتری", "fa-triangle-exclamation", "danger")}
      </section>
      <section class="crm-ai-brief mb-3"><div class="crm-ai-brief-head"><span class="crm-ai-icon"><i class="fa-solid fa-chart-line"></i></span><strong>برداشت مدیریتی</strong></div><p>سبد نرم‌افزاری از نظر ارزش بزرگ‌تر است، اما بخش مهمی از آن به PoC و مستندات فنی وابسته است. در سخت‌افزار، خرید پایا T8 سریع‌ترین فرصت وصول و SecureBox بزرگ‌ترین فروش نزدیک است. هم‌زمان کیفیت خدمات آریا فولاد و خطر عدم تمدید داده‌پرداز خاور می‌تواند روی درآمد تکرارشونده اثر بگذارد.</p></section>
      <div class="crm-grid-equal">
        <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">قیف فروش</h2><span class="small text-muted">ارزش و تعداد فرصت</span></div><div class="crm-funnel">${funnelRows}</div></div></section>
        <section class="crm-card"><div class="crm-card-body"><div class="crm-section-head"><h2 class="crm-section-title">سبد به تفکیک محصول</h2><span class="small text-muted">نرم‌افزار و سخت‌افزار</span></div><div class="crm-bar-chart">${productRows}</div></div></section>
      </div>
      <div class="crm-grid-equal mt-3">
        <section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">مشتریان در معرض ریسک</h2>${atRisk.map((customer) => `<div class="crm-list-item"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.nextAction)}</span></span><button class="btn btn-sm btn-outline-danger" data-action="open-customer" data-id="${customer.id}">${faNumber(customer.health)}</button></div>`).join("")}</div></section>
        <section class="crm-card"><div class="crm-card-body"><h2 class="crm-section-title mb-3">فرصت‌های توسعه حساب</h2>${healthy.map((customer) => `<div class="crm-list-item"><span class="crm-customer-logo">${escapeHtml(customer.short)}</span><span class="crm-list-item-main"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.tags.join(" · "))}</span></span><button class="btn btn-sm btn-outline-primary" data-ai-prompt="برای ${escapeHtml(customer.name)} چه فروش مکملی پیشنهاد می‌کنی؟" data-customer-id="${customer.id}" data-customer-name="${escapeHtml(customer.name)}"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div>`).join("")}</div></section>
      </div>`;
  }

  async function renderRoute() {
    const route = parseRoute();
    state.currentRoute = route;
    activateNavigation(route.view);
    closeMobileMenu();
    dom.searchResults.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    try {
      switch (route.view) {
        case "dashboard": await renderDashboard(); break;
        case "customers": await renderCustomers(); break;
        case "customer": await renderCustomer(route.id); break;
        case "opportunities": await renderOpportunities(); break;
        case "conversations": await renderConversations(route.id); break;
        case "products": await renderProducts(); break;
        case "reports": await renderReports(); break;
        default: routeTo("dashboard");
      }
    } catch (error) {
      dom.view.innerHTML = `<div class="crm-empty"><i class="fa-solid fa-circle-exclamation"></i>بارگذاری صفحه با خطا مواجه شد.<br><button class="btn btn-primary mt-3" data-action="reload-view">تلاش دوباره</button></div>`;
    }
  }

  function updateBadges(kpis) {
    if (!kpis) return;
    dom.navTaskBadge.textContent = faNumber(kpis.taskCount);
    dom.navOpportunityBadge.textContent = faNumber(kpis.activeCount);
    dom.navConversationBadge.textContent = faNumber(kpis.unreadCount);
  }

  async function refreshBadges() {
    try {
      const dashboard = await api.getDashboard(state.role);
      updateBadges(dashboard.kpis);
    } catch (error) {
      console.warn("Could not refresh CRM badges", error);
    }
  }

  function updateRoleUi() {
    const role = roleMeta[state.role] || roleMeta.sales;
    dom.roleSelector.value = state.role;
    dom.currentUser.textContent = role.name;
    dom.currentRole.textContent = role.title;
    dom.avatar.textContent = role.avatar;
  }

  function newOpportunityModal(preset = {}) {
    const customers = state.bootstrap?.customers || [];
    const products = state.bootstrap?.products || [];
    openModal("ثبت فرصت فروش جدید", `
      <form id="newOpportunityForm">
        <div class="crm-form-grid">
          <label class="form-label">مشتری<select class="form-select mt-1" name="customerId" required><option value="">انتخاب مشتری</option>${customers.map((customer) => `<option value="${customer.id}" ${customer.id === preset.customerId ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}</select></label>
          <label class="form-label">محصول یا راهکار<select class="form-select mt-1" name="productId" required><option value="">انتخاب محصول</option>${products.map((product) => `<option value="${product.id}" ${product.id === preset.productId ? "selected" : ""}>${escapeHtml(product.shortName)} — ${productTypeLabel(product.type)}</option>`).join("")}</select></label>
          <label class="form-label full">عنوان فرصت<input class="form-control mt-1" name="title" required value="${escapeHtml(preset.title || "")}" placeholder="مثلاً تأمین ۱۰ دستگاه و خدمات استقرار" /></label>
          <label class="form-label">ارزش تقریبی (تومان)<input class="form-control mt-1 ltr fa-num" type="number" min="0" name="value" required value="${preset.value || ""}" /></label>
          <label class="form-label">تعداد/مجوز<input class="form-control mt-1 ltr fa-num" type="number" min="1" name="quantity" value="${preset.quantity || 1}" /></label>
          <label class="form-label">مرحله<select class="form-select mt-1" name="stage">${activeStages.map((stage) => `<option value="${stage}" ${stage === (preset.stage || "lead") ? "selected" : ""}>${stageMeta[stage].label}</option>`).join("")}</select></label>
          <label class="form-label">تاریخ احتمالی نهایی‌شدن<input class="form-control mt-1 ltr" type="date" name="expectedClose" /></label>
          <label class="form-label full">اقدام بعدی<input class="form-control mt-1" name="nextAction" value="${escapeHtml(preset.nextAction || "")}" placeholder="اقدام مشخص بعدی" /></label>
          <label class="form-label full">ریسک یا مانع<textarea class="form-control mt-1" rows="2" name="risk">${escapeHtml(preset.risk || "")}</textarea></label>
        </div>
        <div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">لغو</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-check"></i> ثبت فرصت</button></div>
      </form>`, (root) => {
        const form = root.querySelector("#newOpportunityForm");
        const date = new Date(Date.now() + 30 * 86400000);
        form.elements.expectedClose.value = date.toISOString().slice(0, 10);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          values.expectedClose = values.expectedClose ? new Date(`${values.expectedClose}T00:00:00`).toISOString() : null;
          values.probability = stageMeta[values.stage]?.probability || 25;
          await withLoading(() => api.createOpportunity(values));
          closeModal();
          notify("فرصت فروش ثبت شد.");
          await refreshBadges();
          routeTo("opportunities");
        });
      });
  }

  function newTaskModal(preset = {}) {
    const customers = state.bootstrap?.customers || [];
    openModal("ایجاد وظیفه و پیگیری", `
      <form id="newTaskForm">
        <div class="crm-form-grid">
          <label class="form-label full">عنوان وظیفه<input class="form-control mt-1" name="title" required value="${escapeHtml(preset.title || "")}" placeholder="مثلاً ارسال پیش‌فاکتور اصلاح‌شده" /></label>
          <label class="form-label">مشتری<select class="form-select mt-1" name="customerId"><option value="">بدون مشتری</option>${customers.map((customer) => `<option value="${customer.id}" ${customer.id === preset.customerId ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}</select></label>
          <label class="form-label">اولویت<select class="form-select mt-1" name="priority"><option value="high">بالا</option><option value="medium" selected>متوسط</option><option value="low">پایین</option></select></label>
          <label class="form-label full">موعد<input class="form-control mt-1 ltr" type="datetime-local" name="dueAt" required /></label>
        </div>
        <div class="crm-form-actions"><button class="btn btn-outline-secondary" type="button" data-action="close-modal">لغو</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-check"></i> ایجاد وظیفه</button></div>
      </form>`, (root) => {
        const form = root.querySelector("#newTaskForm");
        const date = new Date(Date.now() + 24 * 3600000);
        const offset = date.getTimezoneOffset();
        form.elements.dueAt.value = new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          values.dueAt = new Date(values.dueAt).toISOString();
          await withLoading(() => api.createTask(values));
          closeModal();
          notify("وظیفه جدید ایجاد شد.");
          await refreshBadges();
          if (state.currentRoute.view === "dashboard") renderDashboard();
        });
      });
  }

  async function opportunityDetailModal(id) {
    const rows = await withLoading(() => api.listOpportunities());
    const item = rows.find((row) => row.id === id);
    if (!item) return notify("فرصت پیدا نشد.", "danger");
    openModal("جزئیات فرصت فروش", `
      <div class="d-flex align-items-start gap-3 mb-3"><span class="crm-product-card-icon"><i class="fa-solid ${item.product.icon}"></i></span><div><h4 class="mb-1">${escapeHtml(item.title)}</h4><a href="#customer/${item.customer.id}">${escapeHtml(item.customer.name)}</a> · ${escapeHtml(item.product.shortName)}</div></div>
      <div class="crm-grid-equal mb-3">
        <div class="crm-card crm-card-flat"><div class="crm-card-body"><small class="text-muted">ارزش</small><div class="h5 mt-1">${formatMoney(item.value, false)}</div></div></div>
        <div class="crm-card crm-card-flat"><div class="crm-card-body"><small class="text-muted">احتمال تبدیل</small><div class="h5 mt-1">${faNumber(item.probability)}٪</div></div></div>
      </div>
      <div class="crm-analysis-block"><div class="crm-analysis-row"><span>مرحله</span><strong>${stageMeta[item.stage]?.label}</strong></div><div class="crm-analysis-row"><span>تاریخ احتمالی</span><strong>${formatDate(item.expectedClose)}</strong></div><div class="crm-analysis-row"><span>منبع فرصت</span><strong>${escapeHtml(item.source)}</strong></div><div class="crm-analysis-row"><span>اقدام بعدی</span><strong>${escapeHtml(item.nextAction)}</strong></div></div>
      ${item.risk ? `<div class="alert alert-danger"><strong>ریسک:</strong> ${escapeHtml(item.risk)}</div>` : `<div class="alert alert-success">مانع مهمی برای این فرصت ثبت نشده است.</div>`}
      <div class="crm-form-actions"><button class="btn btn-outline-secondary" data-action="new-task" data-customer-id="${item.customerId}"><i class="fa-solid fa-list-check"></i> ایجاد پیگیری</button><button class="btn btn-primary" data-action="open-customer" data-id="${item.customerId}"><i class="fa-solid fa-building"></i> پرونده مشتری</button></div>`);
  }

  async function draftReplyModal(conversationId) {
    const conversations = await api.listConversations();
    const item = conversations.find((row) => row.id === conversationId);
    openModal("پاسخ پیشنهادی هوشمند", `
      <div class="d-flex justify-content-between align-items-center gap-2 mb-3"><div><strong>${escapeHtml(item?.customer?.name || "")}</strong><div class="small text-muted">${escapeHtml(item?.subject || "")}</div></div><select id="replyTone" class="form-select" style="width:auto"><option value="formal">رسمی</option><option value="short">کوتاه</option><option value="friendly">صمیمی</option><option value="followup">پیگیری فروش</option></select></div>
      <textarea id="generatedReply" class="form-control crm-generated-text" placeholder="در حال تولید پاسخ..."></textarea>
      <div class="crm-form-actions"><button class="btn btn-outline-secondary" data-action="regenerate-reply" data-id="${conversationId}"><i class="fa-solid fa-rotate"></i> تولید دوباره</button><button class="btn btn-outline-primary" data-action="copy-reply"><i class="fa-solid fa-copy"></i> کپی</button><button class="btn btn-primary" data-action="accept-reply"><i class="fa-solid fa-check"></i> ثبت به‌عنوان پاسخ</button></div>`, async (root) => {
        await generateReplyIntoModal(conversationId, root.querySelector("#replyTone").value);
      });
  }

  async function generateReplyIntoModal(id, tone) {
    const textarea = document.getElementById("generatedReply");
    if (!textarea) return;
    textarea.value = "در حال تهیه پاسخ پیشنهادی...";
    textarea.disabled = true;
    try {
      textarea.value = await api.generateReply(id, tone);
    } finally {
      textarea.disabled = false;
    }
  }

  async function draftCustomerEmail(customerId) {
    const customer = await api.getCustomer(customerId);
    if (!customer) return;
    openModal("ایمیل پیگیری پیشنهادی", `
      <div class="alert alert-info small">این متن بر اساس وضعیت پرونده، فرصت‌های فعال و اقدام بعدی مشتری ساخته شده است.</div>
      <textarea id="generatedReply" class="form-control crm-generated-text">${escapeHtml(`${customer.contacts[0]?.name || "همکار گرامی"} محترم،\n\nدر ادامه تعاملات اخیر، برای پیگیری ${customer.nextAction} با شما در تماس هستم. با توجه به محصولات و خدمات فعال فاپا در مجموعه شما، تیم ما آماده است جزئیات فنی، زمان‌بندی و شرایط تجاری را نهایی کند.\n\nخواهشمند است زمان مناسب برای یک گفت‌وگوی کوتاه را اعلام فرمایید.\n\nبا احترام\nسارا محمدی\nشرکت فن‌آوران پارسیان`)}</textarea>
      <div class="crm-form-actions"><button class="btn btn-outline-primary" data-action="copy-reply"><i class="fa-solid fa-copy"></i> کپی متن</button><button class="btn btn-primary" data-action="accept-reply"><i class="fa-solid fa-check"></i> ثبت در پرونده</button></div>`);
  }

  async function conversationToOpportunity(conversationId, customerId) {
    const conversation = await api.getConversation(conversationId);
    const guessedProduct = state.bootstrap.products.find((product) => conversation.ai.products.some((name) => name.includes(product.shortName) || product.shortName.includes(name)));
    newOpportunityModal({
      customerId,
      productId: guessedProduct?.id,
      title: conversation.subject,
      stage: "qualification",
      nextAction: conversation.ai.nextAction,
      risk: conversation.ai.sentiment.includes("ریسک") ? conversation.ai.sentiment : ""
    });
  }

  function appendAssistantMessage(role, html, links = []) {
    const message = document.createElement("div");
    message.className = `crm-ai-message ${role}`;
    message.innerHTML = html;
    if (links.length) {
      const row = document.createElement("div");
      row.className = "crm-inline-actions mt-2";
      links.forEach((link) => {
        const button = document.createElement("button");
        button.className = "btn btn-sm btn-outline-primary";
        button.textContent = link.label;
        button.addEventListener("click", () => {
          routeTo(link.route);
          closeAssistant();
        });
        row.appendChild(button);
      });
      message.appendChild(row);
    }
    dom.assistantMessages.appendChild(message);
    dom.assistantMessages.scrollTop = dom.assistantMessages.scrollHeight;
    return message;
  }

  async function askAssistant(prompt, context = state.assistantContext) {
    const clean = String(prompt || "").trim();
    if (!clean) return;
    openAssistant(context);
    appendAssistantMessage("user", escapeHtml(clean));
    dom.assistantInput.value = "";
    const loading = appendAssistantMessage("assistant loading", `<i class="fa-solid fa-circle-notch fa-spin"></i> در حال تحلیل داده‌های CRM...`);
    try {
      const result = await api.askAssistant(clean, context || {});
      loading.remove();
      appendAssistantMessage("assistant", result.html, result.links || []);
    } catch (error) {
      loading.innerHTML = "پاسخ‌گویی با خطا مواجه شد.";
    }
  }

  function renderSearchResults(result) {
    const groups = [
      { title: "مشتریان", items: result.customers, icon: "fa-building", route: (item) => `customer/${item.id}`, label: (item) => item.name, sub: (item) => `${item.industry} · ${item.city}` },
      { title: "فرصت‌های فروش", items: result.opportunities, icon: "fa-handshake", route: () => "opportunities", label: (item) => item.title, sub: (item) => `${item.customer?.name || ""} · ${formatMoney(item.value)}` },
      { title: "محصولات", items: result.products, icon: "fa-box-open", route: () => "products", label: (item) => item.shortName, sub: (item) => `${productTypeLabel(item.type)} · ${item.category}` },
      { title: "مکالمات", items: result.conversations, icon: "fa-inbox", route: (item) => `conversations/${item.id}`, label: (item) => item.subject, sub: (item) => item.customer?.name || "" }
    ];
    const content = groups.filter((group) => group.items?.length).map((group) => `
      <div class="crm-search-group-title">${group.title}</div>
      ${group.items.map((item) => `<button class="crm-search-item" data-route-target="${group.route(item)}"><i class="fa-solid ${group.icon}"></i><span><strong>${escapeHtml(group.label(item))}</strong><small>${escapeHtml(group.sub(item))}</small></span></button>`).join("")}`).join("");
    dom.searchResults.innerHTML = content || `<div class="crm-empty py-4">نتیجه‌ای پیدا نشد.</div>`;
    dom.searchResults.classList.remove("hidden");
  }

  async function handleGlobalSearch() {
    clearTimeout(state.searchTimer);
    const query = dom.globalSearch.value.trim();
    if (query.length < 2) {
      dom.searchResults.classList.add("hidden");
      return;
    }
    state.searchTimer = setTimeout(async () => {
      const result = await api.search(query);
      renderSearchResults(result);
    }, 180);
  }

  async function handleViewClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (target.tagName === "SELECT") return;
    event.preventDefault();

    switch (action) {
      case "open-customer": closeModal(); routeTo(`customer/${id}`); break;
      case "open-conversation": routeTo(`conversations/${id}`); break;
      case "open-opportunity": await opportunityDetailModal(id); break;
      case "toggle-task": await withLoading(() => api.toggleTask(id)); notify("وضعیت وظیفه به‌روزرسانی شد."); await renderDashboard(); break;
      case "new-opportunity": newOpportunityModal({ customerId: target.dataset.customerId, productId: target.dataset.productId }); break;
      case "new-task": newTaskModal({ customerId: target.dataset.customerId }); break;
      case "clear-customer-filters": state.customerFilters = { query: "", health: "", tier: "" }; renderCustomers(); break;
      case "draft-reply": await draftReplyModal(id); break;
      case "draft-customer-email": await draftCustomerEmail(id); break;
      case "conversation-to-opportunity": await conversationToOpportunity(id, target.dataset.customerId); break;
      case "close-mobile-reader": routeTo("conversations"); break;
      case "reload-view": renderRoute(); break;
      case "close-modal": closeModal(); break;
      case "copy-reply": {
        const textarea = document.getElementById("generatedReply");
        await navigator.clipboard.writeText(textarea?.value || "");
        notify("متن کپی شد.");
        break;
      }
      case "accept-reply": notify("پاسخ در پرونده مکالمه ثبت شد."); closeModal(); break;
      case "regenerate-reply": await generateReplyIntoModal(id, document.getElementById("replyTone")?.value || "formal"); break;
      default: break;
    }
  }

  async function handleViewChange(event) {
    const target = event.target.closest("[data-action='change-stage']");
    if (!target) return;
    await withLoading(() => api.updateOpportunityStage(target.dataset.id, target.value));
    notify("مرحله فرصت به‌روزرسانی شد.");
    renderOpportunities();
  }

  function bindEvents() {
    window.addEventListener("hashchange", renderRoute);
    dom.view.addEventListener("click", handleViewClick);
    dom.view.addEventListener("change", handleViewChange);
    dom.modalBody.addEventListener("click", handleViewClick);

    document.addEventListener("click", (event) => {
      const aiButton = event.target.closest("[data-ai-prompt]");
      if (aiButton) {
        event.preventDefault();
        const context = aiButton.dataset.customerId
          ? { customerId: aiButton.dataset.customerId, customerName: aiButton.dataset.customerName }
          : state.assistantContext;
        askAssistant(aiButton.dataset.aiPrompt, context);
      }
      const routeButton = event.target.closest("[data-route-target]");
      if (routeButton) {
        routeTo(routeButton.dataset.routeTarget);
        dom.searchResults.classList.add("hidden");
        dom.globalSearch.value = "";
      }
      if (!event.target.closest(".crm-global-search-wrap")) dom.searchResults.classList.add("hidden");
    });

    dom.btnMenu.addEventListener("click", () => {
      dom.sidebar.classList.add("open");
      dom.mobileBackdrop.classList.add("open");
    });
    dom.mobileBackdrop.addEventListener("click", closeMobileMenu);

    document.getElementById("btnOpenAssistant").addEventListener("click", () => openAssistant(state.assistantContext));
    document.getElementById("btnSidebarAssistant").addEventListener("click", () => openAssistant(state.assistantContext));
    document.getElementById("btnCloseAssistant").addEventListener("click", closeAssistant);
    dom.assistantBackdrop.addEventListener("click", closeAssistant);
    dom.assistantForm.addEventListener("submit", (event) => {
      event.preventDefault();
      askAssistant(dom.assistantInput.value, state.assistantContext);
    });

    dom.roleSelector.addEventListener("change", () => {
      state.role = dom.roleSelector.value;
      localStorage.setItem("fapco-crm-role", state.role);
      updateRoleUi();
      if (state.currentRoute.view === "dashboard") renderDashboard();
      else refreshBadges();
    });

    dom.globalSearch.addEventListener("input", handleGlobalSearch);
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        dom.globalSearch.focus();
      }
      if (event.key === "Escape") {
        closeAssistant();
        closeMobileMenu();
        if (!dom.modalBackdrop.classList.contains("hidden")) closeModal();
      }
    });

    document.getElementById("btnCloseCrmModal").addEventListener("click", closeModal);
    dom.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === dom.modalBackdrop) closeModal();
    });

    document.getElementById("btnResetDemo").addEventListener("click", async () => {
      const accepted = typeof confirmDialog === "function"
        ? await confirmDialog({ title: "بازنشانی دمو", message: "همه تغییرات این نسخه دمو پاک و داده‌های اولیه دوباره بارگذاری می‌شوند.", confirmText: "بازنشانی", confirmClass: "btn-danger" })
        : { confirmed: window.confirm("داده‌های دمو بازنشانی شوند؟") };
      if (!accepted.confirmed) return;
      await withLoading(() => api.reset());
      notify("داده‌های دمو بازنشانی شد.", "info");
      await loadBootstrapData();
      renderRoute();
    });
  }

  async function loadBootstrapData() {
    const bootstrap = await api.getBootstrap();
    bootstrap.customers = await api.listCustomers();
    state.bootstrap = bootstrap;
  }

  async function initAuth() {
    if (typeof setupAuth !== "function") return;
    try {
      auth = await setupAuth("crm", false);
    } catch (error) {
      console.warn("CRM demo continues without backend auth", error);
    }
  }

  async function init() {
    updateRoleUi();
    bindEvents();
    await Promise.all([initAuth(), loadBootstrapData()]);
    await refreshBadges();
    if (!location.hash) location.hash = "dashboard";
    else renderRoute();
  }

  window.crmApp = {
    api,
    routeTo,
    renderRoute,
    openAssistant,
    newOpportunityModal,
    newTaskModal,
    reset: () => api.reset()
  };

  init().catch((error) => {
    console.error(error);
    dom.view.innerHTML = `<div class="crm-empty"><i class="fa-solid fa-circle-exclamation"></i>راه‌اندازی دمو با خطا مواجه شد.</div>`;
  });
})();

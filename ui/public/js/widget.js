(function () {
  "use strict";

  const WEEKDAYS = [
    { key: "saturday", label: "شنبه" },
    { key: "sunday", label: "یکشنبه" },
    { key: "monday", label: "دوشنبه" },
    { key: "tuesday", label: "سه‌شنبه" },
    { key: "wednesday", label: "چهارشنبه" },
    { key: "thursday", label: "پنجشنبه" },
    { key: "friday", label: "جمعه" }
  ];
  const CATEGORY_META = {
    general: { label: "معرفی محصول و اطلاعات عمومی", icon: "fa-circle-info" },
    sales: { label: "فروش، قیمت و درخواست پیش‌فاکتور", icon: "fa-cart-shopping" },
    technical: { label: "پشتیبانی فنی و خطای محصول", icon: "fa-screwdriver-wrench" },
    warranty: { label: "گارانتی، تعمیر و خدمات پس از فروش", icon: "fa-shield-halved" },
    complaint: { label: "شکایت، نارضایتی و پیگیری فوری", icon: "fa-face-frown" },
    contract: { label: "قرارداد، تمدید و امور مالی", icon: "fa-file-signature" },
    security: { label: "امنیت، محرمانگی و الزامات سازمانی", icon: "fa-lock" },
    unknown: { label: "پرسش خارج از دانش یا با اطمینان پایین", icon: "fa-circle-question" }
  };
  const STATUS_META = {
    draft: { label: "پیش‌نویس", cls: "draft", icon: "fa-pen" },
    published: { label: "منتشرشده", cls: "published", icon: "fa-circle-check" },
    changed: { label: "تغییرات منتشرنشده", cls: "changed", icon: "fa-triangle-exclamation" },
    disabled: { label: "غیرفعال", cls: "disabled", icon: "fa-circle-pause" }
  };
  const FILE_TYPES = ["pdf", "odt", "txt", "md", "doc", "docx"];

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const fa = value => Number(value || 0).toLocaleString("fa-IR");
  const formatDate = value => value ? new Date(value).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const formatDateTime = value => value ? new Date(value).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const formatDuration = minutes => {
    const num = Number(minutes || 0);
    if (num < 1) return "کمتر از یک دقیقه";
    if (num < 60) return `${fa(Math.round(num))} دقیقه`;
    return `${fa((num / 60).toFixed(1))} ساعت`;
  };
  const bytesHuman = bytes => {
    const n = Number(bytes || 0);
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  };
  const normalizeOrigin = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.pathname && url.pathname !== "/") || url.search || url.hash) return raw;
      return url.origin.toLowerCase();
    } catch { return raw; }
  };
  const initials = text => String(text || "؟").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("‌");

  function defaultSchedule() {
    return {
      timezone: "Asia/Tehran",
      days: {
        saturday: { enabled: true, start: "08:00", end: "18:00" },
        sunday: { enabled: true, start: "08:00", end: "18:00" },
        monday: { enabled: true, start: "08:00", end: "18:00" },
        tuesday: { enabled: true, start: "08:00", end: "18:00" },
        wednesday: { enabled: true, start: "08:00", end: "18:00" },
        thursday: { enabled: true, start: "08:00", end: "14:00" },
        friday: { enabled: false, start: "09:00", end: "13:00" }
      }
    };
  }

  function summarizeWidget(widget) {
    return {
      sessions: Number(widget.summary?.sessions || 0),
      messages: Number(widget.summary?.messages || 0),
      aiAnswers: Number(widget.summary?.aiAnswers || 0),
      humanEscalations: Number(widget.summary?.humanEscalations || 0),
      pending: Number(widget.summary?.pending || 0),
      assigned: Number(widget.summary?.assigned || 0),
      resolved: Number(widget.summary?.resolved || 0),
      files: Number(widget.summary?.files ?? widget.files?.filter(item => item.status === "ready").length ?? 0),
      operators: Number(widget.summary?.operators ?? widget.operators?.filter(item => item.active).length ?? 0)
    };
  }

  const runtimeApiBases = new Map();
  const sessionContexts = new Map();

  function authReady() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        if (typeof auth !== "undefined" && auth?.apiFetch) return resolve(auth);
        if (attempts++ > 100) return reject(new Error("نشست کاربری آماده نیست"));
        setTimeout(check, 50);
      };
      check();
    });
  }

  async function responseJSON(response) {
    if (!response) throw new Error("پاسخی از سرور دریافت نشد");
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!response.ok || data?.error) {
      const message = data?.error?.message || data?.error || data?.message || data?.raw || `خطای سرور (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.validation = data?.validation || data?.error?.validation;
      throw error;
    }
    return data;
  }

  async function apiJSON(path, options = {}) {
    const currentAuth = await authReady();
    const response = await currentAuth.apiFetch(path, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    return responseJSON(response);
  }

  function publicBase(widgetId) {
    return runtimeApiBases.get(widgetId) || location.origin;
  }

  async function publicJSON(widgetId, path, options = {}) {
    const response = await fetch(`${publicBase(widgetId)}${path}`, {
      ...options,
      mode: "cors",
      credentials: "omit",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    return responseJSON(response);
  }

  function sessionStorageKey(widgetId, clientSessionId, preview) {
    return `fapco-widget-session:${preview ? "preview" : "public"}:${widgetId}:${clientSessionId}`;
  }

  async function ensureServerSession(widgetId, clientSessionId, preview) {
    const storageKey = sessionStorageKey(widgetId, clientSessionId, preview);
    let sessionKey = sessionStorage.getItem(storageKey);
    if (sessionKey) {
      sessionContexts.set(sessionKey, { widgetId, preview, apiBase: publicBase(widgetId) });
      return sessionKey;
    }
    const data = preview
      ? await apiJSON(`/api/widget/${widgetId}/preview/sessions`, { method: "POST", body: "{}" })
      : await publicJSON(widgetId, `/api/widget/public/${widgetId}/sessions`, { method: "POST", body: "{}" });
    sessionKey = data.sessionKey;
    sessionStorage.setItem(storageKey, sessionKey);
    sessionContexts.set(sessionKey, { widgetId, preview, apiBase: publicBase(widgetId) });
    return sessionKey;
  }

  async function parseChatStream(response) {
    if (!response?.ok) return responseJSON(response);
    if (!response.body) throw new Error("پاسخ جریانی از سرور دریافت نشد");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let references = [];
    let meta = { mode: "ai" };

    const consumeLine = line => {
      if (!line.startsWith("data: ")) return;
      const payload = line.slice(6).trim();
      if (!payload) return;
      if (payload.startsWith("[ERROR]:")) throw new Error(payload.slice(8).trim() || "خطا در تولید پاسخ");
      if (payload.startsWith("[REF]:")) {
        try {
          references = JSON.parse(payload.slice(6)).map(item => ({
            id: item.url || item.title,
            name: item.title || item.url || "منبع",
            url: item.url || ""
          }));
        } catch { references = []; }
        return;
      }
      if (payload.startsWith("[WIDGET]:")) {
        try { meta = { ...meta, ...JSON.parse(payload.slice(9)) }; } catch { /* ignore malformed metadata */ }
        return;
      }
      if (payload.startsWith("[DONE:") || payload.startsWith("[CANCELLED:")) return;
      try {
        const chunk = JSON.parse(payload);
        if (typeof chunk.delta === "string") answer += chunk.delta;
      } catch { /* ignore non-JSON control lines */ }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (buffer.trim()) consumeLine(buffer.trim());
    return { answer: answer.trim(), references, ...meta };
  }

  async function uploadSingleWidgetFile(widgetId, file, onProgress) {
    const currentAuth = await authReady();
    const tempId = `upload-${Math.random().toString(36).slice(2, 10)}`;
    const base = { id: tempId, name: file.name, size: file.size, type: file.name.split(".").pop()?.toLowerCase() || "file", status: "processing", progress: 0, chunks: 0, uploadedAt: new Date().toISOString() };
    await onProgress?.(base);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/widget/${widgetId}/files`, true);
      if (currentAuth.token()) xhr.setRequestHeader("Authorization", `Bearer ${currentAuth.token()}`);
      const form = new FormData();
      form.append("file", file);
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        onProgress?.({ ...base, progress: Math.min(80, Math.round(event.loaded / event.total * 80)) });
      };
      xhr.onprogress = () => onProgress?.({ ...base, progress: 90 });
      xhr.onerror = () => reject(new Error("ارتباط با سرور هنگام بارگذاری فایل قطع شد"));
      xhr.onload = async () => {
        const streamedError = xhr.responseText.match(/data:\s*\[ERROR\]:\s*([^\r\n]+)/i);
        if (streamedError?.[1]) return reject(new Error(streamedError[1].trim()));
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            return reject(new Error(parsed?.error?.message || parsed?.error || "بارگذاری فایل ناموفق بود"));
          } catch { return reject(new Error(xhr.responseText || "بارگذاری فایل ناموفق بود")); }
        }
        await onProgress?.({ ...base, progress: 100, status: "ready" });
        resolve({ ok: true });
      };
      xhr.send(form);
    });
  }

  const WidgetAPI = {
    setRuntimeBase(widgetId, base) { runtimeApiBases.set(widgetId, String(base || "").replace(/\/$/, "")); },
    async getOwner() {
      const data = await apiJSON("/api/auth/profile");
      const profile = data.profile || {};
      return {
        id: Number(profile.id || 0),
        username: profile.username || "",
        displayName: profile.name || profile.username || "کاربر سامانه",
        avatar: profile.avatar || ""
      };
    },
    async listWidgets() { return (await apiJSON("/api/widget")).widgets || []; },
    async getWidget(widgetId) { return (await apiJSON(`/api/widget/${widgetId}`)).widget; },
    async createWidget() { return (await apiJSON("/api/widget", { method: "POST", body: "{}" })).widget; },
    async updateWidget(widgetId, changes) { return (await apiJSON(`/api/widget/${widgetId}`, { method: "PUT", body: JSON.stringify(changes || {}) })).widget; },
    async deleteWidget(widgetId) { return apiJSON(`/api/widget/${widgetId}`, { method: "DELETE" }); },
    async uploadFiles(widgetId, files, onProgress) {
      for (const file of Array.from(files || [])) await uploadSingleWidgetFile(widgetId, file, onProgress);
      return { ok: true };
    },
    async deleteFile(widgetId, fileId) { return apiJSON(`/api/widget/${widgetId}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" }); },
    async retryFile(widgetId, fileId) { return apiJSON(`/api/widget/${widgetId}/files/${encodeURIComponent(fileId)}/retry`, { method: "POST", body: "{}" }); },
    async addOperator(widgetId, operator) {
      return (await apiJSON(`/api/widget/${widgetId}/operators`, { method: "POST", body: JSON.stringify({ username: operator.username }) })).operators;
    },
    async toggleOperator(widgetId, username) {
      const widget = await this.getWidget(widgetId);
      const operator = widget.operators.find(item => item.username === username);
      return (await apiJSON(`/api/widget/${widgetId}/operators/${encodeURIComponent(username)}`, { method: "PUT", body: JSON.stringify({ active: !operator?.active }) })).operators;
    },
    async removeOperator(widgetId, username) { return apiJSON(`/api/widget/${widgetId}/operators/${encodeURIComponent(username)}`, { method: "DELETE" }); },
    async testChat(widgetId, clientSessionId, message) {
      const sessionKey = await ensureServerSession(widgetId, clientSessionId, true);
      const currentAuth = await authReady();
      const response = await currentAuth.apiFetch(`/api/widget/${widgetId}/preview/sessions/${sessionKey}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message })
      });
      return parseChatStream(response);
    },
    async publicChat(widgetId, clientSessionId, message) {
      const sessionKey = await ensureServerSession(widgetId, clientSessionId, false);
      const response = await fetch(`${publicBase(widgetId)}/api/widget/public/${widgetId}/sessions/${sessionKey}/messages`, {
        method: "POST", mode: "cors", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message })
      });
      return parseChatStream(response);
    },
    async updateVisitorInfo(widgetId, conversationId, visitor) {
      const context = sessionContexts.get(conversationId);
      if (!context) throw new Error("نشست گفتگو پیدا نشد");
      return context.preview
        ? apiJSON(`/api/widget/${widgetId}/preview/sessions/${conversationId}/contact`, { method: "PUT", body: JSON.stringify(visitor || {}) })
        : publicJSON(widgetId, `/api/widget/public/${widgetId}/sessions/${conversationId}/contact`, { method: "PUT", body: JSON.stringify(visitor || {}) });
    },
    async getTestSession(widgetId, clientSessionId) {
      const previewKey = sessionStorage.getItem(sessionStorageKey(widgetId, clientSessionId, true));
      const publicKey = sessionStorage.getItem(sessionStorageKey(widgetId, clientSessionId, false));
      const sessionKey = previewKey || publicKey;
      if (!sessionKey) return { session: { messages: [] }, conversation: null };
      const preview = Boolean(previewKey);
      sessionContexts.set(sessionKey, { widgetId, preview, apiBase: publicBase(widgetId) });
      const data = preview
        ? await apiJSON(`/api/widget/${widgetId}/preview/sessions/${sessionKey}/messages`)
        : await publicJSON(widgetId, `/api/widget/public/${widgetId}/sessions/${sessionKey}/messages`);
      const conversation = data.session ? { ...data.session, id: sessionKey, sessionId: sessionKey, messages: data.messages || [] } : null;
      return { session: { messages: data.messages || [] }, conversation };
    },
    async resetTestSession(widgetId, clientSessionId) {
      const key = sessionStorageKey(widgetId, clientSessionId, true);
      const sessionKey = sessionStorage.getItem(key);
      if (sessionKey) sessionContexts.delete(sessionKey);
      sessionStorage.removeItem(key);
      return { ok: true };
    },
    async validateWidget(widgetId) { return apiJSON(`/api/widget/${widgetId}/validate`); },
    async publishWidget(widgetId) { return (await apiJSON(`/api/widget/${widgetId}/publish`, { method: "POST", body: "{}" })).widget; },
    async unpublishWidget(widgetId) { return (await apiJSON(`/api/widget/${widgetId}/unpublish`, { method: "POST", body: "{}" })).widget; },
    async getInstallCode(widgetId) { return (await apiJSON(`/api/widget/${widgetId}/install-code`)).code; },
    async listConversations(filters = {}) {
      const params = new URLSearchParams();
      if (filters.widgetId) params.set("widgetId", filters.widgetId);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      if (filters.operator) params.set("operator", filters.operator);
      return (await apiJSON(`/api/widget/conversations?${params}`)).conversations || [];
    },
    async assignConversation(widgetId, conversationId, operatorUsername) {
      return apiJSON(`/api/widget/${widgetId}/conversations/${conversationId}/assign`, { method: "POST", body: JSON.stringify({ operatorUsername }) });
    },
    async sendHumanReply(widgetId, conversationId, _operatorUsername, text) {
      return apiJSON(`/api/widget/${widgetId}/conversations/${conversationId}/replies`, { method: "POST", body: JSON.stringify({ text }) });
    },
    async resolveConversation(widgetId, conversationId) { return apiJSON(`/api/widget/${widgetId}/conversations/${conversationId}/resolve`, { method: "POST", body: "{}" }); },
    async getAnalytics(widgetId = "all") { return apiJSON(`/api/widget/analytics?widgetId=${encodeURIComponent(widgetId)}`); },
    async getPublicConfig(widgetId, preview = false) {
      return preview
        ? apiJSON(`/api/widget/${widgetId}/preview/config`)
        : publicJSON(widgetId, `/api/widget/public/${widgetId}/config`);
    }
  };

  window.WidgetAPI = WidgetAPI;

  /* ------------------------------ Embeddable runtime ------------------------------ */

  async function mountRuntime(script) {
    if (!script || script.dataset.mounted === "1") return;
    const widgetId = script.dataset.widgetId;
    if (!widgetId) return;
    script.dataset.mounted = "1";
    const preview = script.dataset.preview === "true";
    try { WidgetAPI.setRuntimeBase(widgetId, new URL(script.src || location.href, location.href).origin); } catch { WidgetAPI.setRuntimeBase(widgetId, location.origin); }
    let config;
    try { config = await WidgetAPI.getPublicConfig(widgetId, preview); } catch (error) { console.warn("Fapco Widget:", error.message); return; }
    if (!config?.enabled) return;
    if (!preview && String(config.destinationDomain || "").toLowerCase() !== location.origin.toLowerCase()) {
      console.warn(`Fapco Widget: this widget is restricted to ${config.destinationDomain}`);
      return;
    }
    const host = document.createElement("div");
    host.id = `fapco-widget-${widgetId}`;
    host.style.position = "fixed";
    host.style.zIndex = "2147483000";
    document.body.appendChild(host);
    const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    const ap = config.appearance;
    const position = ap.position === "left" ? "left" : "right";
    root.innerHTML = runtimeTemplate(config, position);
    const launcher = root.querySelector(".fw-launcher");
    const panel = root.querySelector(".fw-panel");
    const greeting = root.querySelector(".fw-greeting");
    const close = root.querySelector(".fw-close");
    const form = root.querySelector(".fw-form");
    const input = root.querySelector(".fw-input");
    const messages = root.querySelector(".fw-messages");
    const quick = root.querySelector(".fw-quick");
    const sessionId = `public-${widgetId}-${getVisitorId(widgetId)}`;
    const seenMessageIds = new Set();
    const append = (sender, text, refs = []) => {
      const el = document.createElement("div");
      el.className = `fw-message ${sender}`;
      el.textContent = text;
      if (refs?.length) {
        const r = document.createElement("div"); r.className = "fw-refs"; r.textContent = `منبع: ${refs.map(item => item.name).join("، ")}`; el.appendChild(r);
      }
      messages.appendChild(el); messages.scrollTop = messages.scrollHeight;
    };
    append("assistant", ap.welcomeMessage);
    const openPanel = () => { panel.classList.add("open"); launcher.classList.add("hidden"); greeting?.classList.add("hidden"); input.focus(); };
    const closePanel = () => { panel.classList.remove("open"); launcher.classList.remove("hidden"); greeting?.classList.remove("hidden"); };
    launcher.onclick = openPanel; close.onclick = closePanel;
    quick?.addEventListener("click", event => { const btn = event.target.closest("button[data-q]"); if (!btn) return; input.value = btn.dataset.q; form.requestSubmit(); });
    form.onsubmit = async event => {
      event.preventDefault(); const text = input.value.trim(); if (!text) return; input.value = ""; append("visitor", text);
      const typing = document.createElement("div"); typing.className = "fw-message assistant"; typing.innerHTML = '<span class="fw-typing"><i></i><i></i><i></i></span>'; messages.appendChild(typing); messages.scrollTop = messages.scrollHeight;
      try {
        const result = await (preview ? WidgetAPI.testChat(widgetId, sessionId, text) : WidgetAPI.publicChat(widgetId, sessionId, text)); typing.remove(); append("assistant", result.answer, result.references);
        if (result.mode === "handoff" && config.behavior.humanHandoff.collectContact) showRuntimeContact(root, widgetId, result.conversationId);
      } catch (error) { typing.remove(); append("assistant", "در ارتباط با سامانه خطایی رخ داد. لطفاً دوباره تلاش کنید."); }
    };
    if (ap.autoOpen) setTimeout(openPanel, Math.max(1, Number(ap.autoOpenDelay || 5)) * 1000);
    setInterval(async () => {
      if (!panel.classList.contains("open")) return;
      const data = await WidgetAPI.getTestSession(widgetId, sessionId);
      const conversation = data.conversation;
      if (!conversation) return;
      for (const message of conversation.messages || []) {
        const messageId = Number(message.id || 0);
        if (messageId && seenMessageIds.has(messageId)) continue;
        if (message.sender === "operator") append("operator", message.text);
        if (messageId) seenMessageIds.add(messageId);
      }
    }, 3500);
  }

  function getVisitorId(widgetId) {
    const key = `fapco-widget-visitor-${widgetId}`;
    let id = localStorage.getItem(key);
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem(key, id); }
    return id;
  }

  function runtimeTemplate(config, position) {
    const ap = config.appearance;
    const quick = (ap.quickQuestions || []).slice(0, 4).map(item => `<button type="button" data-q="${esc(item)}">${esc(item)}</button>`).join("");
    const logo = ap.logoDataUrl ? `<img src="${esc(ap.logoDataUrl)}" alt="">` : `<span>${esc(initials(ap.assistantName))}</span>`;
    return `
      <style>
        *{box-sizing:border-box}button,input,textarea{font:inherit}.fw-wrap{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#1d2636;--c:${esc(ap.primaryColor || "#0d6efd")}}
        .fw-launcher{position:fixed;${position}:22px;bottom:22px;width:60px;height:60px;border:0;border-radius:50%;color:#fff;background:var(--c);box-shadow:0 13px 30px rgba(0,0,0,.28);cursor:pointer;font-size:22px}.fw-launcher.hidden,.fw-greeting.hidden{display:none}.fw-launcher:after{content:"💬"}.fw-greeting{position:fixed;${position}:92px;bottom:30px;max-width:250px;padding:9px 12px;color:#263042;background:#fff;border:1px solid #dce3ec;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.16);font-size:11px}
        .fw-panel{position:fixed;${position}:22px;bottom:22px;width:370px;height:545px;display:none;flex-direction:column;overflow:hidden;background:#fff;color:#1d2636;border:1px solid #dce3ec;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3)}.fw-panel.open{display:flex}.fw-panel.dark{color:#e9edf3;background:#20262c;border-color:#39424c}.fw-panel.dark .fw-messages{background:#181d22}.fw-panel.dark .fw-message.assistant{background:#262d34;border-color:#39424c}.fw-panel.dark .fw-quick,.fw-panel.dark .fw-form,.fw-panel.dark .fw-contact{background:#20262c;border-color:#39424c}.fw-panel.dark .fw-quick button{background:#20262c}.fw-panel.dark .fw-input,.fw-panel.dark .fw-contact input{color:#e9edf3;background:#262d34;border-color:#39424c}
        .fw-head{padding:13px 14px;display:flex;align-items:center;gap:10px;color:#fff;background:var(--c)}.fw-avatar{width:39px;height:39px;display:grid;place-items:center;overflow:hidden;background:rgba(255,255,255,.2);border-radius:11px;font-weight:bold}.fw-avatar img{width:100%;height:100%;object-fit:cover}.fw-head-text{min-width:0;display:flex;flex:1;flex-direction:column}.fw-head-text strong{font-size:14px}.fw-head-text small{font-size:10px;opacity:.86;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fw-close{color:#fff;background:transparent;border:0;font-size:20px;cursor:pointer}
        .fw-messages{flex:1;padding:13px;overflow:auto;background:#f5f7fa}.fw-message{max-width:88%;margin-bottom:9px;padding:9px 11px;border-radius:13px;font-size:12px;line-height:1.8;white-space:pre-wrap}.fw-message.assistant{margin-left:auto;background:#fff;border:1px solid #e0e5eb;border-bottom-right-radius:4px}.fw-message.visitor{margin-right:auto;color:#fff;background:var(--c);border-bottom-left-radius:4px}.fw-message.operator{margin-left:auto;background:#e7f7ee;border:1px solid #b9e2ca;border-bottom-right-radius:4px}.fw-refs{margin-top:7px;padding-top:7px;color:#6d7786;border-top:1px dashed #d4dae2;font-size:10px}
        .fw-quick{padding:8px 10px;display:flex;gap:6px;overflow-x:auto;border-top:1px solid #edf0f4}.fw-quick button{padding:6px 9px;white-space:nowrap;color:var(--c);background:#fff;border:1px solid var(--c);border-radius:999px;cursor:pointer;font-size:10px}.fw-form{padding:10px;display:flex;gap:7px;border-top:1px solid #e5e9ef}.fw-input{height:42px;min-height:42px;max-height:86px;flex:1;padding:9px;border:1px solid #d8dee7;border-radius:10px;resize:none;outline:none}.fw-send{width:42px;border:0;color:#fff;background:var(--c);border-radius:10px;cursor:pointer}.fw-send:after{content:"➤"}.fw-brand{padding:0 10px 8px;color:#8a94a2;text-align:center;font-size:9px}.fw-contact{padding:9px;background:#fff;border-top:1px solid #e6eaf0}.fw-contact-row{display:flex;gap:6px}.fw-contact input{min-width:0;width:50%;padding:7px;border:1px solid #d8dee7;border-radius:8px;font-size:10px}.fw-contact button{padding:7px 9px;color:#fff;background:var(--c);border:0;border-radius:8px;cursor:pointer;font-size:10px}.fw-typing{display:inline-flex;gap:4px}.fw-typing i{width:5px;height:5px;background:#8993a1;border-radius:50%;animation:fwt 1s infinite alternate}.fw-typing i:nth-child(2){animation-delay:.2s}.fw-typing i:nth-child(3){animation-delay:.4s}@keyframes fwt{to{transform:translateY(-4px);opacity:.45}}
        @media(max-width:520px){.fw-panel{inset:8px;width:auto;height:auto}.fw-launcher{${position}:14px;bottom:14px}}
      </style>
      <div class="fw-wrap">
        <button class="fw-launcher" aria-label="بازکردن پشتیبان"></button>
        ${ap.greetingBubble ? `<div class="fw-greeting">${esc(ap.greetingBubble)}</div>` : ""}
        <section class="fw-panel ${ap.theme === "dark" ? "dark" : ""}" role="dialog" aria-label="${esc(ap.title)}">
          <header class="fw-head"><div class="fw-avatar">${logo}</div><div class="fw-head-text"><strong>${esc(ap.title)}</strong><small>${esc(ap.subtitle)}</small></div><button class="fw-close" aria-label="بستن">×</button></header>
          <div class="fw-messages"></div>
          ${quick ? `<div class="fw-quick">${quick}</div>` : ""}
          <div class="fw-contact-slot"></div>
          <form class="fw-form"><textarea class="fw-input" placeholder="${esc(ap.inputPlaceholder)}"></textarea><button class="fw-send" type="submit" aria-label="ارسال"></button></form>
          ${ap.showBranding ? '<div class="fw-brand">قدرت‌گرفته از دستیار هوشمند فاپا</div>' : ""}
        </section>
      </div>`;
  }

  function showRuntimeContact(root, widgetId, conversationId) {
    const slot = root.querySelector(".fw-contact-slot");
    if (!slot || slot.children.length) return;
    slot.innerHTML = `<div class="fw-contact"><div class="fw-contact-row"><input name="name" placeholder="نام"><input name="contact" placeholder="شماره یا ایمیل"><button type="button">ثبت</button></div></div>`;
    slot.querySelector("button").onclick = async () => {
      const name = slot.querySelector('[name="name"]').value.trim();
      const contact = slot.querySelector('[name="contact"]').value.trim();
      if (!contact) return;
      await WidgetAPI.updateVisitorInfo(widgetId, conversationId, { name, contact });
      slot.innerHTML = '<div class="fw-contact" style="font-size:10px;color:#198754;text-align:center">اطلاعات تماس ثبت شد.</div>';
    };
  }

  const embedScript = document.currentScript?.dataset?.widgetId ? document.currentScript : null;
  if (embedScript) mountRuntime(embedScript);

  /* ------------------------------ Admin application ------------------------------ */

  if (!document.getElementById("webWidgetApp")) return;

  const app = {
    route: "widgets",
    editorId: null,
    editorTab: "identity",
    widget: null,
    widgets: [],
    conversations: [],
    selectedConversationId: null,
    inboxStatus: "all",
    inboxWidget: "",
    analyticsWidget: "all",
    testDevice: "desktop",
    testOpen: true,
    testSessionId: `test-${Math.random().toString(36).slice(2, 10)}`,
    testMessages: [],
    testConversationId: null,
    owner: null,
    saving: false
  };

  const view = document.getElementById("wwView");
  const sidebar = document.getElementById("wwSidebar");
  const mobileBackdrop = document.getElementById("wwMobileBackdrop");

  document.getElementById("btnWidgetMenu")?.addEventListener("click", () => toggleSidebar(true));
  mobileBackdrop?.addEventListener("click", () => toggleSidebar(false));
  document.getElementById("btnCreateWidgetTop")?.addEventListener("click", createWidget);
  window.addEventListener("hashchange", route);

  function toggleSidebar(open) {
    sidebar?.classList.toggle("open", open);
    mobileBackdrop?.classList.toggle("open", open);
  }

  async function route() {
    toggleSidebar(false);
    const raw = location.hash.replace(/^#/, "") || "widgets";
    const [routeName, id, tab] = raw.split("/");
    if (app.route === "editor" && app.widget && (routeName !== "editor" || id !== app.editorId || (tab || "identity") !== app.editorTab)) {
      await saveCurrentEditorTab(false);
    }
    app.route = routeName;
    document.querySelectorAll(".ww-nav-item").forEach(item => item.classList.toggle("active", item.dataset.route === routeName || (routeName === "editor" && item.dataset.route === "widgets")));
    if (routeName === "editor" && id) {
      app.editorId = id;
      app.editorTab = tab || "identity";
      await renderEditor();
    } else if (routeName === "inbox") await renderInbox();
    else if (routeName === "analytics") await renderAnalytics();
    else await renderWidgets();
    await updateBadges();
  }

  async function updateBadges() {
    const widgets = await WidgetAPI.listWidgets();
    const conversations = await WidgetAPI.listConversations();
    document.getElementById("wwNavWidgetCount").textContent = fa(widgets.length);
    document.getElementById("wwNavPendingCount").textContent = fa(conversations.filter(item => ["pending", "queued"].includes(item.status)).length);
    app.owner = await WidgetAPI.getOwner();
    document.getElementById("wwOwnerUsername").textContent = app.owner.username ? `@${app.owner.username}` : app.owner.displayName;
  }

  async function createWidget() {
    if (app.route === "editor" && app.widget) await saveCurrentEditorTab(false);
    setLoading(true);
    try {
      const widget = await WidgetAPI.createWidget();
      location.hash = `editor/${widget.id}/identity`;
      toastSafe(`نام کاربری اختصاصی ${widget.username} برای ویجت ساخته شد.`, "success");
    } catch (error) { toastSafe(error.message, "danger"); }
    finally { setLoading(false); }
  }

  async function renderWidgets() {
    setLoading(true);
    app.widgets = await WidgetAPI.listWidgets();
    const summaries = app.widgets.map(widget => ({ widget, summary: summarizeWidget(widget) }));
    const totals = summaries.reduce((acc, row) => {
      acc.sessions += row.summary.sessions; acc.pending += row.summary.pending; acc.published += row.widget.status === "published" ? 1 : 0; acc.human += row.summary.humanEscalations; return acc;
    }, { sessions: 0, pending: 0, published: 0, human: 0 });
    view.innerHTML = `
      <div class="ww-page-header">
        <div><h1>ویجت‌های من</h1><p>هر ویجت یک نام کاربری مستقل، دامنه مقصد، منابع دانشی و اپراتورهای مجاز مخصوص خود دارد.</p></div>
        <div class="ww-header-actions"><button class="btn btn-primary" id="btnCreateWidget"><i class="fa-solid fa-plus"></i> ایجاد ویجت جدید</button></div>
      </div>
      <div class="ww-kpi-grid">
        ${kpi("ویجت‌های منتشرشده", totals.published, "از مجموع " + fa(app.widgets.length), "fa-window-restore", "")}
        ${kpi("نشست‌های ۷ روز اخیر", totals.sessions, "مجموع استفاده از همه ویجت‌ها", "fa-comments", "success")}
        ${kpi("ارجاع به انسان", totals.human, "پرسش‌های خارج از پاسخ خودکار", "fa-headset", "purple")}
        ${kpi("در انتظار پاسخ", totals.pending, "نیازمند اقدام اپراتورها", "fa-clock", totals.pending ? "danger" : "success")}
      </div>
      <div class="ww-toolbar">
        <div class="ww-search"><i class="fa-solid fa-magnifying-glass"></i><input class="form-control" id="wwWidgetSearch" placeholder="جست‌وجو در نام، دامنه یا نام کاربری ویجت..."></div>
        <select class="form-select" id="wwWidgetStatus" style="max-width:190px"><option value="all">همه وضعیت‌ها</option><option value="published">منتشرشده</option><option value="changed">تغییرات منتشرنشده</option><option value="draft">پیش‌نویس</option><option value="disabled">غیرفعال</option></select>
      </div>
      <div id="wwWidgetGrid" class="ww-widget-grid">${renderWidgetCards(summaries)}</div>`;
    document.getElementById("btnCreateWidget").onclick = createWidget;
    document.getElementById("wwWidgetSearch").addEventListener("input", filterWidgets);
    document.getElementById("wwWidgetStatus").addEventListener("change", filterWidgets);
    view.onclick = widgetsClickHandler;
    setLoading(false);
  }

  function kpi(label, value, note, icon, cls) {
    const displayValue = typeof value === "number" ? fa(value) : esc(value);
    return `<div class="ww-kpi"><div><div class="ww-kpi-label">${esc(label)}</div><div class="ww-kpi-value">${displayValue}</div><div class="ww-kpi-note">${esc(note)}</div></div><div class="ww-kpi-icon ${cls}"><i class="fa-solid ${icon}"></i></div></div>`;
  }

  function renderWidgetCards(rows) {
    if (!rows.length) return `<div class="ww-card ww-empty-state" style="grid-column:1/-1"><div><i class="fa-solid fa-puzzle-piece"></i><h3>هنوز ویجتی ندارید</h3><p>با ایجاد نخستین ویجت، نام کاربری اختصاصی آن به‌صورت خودکار ساخته می‌شود.</p><button class="btn btn-primary" data-action="create"><i class="fa-solid fa-plus"></i> ساخت اولین ویجت</button></div></div>`;
    return rows.map(({ widget, summary }) => {
      const status = STATUS_META[widget.status] || STATUS_META.draft;
      const logo = widget.appearance.logoDataUrl ? `<img src="${esc(widget.appearance.logoDataUrl)}" alt="">` : `<span>${esc(initials(widget.appearance.assistantName || widget.internalName))}</span>`;
      return `<article class="ww-card ww-widget-card" data-widget-card="${widget.id}" data-status="${widget.status}" data-search="${esc(`${widget.internalName} ${widget.destinationDomain} ${widget.username}`.toLowerCase())}" style="--widget-color:${esc(widget.appearance.primaryColor)}">
        <div class="ww-widget-accent"></div><div class="ww-widget-card-content">
          <div class="ww-widget-card-head"><div class="ww-widget-identity"><div class="ww-widget-logo">${logo}</div><div class="min-width-0"><h3>${esc(widget.internalName)}</h3><small>${esc(widget.destinationDomain || "دامنه تعیین نشده")}</small></div></div><span class="ww-status ${status.cls}"><i class="fa-solid ${status.icon}"></i>${status.label}</span></div>
          <div class="ww-widget-user"><i class="fa-solid fa-robot"></i><span>نام کاربری مستقل ویجت:</span><code>${esc(widget.username)}</code></div>
          <div class="ww-widget-meta"><div><strong>${fa(summary.sessions)}</strong><small>نشست در ۷ روز</small></div><div><strong>${fa(summary.files)}</strong><small>فایل آماده</small></div><div><strong>${fa(summary.pending)}</strong><small>در انتظار انسان</small></div></div>
          <div class="ww-widget-actions">${widget.canManage ? `<button class="btn btn-sm btn-primary" data-action="edit" data-id="${widget.id}"><i class="fa-solid fa-pen-to-square"></i> ویرایش</button><button class="btn btn-sm btn-outline-primary" data-action="test" data-id="${widget.id}"><i class="fa-solid fa-flask"></i> آزمایش</button>` : `<span class="badge text-bg-light border"><i class="fa-solid fa-headset"></i> دسترسی اپراتور</span>`}<button class="btn btn-sm btn-outline-secondary" data-action="inbox" data-id="${widget.id}"><i class="fa-solid fa-headset"></i> گفتگوها</button>${widget.canManage ? `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${widget.id}"><i class="fa-solid fa-trash-can"></i></button>` : ""}</div>
        </div></article>`;
    }).join("");
  }

  function filterWidgets() {
    const q = document.getElementById("wwWidgetSearch").value.trim().toLowerCase();
    const status = document.getElementById("wwWidgetStatus").value;
    document.querySelectorAll("[data-widget-card]").forEach(card => {
      const visible = (!q || card.dataset.search.includes(q)) && (status === "all" || card.dataset.status === status);
      card.classList.toggle("hidden", !visible);
    });
  }

  async function widgetsClickHandler(event) {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const action = button.dataset.action; const id = button.dataset.id;
    if (action === "create") return createWidget();
    if (action === "edit") location.hash = `editor/${id}/identity`;
    if (action === "test") location.hash = `editor/${id}/test`;
    if (action === "inbox") { app.inboxWidget = id; location.hash = "inbox"; }
    if (action === "delete") {
      const accepted = await confirmSafe("حذف ویجت", "ویجت، تنظیمات، فایل‌ها و گفتگوهای آن از نسخه دمو حذف می‌شوند. ادامه می‌دهید؟");
      if (!accepted) return;
      await WidgetAPI.deleteWidget(id); toastSafe("ویجت حذف شد", "info"); renderWidgets();
    }
  }

  async function renderEditor() {
    view.onclick = null;
    setLoading(true);
    try { app.widget = await WidgetAPI.getWidget(app.editorId); }
    catch { location.hash = "widgets"; return; }
    const widget = app.widget; const status = STATUS_META[widget.status] || STATUS_META.draft;
    view.innerHTML = `
      <div class="ww-editor-header">
        <div class="ww-editor-title"><button class="btn btn-sm btn-outline-secondary" id="btnBackWidgets"><i class="fa-solid fa-arrow-right"></i></button><div class="min-width-0"><div class="d-flex align-items-center gap-2"><h1>${esc(widget.internalName)}</h1><span class="ww-status ${status.cls}"><i class="fa-solid ${status.icon}"></i>${status.label}</span></div><small>${esc(widget.username)} · ${esc(widget.destinationDomain || "دامنه تعیین نشده")}</small></div></div>
        <div class="ww-editor-actions"><button class="btn btn-outline-secondary" id="btnSaveEditor"><i class="fa-solid fa-floppy-disk"></i> ذخیره تغییرات</button><button class="btn btn-primary" id="btnPublishEditor"><i class="fa-solid fa-rocket"></i> ${widget.status === "published" ? "انتشار مجدد" : "انتشار"}</button></div>
      </div>
      <section class="ww-card ww-wizard">
        <nav class="ww-wizard-tabs">${wizardTabs(widget)}</nav>
        <div class="ww-wizard-content" id="wwWizardContent">${renderEditorTab(widget, app.editorTab)}</div>
      </section>`;
    document.getElementById("btnBackWidgets").onclick = async () => { await saveCurrentEditorTab(false); location.hash = "widgets"; };
    document.getElementById("btnSaveEditor").onclick = () => saveCurrentEditorTab(true);
    document.getElementById("btnPublishEditor").onclick = async () => { await saveCurrentEditorTab(false); await publishCurrent(); };
    document.querySelectorAll(".ww-wizard-tab").forEach(button => button.onclick = async () => { await saveCurrentEditorTab(false); location.hash = `editor/${widget.id}/${button.dataset.tab}`; });
    bindEditorTab(widget, app.editorTab);
    setLoading(false);
  }

  function wizardTabs(widget) {
    const items = [
      ["identity", "ویژگی‌ها و ظاهر", "fa-sliders"],
      ["knowledge", "فایل‌ها و دانش", "fa-database"],
      ["behavior", "رفتار و ارجاع", "fa-code-branch"],
      ["operators", "اپراتورها", "fa-users-gear"],
      ["test", "آزمایش", "fa-flask"],
      ["publish", "انتشار و نصب", "fa-rocket"]
    ];
    return items.map(([key, label, icon]) => `<button class="ww-wizard-tab ${app.editorTab === key ? "active" : ""} ${tabComplete(widget, key) ? "complete" : ""}" data-tab="${key}"><i class="fa-solid ${icon}"></i>${label}</button>`).join("");
  }

  function tabComplete(widget, tab) {
    if (tab === "identity") return widget.internalName && widget.destinationDomain && widget.appearance.title;
    if (tab === "knowledge") return widget.files.some(file => file.status === "ready");
    if (tab === "behavior") return String(widget.behavior.requiredPrompt || "").length > 20;
    if (tab === "operators") return widget.operators.some(item => item.active);
    if (tab === "test") return Boolean(widget.lastTestAt);
    if (tab === "publish") return widget.status === "published";
    return false;
  }

  function renderEditorTab(widget, tab) {
    if (tab === "knowledge") return renderKnowledgeTab(widget);
    if (tab === "behavior") return renderBehaviorTab(widget);
    if (tab === "operators") return renderOperatorsTab(widget);
    if (tab === "test") return renderTestTab(widget);
    if (tab === "publish") return renderPublishTab(widget);
    return renderIdentityTab(widget);
  }

  function renderIdentityTab(widget) {
    const ap = widget.appearance;
    const logo = ap.logoDataUrl ? `<img src="${esc(ap.logoDataUrl)}" alt="">` : `<span>${esc(initials(ap.assistantName || widget.internalName))}</span>`;
    return `<div class="ww-grid-2"><div class="ww-stack">
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-fingerprint"></i><div><h3>هویت و دامنه ویجت</h3><p>مالک ویجت و نام کاربری اختصاصی آن دو حساب جدا هستند. نام کاربری ویجت پس از ایجاد قابل تغییر نیست.</p></div></div>
        <div class="ww-form-grid"><div class="ww-form-field"><label for="wwInternalName">نام داخلی ویجت</label><input id="wwInternalName" class="form-control" value="${esc(widget.internalName)}"><div class="form-text">فقط در پنل مالک دیده می‌شود.</div></div><div class="ww-form-field"><label for="wwDomain">دامنه مقصد</label><input id="wwDomain" class="form-control ltr" value="${esc(widget.destinationDomain)}" placeholder="https://support.example.com"><div class="form-text">ویجت عمومی فقط روی همین دامنه اجرا خواهد شد.</div></div><div class="ww-form-field full"><label>نام کاربری اختصاصی ویجت</label><div class="ww-readonly-code"><code>${esc(widget.username)}</code><button class="btn btn-sm btn-outline-secondary" type="button" data-copy="${esc(widget.username)}"><i class="fa-solid fa-copy"></i></button></div></div></div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-message"></i><div><h3>متن‌ها و معرفی</h3><p>متن‌هایی که بازدیدکننده سایت مقصد در سربرگ و شروع گفتگو می‌بیند.</p></div></div>
        <div class="ww-form-grid"><div class="ww-form-field"><label>عنوان ویجت</label><input id="wwTitle" class="form-control" value="${esc(ap.title)}"></div><div class="ww-form-field"><label>نام دستیار</label><input id="wwAssistantName" class="form-control" value="${esc(ap.assistantName)}"></div><div class="ww-form-field full"><label>زیرعنوان</label><input id="wwSubtitle" class="form-control" value="${esc(ap.subtitle)}"></div><div class="ww-form-field full"><label>پیام خوشامدگویی</label><textarea id="wwWelcome" class="form-control" rows="3">${esc(ap.welcomeMessage)}</textarea></div><div class="ww-form-field"><label>متن داخل کادر پرسش</label><input id="wwPlaceholder" class="form-control" value="${esc(ap.inputPlaceholder)}"></div><div class="ww-form-field"><label>حباب دعوت اولیه</label><input id="wwGreeting" class="form-control" value="${esc(ap.greetingBubble)}"></div><div class="ww-form-field full"><label>پرسش‌های پیشنهادی</label><textarea id="wwQuickQuestions" class="form-control" rows="4">${esc((ap.quickQuestions || []).join("\n"))}</textarea><div class="form-text">هر پرسش را در یک خط بنویسید.</div></div></div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-palette"></i><div><h3>ظاهر و نحوه نمایش</h3><p>رنگ، حالت نمایش، محل قرارگیری و رفتار اولیه پنجره چت.</p></div></div>
        <div class="ww-form-grid cols-3"><div class="ww-form-field"><label>رنگ اصلی</label><div class="ww-color-row"><input id="wwColorPicker" class="form-control form-control-color" type="color" value="${esc(ap.primaryColor)}"><input id="wwColorText" class="form-control ltr" value="${esc(ap.primaryColor)}"></div></div><div class="ww-form-field"><label>پوسته ویجت</label><select id="wwTheme" class="form-select"><option value="light" ${ap.theme === "light" ? "selected" : ""}>روشن</option><option value="dark" ${ap.theme === "dark" ? "selected" : ""}>تیره</option><option value="auto" ${ap.theme === "auto" ? "selected" : ""}>هماهنگ با سایت</option></select></div><div class="ww-form-field"><label>محل دکمه</label><select id="wwPosition" class="form-select"><option value="right" ${ap.position === "right" ? "selected" : ""}>پایین راست</option><option value="left" ${ap.position === "left" ? "selected" : ""}>پایین چپ</option></select></div></div>
        <div class="ww-form-grid mt-3"><div class="ww-switch-card"><div><strong>نمایش نشان فاپا</strong><small>عبارت «قدرت‌گرفته از دستیار هوشمند فاپا» در پایین ویجت نمایش داده شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwBranding" type="checkbox" ${ap.showBranding ? "checked" : ""}></div></div><div class="ww-switch-card"><div><strong>بازشدن خودکار</strong><small>پنجره ویجت چند ثانیه پس از ورود کاربر باز شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwAutoOpen" type="checkbox" ${ap.autoOpen ? "checked" : ""}></div></div><div class="ww-form-field"><label>تأخیر بازشدن خودکار</label><div class="input-group"><input id="wwAutoDelay" class="form-control" type="number" min="1" max="60" value="${Number(ap.autoOpenDelay || 5)}"><span class="input-group-text">ثانیه</span></div></div></div>
      </section>
    </div><aside class="ww-stack"><div class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>لوگو یا آواتار</h3><p>تصویر در پروفایل ویجت ذخیره می‌شود؛ فایل سبک و مربعی نتیجه بهتری دارد.</p></div></div><div class="ww-logo-uploader"><div class="ww-logo-preview" id="wwLogoPreview" style="--preview-color:${esc(ap.primaryColor)}">${logo}</div><div class="ww-logo-actions"><label class="btn btn-outline-primary btn-sm" for="wwLogoInput"><i class="fa-solid fa-upload"></i> انتخاب تصویر</label><input id="wwLogoInput" class="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button class="btn btn-outline-danger btn-sm" id="wwRemoveLogo" type="button"><i class="fa-solid fa-trash-can"></i> حذف لوگو</button></div></div></div>
      <div class="ww-identity-help"><i class="fa-solid fa-shield-halved"></i><div><strong>محدودیت دامنه در سمت سرور نیز باید اعمال شود.</strong><br>شناسه عمومی ویجت قابل مشاهده است؛ اما توکن کاربر اختصاصی ویجت و دسترسی فایل‌ها هرگز نباید در کد نصب قرار گیرد.</div></div>
      <div class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><h3>تفکیک هویت‌ها</h3></div><div class="ww-detail-row"><span>مالک و مدیر</span><strong>${esc(widget.ownerUsername)}</strong></div><div class="ww-detail-row"><span>کاربر LLM ویجت</span><strong class="ltr">${esc(widget.username)}</strong></div><div class="ww-detail-row"><span>اپراتورهای مجاز</span><strong>${fa(widget.operators.length)} نفر</strong></div></div>
    </aside></div>`;
  }

  function renderKnowledgeTab(widget) {
    return `<div class="ww-stack"><div class="ww-knowledge-owner"><i class="fa-solid fa-database"></i><div>فایل‌های این بخش در فضای اختصاصی کاربر <code>${esc(widget.username)}</code> بارگذاری می‌شوند. بازدیدکنندگان سایت فقط می‌توانند بر مبنای آن‌ها سؤال بپرسند و امکان بارگذاری یا حذف فایل ندارند.</div></div>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>افزودن منابع دانش</h3><p>فایل‌ها پس از بارگذاری، استخراج متن و ایندکس برای پاسخ‌گویی آماده می‌شوند.</p></div></div><label class="ww-dropzone" id="wwDropzone" for="wwFileInput"><div><i class="fa-solid fa-cloud-arrow-up"></i><h3>فایل‌ها را اینجا رها کنید یا کلیک کنید</h3><p>PDF، DOC، DOCX، ODT، TXT و Markdown — امکان انتخاب چند فایل</p></div></label><input id="wwFileInput" class="hidden" type="file" multiple accept=".pdf,.doc,.docx,.odt,.txt,.md"></section>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>فایل‌های ویجت</h3><p>${fa(widget.files.length)} فایل ثبت شده؛ ${fa(widget.files.filter(file => file.status === "ready").length)} فایل آماده است.</p></div></div><div class="ww-file-list" id="wwFileList">${renderFiles(widget.files)}</div></section></div>`;
  }

  function renderFiles(files) {
    if (!files.length) return `<div class="ww-empty-state" style="min-height:190px"><div><i class="fa-solid fa-file-circle-plus"></i><h3>هنوز فایلی افزوده نشده است</h3><p>دانش ویجت از فایل‌های همین بخش ساخته می‌شود.</p></div></div>`;
    return files.map(file => {
      const meta = file.status === "ready" ? ["آماده", "text-success", "fa-circle-check"] : file.status === "failed" ? ["ناموفق", "text-danger", "fa-circle-xmark"] : file.status === "processing" ? ["در حال پردازش", "text-warning", "fa-gears"] : ["در حال بارگذاری", "text-primary", "fa-cloud-arrow-up"];
      return `<div class="ww-file-item" data-file-id="${file.id}"><div class="ww-file-icon"><i class="fa-solid fa-file-${file.type === "pdf" ? "pdf" : file.type === "txt" || file.type === "md" ? "lines" : "word"}"></i></div><div class="ww-file-main"><strong>${esc(file.name)}</strong><small>${bytesHuman(file.size)} · ${file.status === "ready" ? `${fa(file.chunks)} بخش دانشی · ${formatDate(file.uploadedAt)}` : meta[0]}</small>${file.status !== "ready" ? `<div class="ww-progress"><span style="width:${Number(file.progress || 0)}%"></span></div>` : ""}</div><div class="ww-file-actions"><span class="ww-file-status ${meta[1]}"><i class="fa-solid ${meta[2]}"></i> ${meta[0]}</span>${file.status === "failed" ? `<button class="btn btn-sm btn-outline-warning" data-action="retry-file" data-id="${file.id}"><i class="fa-solid fa-rotate"></i></button>` : ""}<button class="btn btn-sm btn-outline-danger" data-action="delete-file" data-id="${file.id}"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
    }).join("");
  }

  function renderBehaviorTab(widget) {
    const b = widget.behavior; const hh = b.humanHandoff; const schedule = hh.schedule || defaultSchedule();
    return `<div class="ww-stack">
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-terminal"></i><div><h3>پرامپت الزامی و حدود پاسخ</h3><p>این متن در سمت سرور پیش از هر پرسش بازدیدکننده به مدل افزوده می‌شود و در اختیار مصرف‌کننده قرار نمی‌گیرد.</p></div></div><div class="ww-form-grid"><div class="ww-form-field full"><label>پرامپت الزامی</label><textarea id="wwRequiredPrompt" class="form-control" rows="7">${esc(b.requiredPrompt)}</textarea></div><div class="ww-form-field"><label>محدوده دانش</label><select id="wwAnswerMode" class="form-select"><option value="files-only" ${b.answerMode === "files-only" ? "selected" : ""}>فقط فایل‌های اختصاصی ویجت</option><option value="files-plus-general" ${b.answerMode === "files-plus-general" ? "selected" : ""}>فایل‌ها همراه دانش عمومی مدل</option></select></div><div class="ww-form-field"><label>لحن پاسخ</label><select id="wwTone" class="form-select"><option value="formal" ${b.tone === "formal" ? "selected" : ""}>رسمی و سازمانی</option><option value="friendly" ${b.tone === "friendly" ? "selected" : ""}>دوستانه</option><option value="sales" ${b.tone === "sales" ? "selected" : ""}>فروش‌محور</option><option value="technical" ${b.tone === "technical" ? "selected" : ""}>فنی</option></select></div><div class="ww-form-field"><label>طول پاسخ</label><select id="wwResponseLength" class="form-select"><option value="short" ${b.responseLength === "short" ? "selected" : ""}>کوتاه</option><option value="balanced" ${b.responseLength === "balanced" ? "selected" : ""}>متعادل</option><option value="detailed" ${b.responseLength === "detailed" ? "selected" : ""}>تشریحی</option></select></div><div class="ww-switch-card"><div><strong>نمایش رفرنس پاسخ</strong><small>نام فایل یا منبعی که پاسخ از آن استخراج شده است به بازدیدکننده نمایش داده شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwShowReferences" type="checkbox" ${b.showReferences ? "checked" : ""}></div></div><div class="ww-form-field full"><label>پیام نبود پاسخ مطمئن</label><textarea id="wwFallback" class="form-control" rows="3">${esc(b.fallbackMessage)}</textarea></div></div></section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-code-branch"></i><div><h3>شرایط ارجاع به پشتیبان انسانی</h3><p>ارجاع می‌تواند به دلیل نوع موضوع، عبارت‌های خاص یا پایین‌بودن اطمینان پاسخ انجام شود. سؤال ارجاع‌شده برای اپراتورها ذخیره می‌شود.</p></div></div>
        <div class="ww-form-grid"><div class="ww-switch-card"><div><strong>فعال‌بودن پاسخ‌گویی انسانی</strong><small>در صورت خاموش‌بودن، ویجت فقط پیام نبود پاسخ را نمایش می‌دهد.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwHandoffEnabled" type="checkbox" ${hh.enabled ? "checked" : ""}></div></div><div class="ww-switch-card"><div><strong>دریافت اطلاعات تماس</strong><small>پس از ارجاع، نام و شماره یا ایمیل از بازدیدکننده درخواست شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwCollectContact" type="checkbox" ${hh.collectContact ? "checked" : ""}></div></div><div class="ww-switch-card"><div><strong>ارجاع بر اساس اطمینان</strong><small>پاسخ‌هایی که اطمینان مدل کمتر از آستانه است به انسان واگذار شوند.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwLowConfidence" type="checkbox" ${hh.lowConfidenceEnabled ? "checked" : ""}></div></div><div class="ww-form-field"><label>آستانه اطمینان</label><div class="ww-threshold-row"><input id="wwConfidence" type="range" class="form-range" min="30" max="90" value="${Number(hh.confidenceThreshold || 60)}"><output id="wwConfidenceOutput">${fa(hh.confidenceThreshold || 60)}٪</output></div></div><div class="ww-form-field full"><label>موضوعاتی که باید به انسان ارجاع شوند</label><div class="ww-chip-grid">${Object.entries(CATEGORY_META).map(([key, meta]) => `<div class="ww-check-chip"><input id="cat-${key}" name="wwCategory" type="checkbox" value="${key}" ${hh.categories?.includes(key) ? "checked" : ""}><label for="cat-${key}"><i class="fa-solid ${meta.icon}"></i>${meta.label}</label></div>`).join("")}</div></div><div class="ww-form-field full"><label>عبارت‌های ارجاع اجباری</label><textarea id="wwKeywords" class="form-control" rows="3">${esc((hh.keywords || []).join("، "))}</textarea><div class="form-text">عبارت‌ها را با ویرگول یا سطر جدید جدا کنید؛ مانند «پیش‌فاکتور، شکایت، اپراتور».</div></div></div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-calendar-days"></i><div><h3>روزها و ساعت‌های پاسخ‌گویی انسانی</h3><p>در ساعات فعال، کاربر در صف اپراتور قرار می‌گیرد. بیرون از این ساعات، سؤال ذخیره و برای پاسخ بعدی نگهداری می‌شود.</p></div></div><div class="ww-form-grid"><div class="ww-form-field"><label>منطقه زمانی</label><select id="wwTimezone" class="form-select"><option value="Asia/Tehran" ${schedule.timezone === "Asia/Tehran" ? "selected" : ""}>تهران</option><option value="Asia/Dubai" ${schedule.timezone === "Asia/Dubai" ? "selected" : ""}>دبی</option><option value="Europe/London" ${schedule.timezone === "Europe/London" ? "selected" : ""}>لندن</option><option value="America/Toronto" ${schedule.timezone === "America/Toronto" ? "selected" : ""}>تورنتو</option></select></div><div class="ww-form-field"><label>رفتار خارج از ساعت کاری</label><select id="wwOutsideBehavior" class="form-select"><option value="queue" ${hh.outsideHoursBehavior === "queue" ? "selected" : ""}>ذخیره سؤال برای پاسخ بعدی</option><option value="contact" ${hh.outsideHoursBehavior === "contact" ? "selected" : ""}>دریافت اطلاعات تماس و ایجاد درخواست</option><option value="message-only" ${hh.outsideHoursBehavior === "message-only" ? "selected" : ""}>فقط نمایش پیام عدم حضور</option></select></div></div><div class="ww-table-wrap mt-3"><table class="ww-schedule-table"><thead><tr><th>روز</th><th>فعال</th><th>شروع</th><th>پایان</th></tr></thead><tbody>${WEEKDAYS.map(dayItem => { const row = schedule.days[dayItem.key] || { enabled: false, start: "08:00", end: "17:00" }; return `<tr data-day="${dayItem.key}"><td><strong>${dayItem.label}</strong></td><td><div class="form-check form-switch"><input class="form-check-input ww-day-enabled" type="checkbox" ${row.enabled ? "checked" : ""}></div></td><td><input class="form-control ww-day-start" type="time" value="${row.start}"></td><td><input class="form-control ww-day-end" type="time" value="${row.end}"></td></tr>`; }).join("")}</tbody></table></div></section>
    </div>`;
  }

  function renderOperatorsTab(widget) {
    return `<div class="ww-stack"><div class="ww-identity-help"><i class="fa-solid fa-users"></i><div><strong>اپراتورها کاربران مستقل سامانه هستند.</strong><br>مالک نام کاربری افرادی را ثبت می‌کند که مجازند گفتگوهای ارجاع‌شده را ببینند و پاسخ دهند. نام نمایشی و تصویر هر اپراتور از پروفایل خودش خوانده می‌شود.</div></div>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>افزودن اپراتور مجاز</h3><p>کاربر باید ابتدا در صفحه پروفایل یک نام کاربری یکتا ثبت کرده باشد.</p></div><a class="btn btn-sm btn-outline-secondary" href="/profile" target="_blank"><i class="fa-solid fa-address-card"></i> صفحه پروفایل</a></div><div class="ww-operator-add"><div class="ww-form-field"><label>نام کاربری</label><input id="wwOperatorUsername" class="form-control ltr" placeholder="operator-username"></div><button class="btn btn-primary" id="btnAddOperator"><i class="fa-solid fa-user-plus"></i> افزودن</button></div></section>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>اپراتورهای پاسخ‌گو</h3><p>${fa(widget.operators.length)} کاربر ثبت شده است؛ آمار تفکیکی در بخش «آمار استفاده» نمایش داده می‌شود.</p></div></div><div class="ww-operator-list">${widget.operators.length ? widget.operators.map(operator => `<div class="ww-operator-item"><div class="ww-operator-avatar">${operator.avatar ? `<img src="${esc(operator.avatar)}" alt="">` : esc(initials(operator.displayName))}</div><div class="ww-operator-main"><strong>${esc(operator.displayName)}</strong><small class="ltr">${esc(operator.username)}</small></div><div class="ww-op-stat"><strong>${operator.role === "Owner" ? "مالک" : "اپراتور"}</strong><small>سطح دسترسی</small></div><div class="ww-op-stat"><strong class="${operator.active ? "text-success" : "text-muted"}">${operator.active ? "فعال" : "غیرفعال"}</strong><small>وضعیت</small></div><div class="d-flex gap-1"><button class="btn btn-sm ${operator.active ? "btn-outline-warning" : "btn-outline-success"}" data-action="toggle-operator" data-username="${esc(operator.username)}" title="${operator.active ? "غیرفعال‌کردن" : "فعال‌کردن"}"><i class="fa-solid ${operator.active ? "fa-pause" : "fa-play"}"></i></button><button class="btn btn-sm btn-outline-danger" data-action="remove-operator" data-username="${esc(operator.username)}"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join("") : `<div class="ww-empty-state" style="min-height:180px"><div><i class="fa-solid fa-user-shield"></i><h3>اپراتور دیگری ثبت نشده است</h3><p>مالک ویجت همچنان به صندوق پاسخ‌گویی دسترسی دارد؛ برای واگذاری گفتگوها اپراتور اضافه کنید.</p></div></div>`}</div></section></div>`;
  }

  function renderTestTab(widget) {
    const ap = widget.appearance;
    if (!app.testMessages.length) app.testMessages = [{ sender: "assistant", text: ap.welcomeMessage, references: [] }];
    return `<div class="ww-stack"><div class="ww-preview-toolbar"><div class="ww-device-buttons"><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "desktop" ? "active" : ""}" data-device="desktop"><i class="fa-solid fa-desktop"></i> دسکتاپ</button><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "tablet" ? "active" : ""}" data-device="tablet"><i class="fa-solid fa-tablet-screen-button"></i> تبلت</button><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "mobile" ? "active" : ""}" data-device="mobile"><i class="fa-solid fa-mobile-screen"></i> موبایل</button></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" id="btnResetTest"><i class="fa-solid fa-rotate-left"></i> شروع دوباره</button><a class="btn btn-sm btn-outline-primary" href="webwidget-demo-site.html?widget=${widget.id}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> صفحه نمونه مستقل</a></div></div>
      <div class="ww-preview-stage"><div class="ww-preview-browser ${app.testDevice}" id="wwPreviewBrowser"><div class="ww-browser-bar"><span class="ww-browser-dot"></span><span class="ww-browser-dot"></span><span class="ww-browser-dot"></span><div class="ww-browser-address">${esc(widget.destinationDomain || "https://example.com")}</div></div><div class="ww-fake-site-nav"><div class="ww-fake-logo">F</div><strong>فناوری اطلاعات فاپا</strong><div class="ww-fake-links"><span>محصولات</span><span>راهکارها</span><span>خدمات</span><span>تماس</span></div></div><div class="ww-fake-hero"><span class="badge text-bg-primary">سایت مقصد شبیه‌سازی‌شده</span><h2>راهکارهای نرم‌افزاری و سخت‌افزاری برای سازمان‌ها</h2><p>این محیط نشان می‌دهد ویجت بعد از نصب روی دامنه مقصد چگونه دیده می‌شود. سؤال‌هایی که ویجت نتواند پاسخ دهد در پنل انسانی ثبت خواهند شد.</p><button class="btn btn-primary">مشاهده راهکارها</button></div><div class="ww-fake-products"><div class="ww-fake-product"><span>🖥️</span><strong>نرم‌افزارهای سازمانی</strong><small>اتوماسیون و مدیریت خدمات</small></div><div class="ww-fake-product"><span>🛡️</span><strong>امنیت و زیرساخت</strong><small>تجهیزات، نصب و پشتیبانی</small></div><div class="ww-fake-product"><span>🎧</span><strong>خدمات پس از فروش</strong><small>گارانتی و نگهداری</small></div></div>${renderTestWidget(widget)}</div></div></div>`;
  }

  function renderTestWidget(widget) {
    const ap = widget.appearance; const position = ap.position === "left" ? "left" : "right";
    const logo = ap.logoDataUrl ? `<img src="${esc(ap.logoDataUrl)}" alt="">` : esc(initials(ap.assistantName));
    return `<div class="ww-test-widget-layer" style="--widget-color:${esc(ap.primaryColor)}"><button class="ww-test-launcher ${position} ${app.testOpen ? "hidden" : ""}" id="wwTestLauncher"><i class="fa-solid fa-comments"></i></button>${ap.greetingBubble ? `<div class="ww-test-greeting ${position} ${app.testOpen ? "hidden" : ""}" id="wwTestGreeting">${esc(ap.greetingBubble)}</div>` : ""}<section class="ww-test-chat ${position} ${ap.theme === "dark" ? "dark" : ""} ${app.testOpen ? "" : "hidden"}" id="wwTestChat"><header class="ww-test-chat-head"><div class="ww-test-chat-avatar">${logo}</div><div><strong>${esc(ap.title)}</strong><small>${esc(ap.subtitle)}</small></div><button id="wwTestClose"><i class="fa-solid fa-xmark"></i></button></header><div class="ww-test-messages" id="wwTestMessages">${app.testMessages.map(renderTestMessage).join("")}</div>${(ap.quickQuestions || []).length ? `<div class="ww-test-quick">${ap.quickQuestions.slice(0, 4).map(q => `<button type="button" data-test-question="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}<div id="wwTestContactSlot">${app.testConversationId && widget.behavior.humanHandoff.collectContact ? renderTestContact() : ""}</div><form class="ww-test-input" id="wwTestForm"><textarea class="form-control" id="wwTestInput" placeholder="${esc(ap.inputPlaceholder)}"></textarea><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button></form>${ap.showBranding ? '<div class="text-center text-muted pb-2" style="font-size:.55rem">قدرت‌گرفته از دستیار هوشمند فاپا</div>' : ""}</section></div>`;
  }

  function renderTestMessage(message) {
    const refs = message.references?.length ? `<div class="ww-refs">منبع: ${message.references.map(ref => esc(ref.name)).join("، ")}</div>` : "";
    return `<div class="ww-test-message ${message.sender}">${esc(message.text)}${refs}</div>`;
  }

  function renderTestContact() {
    return `<div class="ww-test-contact"><div class="input-group input-group-sm"><input class="form-control" id="wwTestVisitorName" placeholder="نام"><input class="form-control" id="wwTestVisitorContact" placeholder="شماره یا ایمیل"><button class="btn btn-outline-primary" type="button" id="btnSaveTestContact">ثبت</button></div></div>`;
  }

  function renderPublishTab(widget) {
    return `<div class="ww-grid-2"><div class="ww-stack"><section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>چک‌لیست آمادگی انتشار</h3><p id="wwValidationSummary">در حال بررسی تنظیمات...</p></div></div><div class="ww-publish-checklist" id="wwPublishChecklist"><div class="text-muted">در حال بارگذاری...</div></div></section><section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>کد نصب روی سایت مقصد</h3><p>کد را پیش از بسته‌شدن تگ body در دامنه مقصد قرار دهید.</p></div></div><div class="ww-install-code"><pre id="wwInstallCode">در حال تولید کد...</pre><button class="btn btn-sm btn-light" id="btnCopyInstall"><i class="fa-solid fa-copy"></i> کپی کد</button></div></section></div><aside class="ww-stack"><section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><h3>وضعیت انتشار</h3></div><div class="ww-publish-summary"><div><small>وضعیت</small><strong>${STATUS_META[widget.status]?.label || widget.status}</strong></div><div><small>نسخه منتشرشده</small><strong>${fa(widget.publishedVersion || 0)}</strong></div><div><small>آخرین انتشار</small><strong>${formatDateTime(widget.publishedAt)}</strong></div></div><div class="d-grid gap-2 mt-3"><button class="btn btn-primary" id="btnPublishNow"><i class="fa-solid fa-rocket"></i> ${widget.status === "published" ? "انتشار مجدد" : "انتشار ویجت"}</button>${widget.status === "published" || widget.status === "changed" ? `<button class="btn btn-outline-danger" id="btnUnpublish"><i class="fa-solid fa-circle-pause"></i> غیرفعال‌کردن نسخه عمومی</button>` : ""}<a class="btn btn-outline-secondary" href="webwidget-demo-site.html?widget=${widget.id}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> بازکردن سایت نمونه</a></div></section><div class="ww-identity-help"><i class="fa-solid fa-lock"></i><div><strong>کد نصب فقط شناسه عمومی ویجت را دارد.</strong><br>نام کاربری LLM، توکن دسترسی و فایل‌های اختصاصی باید در سمت سرور نگهداری شوند.</div></div></aside></div>`;
  }

  function bindEditorTab(widget, tab) {
    document.querySelectorAll("[data-copy]").forEach(button => button.onclick = () => copyText(button.dataset.copy));
    if (tab === "identity") bindIdentity(widget);
    if (tab === "knowledge") bindKnowledge(widget);
    if (tab === "behavior") bindBehavior();
    if (tab === "operators") bindOperators(widget);
    if (tab === "test") bindTest(widget);
    if (tab === "publish") bindPublish(widget);
  }

  function bindIdentity(widget) {
    const picker = document.getElementById("wwColorPicker"), text = document.getElementById("wwColorText"), preview = document.getElementById("wwLogoPreview");
    picker.oninput = () => { text.value = picker.value; preview.style.setProperty("--preview-color", picker.value); };
    text.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { picker.value = text.value; preview.style.setProperty("--preview-color", text.value); } };
    document.getElementById("wwLogoInput").onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 500 * 1024) return toastSafe("حجم لوگو باید کمتر از ۵۰۰ کیلوبایت باشد", "warning");
      const dataUrl = await readDataUrl(file); await WidgetAPI.updateWidget(widget.id, { appearance: { logoDataUrl: dataUrl } }); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor();
    };
    document.getElementById("wwRemoveLogo").onclick = async () => { await WidgetAPI.updateWidget(widget.id, { appearance: { logoDataUrl: "" } }); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); };
  }

  function bindKnowledge(widget) {
    const input = document.getElementById("wwFileInput"), zone = document.getElementById("wwDropzone");
    input.onchange = () => uploadFiles(widget.id, input.files);
    ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", event => uploadFiles(widget.id, event.dataTransfer.files));
    document.getElementById("wwFileList").onclick = async event => {
      const button = event.target.closest("[data-action]"); if (!button) return;
      if (button.dataset.action === "delete-file") { const ok = await confirmSafe("حذف فایل", "این فایل از دانش اختصاصی ویجت حذف شود؟"); if (ok) { await WidgetAPI.deleteFile(widget.id, button.dataset.id); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); } }
      if (button.dataset.action === "retry-file") { await WidgetAPI.retryFile(widget.id, button.dataset.id); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); }
    };
  }

  async function uploadFiles(widgetId, files) {
    if (!files?.length) return;
    try {
      await WidgetAPI.uploadFiles(widgetId, files, async file => {
        const row = document.querySelector(`[data-file-id="${file.id}"]`);
        if (row) row.outerHTML = renderFiles([file]);
        else { app.widget = await WidgetAPI.getWidget(widgetId); document.getElementById("wwFileList").innerHTML = renderFiles(app.widget.files); }
      });
      app.widget = await WidgetAPI.getWidget(widgetId); document.getElementById("wwFileList").innerHTML = renderFiles(app.widget.files); toastSafe("فایل‌ها پردازش و به دانش ویجت افزوده شدند", "success");
    } catch (error) { toastSafe(error.message, "danger"); }
  }

  function bindBehavior() {
    const range = document.getElementById("wwConfidence"), output = document.getElementById("wwConfidenceOutput");
    range.oninput = () => output.textContent = `${fa(range.value)}٪`;
  }

  function bindOperators(widget) {
    document.getElementById("btnAddOperator").onclick = async () => {
      try { await WidgetAPI.addOperator(widget.id, { username: document.getElementById("wwOperatorUsername").value }); toastSafe("اپراتور مجاز افزوده شد", "success"); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); } catch (error) { toastSafe(error.message, "danger"); }
    };
    document.querySelector(".ww-operator-list").onclick = async event => {
      const button = event.target.closest("[data-action]"); if (!button) return;
      if (button.dataset.action === "toggle-operator") await WidgetAPI.toggleOperator(widget.id, button.dataset.username);
      if (button.dataset.action === "remove-operator") { const ok = await confirmSafe("حذف اپراتور", "دسترسی این کاربر به گفتگوهای ویجت حذف شود؟"); if (!ok) return; await WidgetAPI.removeOperator(widget.id, button.dataset.username); }
      app.widget = await WidgetAPI.getWidget(widget.id); renderEditor();
    };
  }

  function bindTest(widget) {
    document.querySelectorAll("[data-device]").forEach(button => button.onclick = () => { app.testDevice = button.dataset.device; renderEditor(); });
    document.getElementById("btnResetTest").onclick = async () => { await WidgetAPI.resetTestSession(widget.id, app.testSessionId); app.testSessionId = `test-${Math.random().toString(36).slice(2, 10)}`; app.testMessages = [{ sender: "assistant", text: widget.appearance.welcomeMessage }]; app.testConversationId = null; renderEditor(); };
    document.getElementById("wwTestLauncher")?.addEventListener("click", () => { app.testOpen = true; document.getElementById("wwTestChat").classList.remove("hidden"); document.getElementById("wwTestLauncher").classList.add("hidden"); document.getElementById("wwTestGreeting")?.classList.add("hidden"); });
    document.getElementById("wwTestClose")?.addEventListener("click", () => { app.testOpen = false; document.getElementById("wwTestChat").classList.add("hidden"); document.getElementById("wwTestLauncher").classList.remove("hidden"); document.getElementById("wwTestGreeting")?.classList.remove("hidden"); });
    document.querySelectorAll("[data-test-question]").forEach(button => button.onclick = () => { document.getElementById("wwTestInput").value = button.dataset.testQuestion; document.getElementById("wwTestForm").requestSubmit(); });
    document.getElementById("wwTestForm")?.addEventListener("submit", event => sendTestMessage(event, widget));
    document.getElementById("btnSaveTestContact")?.addEventListener("click", async () => {
      await WidgetAPI.updateVisitorInfo(widget.id, app.testConversationId, { name: document.getElementById("wwTestVisitorName").value, contact: document.getElementById("wwTestVisitorContact").value });
      document.getElementById("wwTestContactSlot").innerHTML = '<div class="ww-test-contact text-success text-center small">اطلاعات تماس در نشست آزمایشی ثبت شد.</div>';
    });
  }

  async function sendTestMessage(event, widget) {
    event.preventDefault(); const input = document.getElementById("wwTestInput"); const text = input.value.trim(); if (!text) return; input.value = "";
    app.testMessages.push({ sender: "visitor", text });
    const box = document.getElementById("wwTestMessages"); box.insertAdjacentHTML("beforeend", renderTestMessage({ sender: "visitor", text }) + '<div class="ww-test-message assistant" id="wwTestTyping"><span class="ww-typing"><i></i><i></i><i></i></span></div>'); box.scrollTop = box.scrollHeight;
    try {
      const result = await WidgetAPI.testChat(widget.id, app.testSessionId, text);
      document.getElementById("wwTestTyping")?.remove(); app.testMessages.push({ sender: "assistant", text: result.answer, references: result.references }); box.insertAdjacentHTML("beforeend", renderTestMessage({ sender: "assistant", text: result.answer, references: result.references }));
      if (result.mode === "handoff") { app.testConversationId = result.conversationId; document.getElementById("wwTestContactSlot").innerHTML = widget.behavior.humanHandoff.collectContact ? renderTestContact() : "";
        document.getElementById("btnSaveTestContact")?.addEventListener("click", async () => {
          await WidgetAPI.updateVisitorInfo(widget.id, app.testConversationId, { name: document.getElementById("wwTestVisitorName").value, contact: document.getElementById("wwTestVisitorContact").value });
          document.getElementById("wwTestContactSlot").innerHTML = '<div class="ww-test-contact text-success text-center small">اطلاعات تماس در نشست آزمایشی ثبت شد.</div>';
        });
        toastSafe("شرایط ارجاع انسانی در حالت آزمایش فعال شد؛ نشست آزمایشی وارد صندوق واقعی اپراتورها نمی‌شود.", "info"); }
      box.scrollTop = box.scrollHeight;
    } catch (error) { document.getElementById("wwTestTyping")?.remove(); toastSafe(error.message, "danger"); }
  }

  async function bindPublish(widget) {
    const validation = await WidgetAPI.validateWidget(widget.id); const code = await WidgetAPI.getInstallCode(widget.id);
    document.getElementById("wwValidationSummary").textContent = validation.ok ? "همه الزامات اصلی تکمیل شده است." : "برای انتشار، موارد ناقص را تکمیل کنید.";
    document.getElementById("wwPublishChecklist").innerHTML = validation.checks.map(check => `<div class="ww-publish-check"><i class="fa-solid ${check.ok ? "fa-circle-check ok" : "fa-circle-xmark fail"}"></i><div><strong>${esc(check.label)}</strong><small>${esc(check.detail)}</small></div><span class="badge ${check.ok ? "text-bg-success" : "text-bg-danger"}">${check.ok ? "کامل" : "ناقص"}</span></div>`).join("");
    document.getElementById("wwInstallCode").textContent = code;
    document.getElementById("btnCopyInstall").onclick = () => copyText(code);
    document.getElementById("btnPublishNow").onclick = publishCurrent;
    document.getElementById("btnUnpublish")?.addEventListener("click", async () => { const ok = await confirmSafe("غیرفعال‌کردن ویجت", "نسخه عمومی دیگر روی دامنه مقصد نمایش داده نمی‌شود. ادامه می‌دهید؟"); if (!ok) return; await WidgetAPI.unpublishWidget(widget.id); toastSafe("نسخه عمومی غیرفعال شد", "info"); renderEditor(); });
  }

  async function saveCurrentEditorTab(showToast) {
    if (!app.widget || app.saving) return;
    app.saving = true;
    try {
      let changes = null;
      if (app.editorTab === "identity" && document.getElementById("wwInternalName")) {
        changes = { internalName: document.getElementById("wwInternalName").value.trim(), destinationDomain: normalizeOrigin(document.getElementById("wwDomain").value), appearance: { title: document.getElementById("wwTitle").value.trim(), assistantName: document.getElementById("wwAssistantName").value.trim(), subtitle: document.getElementById("wwSubtitle").value.trim(), welcomeMessage: document.getElementById("wwWelcome").value.trim(), inputPlaceholder: document.getElementById("wwPlaceholder").value.trim(), greetingBubble: document.getElementById("wwGreeting").value.trim(), primaryColor: document.getElementById("wwColorText").value.trim(), theme: document.getElementById("wwTheme").value, position: document.getElementById("wwPosition").value, showBranding: document.getElementById("wwBranding").checked, autoOpen: document.getElementById("wwAutoOpen").checked, autoOpenDelay: Number(document.getElementById("wwAutoDelay").value || 5), quickQuestions: document.getElementById("wwQuickQuestions").value.split("\n").map(item => item.trim()).filter(Boolean).slice(0, 6) } };
      }
      if (app.editorTab === "behavior" && document.getElementById("wwRequiredPrompt")) {
        const days = {}; document.querySelectorAll(".ww-schedule-table tbody tr").forEach(row => { days[row.dataset.day] = { enabled: row.querySelector(".ww-day-enabled").checked, start: row.querySelector(".ww-day-start").value, end: row.querySelector(".ww-day-end").value }; });
        changes = { behavior: { requiredPrompt: document.getElementById("wwRequiredPrompt").value.trim(), answerMode: document.getElementById("wwAnswerMode").value, tone: document.getElementById("wwTone").value, responseLength: document.getElementById("wwResponseLength").value, showReferences: document.getElementById("wwShowReferences").checked, fallbackMessage: document.getElementById("wwFallback").value.trim(), humanHandoff: { enabled: document.getElementById("wwHandoffEnabled").checked, collectContact: document.getElementById("wwCollectContact").checked, lowConfidenceEnabled: document.getElementById("wwLowConfidence").checked, confidenceThreshold: Number(document.getElementById("wwConfidence").value), categories: Array.from(document.querySelectorAll('[name="wwCategory"]:checked')).map(input => input.value), keywords: document.getElementById("wwKeywords").value.split(/[،,\n]/).map(item => item.trim()).filter(Boolean), outsideHoursBehavior: document.getElementById("wwOutsideBehavior").value, schedule: { timezone: document.getElementById("wwTimezone").value, days } } } };
      }
      if (changes) { app.widget = await WidgetAPI.updateWidget(app.widget.id, changes); if (showToast) toastSafe("تغییرات ذخیره شد", "success"); }
    } catch (error) { toastSafe(error.message, "danger"); }
    finally { app.saving = false; }
  }

  async function publishCurrent() {
    try { setLoading(true); await WidgetAPI.publishWidget(app.widget.id); toastSafe("ویجت منتشر شد و نسخه عمومی به‌روزرسانی شد", "success"); app.widget = await WidgetAPI.getWidget(app.widget.id); app.editorTab = "publish"; location.hash = `editor/${app.widget.id}/publish`; await renderEditor(); }
    catch (error) { toastSafe(error.message, "danger"); if (error.validation) app.editorTab = "publish"; }
    finally { setLoading(false); }
  }

  async function renderInbox() {
    view.onclick = null;
    setLoading(true);
    app.owner = app.owner || await WidgetAPI.getOwner();
    app.widgets = await WidgetAPI.listWidgets();
    app.conversations = await WidgetAPI.listConversations({ widgetId: app.inboxWidget, status: app.inboxStatus });
    if (!app.selectedConversationId || !app.conversations.some(item => item.id === app.selectedConversationId)) app.selectedConversationId = app.conversations[0]?.id || null;
    const selected = app.conversations.find(item => item.id === app.selectedConversationId);
    view.innerHTML = `<div class="ww-page-header"><div><h1>پاسخ‌گویی انسانی</h1><p>سؤال‌هایی که ویجت پاسخ مطمئن نداده یا طبق قواعد نیازمند انسان بوده‌اند در این بخش قرار می‌گیرند.</p></div></div><div class="ww-card ww-inbox-layout ${selected ? "thread-open" : ""}" id="wwInboxLayout"><aside class="ww-inbox-list"><div class="ww-inbox-list-head"><div class="d-grid gap-2"><select class="form-select form-select-sm" id="wwInboxWidget"><option value="">همه ویجت‌ها</option>${app.widgets.map(widget => `<option value="${widget.id}" ${app.inboxWidget === widget.id ? "selected" : ""}>${esc(widget.internalName)}</option>`).join("")}</select><select class="form-select form-select-sm" id="wwInboxStatus"><option value="all" ${app.inboxStatus === "all" ? "selected" : ""}>همه وضعیت‌ها</option><option value="queued" ${app.inboxStatus === "queued" ? "selected" : ""}>ذخیره‌شده خارج ساعت</option><option value="pending" ${app.inboxStatus === "pending" ? "selected" : ""}>در انتظار واگذاری</option><option value="assigned" ${app.inboxStatus === "assigned" ? "selected" : ""}>در حال پاسخ‌گویی</option><option value="resolved" ${app.inboxStatus === "resolved" ? "selected" : ""}>بسته‌شده</option></select></div></div><div class="ww-inbox-items">${renderConversationList(app.conversations, app.selectedConversationId)}</div></aside><section class="ww-inbox-thread">${selected ? renderThread(selected) : '<div class="ww-inbox-empty"><div><i class="fa-solid fa-comments" style="font-size:2.5rem"></i><p class="mt-3">گفتگویی برای نمایش انتخاب نشده است.</p></div></div>'}</section><aside class="ww-inbox-details">${selected ? renderConversationDetails(selected) : ""}</aside></div>`;
    document.getElementById("wwInboxWidget").onchange = event => { app.inboxWidget = event.target.value; renderInbox(); };
    document.getElementById("wwInboxStatus").onchange = event => { app.inboxStatus = event.target.value; renderInbox(); };
    document.querySelector(".ww-inbox-items").onclick = event => { const button = event.target.closest("[data-conversation]"); if (!button) return; app.selectedConversationId = button.dataset.conversation; renderInbox(); };
    if (selected) bindThread(selected);
    setLoading(false);
  }

  function renderConversationList(rows, selectedId) {
    if (!rows.length) return `<div class="ww-empty-state" style="min-height:280px"><div><i class="fa-solid fa-inbox"></i><h3>صندوق خالی است</h3><p>در این فیلتر گفتگویی وجود ندارد.</p></div></div>`;
    return rows.map(item => { const last = item.messages.at(-1); const status = item.status === "pending" ? "text-bg-danger" : item.status === "queued" ? "text-bg-warning" : item.status === "assigned" ? "text-bg-primary" : "text-bg-success"; return `<button class="ww-conversation-item ${selectedId === item.id ? "active" : ""}" data-conversation="${item.id}"><div class="ww-conv-icon"><i class="fa-solid ${CATEGORY_META[item.category]?.icon || "fa-message"}"></i></div><div class="min-width-0"><strong>${esc(item.visitorName || "بازدیدکننده ناشناس")}</strong><span>${esc(last?.text || "")}</span><span>${esc(item.widgetName)}</span></div><div><time>${formatDateTime(item.updatedAt)}</time><span class="badge ${status} mt-1">${conversationStatus(item.status)}</span></div></button>`; }).join("");
  }

  function conversationStatus(status) { return ({ queued: "ذخیره‌شده", pending: "در انتظار", assigned: "واگذارشده", resolved: "بسته‌شده" })[status] || status; }

  function renderThread(item) {
    const activeOps = item.operators.filter(op => op.active);
    const canAssign = Boolean(item.canManage);
    const assignment = canAssign && item.status !== "resolved" ? `<div class="ww-thread-assignment"><select class="form-select form-select-sm" id="wwAssignOperator"><option value="">واگذاری به خودم</option>${activeOps.map(op => `<option value="${esc(op.username)}" ${item.assignedTo === op.username ? "selected" : ""}>${esc(op.displayName)}</option>`).join("")}</select><button class="btn btn-sm btn-outline-primary" id="btnAssignConversation" type="button"><i class="fa-solid fa-user-check"></i> واگذاری</button></div>` : "";
    const compose = item.status === "resolved"
      ? `<div class="ww-thread-compose"><div class="alert alert-success border mb-0"><i class="fa-solid fa-circle-check ms-1"></i> این گفتگو بسته شده است. با دریافت پیام جدید از بازدیدکننده، نشست دوباره وارد چرخه پاسخ‌گویی می‌شود.</div></div>`
      : `<div class="ww-thread-compose"><div class="alert alert-light border py-2 px-3 small mb-0"><i class="fa-solid fa-circle-user ms-1"></i> پاسخ با حساب جاری <strong>${esc(app.owner?.displayName || app.owner?.username || "کاربر سامانه")}</strong> ثبت می‌شود.</div><textarea class="form-control" id="wwReplyText" placeholder="پاسخ پشتیبان انسانی..."></textarea><div class="d-grid gap-2"><button class="btn btn-primary" id="btnSendReply"><i class="fa-solid fa-paper-plane"></i> ارسال پاسخ</button><button class="btn btn-outline-success" id="btnResolveConversation"><i class="fa-solid fa-check"></i> بستن گفتگو</button></div></div>`;
    return `<header class="ww-thread-head"><div><button class="btn btn-sm btn-outline-secondary on-mobile" id="btnBackInbox"><i class="fa-solid fa-arrow-right"></i></button><h3 class="d-inline-block me-2">${esc(item.visitorName || "بازدیدکننده ناشناس")}</h3><small>${esc(item.widgetName)}</small></div><span class="badge ${item.status === "resolved" ? "text-bg-success" : "text-bg-primary"}">${conversationStatus(item.status)}</span></header>${assignment}<div class="ww-thread-messages" id="wwThreadMessages">${item.messages.map(message => `<div class="ww-thread-message ${message.sender}">${esc(message.text)}<small>${message.sender === "operator" ? esc(message.operatorName || message.operatorUsername || "اپراتور") + " · " : ""}${formatDateTime(message.createdAt)}</small></div>`).join("")}</div>${compose}`;
  }

  function renderConversationDetails(item) {
    const operatorName = item.assignedToDisplay || item.operators.find(op => op.username === item.assignedTo)?.displayName || "واگذار نشده";
    return `<div class="ww-detail-group"><h4>بازدیدکننده</h4><div class="ww-detail-row"><span>نام</span><strong>${esc(item.visitorName || "ناشناس")}</strong></div><div class="ww-detail-row"><span>تماس</span><strong class="ltr">${esc(item.visitorContact || "ثبت نشده")}</strong></div><div class="ww-detail-row"><span>شناسه نشست</span><strong class="ltr">${esc(item.sessionId)}</strong></div></div><div class="ww-detail-group"><h4>ارجاع</h4><div class="ww-detail-row"><span>موضوع</span><strong>${esc(CATEGORY_META[item.category]?.label || item.category)}</strong></div><div class="ww-detail-row"><span>دلیل</span><strong>${esc(item.escalatedReason)}</strong></div><div class="ww-detail-row"><span>اطمینان مدل</span><strong>${fa(item.confidence)}٪</strong></div><div class="ww-detail-row"><span>اپراتور</span><strong>${esc(operatorName)}</strong></div></div><div class="ww-detail-group"><h4>زمان‌بندی</h4><div class="ww-detail-row"><span>ایجاد</span><strong>${formatDateTime(item.createdAt)}</strong></div><div class="ww-detail-row"><span>آخرین تغییر</span><strong>${formatDateTime(item.updatedAt)}</strong></div><div class="ww-detail-row"><span>بسته‌شدن</span><strong>${formatDateTime(item.resolvedAt)}</strong></div></div>`;
  }

  function bindThread(item) {
    document.getElementById("btnBackInbox")?.addEventListener("click", () => document.getElementById("wwInboxLayout").classList.remove("thread-open"));
    document.getElementById("btnAssignConversation")?.addEventListener("click", async () => {
      try {
        const operator = document.getElementById("wwAssignOperator").value;
        await WidgetAPI.assignConversation(item.widgetId, item.id, operator);
        toastSafe("گفتگو واگذار شد", "success");
        await renderInbox();
      } catch (error) { toastSafe(error.message, "danger"); }
    });
    const sendReplyButton = document.getElementById("btnSendReply");
    if (sendReplyButton) sendReplyButton.onclick = async () => {
      const text = document.getElementById("wwReplyText").value.trim();
      if (!text) return;
      try {
        await WidgetAPI.sendHumanReply(item.widgetId, item.id, "", text);
        toastSafe("پاسخ انسانی ثبت شد", "success");
        await renderInbox();
      } catch (error) { toastSafe(error.message, "danger"); }
    };
    document.getElementById("btnResolveConversation")?.addEventListener("click", async () => { await WidgetAPI.resolveConversation(item.widgetId, item.id); toastSafe("گفتگو بسته شد", "success"); renderInbox(); });
    const box = document.getElementById("wwThreadMessages"); box.scrollTop = box.scrollHeight;
  }

  async function renderAnalytics() {
    view.onclick = null;
    setLoading(true);
    app.widgets = (await WidgetAPI.listWidgets()).filter(widget => widget.canManage);
    if (app.analyticsWidget !== "all" && !app.widgets.some(widget => widget.id === app.analyticsWidget)) app.analyticsWidget = "all";
    const data = await WidgetAPI.getAnalytics(app.analyticsWidget);
    const answerRate = data.totals.messages ? Math.round(data.totals.aiAnswers / data.totals.messages * 100) : 0; const humanRate = data.totals.messages ? Math.round(data.totals.humanEscalations / data.totals.messages * 100) : 0;
    const maxMessages = Math.max(1, ...data.daily.map(row => row.messages));
    view.innerHTML = `<div class="ww-page-header"><div><h1>آمار استفاده و پاسخ‌گویی</h1><p>عملکرد پاسخ خودکار و پاسخ‌گویی انسانی به تفکیک اپراتورها.</p></div><div class="ww-header-actions"><select class="form-select" id="wwAnalyticsWidget"><option value="all">همه ویجت‌ها</option>${app.widgets.map(widget => `<option value="${widget.id}" ${app.analyticsWidget === widget.id ? "selected" : ""}>${esc(widget.internalName)}</option>`).join("")}</select></div></div><div class="ww-kpi-grid">${kpi("نشست‌ها", data.totals.sessions, "هفت روز اخیر", "fa-comments", "")}${kpi("پیام‌های کاربران", data.totals.messages, "مجموع پرسش‌های دریافت‌شده", "fa-message", "success")}${kpi("پاسخ خودکار", `${answerRate}٪`, `${fa(data.totals.aiAnswers)} پاسخ`, "fa-robot", "purple")}${kpi("ارجاع انسانی", `${humanRate}٪`, `${fa(data.totals.humanEscalations)} گفتگو`, "fa-headset", "warning")}</div><div class="ww-grid-2"><section class="ww-card ww-chart-card"><div class="ww-section-head"><div><h3>روند پیام‌ها و ارجاع‌ها</h3><p>پاسخ هوش مصنوعی در برابر گفتگوهای ارجاع‌شده به انسان</p></div></div><div class="ww-bar-chart">${data.daily.map(row => { const height = Math.max(4, row.messages / maxMessages * 100); const aiPart = row.messages ? row.aiAnswers / row.messages * 100 : 0; const humanPart = row.messages ? row.humanEscalations / row.messages * 100 : 0; return `<div class="ww-bar-col"><div class="ww-bar-stack" style="--bar-height:${height}%;--ai-part:${aiPart}%;--human-part:${humanPart}%"><div class="ww-bar-ai" title="پاسخ خودکار: ${row.aiAnswers}"></div><div class="ww-bar-human" title="ارجاع انسانی: ${row.humanEscalations}"></div></div><small>${new Date(row.date).toLocaleDateString("fa-IR", { weekday: "short" })}</small></div>`; }).join("")}</div><div class="ww-chart-legend"><span><i style="background:#0d6efd"></i>پاسخ خودکار</span><span><i style="background:#6f42c1"></i>ارجاع انسانی</span></div></section><section class="ww-card ww-chart-card"><div class="ww-section-head"><div><h3>ترکیب پاسخ‌گویی</h3><p>نسبت پاسخ مدل به نیاز به اپراتور انسانی</p></div></div><div class="ww-donut-wrap"><div class="ww-donut" style="--ai:${answerRate}"><div class="ww-donut-center"><div><strong>${fa(answerRate)}٪</strong><small>پاسخ خودکار</small></div></div></div><div class="ww-metric-list"><div class="ww-metric-row"><i style="background:#0d6efd"></i><span>پاسخ مدل</span><strong>${fa(data.totals.aiAnswers)}</strong></div><div class="ww-metric-row"><i style="background:#6f42c1"></i><span>ارجاع به انسان</span><strong>${fa(data.totals.humanEscalations)}</strong></div><div class="ww-metric-row"><i style="background:#dc3545"></i><span>در انتظار پاسخ</span><strong>${fa(data.totals.pending)}</strong></div><div class="ww-metric-row"><i style="background:#198754"></i><span>گفتگوی بسته‌شده</span><strong>${fa(data.totals.resolved)}</strong></div></div></div></section></div><section class="ww-card ww-card-body mt-3"><div class="ww-section-head"><div><h3>عملکرد اپراتورها</h3><p>آمار پاسخ‌گویی انسانی بر اساس گفتگوهای ثبت‌شده هر ویجت</p></div></div><div class="ww-table-wrap"><table class="ww-table"><thead><tr><th>اپراتور</th><th>ویجت</th><th>گفتگوی واگذارشده</th><th>پاسخ‌ها</th><th>بسته‌شده</th><th>باز</th><th>میانگین زمان پاسخ</th><th>وضعیت</th></tr></thead><tbody>${data.operators.length ? data.operators.map(op => `<tr><td><strong>${esc(op.displayName)}</strong><br><small class="text-muted ltr">${esc(op.username)}</small></td><td>${esc(op.widgetName)}</td><td>${fa(op.assigned)}</td><td>${fa(op.replies)}</td><td>${fa(op.resolved)}</td><td>${fa(op.pending)}</td><td>${formatDuration(op.avgResponseMinutes)}</td><td><span class="badge ${op.active ? "text-bg-success" : "text-bg-secondary"}">${op.active ? "فعال" : "غیرفعال"}</span></td></tr>`).join("") : `<tr><td colspan="8" class="text-center text-muted py-4">اپراتوری ثبت نشده است.</td></tr>`}</tbody></table></div></section>`;
    document.getElementById("wwAnalyticsWidget").onchange = event => { app.analyticsWidget = event.target.value; renderAnalytics(); };
    setLoading(false);
  }


  function setLoading(state) { document.getElementById("loading")?.classList.toggle("hidden", !state); }
  function toastSafe(message, type = "success") { if (typeof window.toast === "function") window.toast(message, type); else alert(message); }
  async function confirmSafe(title, message) { if (typeof window.confirmDialog === "function") { const result = await window.confirmDialog({ title, message, confirmText: "بله، ادامه بده", confirmClass: "btn-danger" }); return result.confirmed; } return window.confirm(message); }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); toastSafe("در حافظه کپی شد", "success"); } catch { const area = document.createElement("textarea"); area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); toastSafe("در حافظه کپی شد", "success"); } }
  function readDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }

  route();
})();

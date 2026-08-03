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
  const LEGACY_TOPIC_META = {
    general: { label: "اطلاعات عمومی", icon: "fa-circle-info" },
    sales: { label: "فروش و قیمت", icon: "fa-cart-shopping" },
    technical: { label: "پشتیبانی فنی", icon: "fa-screwdriver-wrench" },
    warranty: { label: "گارانتی", icon: "fa-shield-halved" },
    complaint: { label: "شکایت", icon: "fa-face-frown" },
    contract: { label: "قرارداد و مالی", icon: "fa-file-signature" },
    security: { label: "امنیت", icon: "fa-lock" },
    unknown: { label: "خارج از دانش", icon: "fa-circle-question" },
    other: { label: "سایر", icon: "fa-message" },
    "low-similarity": { label: "تطابق پایین اسناد", icon: "fa-wave-square" },
    "no-context": { label: "بدون سند مرتبط", icon: "fa-file-circle-question" }
  };
  const STATUS_META = {
    draft: { label: "پیش‌نویس", cls: "draft", icon: "fa-pen" },
    published: { label: "منتشرشده", cls: "published", icon: "fa-circle-check" },
    changed: { label: "تغییرات منتشرنشده", cls: "changed", icon: "fa-triangle-exclamation" },
    disabled: { label: "غیرفعال", cls: "disabled", icon: "fa-circle-pause" }
  };
  const FILE_TYPES = ["pdf", "odt", "txt", "md", "doc", "docx", "jsonl"];
  const STRUCTURED_RAG_SUFFIX = ".rag.jsonl";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");


  let markdownRendererPromise;

  function sanitizeMarkdownHTML(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");

    template.content
      .querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,math")
      .forEach(node => node.remove());

    const allowedTags = new Set([
      "P", "BR", "STRONG", "B", "EM", "I", "DEL", "S",
      "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE",
      "H1", "H2", "H3", "H4", "H5", "H6", "A", "HR",
      "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
    ]);

    template.content.querySelectorAll("*").forEach(node => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      Array.from(node.attributes).forEach(attribute => {
        const name = attribute.name.toLowerCase();
        const keep = node.tagName === "A" && ["href", "title"].includes(name);
        if (!keep) node.removeAttribute(attribute.name);
      });

      if (node.tagName === "A") {
        const href = String(node.getAttribute("href") || "").trim();
        if (!/^(https?:|mailto:|tel:|#|\/)/i.test(href)) node.removeAttribute("href");
        if (node.hasAttribute("href")) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer nofollow");
        }
      }
    });

    return template.innerHTML;
  }

  function renderMarkdown(markdown) {
    const source = String(markdown || "").trim();
    if (!source) return "";
    if (typeof globalThis.marked === "undefined" || typeof globalThis.marked.parse !== "function") {
      return `<p>${esc(source).replaceAll("\n", "<br>")}</p>`;
    }
    return sanitizeMarkdownHTML(globalThis.marked.parse(source, { gfm: true, breaks: true }));
  }

  function ensureMarkdownRenderer(baseUrl = location.origin) {
    if (typeof globalThis.marked !== "undefined" && typeof globalThis.marked.parse === "function") {
      return Promise.resolve(true);
    }
    if (markdownRendererPromise) return markdownRendererPromise;

    const src = `${String(baseUrl || location.origin).replace(/\/$/, "")}/js/marked.min.js`;
    markdownRendererPromise = new Promise(resolve => {
      const existing = Array.from(document.scripts).find(script => script.src === src);
      const script = existing || document.createElement("script");
      const finish = () => resolve(
        typeof globalThis.marked !== "undefined" && typeof globalThis.marked.parse === "function"
      );

      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.fapcoMarkdown = "1";
        document.head.appendChild(script);
      }
      const timeout = window.setTimeout(() => resolve(false), 4000);
      const finishWithCleanup = () => {
        window.clearTimeout(timeout);
        finish();
      };
      script.addEventListener("load", finishWithCleanup, { once: true });
      script.addEventListener("error", () => {
        window.clearTimeout(timeout);
        resolve(false);
      }, { once: true });
      if (existing?.dataset.loaded === "1") finishWithCleanup();
      else script.addEventListener("load", () => { script.dataset.loaded = "1"; }, { once: true });
    });

    return markdownRendererPromise;
  }

  function messageContentHTML(sender, text) {
    return ["assistant", "operator", "ai"].includes(String(sender || ""))
      ? renderMarkdown(text)
      : esc(text).replaceAll("\n", "<br>");
  }    
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
  const fileExtension = fileName => String(fileName || "").trim().toLowerCase().split(".").pop() || "";
  const isSupportedKnowledgeFile = file => {
    const name = String(file?.name || "").trim().toLowerCase();
    return name.endsWith(STRUCTURED_RAG_SUFFIX) || FILE_TYPES.includes(fileExtension(name));
  };
  const supportedKnowledgeFilesText = "PDF، DOC، DOCX، ODT، TXT، Markdown و Structured JSONL";
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
  const EFFECTIVE_APPEARANCE = {
    title: "پشتیبان هوشمند", assistantName: "پشتیبان", subtitle: "پاسخ‌گوی محصولات و خدمات",
    welcomeMessage: "سلام! چطور می‌توانم راهنمایی‌تان کنم؟", inputPlaceholder: "پرسش خود را بنویسید..."
  };
  const DEFAULT_FALLBACK = "برای این پرسش پاسخ مطمئنی در منابع موجود ندارم. پرسش شما برای پشتیبان انسانی ثبت می‌شود.";
  const effectiveAppearance = appearance => ({
    ...(appearance || {}),
    title: appearance?.title || EFFECTIVE_APPEARANCE.title,
    assistantName: appearance?.assistantName || EFFECTIVE_APPEARANCE.assistantName,
    subtitle: appearance?.subtitle || EFFECTIVE_APPEARANCE.subtitle,
    welcomeMessage: appearance?.welcomeMessage || EFFECTIVE_APPEARANCE.welcomeMessage,
    inputPlaceholder: appearance?.inputPlaceholder || EFFECTIVE_APPEARANCE.inputPlaceholder
  });

  function normalizeHexColor(value, fallback = "#0d6efd") {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function hexToRGB(hex) {
    const color = normalizeHexColor(hex).slice(1);
    return {
      r: Number.parseInt(color.slice(0, 2), 16),
      g: Number.parseInt(color.slice(2, 4), 16),
      b: Number.parseInt(color.slice(4, 6), 16)
    };
  }

  function relativeLuminance(hex) {
    const { r, g, b } = hexToRGB(hex);
    const channel = value => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(first, second) {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function mixHex(first, second, ratio) {
    const a = hexToRGB(first);
    const b = hexToRGB(second);
    const amount = Math.max(0, Math.min(1, Number(ratio || 0)));
    const value = channel => Math.round(a[channel] + (b[channel] - a[channel]) * amount)
      .toString(16).padStart(2, "0");
    return `#${value("r")}${value("g")}${value("b")}`;
  }

  function ensureContrast(foreground, background, minimum = 4.5) {
    const color = normalizeHexColor(foreground);
    const surface = normalizeHexColor(background, "#ffffff");
    if (contrastRatio(color, surface) >= minimum) return color;
    const target = relativeLuminance(surface) > 0.45 ? "#111827" : "#ffffff";
    for (let step = 1; step <= 20; step += 1) {
      const candidate = mixHex(color, target, step / 20);
      if (contrastRatio(candidate, surface) >= minimum) return candidate;
    }
    return target;
  }

  function widgetPalette(value) {
    const primary = normalizeHexColor(value);
    const lightText = "#ffffff";
    const darkText = "#182033";
    const onPrimary = contrastRatio(primary, lightText) >= contrastRatio(primary, darkText)
      ? lightText
      : darkText;
    return {
      primary,
      onPrimary,
      accentLight: ensureContrast(primary, "#ffffff", 4.5),
      accentDark: ensureContrast(primary, "#20262c", 4.5),
      borderLight: ensureContrast(primary, "#ffffff", 3),
      borderDark: ensureContrast(primary, "#20262c", 3)
    };
  }

  function widgetPaletteVariables(value) {
    const palette = widgetPalette(value);
    return [
      `--widget-color:${palette.primary}`,
      `--widget-on-color:${palette.onPrimary}`,
      `--widget-accent-light:${palette.accentLight}`,
      `--widget-accent-dark:${palette.accentDark}`,
      `--widget-border-light:${palette.borderLight}`,
      `--widget-border-dark:${palette.borderDark}`
    ].join(";");
  }

  function widgetThemeClass(theme) {
    if (theme === "dark") return "dark";
    if (theme === "auto") return "auto";
    return "light";
  }
  const splitList = value => [...new Set(String(value || "").split(/[،,؛;\n\r]+/).map(item => item.trim()).filter(Boolean))];
  const requiredBadge = () => '<span class="ww-field-required">الزامی</span>';
  const optionalBadge = () => '<span class="ww-field-optional">اختیاری</span>';
  const helpIcon = (title, text) => `<button type="button" class="ww-help-button" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-placement="top" title="${esc(title)}" data-bs-content="${esc(text)}" aria-label="راهنمای ${esc(title)}"><i class="fa-solid fa-circle-question"></i></button>`;
  const topicLabel = value => LEGACY_TOPIC_META[value]?.label || value || "سایر";
  const topicIcon = value => LEGACY_TOPIC_META[value]?.icon || "fa-message";

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

  function makeWidgetUploadItem(file, tempId, queueIndex, queueTotal) {
    return {
      id: tempId,
      name: file.name,
      size: file.size,
      type: file.name.split(".").pop()?.toLowerCase() || "file",
      status: "queued",
      progress: 0,
      chunks: 0,
      uploadedAt: new Date().toISOString(),
      queueIndex,
      queueTotal
     };
  }

  async function uploadSingleWidgetFile(widgetId, file, base, onProgress) {
    const currentAuth = await authReady();
    await onProgress?.({ ...base, status: "uploading", progress: 0 });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/widget/${widgetId}/files`, true);
      if (currentAuth.token()) xhr.setRequestHeader("Authorization", `Bearer ${currentAuth.token()}`);
      const form = new FormData();
      form.append("file", file);
      let received = "";

      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        const progress = Math.min(78, Math.round(event.loaded / event.total * 78));
        onProgress?.({ ...base, status: "uploading", progress });
      };

      xhr.onreadystatechange = () => {
        if (![3, 4].includes(xhr.readyState) || xhr.responseText.length <= received.length) return;
        received = xhr.responseText;
        const reports = received.split(/\r?\n/);
        for (let index = reports.length - 1; index >= 0; index -= 1) {
          const line = reports[index].trim();
          if (!line.startsWith("progress:")) continue;
          try {
            const report = JSON.parse(line.slice("progress:".length).trim());
            const fraction = report.total ? Number(report.progress || 0) / Number(report.total) : 0;
            const progress = Math.min(98, 80 + Math.round(fraction * 18));
            onProgress?.({ ...base, status: "processing", progress });
          } catch { /* incomplete streaming progress */ }
          break;
        }
      };

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
        const done = xhr.responseText.match(/data:\s*\[DONE\]:\s*(\{[^\r\n]+\})/i);
        let chunks = 0;
        try { chunks = Number(JSON.parse(done?.[1] || "{}").totalChunks || 0); } catch { /* ignore */ }
        await onProgress?.({ ...base, progress: 100, status: "ready", chunks });
        resolve({ ok: true, tempId });
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
      const queue = Array.from(files || []).map((file, index, all) => ({
        file,
        base: makeWidgetUploadItem(
          file,
          `upload-${Math.random().toString(36).slice(2, 10)}`,
          index + 1,
          all.length
        )
      }));

      for (const item of queue) await onProgress?.(item.base);

      const results = [];
      for (const item of queue) {
        try {
          const result = await uploadSingleWidgetFile(widgetId, item.file, item.base, onProgress);
          results.push({ ok: true, file: item.file, base: item.base, result });
        } catch (error) {
          const message = error?.message || "بارگذاری فایل ناموفق بود";
          await onProgress?.({ ...item.base, status: "failed", progress: 100, error: message });
          results.push({ ok: false, file: item.file, base: item.base, error: message });
        }
      }

      const failed = results.filter(item => !item.ok);
      return {
        ok: failed.length === 0,
        succeeded: results.length - failed.length,
        failed: failed.length,
        results
      };
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
    const ap = effectiveAppearance(config.appearance);
    const position = ap.position === "left" ? "left" : "right";
    await ensureMarkdownRenderer(publicBase(widgetId));
    root.innerHTML = runtimeTemplate(config, position, publicBase(widgetId));
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
      const content = document.createElement("div");
      content.className = "fw-message-content";
      if (["assistant", "operator", "ai"].includes(sender)) content.innerHTML = renderMarkdown(text);
      else content.textContent = String(text || "");
      el.appendChild(content);
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
      event.preventDefault();
      const send = root.querySelector(".fw-send");
      const text = input.value.trim();
      if (!text || send.disabled) return;
      input.value = "";
      input.disabled = true;
      send.disabled = true;
      append("visitor", text);
      const typing = document.createElement("div");
      typing.className = "fw-message assistant";
      typing.innerHTML = '<span class="fw-typing"><i></i><i></i><i></i></span>';
      messages.appendChild(typing); messages.scrollTop = messages.scrollHeight;
      try {
        const result = await (preview ? WidgetAPI.testChat(widgetId, sessionId, text) : WidgetAPI.publicChat(widgetId, sessionId, text));
        typing.remove();
        append("assistant", result.answer || "پاسخی دریافت نشد.", result.references);
        if (result.mode === "handoff" && config.behavior.humanHandoff.collectContact) showRuntimeContact(root, widgetId, result.conversationId);
      } catch (error) {
        typing.remove();
        append("assistant", error?.message || "در ارتباط با سامانه خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      } finally {
        input.disabled = false;
        send.disabled = false;
        input.focus();
      }
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

  function runtimeTemplate(config, position, assetBase) {
    const ap = effectiveAppearance(config.appearance);
    const palette = widgetPalette(ap.primaryColor);
    const themeClass = widgetThemeClass(ap.theme);
    const quick = (ap.quickQuestions || []).slice(0, 4).map(item => `<button type="button" data-q="${esc(item)}">${esc(item)}</button>`).join("");
    const logo = ap.logoDataUrl ? `<img src="${esc(ap.logoDataUrl)}" alt="">` : `<span>${esc(initials(ap.assistantName))}</span>`;
    const sendIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6l.1 6.5 11.8 1.9-11.8 1.9-.1 6.5Z"/></svg>';
    const chatIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h12V7H6v2Zm0 4h9v-2H6v2Z"/></svg>';
    const fontCssUrl = `${String(assetBase || location.origin).replace(/\/$/, "")}/fonts/IranSansX/fontiran.css`;
    return `
      <style>
        :host{all:initial}
        .fw-wrap,.fw-wrap *{box-sizing:border-box}
        .fw-wrap{font-family:"IRANSansX",Tahoma,Arial,sans-serif;direction:rtl;--c:${palette.primary};--on-c:${palette.onPrimary};--accent-light:${palette.accentLight};--accent-dark:${palette.accentDark};--accent-border-light:${palette.borderLight};--accent-border-dark:${palette.borderDark}}
        .fw-wrap button,.fw-wrap input,.fw-wrap textarea,.fw-wrap select{font:inherit}
        .fw-launcher{position:fixed;z-index:2147483001;${position}:22px;bottom:22px;width:60px;height:60px;display:grid;place-items:center;padding:16px;color:var(--on-c);background:var(--c);border:1px solid var(--accent-border-light);border-radius:50%;box-shadow:0 13px 30px rgba(0,0,0,.28);cursor:pointer}.fw-launcher svg{width:100%;height:100%}.fw-launcher.hidden,.fw-greeting.hidden{display:none}
        .fw-greeting{position:fixed;z-index:2147483000;${position}:92px;bottom:30px;max-width:min(250px,calc(100vw - 120px));padding:9px 12px;overflow-wrap:anywhere;color:#263042;background:#fff;border:1px solid #dce3ec;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.16);font-size:11px}
        .fw-panel{--bg:#fff;--surface:#fff;--surface-2:#f5f7fa;--border:#dce3ec;--text:#1d2636;--muted:#6d7786;--operator-bg:#e7f7ee;--operator-border:#b9e2ca;--accent:var(--accent-light);--accent-border:var(--accent-border-light);position:fixed;z-index:2147483002;${position}:22px;bottom:22px;width:min(370px,calc(100vw - 24px));height:min(570px,calc(100vh - 24px));height:min(570px,calc(100dvh - 24px));min-width:0;display:none;flex-direction:column;overflow:hidden;color-scheme:light;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
        .fw-panel.open{display:flex}
        .fw-panel.dark{--bg:#20262c;--surface:#20262c;--surface-2:#181d22;--border:#39424c;--text:#e9edf3;--muted:#a5afbc;--operator-bg:#17392c;--operator-border:#2d6a4f;--accent:var(--accent-dark);--accent-border:var(--accent-border-dark);color-scheme:dark}
        @media(prefers-color-scheme:dark){.fw-panel.auto{--bg:#20262c;--surface:#20262c;--surface-2:#181d22;--border:#39424c;--text:#e9edf3;--muted:#a5afbc;--operator-bg:#17392c;--operator-border:#2d6a4f;--accent:var(--accent-dark);--accent-border:var(--accent-border-dark);color-scheme:dark}}
        .fw-head{flex:0 0 auto;padding:13px 14px;display:flex;align-items:center;gap:10px;color:var(--on-c);background:var(--c);border-bottom:1px solid var(--accent-border)}.fw-avatar{width:39px;height:39px;flex:0 0 39px;display:grid;place-items:center;overflow:hidden;color:inherit;background:rgba(127,127,127,.18);border-radius:11px;font-weight:bold}.fw-avatar img{width:100%;height:100%;object-fit:cover}.fw-head-text{min-width:0;display:flex;flex:1;flex-direction:column}.fw-head-text strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.fw-head-text small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;opacity:.86}.fw-close{flex:0 0 auto;padding:4px 8px;color:inherit;background:transparent;border:0;font-size:20px;cursor:pointer}
        .fw-messages{min-width:0;min-height:0;flex:1;padding:13px;overflow-y:auto;overflow-x:hidden;background:var(--surface-2)}.fw-message{max-width:88%;margin-bottom:9px;padding:9px 11px;overflow-wrap:anywhere;word-break:break-word;border-radius:13px;font-size:12px;line-height:1.8;white-space:normal}.fw-message.assistant{margin-left:auto;color:var(--text);background:var(--surface);border:1px solid var(--border);border-bottom-right-radius:4px}.fw-message.visitor{margin-right:auto;color:var(--on-c);background:var(--c);border:1px solid var(--accent-border);border-bottom-left-radius:4px;white-space:pre-wrap}.fw-message.operator{margin-left:auto;color:var(--text);background:var(--operator-bg);border:1px solid var(--operator-border);border-bottom-right-radius:4px}.fw-message-content{min-width:0;overflow-wrap:anywhere}.fw-message-content>:first-child{margin-top:0}.fw-message-content>:last-child{margin-bottom:0}.fw-message-content p{margin:0 0 .65em}.fw-message-content h1,.fw-message-content h2,.fw-message-content h3,.fw-message-content h4,.fw-message-content h5,.fw-message-content h6{margin:.8em 0 .35em;font:inherit;font-weight:800}.fw-message-content ul,.fw-message-content ol{margin:.45em 0;padding-inline-start:1.5em}.fw-message-content li+li{margin-top:.2em}.fw-message-content blockquote{margin:.6em 0;padding:.25em .75em;color:var(--muted);border-inline-start:3px solid var(--accent-border)}.fw-message-content code,.fw-message-content pre{font-family:"IRANSansX",Tahoma,Arial,sans-serif}.fw-message-content code{padding:.08em .3em;background:var(--surface-2);border:1px solid var(--border);border-radius:4px}.fw-message-content pre{max-width:100%;margin:.6em 0;padding:.65em;overflow:auto;direction:ltr;text-align:left;white-space:pre;background:var(--surface-2);border:1px solid var(--border);border-radius:7px}.fw-message-content pre code{padding:0;background:transparent;border:0}.fw-message-content a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}.fw-message-content table{display:block;max-width:100%;margin:.6em 0;overflow-x:auto;border-collapse:collapse}.fw-message-content th,.fw-message-content td{padding:.35em .5em;border:1px solid var(--border);white-space:nowrap}.fw-message-content hr{margin:.7em 0;border:0;border-top:1px solid var(--border)}.fw-refs{margin-top:7px;padding-top:7px;overflow-wrap:anywhere;color:var(--muted);border-top:1px dashed var(--border);font-size:10px}
        .fw-quick{flex:0 0 auto;max-height:126px;padding:8px 10px;display:grid;gap:6px;overflow-y:auto;overflow-x:hidden;background:var(--surface);border-top:1px solid var(--border)}.fw-quick button{width:100%;padding:7px 9px;white-space:normal;overflow-wrap:anywhere;color:var(--accent);background:var(--surface);border:1px solid var(--accent-border);border-radius:10px;cursor:pointer;text-align:right;font-size:10px;line-height:1.55}.fw-quick button:hover,.fw-quick button:focus-visible{color:var(--on-c);background:var(--c);outline:none}
        .fw-form{flex:0 0 auto;width:100%;padding:10px;display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px;overflow:hidden;background:var(--surface);border-top:1px solid var(--border)}.fw-input{width:100%;min-width:0;height:42px;min-height:42px;max-height:86px;padding:9px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:10px;resize:none;outline:none}.fw-input::placeholder{color:var(--muted)}.fw-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(127,127,127,.16)}.fw-send{width:44px;height:42px;display:grid;place-items:center;padding:11px;color:var(--on-c);background:var(--c);border:1px solid var(--accent-border);border-radius:10px;cursor:pointer}.fw-send svg{width:100%;height:100%;transform:scaleX(-1)}.fw-send:disabled{opacity:.55;cursor:not-allowed}.fw-brand{flex:0 0 auto;padding:0 10px 8px;color:var(--muted);text-align:center;font-size:9px}
        .fw-contact{padding:9px;background:var(--surface);border-top:1px solid var(--border)}.fw-contact-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) auto;gap:6px}.fw-contact input{min-width:0;width:100%;padding:7px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:10px}.fw-contact input::placeholder{color:var(--muted)}.fw-contact button{padding:7px 9px;color:var(--on-c);background:var(--c);border:1px solid var(--accent-border);border-radius:8px;cursor:pointer;font-size:10px}.fw-contact-error{margin-top:5px;color:#dc3545;font-size:9px}.fw-typing{display:inline-flex;gap:4px}.fw-typing i{width:5px;height:5px;background:var(--muted);border-radius:50%;animation:fwt 1s infinite alternate}.fw-typing i:nth-child(2){animation-delay:.2s}.fw-typing i:nth-child(3){animation-delay:.4s}@keyframes fwt{to{transform:translateY(-4px);opacity:.45}}
        @media(max-width:520px){.fw-panel{inset:8px;width:auto;height:auto;border-radius:14px}.fw-launcher{${position}:14px;bottom:14px}.fw-greeting{${position}:82px;bottom:22px}.fw-contact-row{grid-template-columns:1fr}.fw-contact button{min-height:34px}}
      </style>
      <div class="fw-wrap">
        <button class="fw-launcher" aria-label="بازکردن پشتیبان">${chatIcon}</button>
        ${ap.greetingBubble ? `<div class="fw-greeting">${esc(ap.greetingBubble)}</div>` : ""}
        <section class="fw-panel ${themeClass}" role="dialog" aria-label="${esc(ap.title)}">
          <header class="fw-head"><div class="fw-avatar">${logo}</div><div class="fw-head-text"><strong>${esc(ap.title)}</strong><small>${esc(ap.subtitle)}</small></div><button class="fw-close" aria-label="بستن">×</button></header>
          <div class="fw-messages"></div>
          ${quick ? `<div class="fw-quick">${quick}</div>` : ""}
          <div class="fw-contact-slot"></div>
          <form class="fw-form"><textarea class="fw-input" placeholder="${esc(ap.inputPlaceholder)}"></textarea><button class="fw-send" type="submit" aria-label="ارسال">${sendIcon}</button></form>
          ${ap.showBranding ? '<div class="fw-brand">قدرت‌گرفته از دستیار هوشمند فاپا</div>' : ""}
        </section>
      </div>`;
  }

  function showRuntimeContact(root, widgetId, conversationId) {
    const slot = root.querySelector(".fw-contact-slot");
    if (!slot || slot.children.length) return;
    slot.innerHTML = `<div class="fw-contact"><div class="fw-contact-row"><input name="name" placeholder="نام (اختیاری)"><input name="contact" placeholder="شماره یا ایمیل"><button type="button">ثبت</button></div><div class="fw-contact-error" hidden></div></div>`;
    const button = slot.querySelector("button");
    button.onclick = async () => {
      const name = slot.querySelector('[name="name"]').value.trim();
      const contact = slot.querySelector('[name="contact"]').value.trim();
      const errorBox = slot.querySelector(".fw-contact-error");
      if (!contact) { errorBox.textContent = "شماره یا ایمیل را وارد کنید."; errorBox.hidden = false; return; }
      button.disabled = true;
      errorBox.hidden = true;
      try {
        await WidgetAPI.updateVisitorInfo(widgetId, conversationId, { name, contact });
        slot.innerHTML = '<div class="fw-contact" style="font-size:10px;color:#198754;text-align:center">اطلاعات تماس ثبت شد.</div>';
      } catch (error) {
        errorBox.textContent = error?.message || "ثبت اطلاعات تماس ناموفق بود.";
        errorBox.hidden = false;
        button.disabled = false;
      }
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
    saving: false,
    knowledgeUploadRunning: false
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
          <div class="ww-widget-card-head"><div class="ww-widget-identity"><div class="ww-widget-logo">${logo}</div><div class="min-width-0"><h3>${esc(widget.internalName || "ویجت بدون نام")}</h3><small>${esc(widget.destinationDomain || "دامنه تعیین نشده")}</small></div></div><span class="ww-status ${status.cls}"><i class="fa-solid ${status.icon}"></i>${status.label}</span></div>
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
        <div class="ww-editor-title"><button class="btn btn-sm btn-outline-secondary" id="btnBackWidgets"><i class="fa-solid fa-arrow-right"></i></button><div class="min-width-0"><div class="d-flex align-items-center gap-2"><h1>${esc(widget.internalName || "ویجت بدون نام")}</h1><span class="ww-status ${status.cls}"><i class="fa-solid ${status.icon}"></i>${status.label}</span></div><small>${esc(widget.username)} · ${esc(widget.destinationDomain || "دامنه تعیین نشده")}</small></div></div>
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
    if (tab === "identity") return Boolean(widget.internalName && widget.destinationDomain && widget.appearance.title);
    if (tab === "knowledge") return widget.files.some(file => file.status === "ready");
    if (tab === "behavior") return true;
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
    const ap = widget.appearance || {};
    const display = effectiveAppearance(ap);
    const logo = ap.logoDataUrl
      ? `<img src="${esc(ap.logoDataUrl)}" alt="">`
      : `<span>${esc(initials(display.assistantName || widget.internalName))}</span>`;
    return `<div class="ww-grid-2"><div class="ww-stack">
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-fingerprint"></i><div><h3>هویت و دامنه ویجت</h3><p>مالک ویجت و نام کاربری اختصاصی آن دو حساب جدا هستند. نام کاربری ویجت پس از ایجاد قابل تغییر نیست.</p></div></div>
        <div class="ww-form-grid">
          <div class="ww-form-field"><label for="wwInternalName"><span>نام داخلی ویجت ${requiredBadge()}</span>${helpIcon("نام داخلی", "این نام فقط در پنل مدیریت دیده می‌شود و برای تمایز ویجت‌های مختلف مالک است.")}</label><input id="wwInternalName" class="form-control" value="${esc(widget.internalName || "")}" placeholder="مثلاً پشتیبان سایت فروش فاپا" required><div class="form-text">فقط در پنل مالک دیده می‌شود.</div></div>
          <div class="ww-form-field"><label for="wwDomain"><span>دامنه مقصد ${requiredBadge()}</span>${helpIcon("دامنه مقصد", "نشانی دقیق Origin سایت مقصد را وارد کنید؛ مانند https://www.example.com. مسیر، Query و Fragment پذیرفته نمی‌شود.")}</label><input id="wwDomain" class="form-control ltr" value="${esc(widget.destinationDomain || "")}" placeholder="https://www.example.com" required><div class="form-text">نسخه عمومی فقط برای همین دامنه مجاز خواهد بود.</div></div>
          <div class="ww-form-field full"><label><span>نام کاربری اختصاصی ویجت</span>${helpIcon("کاربر اختصاصی ویجت", "این حساب سیستمی مالک فایل‌ها و گفتگوهای RAG ویجت است و با حساب انسانی سازنده یا اپراتورها تفاوت دارد.")}</label><div class="ww-readonly-code"><code>${esc(widget.username)}</code><button class="btn btn-sm btn-outline-secondary" type="button" data-copy="${esc(widget.username)}"><i class="fa-solid fa-copy"></i></button></div></div>
        </div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-message"></i><div><h3>متن‌ها و معرفی</h3><p>مقادیر نمونه داخل فیلدها صرفاً راهنما هستند و تا زمانی که ذخیره نشوند، بخشی از تنظیمات ویجت نیستند.</p></div></div>
        <div class="ww-form-grid">
          <div class="ww-form-field"><label for="wwTitle"><span>عنوان ویجت ${requiredBadge()}</span>${helpIcon("عنوان ویجت", "عنوانی است که در سربرگ پنجره چت به بازدیدکننده نمایش داده می‌شود.")}</label><input id="wwTitle" class="form-control" value="${esc(ap.title || "")}" placeholder="مثلاً پشتیبان محصولات فاپا" required></div>
          <div class="ww-form-field"><label for="wwAssistantName"><span>نام دستیار ${optionalBadge()}</span>${helpIcon("نام دستیار", "نام کوتاهی برای شخصیت یا آواتار پاسخ‌گو؛ در صورت خالی‌بودن، عنوان عمومی پشتیبان استفاده می‌شود.")}</label><input id="wwAssistantName" class="form-control" value="${esc(ap.assistantName || "")}" placeholder="مثلاً فاپی"></div>
          <div class="ww-form-field full"><label for="wwSubtitle"><span>زیرعنوان ${optionalBadge()}</span></label><input id="wwSubtitle" class="form-control" value="${esc(ap.subtitle || "")}" placeholder="مثلاً راهنمای محصولات، فروش و خدمات پس از فروش"></div>
          <div class="ww-form-field full"><label for="wwWelcome"><span>پیام خوشامدگویی ${optionalBadge()}</span>${helpIcon("پیام خوشامدگویی", "اولین پیام داخل پنجره گفتگو است. اگر خالی بماند، پیام عمومی سامانه نمایش داده می‌شود.")}</label><textarea id="wwWelcome" class="form-control" rows="3" placeholder="مثلاً سلام! برای انتخاب محصول یا دریافت پشتیبانی چه کمکی از من برمی‌آید؟">${esc(ap.welcomeMessage || "")}</textarea></div>
          <div class="ww-form-field"><label for="wwPlaceholder"><span>متن داخل کادر پرسش ${optionalBadge()}</span></label><input id="wwPlaceholder" class="form-control" value="${esc(ap.inputPlaceholder || "")}" placeholder="مثلاً پرسش خود را بنویسید..."></div>
          <div class="ww-form-field"><label for="wwGreeting"><span>حباب دعوت اولیه ${optionalBadge()}</span>${helpIcon("حباب دعوت اولیه", "متن کوتاهی است که کنار دکمه شناور، پیش از بازشدن پنجره چت، توجه بازدیدکننده را جلب می‌کند.")}</label><input id="wwGreeting" class="form-control" value="${esc(ap.greetingBubble || "")}" placeholder="مثلاً برای راهنمایی اینجا کلیک کنید"></div>
          <div class="ww-form-field full"><label for="wwQuickQuestions"><span>پرسش‌های پیشنهادی ${optionalBadge()}</span>${helpIcon("پرسش‌های پیشنهادی", "چند سؤال پرتکرار که در ابتدای گفتگو به‌صورت دکمه‌های سریع، هرکدام در یک سطر، نمایش داده می‌شوند.")}</label><textarea id="wwQuickQuestions" class="form-control" rows="4" placeholder="شرایط گارانتی چیست؟&#10;برای دریافت پیش‌فاکتور چه اطلاعاتی لازم است؟">${esc((ap.quickQuestions || []).join("\n"))}</textarea><div class="form-text">هر پرسش را در یک خط بنویسید؛ حداکثر ۶ مورد.</div></div>
        </div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-palette"></i><div><h3>ظاهر و نحوه نمایش</h3><p>تنظیمات سیستمی دارای مقدار اولیه‌اند؛ متن‌های محتوایی بالا بدون مقدار از پیش‌ساخته ذخیره می‌شوند.</p></div></div>
        <div class="ww-form-grid cols-3">
          <div class="ww-form-field"><label for="wwColorText"><span>رنگ اصلی</span></label><div class="ww-color-row"><input id="wwColorPicker" class="form-control form-control-color" type="color" value="${esc(ap.primaryColor || "#0d6efd")}"><input id="wwColorText" class="form-control ltr" value="${esc(ap.primaryColor || "#0d6efd")}"></div></div>
          <div class="ww-form-field"><label for="wwTheme"><span>پوسته ویجت</span></label><select id="wwTheme" class="form-select"><option value="light" ${ap.theme === "light" ? "selected" : ""}>روشن</option><option value="dark" ${ap.theme === "dark" ? "selected" : ""}>تیره</option><option value="auto" ${ap.theme === "auto" ? "selected" : ""}>هماهنگ با سایت</option></select></div>
          <div class="ww-form-field"><label for="wwPosition"><span>محل دکمه</span></label><select id="wwPosition" class="form-select"><option value="right" ${ap.position !== "left" ? "selected" : ""}>پایین راست</option><option value="left" ${ap.position === "left" ? "selected" : ""}>پایین چپ</option></select></div>
        </div>
        <div class="ww-form-grid mt-3">
          <div class="ww-switch-card"><div><strong>نمایش نشان فاپا</strong><small>عبارت «قدرت‌گرفته از دستیار هوشمند فاپا» در پایین ویجت نمایش داده شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwBranding" type="checkbox" ${ap.showBranding !== false ? "checked" : ""}></div></div>
          <div class="ww-switch-card"><div><strong>بازشدن خودکار ${helpIcon("بازشدن خودکار", "در صورت فعال‌بودن، پنجره چت پس از تأخیر تعیین‌شده بدون کلیک کاربر باز می‌شود.")}</strong><small>پنجره ویجت چند ثانیه پس از ورود باز شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwAutoOpen" type="checkbox" ${ap.autoOpen ? "checked" : ""}></div></div>
          <div class="ww-form-field ${ap.autoOpen ? "" : "ww-field-disabled"}" id="wwAutoDelayField"><label for="wwAutoDelay"><span>تأخیر بازشدن خودکار</span></label><div class="input-group"><input id="wwAutoDelay" class="form-control" type="number" min="1" max="60" value="${Number(ap.autoOpenDelay || 5)}" ${ap.autoOpen ? "" : "disabled"}><span class="input-group-text">ثانیه</span></div></div>
        </div>
      </section>
    </div><aside class="ww-stack">
      <div class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>لوگو یا آواتار ${optionalBadge()}</h3><p>فایل سبک و مربعی نتیجه بهتری دارد؛ حداکثر ۵۰۰ کیلوبایت.</p></div></div><div class="ww-logo-uploader"><div class="ww-logo-preview" id="wwLogoPreview" style="--preview-color:${esc(ap.primaryColor || "#0d6efd")}">${logo}</div><div class="ww-logo-actions"><label class="btn btn-outline-primary btn-sm" for="wwLogoInput"><i class="fa-solid fa-upload"></i> انتخاب تصویر</label><input id="wwLogoInput" class="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button class="btn btn-outline-danger btn-sm" id="wwRemoveLogo" type="button"><i class="fa-solid fa-trash-can"></i> حذف لوگو</button></div></div></div>
      <div class="ww-identity-help"><i class="fa-solid fa-shield-halved"></i><div><strong>دامنه در سمت API نیز کنترل می‌شود.</strong><br>شناسه عمومی ویجت قابل مشاهده است؛ اما حساب Runtime، توکن و دسترسی فایل‌ها هیچ‌گاه وارد کد نصب نمی‌شوند.</div></div>
      <div class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><h3>تفکیک هویت‌ها</h3></div><div class="ww-detail-row"><span>مالک و مدیر</span><strong>${esc(widget.ownerUsername)}</strong></div><div class="ww-detail-row"><span>کاربر LLM ویجت</span><strong class="ltr">${esc(widget.username)}</strong></div><div class="ww-detail-row"><span>اپراتورهای مجاز</span><strong>${fa(widget.operators.length)} نفر</strong></div></div>
    </aside></div>`;
  }

  function renderKnowledgeTab(widget) {
    return `<div class="ww-stack"><div class="ww-knowledge-owner"><i class="fa-solid fa-database"></i><div>فایل‌های این بخش در فضای اختصاصی کاربر <code>${esc(widget.username)}</code> بارگذاری می‌شوند. بازدیدکنندگان سایت فقط می‌توانند بر مبنای آن‌ها سؤال بپرسند و امکان بارگذاری یا حذف فایل ندارند.</div></div>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>افزودن منابع دانش</h3><p>فایل‌ها پس از بارگذاری، استخراج متن و ایندکس برای پاسخ‌گویی آماده می‌شوند.</p></div></div><label class="ww-dropzone" id="wwDropzone" for="wwFileInput"><div><i class="fa-solid fa-cloud-arrow-up"></i><h3>فایل‌ها را اینجا رها کنید یا کلیک کنید</h3><p>${supportedKnowledgeFilesText} — امکان انتخاب چند فایل</p><small>برای داده‌های ساخت‌یافته از پسوند <code>.rag.jsonl</code> استفاده کنید. فایل <code>.jsonl</code> عادی باید manifest معتبر داشته باشد.</small><small data-upload-queue-status>فایل‌ها یکی‌یکی و به‌ترتیب انتخاب پردازش می‌شوند.</small></div></label><input id="wwFileInput" class="hidden" type="file" multiple accept=".pdf,.doc,.docx,.odt,.txt,.md,.rag.jsonl,.jsonl,application/json,application/x-ndjson"></section>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>فایل‌های ویجت</h3><p>${fa(widget.files.length)} فایل ثبت شده؛ ${fa(widget.files.filter(file => file.status === "ready").length)} فایل آماده است.</p></div></div><div class="ww-file-list" id="wwFileList">${renderFiles(widget.files)}</div></section></div>`;
  }

  function renderFiles(files) {
    if (!files.length) return `<div class="ww-empty-state" style="min-height:190px"><div><i class="fa-solid fa-file-circle-plus"></i><h3>هنوز فایلی افزوده نشده است</h3><p>دانش ویجت از فایل‌های همین بخش ساخته می‌شود.</p></div></div>`;
    return files.map(file => {
    const meta = file.status === "ready"
        ? ["آماده", "text-success", "fa-circle-check"]
        : file.status === "failed"
          ? ["ناموفق", "text-danger", "fa-circle-xmark"]
          : file.status === "processing"
            ? ["در حال پردازش", "text-warning", "fa-gears"]
            : file.status === "queued"
              ? ["در صف", "text-secondary", "fa-clock"]
              : ["در حال بارگذاری", "text-primary", "fa-cloud-arrow-up"];
      const icon = file.type === "pdf" ? "pdf" : file.type === "txt" || file.type === "md" ? "lines" : file.type === "jsonl" ? "code" : "word";
      const transient = String(file.id || "").startsWith("upload-");
      const actions = transient
        ? ""
        : `${file.status === "failed" ? `<button class="btn btn-sm btn-outline-warning" data-action="retry-file" data-id="${file.id}"><i class="fa-solid fa-rotate"></i></button>` : ""}<button class="btn btn-sm btn-outline-danger" data-action="delete-file" data-id="${file.id}"><i class="fa-solid fa-trash-can"></i></button>`;
      return `<div class="ww-file-item" data-file-id="${file.id}"><div class="ww-file-icon"><i class="fa-solid fa-file-${icon}"></i></div><div class="ww-file-main"><strong>${esc(file.name)}</strong><small>${bytesHuman(file.size)} · ${file.status === "ready" ? `${fa(file.chunks)} بخش دانشی · ${formatDate(file.uploadedAt)}` : meta[0]}</small>${file.status !== "ready" ? `<div class="ww-progress"><span style="width:${Number(file.progress || 0)}%"></span></div>` : ""}</div><div class="ww-file-actions"><span class="ww-file-status ${meta[1]}"><i class="fa-solid ${meta[2]}"></i> ${meta[0]}</span>${actions}</div></div>`;
    }).join("");
  }

  function renderBehaviorTab(widget) {
    const b = widget.behavior || {};
    const hh = b.humanHandoff || {};
    const schedule = hh.schedule || defaultSchedule();
    const defaultPrompt = b.defaultPrompt || widget.defaultPrompt || "پرامپت پیش‌فرض سامانه هنگام اجرا اعمال می‌شود.";
    return `<div class="ww-stack">
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-terminal"></i><div><h3>راهنمای پاسخ‌گویی مدل</h3><p>سامانه همیشه یک پرامپت پایه و ایمن برای نقش پشتیبان دارد. متن اختصاصی مالک اختیاری است و به آن افزوده می‌شود.</p></div></div>
        <div class="ww-form-grid">
          <div class="ww-form-field full"><label for="wwCustomPrompt"><span>پرامپت تکمیلی مالک ${optionalBadge()}</span>${helpIcon("پرامپت تکمیلی", "دستورهای ویژه کسب‌وکار را بنویسید؛ مانند نحوه معرفی محصولات، محدودیت وعده‌دادن یا شیوه پاسخ. اگر خالی باشد فقط پرامپت پیش‌فرض سامانه اجرا می‌شود.")}</label><textarea id="wwCustomPrompt" class="form-control" rows="6" placeholder="مثلاً پیش از پیشنهاد محصول، ابتدا نوع سازمان و تعداد کاربران را بپرس. هیچ قیمت یا زمان تحویل قطعی بدون سند اعلام نکن.">${esc(b.customPrompt || "")}</textarea></div>
          <div class="ww-form-field full"><details class="ww-default-prompt"><summary><i class="fa-solid fa-shield-halved"></i> مشاهده پرامپت پیش‌فرض سامانه</summary><pre>${esc(defaultPrompt)}</pre></details></div>
          <div class="ww-form-field"><label for="wwAnswerMode"><span>محدوده دانش</span>${helpIcon("محدوده دانش", "در حالت فقط فایل‌ها، نبود سند مرتبط می‌تواند باعث ارجاع شود. در حالت دانش عمومی، مدل فقط برای توضیح عمومی مجاز به استفاده از دانش درونی است.")}</label><select id="wwAnswerMode" class="form-select"><option value="files-only" ${b.answerMode === "files-only" ? "selected" : ""}>فقط فایل‌های اختصاصی ویجت</option><option value="files-and-general" ${b.answerMode === "files-and-general" ? "selected" : ""}>فایل‌ها همراه دانش عمومی مدل</option></select></div>
          <div class="ww-form-field"><label for="wwTone"><span>لحن پاسخ</span></label><select id="wwTone" class="form-select"><option value="formal" ${b.tone === "formal" ? "selected" : ""}>رسمی و سازمانی</option><option value="friendly" ${b.tone === "friendly" ? "selected" : ""}>دوستانه</option><option value="sales" ${b.tone === "sales" ? "selected" : ""}>فروش‌محور</option><option value="support" ${b.tone === "support" ? "selected" : ""}>فنی و پشتیبانی</option></select></div>
          <div class="ww-form-field"><label for="wwResponseLength"><span>طول پاسخ</span></label><select id="wwResponseLength" class="form-select"><option value="short" ${b.responseLength === "short" ? "selected" : ""}>کوتاه</option><option value="balanced" ${b.responseLength === "balanced" ? "selected" : ""}>متعادل</option><option value="detailed" ${b.responseLength === "detailed" ? "selected" : ""}>تشریحی</option></select></div>
          <div class="ww-switch-card"><div><strong>نمایش رفرنس پاسخ ${helpIcon("نمایش رفرنس", "در صورت فعال‌بودن، نام فایل‌ها یا منابع بازیابی‌شده همراه پاسخ به بازدیدکننده نمایش داده می‌شود.")}</strong><small>منبعی که پاسخ از آن استخراج شده نمایش داده شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwShowReferences" type="checkbox" ${b.showReferences ? "checked" : ""}></div></div>
          <div class="ww-form-field full"><label for="wwFallback"><span>پیام نبود پاسخ مطمئن ${optionalBadge()}</span></label><textarea id="wwFallback" class="form-control" rows="3" placeholder="${esc(DEFAULT_FALLBACK)}">${esc(b.fallbackMessage || "")}</textarea><div class="form-text">اگر خالی باشد پیام پیش‌فرض سامانه استفاده می‌شود.</div></div>
        </div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-code-branch"></i><div><h3>شرایط ارجاع به پشتیبان انسانی</h3><p>موضوعات و عبارت‌ها برای هر ویجت مستقل‌اند و در منطق ارجاع و پرامپت اجرایی همان ویجت اثر می‌گذارند.</p></div></div>
        <div class="ww-form-grid">
          <div class="ww-switch-card"><div><strong>فعال‌بودن پاسخ‌گویی انسانی</strong><small>در صورت خاموش‌بودن، ویجت فقط پاسخ خودکار یا پیام نبود پاسخ را نمایش می‌دهد.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwHandoffEnabled" type="checkbox" ${hh.enabled ? "checked" : ""}></div></div>
          <div class="ww-switch-card"><div><strong>ذخیره پرسش‌های ارجاع‌شده</strong><small>سؤال و سابقه گفتگو برای مشاهده و پاسخ اپراتورها در صندوق انسانی ثبت شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwSaveUnanswered" type="checkbox" ${hh.saveUnanswered !== false ? "checked" : ""}></div></div>
          <div class="ww-switch-card"><div><strong>دریافت اطلاعات تماس</strong><small>پس از ارجاع، نام و شماره یا ایمیل از بازدیدکننده درخواست شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwCollectContact" type="checkbox" ${hh.collectContact ? "checked" : ""}></div></div>
          <div class="ww-switch-card"><div><strong>ارجاع بر اساس امتیاز تطابق اسناد ${helpIcon("امتیاز تطابق اسناد", "این عدد احتمال درست‌بودن پاسخ مدل نیست. امتیاز شباهت بهترین بخش بازیابی‌شده از اسناد RAG است. پایین‌بودن آن فقط نشانه کم‌ارتباط‌بودن اسناد پیدا‌شده است.")}</strong><small>اگر بهترین بخش بازیابی‌شده از آستانه پایین‌تر باشد، سؤال ارجاع شود.</small></div><div class="form-check form-switch"><input class="form-check-input" id="wwSimilarityEnabled" type="checkbox" ${hh.similarityEnabled ? "checked" : ""}></div></div>
          <div class="ww-form-field ${hh.similarityEnabled ? "" : "ww-field-disabled"}" id="wwSimilarityField"><label for="wwSimilarity"><span>آستانه تطابق اسناد</span></label><div class="ww-threshold-row"><input id="wwSimilarity" type="range" class="form-range" min="0" max="100" value="${Number(hh.similarityThreshold ?? 35)}" ${hh.similarityEnabled ? "" : "disabled"}><output id="wwSimilarityOutput">${fa(hh.similarityThreshold ?? 35)}٪</output></div><div class="form-text">این مقدار باید با داده‌های واقعی هر ویجت تنظیم شود؛ مقدار پیش‌فرض محافظه‌کارانه است.</div></div>
          <div class="ww-form-field full"><label for="wwTopics"><span>موضوعاتی که باید به انسان ارجاع شوند ${optionalBadge()}</span>${helpIcon("موضوعات ارجاع", "عبارت‌های موضوعی مخصوص همین کسب‌وکار را بنویسید. هرگاه متن سؤال شامل یکی از آن‌ها باشد، گفتگو به انسان ارجاع می‌شود و مدل نیز در پرامپت خود از پاسخ قطعی درباره آن موضوع منع می‌شود.")}</label><textarea id="wwTopics" class="form-control" rows="4" placeholder="مثلاً شکایت رسمی&#10;درخواست قرارداد اختصاصی&#10;حادثه امنیتی">${esc((hh.topics || []).join("\n"))}</textarea><div class="form-text">هر موضوع در یک سطر یا جداشده با ویرگول فارسی/انگلیسی؛ هیچ موضوع پیش‌فرضی تحمیل نمی‌شود.</div></div>
          <div class="ww-form-field full"><label for="wwKeywords"><span>عبارت‌های ارجاع اجباری ${optionalBadge()}</span>${helpIcon("عبارت ارجاع اجباری", "تطابق مستقیم عبارت در متن سؤال انجام می‌شود. از واژه‌ها یا عبارت‌های نسبتاً مشخص استفاده کنید تا ارجاع ناخواسته کم شود.")}</label><textarea id="wwKeywords" class="form-control" rows="3" placeholder="مثلاً پیش‌فاکتور، شکایت، صحبت با اپراتور">${esc((hh.keywords || []).join("، "))}</textarea><div class="form-text">ویرگول فارسی «،»، ویرگول انگلیسی «,»، نقطه‌ویرگول و سطر جدید پذیرفته می‌شوند.</div></div>
        </div>
      </section>
      <section class="ww-form-section"><div class="ww-form-section-title"><i class="fa-solid fa-calendar-days"></i><div><h3>روزها و ساعت‌های پاسخ‌گویی انسانی</h3><p>زمان‌بندی با منطقه زمانی انتخاب‌شده در سمت API ارزیابی می‌شود و بازه‌های عبورکننده از نیمه‌شب را نیز پشتیبانی می‌کند.</p></div></div>
        <div class="ww-form-grid"><div class="ww-form-field"><label for="wwTimezone"><span>منطقه زمانی</span></label><select id="wwTimezone" class="form-select"><option value="Asia/Tehran" ${schedule.timezone === "Asia/Tehran" ? "selected" : ""}>تهران</option><option value="Asia/Dubai" ${schedule.timezone === "Asia/Dubai" ? "selected" : ""}>دبی</option><option value="Europe/London" ${schedule.timezone === "Europe/London" ? "selected" : ""}>لندن</option><option value="America/Toronto" ${schedule.timezone === "America/Toronto" ? "selected" : ""}>تورنتو</option></select></div><div class="ww-form-field"><label for="wwOutsideBehavior"><span>رفتار خارج از ساعت کاری</span>${helpIcon("خارج از ساعت کاری", "ذخیره برای بعد: گفتگو به صف انسانی می‌رود. ادامه پاسخ خودکار: اگر سند مرتبط وجود داشته باشد مدل پاسخ می‌دهد و فقط در نبود پاسخ، پیام مناسب نمایش داده می‌شود.")}</label><select id="wwOutsideBehavior" class="form-select"><option value="queue" ${hh.outsideHoursBehavior !== "bot-only" ? "selected" : ""}>ذخیره سؤال برای پاسخ بعدی</option><option value="bot-only" ${hh.outsideHoursBehavior === "bot-only" ? "selected" : ""}>ادامه پاسخ خودکار در صورت وجود سند</option></select></div></div>
        <div class="ww-table-wrap mt-3"><table class="ww-schedule-table"><thead><tr><th>روز</th><th>فعال</th><th>شروع</th><th>پایان</th></tr></thead><tbody>${WEEKDAYS.map(dayItem => { const row = schedule.days?.[dayItem.key] || { enabled: false, start: "08:00", end: "17:00" }; return `<tr data-day="${dayItem.key}"><td><strong>${dayItem.label}</strong></td><td><div class="form-check form-switch"><input class="form-check-input ww-day-enabled" type="checkbox" ${row.enabled ? "checked" : ""}></div></td><td><input class="form-control ww-day-start" type="time" value="${esc(row.start)}" ${row.enabled ? "" : "disabled"}></td><td><input class="form-control ww-day-end" type="time" value="${esc(row.end)}" ${row.enabled ? "" : "disabled"}></td></tr>`; }).join("")}</tbody></table></div>
      </section>
    </div>`;
  }

  function renderOperatorsTab(widget) {
    return `<div class="ww-stack">
      <div class="ww-identity-help"><i class="fa-solid fa-users"></i><div><strong>اپراتورها کاربران مستقل سامانه هستند.</strong><br>نام کاربری واردشده در سمت API با جدول کاربران کنترل می‌شود؛ کاربر ناموجود یا فاقد نام کاربری پذیرفته نمی‌شود. اپراتور پس از ورود از مسیر <a href="/webwidget#inbox"><strong>ویجت‌ها ← صندوق پاسخ‌گویی</strong></a> به گفتگوهای مجاز دسترسی دارد.</div></div>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>افزودن اپراتور مجاز</h3><p>نام کاربری دقیق فردی را وارد کنید که قبلاً حساب و نام کاربری یکتا در سامانه دارد.</p></div><a class="btn btn-sm btn-outline-primary" href="/webwidget#inbox"><i class="fa-solid fa-inbox"></i> مشاهده صندوق پاسخ‌گویی</a></div><div class="ww-operator-add"><div class="ww-form-field"><label for="wwOperatorUsername"><span>نام کاربری اپراتور ${requiredBadge()}</span></label><input id="wwOperatorUsername" class="form-control ltr" placeholder="operator-username" autocomplete="off"></div><button class="btn btn-primary" id="btnAddOperator"><i class="fa-solid fa-user-plus"></i> افزودن</button></div></section>
      <section class="ww-card ww-card-flat ww-card-body"><div class="ww-section-head"><div><h3>اپراتورهای پاسخ‌گو</h3><p>${fa(widget.operators.length)} کاربر ثبت شده است؛ آمار تفکیکی در بخش «آمار استفاده» نمایش داده می‌شود.</p></div></div><div class="ww-operator-list">${widget.operators.length ? widget.operators.map(operator => `<div class="ww-operator-item"><div class="ww-operator-avatar">${operator.avatar ? `<img src="${esc(operator.avatar)}" alt="">` : `<i class="fa-solid fa-user"></i>`}</div><div class="ww-operator-main"><strong>${esc(operator.displayName)}</strong><small class="ltr">${esc(operator.username)}</small></div><div class="ww-op-stat"><strong>${operator.role === "Owner" ? "مالک" : "اپراتور"}</strong><small>سطح دسترسی</small></div><div class="ww-op-stat"><strong class="${operator.active ? "text-success" : "text-muted"}">${operator.active ? "فعال" : "غیرفعال"}</strong><small>وضعیت</small></div><div class="d-flex gap-1"><button class="btn btn-sm ${operator.active ? "btn-outline-warning" : "btn-outline-success"}" data-action="toggle-operator" data-username="${esc(operator.username)}" title="${operator.active ? "غیرفعال‌کردن" : "فعال‌کردن"}"><i class="fa-solid ${operator.active ? "fa-pause" : "fa-play"}"></i></button><button class="btn btn-sm btn-outline-danger" data-action="remove-operator" data-username="${esc(operator.username)}"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join("") : `<div class="ww-empty-state" style="min-height:180px"><div><i class="fa-solid fa-user-shield"></i><h3>اپراتور دیگری ثبت نشده است</h3><p>مالک ویجت به صندوق پاسخ‌گویی دسترسی دارد؛ برای تقسیم کار، اپراتور اضافه کنید.</p></div></div>`}</div></section>
    </div>`;
  }

  function renderTestTab(widget) {
    const ap = effectiveAppearance(widget.appearance);
    if (!app.testMessages.length) app.testMessages = [{ sender: "assistant", text: ap.welcomeMessage, references: [] }];
    return `<div class="ww-stack"><div class="ww-preview-toolbar"><div class="ww-device-buttons"><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "desktop" ? "active" : ""}" data-device="desktop"><i class="fa-solid fa-desktop"></i> دسکتاپ</button><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "tablet" ? "active" : ""}" data-device="tablet"><i class="fa-solid fa-tablet-screen-button"></i> تبلت</button><button class="btn btn-sm btn-outline-secondary ${app.testDevice === "mobile" ? "active" : ""}" data-device="mobile"><i class="fa-solid fa-mobile-screen"></i> موبایل</button></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" id="btnResetTest"><i class="fa-solid fa-rotate-left"></i> شروع دوباره</button><a class="btn btn-sm btn-outline-primary" href="webwidget-demo-site.html?widget=${widget.id}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> صفحه نمونه مستقل</a></div></div>
      <div class="ww-preview-stage"><div class="ww-preview-browser ${app.testDevice}" id="wwPreviewBrowser"><div class="ww-browser-bar"><span class="ww-browser-dot"></span><span class="ww-browser-dot"></span><span class="ww-browser-dot"></span><div class="ww-browser-address">${esc(widget.destinationDomain || "https://example.com")}</div></div><div class="ww-fake-site-nav"><div class="ww-fake-logo">F</div><strong>فناوری اطلاعات فاپا</strong><div class="ww-fake-links"><span>محصولات</span><span>راهکارها</span><span>خدمات</span><span>تماس</span></div></div><div class="ww-fake-hero"><span class="badge text-bg-primary">سایت مقصد شبیه‌سازی‌شده</span><h2>راهکارهای نرم‌افزاری و سخت‌افزاری برای سازمان‌ها</h2><p>در این محیط، خود ویجت و نشست Preview به API واقعی متصل‌اند؛ فقط صفحه میزبان شبیه‌سازی شده است.</p><button class="btn btn-primary">مشاهده راهکارها</button></div><div class="ww-fake-products"><div class="ww-fake-product"><span>🖥️</span><strong>نرم‌افزارهای سازمانی</strong><small>اتوماسیون و مدیریت خدمات</small></div><div class="ww-fake-product"><span>🛡️</span><strong>امنیت و زیرساخت</strong><small>تجهیزات، نصب و پشتیبانی</small></div><div class="ww-fake-product"><span>🎧</span><strong>خدمات پس از فروش</strong><small>گارانتی و نگهداری</small></div></div>${renderTestWidget(widget)}</div></div></div>`;
  }

  function renderTestWidget(widget) {
    const ap = effectiveAppearance(widget.appearance);
    const position = ap.position === "left" ? "left" : "right";
    const themeClass = widgetThemeClass(ap.theme);
    const logo = ap.logoDataUrl ? `<img src="${esc(ap.logoDataUrl)}" alt="">` : esc(initials(ap.assistantName));
    return `<div class="ww-test-widget-layer" style="${widgetPaletteVariables(ap.primaryColor)}"><button class="ww-test-launcher ${position} ${app.testOpen ? "hidden" : ""}" id="wwTestLauncher" type="button"><i class="fa-solid fa-comments"></i></button>${ap.greetingBubble ? `<div class="ww-test-greeting ${position} ${app.testOpen ? "hidden" : ""}" id="wwTestGreeting">${esc(ap.greetingBubble)}</div>` : ""}<section class="ww-test-chat ${position} ${themeClass} ${app.testOpen ? "" : "hidden"}" id="wwTestChat"><header class="ww-test-chat-head"><div class="ww-test-chat-avatar">${logo}</div><div><strong>${esc(ap.title)}</strong><small>${esc(ap.subtitle)}</small></div><button id="wwTestClose" type="button" aria-label="بستن"><i class="fa-solid fa-xmark"></i></button></header><div class="ww-test-messages" id="wwTestMessages">${app.testMessages.map(renderTestMessage).join("")}</div>${(ap.quickQuestions || []).length ? `<div class="ww-test-quick">${ap.quickQuestions.slice(0, 4).map(q => `<button type="button" data-test-question="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}<div id="wwTestContactSlot">${app.testConversationId && widget.behavior.humanHandoff.collectContact ? renderTestContact() : ""}</div><form class="ww-test-input" id="wwTestForm"><textarea id="wwTestInput" rows="1" placeholder="${esc(ap.inputPlaceholder)}"></textarea><button type="submit" id="wwTestSend" aria-label="ارسال"><i class="fa-solid fa-paper-plane"></i></button></form>${ap.showBranding ? '<div class="ww-test-branding">قدرت‌گرفته از دستیار هوشمند فاپا</div>' : ""}</section></div>`;
  }

  function renderTestMessage(message) {
    const refs = message.references?.length ? `<div class="ww-refs">منبع: ${message.references.map(ref => esc(ref.name)).join("، ")}</div>` : "";
    return `<div class="ww-test-message ${message.sender}"><div class="ww-test-message-content">${messageContentHTML(message.sender, message.text)}</div>${refs}</div>`;
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

  function bindHelpPopovers() {
    if (typeof bootstrap === "undefined" || !bootstrap.Popover) return;
    document.querySelectorAll('[data-bs-toggle="popover"]').forEach(element => {
      bootstrap.Popover.getOrCreateInstance(element, { container: "body", html: false });
    });
  }

  function bindIdentity(widget) {
    bindHelpPopovers();
    const picker = document.getElementById("wwColorPicker"), text = document.getElementById("wwColorText"), preview = document.getElementById("wwLogoPreview");
    picker.oninput = () => { text.value = picker.value; preview.style.setProperty("--preview-color", picker.value); };
    text.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { picker.value = text.value; preview.style.setProperty("--preview-color", text.value); } };
    const autoOpen = document.getElementById("wwAutoOpen"), delay = document.getElementById("wwAutoDelay"), delayField = document.getElementById("wwAutoDelayField");
    const syncAutoDelay = () => { delay.disabled = !autoOpen.checked; delayField.classList.toggle("ww-field-disabled", !autoOpen.checked); };
    autoOpen.addEventListener("change", syncAutoDelay); syncAutoDelay();
    document.getElementById("wwLogoInput").onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 500 * 1024) return toastSafe("حجم لوگو باید کمتر از ۵۰۰ کیلوبایت باشد", "warning");
      const dataUrl = await readDataUrl(file); await WidgetAPI.updateWidget(widget.id, { appearance: { logoDataUrl: dataUrl } }); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor();
    };
    document.getElementById("wwRemoveLogo").onclick = async () => { await WidgetAPI.updateWidget(widget.id, { appearance: { logoDataUrl: "" } }); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); };
  }

  function bindKnowledge(widget) {
    const input = document.getElementById("wwFileInput"), zone = document.getElementById("wwDropzone");
    input.onchange = () => {
      const files = Array.from(input.files || []);
      input.value = "";
      uploadFiles(widget.id, files);
    };
    ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", event => uploadFiles(widget.id, Array.from(event.dataTransfer.files || [])));
    document.getElementById("wwFileList").onclick = async event => {
      const button = event.target.closest("[data-action]"); if (!button) return;
      if (button.dataset.action === "delete-file") { const ok = await confirmSafe("حذف فایل", "این فایل از دانش اختصاصی ویجت حذف شود؟"); if (ok) { await WidgetAPI.deleteFile(widget.id, button.dataset.id); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); } }
      if (button.dataset.action === "retry-file") { await WidgetAPI.retryFile(widget.id, button.dataset.id); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); }
    };
  }

  async function uploadFiles(widgetId, files) {
    if (!files?.length) return;
    if (app.knowledgeUploadRunning) {
      toastSafe("یک صف بارگذاری در حال پردازش است؛ پس از پایان دوباره تلاش کنید", "warning");
      return;
    }
    
    const selectedFiles = Array.from(files);
    const unsupported = selectedFiles.filter(file => !isSupportedKnowledgeFile(file));
    const supported = selectedFiles.filter(isSupportedKnowledgeFile);

    if (unsupported.length) {
      toastSafe(`فرمت این فایل‌ها پشتیبانی نمی‌شود: ${unsupported.map(file => file.name).join("، ")}. فرمت‌های مجاز: ${supportedKnowledgeFilesText}`, "warning");
    }
    if (!supported.length) return;
    
    const list = document.getElementById("wwFileList");
    const input = document.getElementById("wwFileInput");
    const zone = document.getElementById("wwDropzone");
    const queueStatus = zone?.querySelector("[data-upload-queue-status]");
    app.knowledgeUploadRunning = true;
    if (input) input.disabled = true;
    zone?.classList.add("uploading");
    zone?.setAttribute("aria-busy", "true");
    
    try {
      const summary = await WidgetAPI.uploadFiles(widgetId, supported, file => {
        const empty = list.querySelector(".ww-empty-state");
        if (empty) empty.remove();
        const current = list.querySelector(`[data-file-id="${CSS.escape(String(file.id))}"]`);
        const html = renderFiles([file]);
        if (current) current.outerHTML = html;
        else list.insertAdjacentHTML("beforeend", html);

        if (queueStatus && file.status !== "queued") {
          queueStatus.textContent = `در حال پردازش فایل ${fa(file.queueIndex)} از ${fa(file.queueTotal)}: ${file.name}`;
        }
      });
      app.widget = await WidgetAPI.getWidget(widgetId);
      list.innerHTML = renderFiles(app.widget.files);

      if (summary.failed === 0) {
        toastSafe(`${fa(summary.succeeded)} فایل به‌ترتیب پردازش و به دانش ویجت افزوده شد`, "success");
      } else {
        const failedNames = summary.results.filter(item => !item.ok).map(item => item.file.name).join("، ");
        const level = summary.succeeded ? "warning" : "danger";
        toastSafe(`${fa(summary.succeeded)} فایل پردازش شد و ${fa(summary.failed)} فایل ناموفق بود: ${failedNames}`, level);
      }      
    } catch (error) {
      app.widget = await WidgetAPI.getWidget(widgetId).catch(() => app.widget);
      list.innerHTML = renderFiles(app.widget?.files || []);
      +      toastSafe(error.message || "پردازش صف فایل‌ها ناموفق بود", "danger");
    } finally {
      app.knowledgeUploadRunning = false;
      if (input) input.disabled = false;
      zone?.classList.remove("uploading");
      zone?.removeAttribute("aria-busy");
      if (queueStatus) queueStatus.textContent = "فایل‌ها یکی‌یکی و به‌ترتیب انتخاب پردازش می‌شوند.";
    }
  }

  function bindBehavior() {
    bindHelpPopovers();
    const enabled = document.getElementById("wwSimilarityEnabled");
    const range = document.getElementById("wwSimilarity");
    const output = document.getElementById("wwSimilarityOutput");
    const field = document.getElementById("wwSimilarityField");
    const syncSimilarity = () => {
      range.disabled = !enabled.checked;
      field.classList.toggle("ww-field-disabled", !enabled.checked);
    };
    range.oninput = () => output.textContent = `${fa(range.value)}٪`;
    enabled.onchange = syncSimilarity;
    syncSimilarity();
    document.querySelectorAll(".ww-schedule-table tbody tr").forEach(row => {
      const checkbox = row.querySelector(".ww-day-enabled");
      const times = row.querySelectorAll(".ww-day-start,.ww-day-end");
      const sync = () => times.forEach(input => { input.disabled = !checkbox.checked; });
      checkbox.addEventListener("change", sync); sync();
    });
  }

  function bindOperators(widget) {
    document.getElementById("btnAddOperator").onclick = async () => {
      const username = document.getElementById("wwOperatorUsername").value.trim().toLowerCase();
      if (!username) return toastSafe("نام کاربری اپراتور را وارد کنید", "warning");
      try { await WidgetAPI.addOperator(widget.id, { username }); toastSafe("اپراتور مجاز افزوده شد", "success"); app.widget = await WidgetAPI.getWidget(widget.id); renderEditor(); } catch (error) { toastSafe(error.message, "danger"); }
    };
    document.querySelector(".ww-operator-list").onclick = async event => {
      const button = event.target.closest("[data-action]"); if (!button) return;
      if (button.dataset.action === "toggle-operator") await WidgetAPI.toggleOperator(widget.id, button.dataset.username);
      if (button.dataset.action === "remove-operator") { const ok = await confirmSafe("حذف اپراتور", "دسترسی این کاربر به گفتگوهای ویجت حذف شود؟"); if (!ok) return; await WidgetAPI.removeOperator(widget.id, button.dataset.username); }
      app.widget = await WidgetAPI.getWidget(widget.id); renderEditor();
    };
  }

  function bindTestContact(widget) {
    const button = document.getElementById("btnSaveTestContact");
    if (!button) return;
    button.onclick = async () => {
      const contact = document.getElementById("wwTestVisitorContact").value.trim();
      if (!contact) return toastSafe("شماره تماس یا ایمیل را وارد کنید", "warning");
      button.disabled = true;
      try {
        await WidgetAPI.updateVisitorInfo(widget.id, app.testConversationId, {
          name: document.getElementById("wwTestVisitorName").value.trim(),
          contact
        });
        document.getElementById("wwTestContactSlot").innerHTML = '<div class="ww-test-contact text-success text-center small">اطلاعات تماس در نشست آزمایشی ثبت شد.</div>';
      } catch (error) {
        toastSafe(error.message, "danger");
        button.disabled = false;
      }
    };
  }

  function bindTest(widget) {
    document.querySelectorAll("[data-device]").forEach(button => button.onclick = () => { app.testDevice = button.dataset.device; renderEditor(); });
    document.getElementById("btnResetTest").onclick = async () => { await WidgetAPI.resetTestSession(widget.id, app.testSessionId); app.testSessionId = `test-${Math.random().toString(36).slice(2, 10)}`; app.testMessages = [{ sender: "assistant", text: effectiveAppearance(widget.appearance).welcomeMessage }]; app.testConversationId = null; renderEditor(); };
    document.getElementById("wwTestLauncher")?.addEventListener("click", () => { app.testOpen = true; document.getElementById("wwTestChat").classList.remove("hidden"); document.getElementById("wwTestLauncher").classList.add("hidden"); document.getElementById("wwTestGreeting")?.classList.add("hidden"); });
    document.getElementById("wwTestClose")?.addEventListener("click", () => { app.testOpen = false; document.getElementById("wwTestChat").classList.add("hidden"); document.getElementById("wwTestLauncher").classList.remove("hidden"); document.getElementById("wwTestGreeting")?.classList.remove("hidden"); });
    document.querySelectorAll("[data-test-question]").forEach(button => button.onclick = () => { document.getElementById("wwTestInput").value = button.dataset.testQuestion; document.getElementById("wwTestForm").requestSubmit(); });
    document.getElementById("wwTestForm")?.addEventListener("submit", event => sendTestMessage(event, widget));
    bindTestContact(widget);
  }

  async function sendTestMessage(event, widget) {
    event.preventDefault();
    const input = document.getElementById("wwTestInput");
    const send = document.getElementById("wwTestSend");
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = "";
    input.disabled = true;
    send.disabled = true;
    app.testMessages.push({ sender: "visitor", text });
    const box = document.getElementById("wwTestMessages");
    box.insertAdjacentHTML("beforeend", renderTestMessage({ sender: "visitor", text }) + '<div class="ww-test-message assistant" id="wwTestTyping"><span class="ww-typing"><i></i><i></i><i></i></span></div>');
    box.scrollTop = box.scrollHeight;
    try {
      const result = await WidgetAPI.testChat(widget.id, app.testSessionId, text);
      document.getElementById("wwTestTyping")?.remove();
      const answer = result.answer || "پاسخی دریافت نشد.";
      app.testMessages.push({ sender: "assistant", text: answer, references: result.references });
      box.insertAdjacentHTML("beforeend", renderTestMessage({ sender: "assistant", text: answer, references: result.references }));
      if (result.mode === "handoff") {
        app.testConversationId = result.conversationId;
        document.getElementById("wwTestContactSlot").innerHTML = widget.behavior.humanHandoff.collectContact ? renderTestContact() : "";
        bindTestContact(widget);
        toastSafe("شرایط ارجاع انسانی در حالت آزمایش فعال شد؛ نشست آزمایشی وارد صندوق واقعی اپراتورها نمی‌شود.", "info");
      }
      box.scrollTop = box.scrollHeight;
    } catch (error) {
      document.getElementById("wwTestTyping")?.remove();
      const message = error?.message || "خطا در ارتباط با سامانه";
      app.testMessages.push({ sender: "assistant", text: message });
      box.insertAdjacentHTML("beforeend", renderTestMessage({ sender: "assistant", text: message }));
      toastSafe(message, "danger");
    } finally {
      input.disabled = false;
      send.disabled = false;
      input.focus();
    }
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
        changes = {
          internalName: document.getElementById("wwInternalName").value.trim(),
          destinationDomain: normalizeOrigin(document.getElementById("wwDomain").value),
          appearance: {
            title: document.getElementById("wwTitle").value.trim(),
            assistantName: document.getElementById("wwAssistantName").value.trim(),
            subtitle: document.getElementById("wwSubtitle").value.trim(),
            welcomeMessage: document.getElementById("wwWelcome").value.trim(),
            inputPlaceholder: document.getElementById("wwPlaceholder").value.trim(),
            greetingBubble: document.getElementById("wwGreeting").value.trim(),
            primaryColor: document.getElementById("wwColorText").value.trim(),
            theme: document.getElementById("wwTheme").value,
            position: document.getElementById("wwPosition").value,
            showBranding: document.getElementById("wwBranding").checked,
            autoOpen: document.getElementById("wwAutoOpen").checked,
            autoOpenDelay: Number(document.getElementById("wwAutoDelay").value || 5),
            quickQuestions: splitList(document.getElementById("wwQuickQuestions").value).slice(0, 6)
          }
        };
      }
      if (app.editorTab === "behavior" && document.getElementById("wwCustomPrompt")) {
        const days = {};
        document.querySelectorAll(".ww-schedule-table tbody tr").forEach(row => {
          days[row.dataset.day] = {
            enabled: row.querySelector(".ww-day-enabled").checked,
            start: row.querySelector(".ww-day-start").value,
            end: row.querySelector(".ww-day-end").value
          };
        });
        changes = {
          behavior: {
            customPrompt: document.getElementById("wwCustomPrompt").value.trim(),
            answerMode: document.getElementById("wwAnswerMode").value,
            tone: document.getElementById("wwTone").value,
            responseLength: document.getElementById("wwResponseLength").value,
            showReferences: document.getElementById("wwShowReferences").checked,
            fallbackMessage: document.getElementById("wwFallback").value.trim(),
            humanHandoff: {
              enabled: document.getElementById("wwHandoffEnabled").checked,
              saveUnanswered: document.getElementById("wwSaveUnanswered").checked,
              collectContact: document.getElementById("wwCollectContact").checked,
              similarityEnabled: document.getElementById("wwSimilarityEnabled").checked,
              similarityThreshold: Number(document.getElementById("wwSimilarity").value),
              topics: splitList(document.getElementById("wwTopics").value),
              keywords: splitList(document.getElementById("wwKeywords").value),
              outsideHoursBehavior: document.getElementById("wwOutsideBehavior").value,
              schedule: { timezone: document.getElementById("wwTimezone").value, days }
            }
          }
        };
      }
      if (changes) {
        app.widget = await WidgetAPI.updateWidget(app.widget.id, changes);
        if (showToast) toastSafe("تغییرات ذخیره شد", "success");
      }
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
    view.innerHTML = `<div class="ww-page-header"><div><h1>پاسخ‌گویی انسانی</h1><p>سؤال‌هایی که ویجت پاسخ مطمئن نداده یا طبق قواعد نیازمند انسان بوده‌اند در این بخش قرار می‌گیرند.</p></div></div><div class="ww-card ww-inbox-layout ${selected ? "thread-open" : ""}" id="wwInboxLayout"><aside class="ww-inbox-list"><div class="ww-inbox-list-head"><div class="d-grid gap-2"><select class="form-select form-select-sm" id="wwInboxWidget"><option value="">همه ویجت‌ها</option>${app.widgets.map(widget => `<option value="${widget.id}" ${app.inboxWidget === widget.id ? "selected" : ""}>${esc(widget.internalName || "ویجت بدون نام")}</option>`).join("")}</select><select class="form-select form-select-sm" id="wwInboxStatus"><option value="all" ${app.inboxStatus === "all" ? "selected" : ""}>همه وضعیت‌ها</option><option value="queued" ${app.inboxStatus === "queued" ? "selected" : ""}>ذخیره‌شده خارج ساعت</option><option value="pending" ${app.inboxStatus === "pending" ? "selected" : ""}>در انتظار واگذاری</option><option value="assigned" ${app.inboxStatus === "assigned" ? "selected" : ""}>در حال پاسخ‌گویی</option><option value="resolved" ${app.inboxStatus === "resolved" ? "selected" : ""}>بسته‌شده</option></select></div></div><div class="ww-inbox-items">${renderConversationList(app.conversations, app.selectedConversationId)}</div></aside><section class="ww-inbox-thread">${selected ? renderThread(selected) : '<div class="ww-inbox-empty"><div><i class="fa-solid fa-comments" style="font-size:2.5rem"></i><p class="mt-3">گفتگویی برای نمایش انتخاب نشده است.</p></div></div>'}</section><aside class="ww-inbox-details">${selected ? renderConversationDetails(selected) : ""}</aside></div>`;
    document.getElementById("wwInboxWidget").onchange = event => { app.inboxWidget = event.target.value; renderInbox(); };
    document.getElementById("wwInboxStatus").onchange = event => { app.inboxStatus = event.target.value; renderInbox(); };
    document.querySelector(".ww-inbox-items").onclick = event => { const button = event.target.closest("[data-conversation]"); if (!button) return; app.selectedConversationId = button.dataset.conversation; renderInbox(); };
    if (selected) bindThread(selected);
    setLoading(false);
  }

  function renderConversationList(rows, selectedId) {
    if (!rows.length) return `<div class="ww-empty-state" style="min-height:280px"><div><i class="fa-solid fa-inbox"></i><h3>صندوق خالی است</h3><p>در این فیلتر گفتگویی وجود ندارد.</p></div></div>`;
    return rows.map(item => { const last = item.messages.at(-1); const status = item.status === "pending" ? "text-bg-danger" : item.status === "queued" ? "text-bg-warning" : item.status === "assigned" ? "text-bg-primary" : "text-bg-success"; return `<button class="ww-conversation-item ${selectedId === item.id ? "active" : ""}" data-conversation="${item.id}"><div class="ww-conv-icon"><i class="fa-solid ${topicIcon(item.category)}"></i></div><div class="min-width-0"><strong>${esc(item.visitorName || "بازدیدکننده ناشناس")}</strong><span>${esc(last?.text || "")}</span><span>${esc(item.widgetName)}</span></div><div><time>${formatDateTime(item.updatedAt)}</time><span class="badge ${status} mt-1">${conversationStatus(item.status)}</span></div></button>`; }).join("");
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
    return `<div class="ww-detail-group"><h4>بازدیدکننده</h4><div class="ww-detail-row"><span>نام</span><strong>${esc(item.visitorName || "ناشناس")}</strong></div><div class="ww-detail-row"><span>تماس</span><strong class="ltr">${esc(item.visitorContact || "ثبت نشده")}</strong></div><div class="ww-detail-row"><span>شناسه نشست</span><strong class="ltr">${esc(item.sessionId)}</strong></div></div><div class="ww-detail-group"><h4>ارجاع</h4><div class="ww-detail-row"><span>موضوع</span><strong>${esc(topicLabel(item.category))}</strong></div><div class="ww-detail-row"><span>دلیل</span><strong>${esc(item.escalatedReason)}</strong></div><div class="ww-detail-row"><span>امتیاز تطابق اسناد</span><strong>${fa(item.similarityScore ?? item.confidence)}٪</strong></div><div class="ww-detail-row"><span>اپراتور</span><strong>${esc(operatorName)}</strong></div></div><div class="ww-detail-group"><h4>زمان‌بندی</h4><div class="ww-detail-row"><span>ایجاد</span><strong>${formatDateTime(item.createdAt)}</strong></div><div class="ww-detail-row"><span>آخرین تغییر</span><strong>${formatDateTime(item.updatedAt)}</strong></div><div class="ww-detail-row"><span>بسته‌شدن</span><strong>${formatDateTime(item.resolvedAt)}</strong></div></div>`;
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
    view.innerHTML = `<div class="ww-page-header"><div><h1>آمار استفاده و پاسخ‌گویی</h1><p>عملکرد پاسخ خودکار و پاسخ‌گویی انسانی به تفکیک اپراتورها.</p></div><div class="ww-header-actions"><select class="form-select" id="wwAnalyticsWidget"><option value="all">همه ویجت‌ها</option>${app.widgets.map(widget => `<option value="${widget.id}" ${app.analyticsWidget === widget.id ? "selected" : ""}>${esc(widget.internalName || "ویجت بدون نام")}</option>`).join("")}</select></div></div><div class="ww-kpi-grid">${kpi("نشست‌ها", data.totals.sessions, "هفت روز اخیر", "fa-comments", "")}${kpi("پیام‌های کاربران", data.totals.messages, "مجموع پرسش‌های دریافت‌شده", "fa-message", "success")}${kpi("پاسخ خودکار", `${answerRate}٪`, `${fa(data.totals.aiAnswers)} پاسخ`, "fa-robot", "purple")}${kpi("ارجاع انسانی", `${humanRate}٪`, `${fa(data.totals.humanEscalations)} گفتگو`, "fa-headset", "warning")}</div><div class="ww-grid-2"><section class="ww-card ww-chart-card"><div class="ww-section-head"><div><h3>روند پیام‌ها و ارجاع‌ها</h3><p>پاسخ هوش مصنوعی در برابر گفتگوهای ارجاع‌شده به انسان</p></div></div><div class="ww-bar-chart">${data.daily.map(row => { const height = Math.max(4, row.messages / maxMessages * 100); const aiPart = row.messages ? row.aiAnswers / row.messages * 100 : 0; const humanPart = row.messages ? row.humanEscalations / row.messages * 100 : 0; return `<div class="ww-bar-col"><div class="ww-bar-stack" style="--bar-height:${height}%;--ai-part:${aiPart}%;--human-part:${humanPart}%"><div class="ww-bar-ai" title="پاسخ خودکار: ${row.aiAnswers}"></div><div class="ww-bar-human" title="ارجاع انسانی: ${row.humanEscalations}"></div></div><small>${new Date(row.date).toLocaleDateString("fa-IR", { weekday: "short" })}</small></div>`; }).join("")}</div><div class="ww-chart-legend"><span><i style="background:#0d6efd"></i>پاسخ خودکار</span><span><i style="background:#6f42c1"></i>ارجاع انسانی</span></div></section><section class="ww-card ww-chart-card"><div class="ww-section-head"><div><h3>ترکیب پاسخ‌گویی</h3><p>نسبت پاسخ مدل به نیاز به اپراتور انسانی</p></div></div><div class="ww-donut-wrap"><div class="ww-donut" style="--ai:${answerRate}"><div class="ww-donut-center"><div><strong>${fa(answerRate)}٪</strong><small>پاسخ خودکار</small></div></div></div><div class="ww-metric-list"><div class="ww-metric-row"><i style="background:#0d6efd"></i><span>پاسخ مدل</span><strong>${fa(data.totals.aiAnswers)}</strong></div><div class="ww-metric-row"><i style="background:#6f42c1"></i><span>ارجاع به انسان</span><strong>${fa(data.totals.humanEscalations)}</strong></div><div class="ww-metric-row"><i style="background:#dc3545"></i><span>در انتظار پاسخ</span><strong>${fa(data.totals.pending)}</strong></div><div class="ww-metric-row"><i style="background:#198754"></i><span>گفتگوی بسته‌شده</span><strong>${fa(data.totals.resolved)}</strong></div></div></div></section></div><section class="ww-card ww-card-body mt-3"><div class="ww-section-head"><div><h3>عملکرد اپراتورها</h3><p>آمار پاسخ‌گویی انسانی بر اساس گفتگوهای ثبت‌شده هر ویجت</p></div></div><div class="ww-table-wrap"><table class="ww-table"><thead><tr><th>اپراتور</th><th>ویجت</th><th>گفتگوی واگذارشده</th><th>پاسخ‌ها</th><th>بسته‌شده</th><th>باز</th><th>میانگین زمان پاسخ</th><th>وضعیت</th></tr></thead><tbody>${data.operators.length ? data.operators.map(op => `<tr><td><strong>${esc(op.displayName)}</strong><br><small class="text-muted ltr">${esc(op.username)}</small></td><td>${esc(op.widgetName)}</td><td>${fa(op.assigned)}</td><td>${fa(op.replies)}</td><td>${fa(op.resolved)}</td><td>${fa(op.pending)}</td><td>${formatDuration(op.avgResponseMinutes)}</td><td><span class="badge ${op.active ? "text-bg-success" : "text-bg-secondary"}">${op.active ? "فعال" : "غیرفعال"}</span></td></tr>`).join("") : `<tr><td colspan="8" class="text-center text-muted py-4">اپراتوری ثبت نشده است.</td></tr>`}</tbody></table></div></section>`;
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

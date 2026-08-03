(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const input = $("inpFile"), drop = $("dropZone"), generate = $("generate"), preview = $("preview");
  let selectedFile = null, items = [], running = false, inspectedPageCount = 0;

  const escapeHTML = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const markdown = () => items.map((item, i) => `## ${i + 1}. ${item.question}\n\n${item.answer}${item.section ? `\n\n*بخش: ${item.section}*` : ""}`).join("\n\n");
  const output = format => format === "json" ? JSON.stringify(items, null, 2) : markdown();

  function setBusy(active, label = "در حال خواندن و تبدیل فایل…") {
    $("busyLabel").textContent = label;
    $("busyOverlay").classList.toggle("d-none", !active);
    document.body.style.overflow = active ? "hidden" : "";
  }

  function setProgressIndeterminate(active) {
    $("progressWrap").classList.remove("d-none");
    $("progressWrap").querySelector(".progress").classList.toggle("faq-progress-indeterminate", active);
  }

  async function choose(file) {
    selectedFile = file || null;
    inspectedPageCount = 0;

    $("fileName").textContent = file ? `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB` : "";
    generate.disabled = true;
    if (!file) return;
    setBusy(true); setProgressIndeterminate(true); $("progressLabel").textContent = "خواندن و تبدیل فایل"; $("progressCount").textContent = "";
    try {
      const form = new FormData(); form.append("file", file);
      const response = await auth.apiFetch("/api/faq/inspect", { method: "POST", body: form });
      if (!response.ok) throw response;
      const meta = await response.json();
      inspectedPageCount = Math.max(1, Number(meta.pageCount) || 1);
      $("from").max = inspectedPageCount; $("to").max = inspectedPageCount; $("from").value = 1; $("to").value = inspectedPageCount;
      $("rangeHint").textContent = `این سند ${inspectedPageCount} صفحه/بخش دارد.`;
      generate.disabled = false;
    } catch (error) {
      selectedFile = null; input.value = ""; $("fileName").textContent = "خواندن فایل با خطا مواجه شد.";
      if (typeof showError === "function") showError("خواندن و تبدیل فایل با خطا مواجه شد.");
    } finally { setProgressIndeterminate(false); $("progressWrap").classList.add("d-none"); setBusy(false); }
  }
  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) input.click(); });
  input.addEventListener("change", () => choose(input.files[0]));
  ["dragenter", "dragover"].forEach(name => drop.addEventListener(name, e => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach(name => drop.addEventListener(name, e => { e.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", e => choose(e.dataTransfer.files[0]));

  $("scope").addEventListener("change", () => {
    const value = $("scope").value;
    $("advanced").classList.toggle("d-none", value === "all");
    $("rangeFields").classList.toggle("d-none", value !== "range");
    $("focusFields").classList.toggle("d-none", value !== "focus");
  });

  function render() {
    if (!items.length) return;
    preview.innerHTML = items.map((item, i) => `<article class="faq-item"><button class="faq-question" type="button" data-faq="${i}" aria-expanded="false"><span><span class="fa-num">${i + 1}.</span> ${escapeHTML(item.question)}</span><i class="fa-solid fa-chevron-down"></i></button><div class="faq-answer d-none">${escapeHTML(item.answer)}${item.section ? `<div class="faq-section"><i class="fa-regular fa-bookmark ms-1"></i>${escapeHTML(item.section)}</div>` : ""}</div></article>`).join("");
    $("copy").classList.remove("d-none"); $("downloadMenu").classList.remove("d-none"); $("moreWrap").classList.remove("d-none");
    $("generateMore").disabled = running || items.length >= 100;
    $("faqLimit").textContent = items.length >= 100 ? "به سقف ۱۰۰ FAQ رسیده‌اید." : `${items.length} FAQ ساخته شده است.`;
  }
  preview.addEventListener("click", e => { const button = e.target.closest("[data-faq]"); if (!button) return; const answer = button.nextElementSibling; const expanded = answer.classList.toggle("d-none") === false; button.setAttribute("aria-expanded", String(expanded)); button.querySelector("i").classList.toggle("fa-chevron-up", expanded); button.querySelector("i").classList.toggle("fa-chevron-down", !expanded); });

  function progress(produced, total, text) {
    $("progressWrap").classList.remove("d-none");
    const pct = total ? Math.round(produced * 100 / total) : 0;
    $("progressBar").style.width = `${pct}%`; $("progressLabel").textContent = text; $("progressCount").textContent = `${produced} از ${total}`;
  }

  function parseSSE(buffer, onEvent) {
    const blocks = buffer.split("\n\n"), rest = blocks.pop();
    blocks.forEach(block => { let event = "message", data = ""; block.split("\n").forEach(line => { if (line.startsWith("event:")) event = line.slice(6).trim(); if (line.startsWith("data:")) data += line.slice(5).trim(); }); if (data) onEvent(event, JSON.parse(data)); });
    return rest;
  }

  async function generateBatch(append) {
     if (!selectedFile || !inspectedPageCount || running) return;
    const count = Math.min(10, 100 - (append ? items.length : 0));
    if (count <= 0) return;
    const form = new FormData();
    form.append("file", selectedFile); form.append("count", count); form.append("answer_words", $("answerLength").value); form.append("tone", $("tone").value); form.append("language", $("language").value); form.append("scope", $("scope").value); form.append("from", $("from").value); form.append("to", $("to").value); form.append("focus", $("focus").value); form.append("prior_questions", JSON.stringify(append ? items.map(item => item.question) : []));
    running = true; if (!append) { items = []; preview.innerHTML = `<div class="faq-empty"><span class="spinner-border text-primary mb-3"></span><div>در حال خواندن کامل فایل…</div></div>`; }
    generate.disabled = true; $("generateMore").disabled = true; $("progressBar").classList.add("progress-bar-animated"); setProgressIndeterminate(true); progress(0, count, "خواندن و تبدیل فایل");
    if (append) setBusy(true, "در حال ساخت ۱۰ FAQ بعدی…");
    try {
      const response = await auth.apiFetch("/api/faq", { method: "POST", body: form });
      if (!response.ok) throw response;
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "";
      const event = (name, data) => {
        if (name === "meta") { if (!append) setProgressIndeterminate(false); progress(0, data.count, "تولید بسته ۱"); }
        if (name === "batch") { items.push(...data.items); render(); progress(data.produced, count, data.produced >= count ? "تکمیل شد" : `تولید بسته ${data.index + 1}`); }
        if (name === "error") throw new Error(data.message);
      };
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer = parseSSE(buffer + decoder.decode(value, { stream: true }), event); }
      if (!items.length) throw new Error("FAQ معتبری دریافت نشد");
    } catch (error) {
      const message = error instanceof Response ? await error.text() : error.message;
      if (!append) preview.innerHTML = `<div class="alert alert-danger">${escapeHTML(message || "خطا در ساخت FAQ")}</div>`;
      if (typeof showError === "function") showError(message || "ساخت FAQ با خطا مواجه شد.");
    } finally { running = false; generate.disabled = !selectedFile; $("generateMore").disabled = items.length >= 100; $("progressBar").classList.remove("progress-bar-animated"); setProgressIndeterminate(false); setBusy(false); }
  }

  generate.addEventListener("click", () => generateBatch(false));
  $("generateMore").addEventListener("click", () => generateBatch(true));

  $("copy").addEventListener("click", async () => { await navigator.clipboard.writeText(markdown()); if (typeof toast === "function") toast("خروجی کپی شد", "success"); });
  $("downloadMenu").addEventListener("click", event => { const button = event.target.closest("[data-download-format]"); if (!button) return; const format = button.dataset.downloadFormat; const ext = format === "json" ? "json" : "md"; const blob = new Blob([output(format)], { type: ext === "json" ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `faq.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
})();

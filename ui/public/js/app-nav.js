(function () {
  "use strict";

  const escapeHTML = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function decodeToken(token) {
    try {
      const payload = token.split(".")[1];
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function loginBack(slot) {
    const explicit = slot.dataset.loginBack;
    if (explicit) return explicit;
    const path = location.pathname.replace(/^\//, "") || "/";
    return path + location.search + location.hash;
  }

  function serviceName(slot) {
    return slot.dataset.service || document.body.dataset.service || window.page?.serviceName || "/";
  }

  function loginUrl(slot) {
    const params = new URLSearchParams({ back: loginBack(slot) });
    const service = serviceName(slot);
    if (service && service !== "/") params.set("service", service);
    return `/login?${params.toString()}`;
  }

  function avatarHTML(profile, compact) {
    const avatar = String(profile?.avatar || "");
    const sizeClass = compact ? "app-account-avatar compact" : "app-account-avatar";
    if (/^(?:data:image\/(?:png|jpe?g|webp|gif);base64,|https:\/\/)/i.test(avatar)) {
      return `<span class="${sizeClass}"><img src="${escapeHTML(avatar)}" alt="تصویر پروفایل"></span>`;
    }
    return `<span class="${sizeClass}"><i class="fa-solid fa-user"></i></span>`;
  }

  function profileFallback(token) {
    const info = decodeToken(token) || {};
    return {
      name: info.name || info.username || "کاربر سامانه",
      username: info.username || "",
      avatar: info.avatar || ""
    };
  }

  async function fetchProfile(token) {
    if (!token) return null;
    try {
      const response = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.profile || null;
    } catch {
      return null;
    }
  }

  function renderServices() {
    document.querySelectorAll("[data-app-services]").forEach(slot => {
      const compact = slot.hasAttribute("data-compact");
      slot.innerHTML = `<a href="/" class="btn btn-sm btn-outline-secondary app-services-button" title="سایر خدمات">
        <i class="fa-solid fa-boxes-stacked"></i>${compact ? "" : "<span>سایر خدمات</span>"}
      </a>`;
    });
  }

  async function renderAccounts() {
    const token = localStorage.getItem("accessToken") || "";
    let profile = token ? profileFallback(token) : null;
    const remote = token ? await fetchProfile(token) : null;
    if (remote) profile = { ...profile, ...remote };

    document.querySelectorAll("[data-app-account]").forEach(slot => {
      const compact = slot.hasAttribute("data-compact");
      if (!token) {
        slot.innerHTML = `<a href="${escapeHTML(loginUrl(slot))}" class="btn btn-sm btn-outline-primary app-login-button">
          <i class="fa-solid fa-user"></i>${compact ? "" : "<span>ورود به سامانه</span>"}
        </a>`;
        return;
      }
      const display = profile?.name || profile?.username || "حساب کاربری";
      slot.innerHTML = `<div class="dropdown app-account-dropdown">
        <button class="btn btn-sm btn-outline-secondary app-account-button dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="حساب کاربری">
          ${avatarHTML(profile, compact)}${compact ? "" : `<span class="app-account-name">${escapeHTML(display)}</span>`}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li class="app-account-summary">
            ${avatarHTML(profile, false)}
            <span><strong>${escapeHTML(display)}</strong>${profile?.username ? `<small dir="ltr">@${escapeHTML(profile.username)}</small>` : ""}</span>
          </li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="/profile"><i class="fa-solid fa-address-card ms-2"></i>پروفایل</a></li>
          <li><button class="dropdown-item text-danger" type="button" data-app-logout><i class="fa-solid fa-arrow-right-from-bracket ms-2"></i>خروج</button></li>
        </ul>
      </div>`;
    });
  }

  async function logout() {
    let confirmed = true;
    if (typeof window.confirmDialog === "function") {
      const result = await window.confirmDialog({
        title: "خروج از حساب",
        message: "آیا می‌خواهید از حساب خود خارج شوید؟",
        confirmText: "بله، خارج شو",
        confirmClass: "btn-outline-danger"
      });
      confirmed = Boolean(result.confirmed);
    } else {
      confirmed = window.confirm("آیا می‌خواهید از حساب خود خارج شوید؟");
    }
    if (!confirmed) return;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { /* local logout still applies */ }
    localStorage.removeItem("accessToken");
    window.dispatchEvent(new CustomEvent("app-auth-changed", { detail: { authenticated: false } }));
    location.href = "/";
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-app-logout]")) logout();
  });

  async function render() {
    renderServices();
    await renderAccounts();
  }

  window.addEventListener("app-auth-changed", render);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
  window.AppNav = { render };
})();

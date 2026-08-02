async function setupAuth(service, required) {
  let accessToken = localStorage.getItem("accessToken");
  const notifyAuthChanged = () => window.dispatchEvent(new CustomEvent("app-auth-changed", {
    detail: { authenticated: Boolean(accessToken), service }
  }));
  const DEFAULT_PRIV = { uid: 1, name: "anonymous" }
  const auth = {
    setToken: (token) => {
      accessToken = token;
      localStorage.setItem("accessToken", token);
      notifyAuthChanged();
    },
    getToken: () => accessToken,
    getUser: () => {
      if (!accessToken) return null;
      return parseJwt(accessToken);
    },
    logout: () => {
      accessToken = null;
      localStorage.removeItem("accessToken");
      notifyAuthChanged();
    },
  };

  function parseJwt(token) {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  }

  function isExpired(token) {
    const { exp } = parseJwt(token);
    return Date.now() >= exp * 1000;
  }

  let isRefreshing = false;
  let refreshSubscribers = [];
  async function _refreshToken() {
    try {
      const res = await fetch('/api/auth/refresh?service=' + service, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json()
      if (!res.ok || data.error) return false;

      auth.setToken(data.accessToken);
      refreshSubscribers.forEach((cb) => cb(data.accessToken));
      return true;
    } finally {
      refreshSubscribers = [];
      isRefreshing = false;
    }
  }

  async function refreshToken() {
    if (isRefreshing)
      return new Promise((resolve) => { refreshSubscribers.push(resolve); });

    isRefreshing = true;
    return _refreshToken();
  }

  async function logout(backTo) {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    auth.logout()
    window.location.href = backTo || "/"
  }

  async function apiFetch(url, options = {}) {
    document.getElementById("loading")?.classList.remove("hidden")

    let token = auth.getToken();

    if (token && isExpired(token)) {
      await refreshToken();
      token = auth.getToken();
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : ""
      },
      credentials: 'include'
    });

    if (res.status === 401) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        auth.logout();
        showError('نشست منقضی شده است');
        window.location.href = `/login?back=${service}`;
        document.getElementById("loading")?.classList.add("hidden")
        return null;
      }

      // retry once
      document.getElementById("loading")?.classList.add("hidden")
      return apiFetch(url, options);
    }

    const isBlob = res.headers.get("Content-Type")?.includes("application/octet-stream") ||
      res.headers.get("Content-Type")?.includes("image/") ||
      res.headers.get("Content-Type")?.includes("video/") ||
      res.headers.get("Content-Type")?.includes("audio/");

      document.getElementById("loading")?.classList.add("hidden")
    return res
  }

  async function ensureAuth() {
    try {
      const token = auth.getToken();

      if (!token && required) {
        showError('نشست منقضی شده است');
        window.location.href = `/login?back=${service}`;
        return null;
      }

      return auth.getUser();
    } finally {
      document.getElementById("loading")?.classList.add("hidden")
      setClass(document.getElementById('btnLogin'), 'hidden', auth.getToken())
      setClass(document.getElementById('btnLogin2'), 'hidden', auth.getToken())
      setClass(document.getElementById('backToLogin'), 'hidden', !auth.getToken())
      notifyAuthChanged();
    }
  }

  async function withAuth(fn, options) {
    try {
      return await fn(options);
    } catch (e) {
      if (e.code === 401) {
        await refreshToken();
        return fn(options);
      }
      throw e;
    }
  }

  await ensureAuth()

  return {
    apiFetch,
    withAuth,
    setAccessToken: (token) => auth.setToken(token),
    token: () => auth.getToken(),
    info: () => auth.getUser(),
    logout
  }
}

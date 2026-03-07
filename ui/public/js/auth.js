async function setupAuth(service, required) {
  let accessToken = localStorage.getItem("accessToken");
  const DEFAULT_PRIV = { uid: 1, name: "anonymous" }
  const auth = {
    setToken: (token) => {
      accessToken = token;
      localStorage.setItem("accessToken", token);
    },
    getToken: () => accessToken,
    getUser: () => {
      if (!accessToken) return null;
      return parseJwt(accessToken);
    },
    logout: () => {
      accessToken = null;
      localStorage.removeItem("accessToken");
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

      if (!res.ok) return false;

      const data = await res.json();
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
    const token = auth.getToken();

    if (token && isExpired(token))
      await refreshToken();

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
        return null;
      }

      // retry once
      return apiFetch(url, options);
    }

    return res;
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

/* Public, non-sensitive theme hint applied before styles load. */
if (document.documentElement.dataset.themePreference === 'system') {
  document.documentElement.setAttribute('data-bs-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

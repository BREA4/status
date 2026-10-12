// Apply an explicit choice before styles and page content can paint.
try {
  const theme =
    document.documentElement.dataset.themeSelector === 'enabled'
      ? localStorage.getItem('breach-theme')
      : 'light';
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="color-scheme"]').content = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = theme === 'dark' ? '#101613' : '#f8f9f5';
    });
  }
} catch {
  // Device preferences still work when browser storage is unavailable.
}

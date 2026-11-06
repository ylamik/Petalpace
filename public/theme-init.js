var lightOnly = typeof location !== 'undefined' && ['/', '/sign-in', '/sign-up', '/verify-email', '/forgot-password', '/reset-password'].indexOf(location.pathname) >= 0;
try {
  const preference = localStorage.getItem('petalpace-theme');
  document.documentElement.dataset.theme = lightOnly ? 'light' : preference === 'dark' || preference === 'light' ? preference : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch { document.documentElement.dataset.theme = lightOnly ? 'light' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }

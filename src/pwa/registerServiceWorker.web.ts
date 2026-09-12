function addLink(rel: string, href: string) {
  if (document.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

addLink('manifest', '/manifest.json');
addLink('apple-touch-icon', '/icon-source.png');

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

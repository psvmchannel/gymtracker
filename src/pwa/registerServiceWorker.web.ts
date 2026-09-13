function addLink(rel: string, href: string) {
  if (document.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

const BASE_PATH = '/gymtracker';

addLink('manifest', `${BASE_PATH}/manifest.json`);
addLink('apple-touch-icon', `${BASE_PATH}/icon-source.png`);

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${BASE_PATH}/sw.js`);
  });
}

function addLink(rel: string, href: string) {
  if (document.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

export function withSafeAreaViewport(content: string): string {
  return content.includes('viewport-fit=')
    ? content
    : `${content}, viewport-fit=cover`;
}

function enableSafeAreaInsets() {
  const viewport = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  if (!viewport) return;
  viewport.content = withSafeAreaViewport(viewport.content);
}

const BASE_PATH = '/gymtracker';

if (typeof document !== 'undefined') {
  enableSafeAreaInsets();
  addLink('manifest', `${BASE_PATH}/manifest.json`);
  addLink('apple-touch-icon', `${BASE_PATH}/icon-source.png`);
}

if (
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production'
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${BASE_PATH}/sw.js`);
  });
}

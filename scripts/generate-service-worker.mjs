import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const outputDirectory = join(process.cwd(), 'dist');

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.name !== 'sw.js') files.push(path);
  }
  return files;
}

const files = await collectFiles(outputDirectory);
const urls = files.map(
  (file) => `/${relative(outputDirectory, file).split(sep).join('/')}`,
);
const hash = createHash('sha256')
  .update(
    await Promise.all(files.map((file) => readFile(file))).then((buffers) =>
      Buffer.concat(buffers),
    ),
  )
  .digest('hex')
  .slice(0, 16);
const serviceWorker = `const CACHE = 'gymtracker-${hash}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('gymtracker-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : fetch(event.request))));
});
`;
await writeFile(join(outputDirectory, 'sw.js'), serviceWorker);
console.log(`Generated ${CACHE_NAME(hash)} with ${urls.length} assets.`);

function CACHE_NAME(value) {
  return `gymtracker-${value}`;
}

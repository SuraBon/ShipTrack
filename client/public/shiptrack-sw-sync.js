/* eslint-disable no-restricted-globals */
/** Workbox importScripts companion — nudges open clients to run offline/route sync. */
self.addEventListener('sync', event => {
  if (!event || event.tag !== 'shiptrack-offline-sync') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SHIPTRACK_RUN_SYNC' });
      });
    }),
  );
});

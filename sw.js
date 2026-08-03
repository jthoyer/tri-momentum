// This app no longer ships a service worker. The previous version registered
// one with a permanent cache-first strategy, which froze index.html for
// anyone who'd already visited — this file's only job now is to retire that
// registration. Kept at the same URL (rather than deleted) so browsers that
// already control a client can still fetch it, detect the byte change, and
// self-destruct: on activate it unregisters itself and force-reloads any
// open tabs, which then load straight from the network with no SW involved.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(event){
  event.waitUntil(
    self.registration.unregister()
      .then(function(){ return self.clients.matchAll(); })
      .then(function(clients){
        clients.forEach(function(client){ client.navigate(client.url); });
      })
  );
});

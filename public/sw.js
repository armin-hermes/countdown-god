/* Study timer offline cache */
var CACHE = "study-timer-v10";
var CORE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./fonts/rokh-400.woff2", "./fonts/rokh-500.woff2",
  "./fonts/rokh-700.woff2", "./fonts/rokh-800.woff2",
  "./fonts/rokh-900.woff2", "./icons/icon-192.png", "./icons/icon-512.png",
  "./sounds/school_bell.mp3", "./sounds/digital_alarm.mp3",
  "./sounds/copper_bell.mp3", "./sounds/tibetan_bowl.mp3",
  "./sounds/piano.mp3", "./sounds/marimba.mp3",
  "./sounds/electronic_chime.mp3", "./sounds/music_box.mp3",
  "./sounds/reception_bell.mp3", "./sounds/analog_alarm.mp3",
  "./sounds/positive.mp3", "./sounds/break_chime.mp3"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // navigations: network-first so updates reach users; fallback to cache offline
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match("./index.html"); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match("./index.html"); });
  }));
});

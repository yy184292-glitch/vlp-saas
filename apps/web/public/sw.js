// Service Worker for VLP SaaS PWA
const CACHE_NAME = "vlp-cache-v1";

// 事前キャッシュする静的URL
const STATIC_URLS = [
  "/",
  "/dashboard",
  "/cars",
  "/work-orders",
  "/customers",
];

// install: 静的アセットを事前キャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// activate: 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch: Network First 戦略
// API リクエストはネットワーク優先、失敗時はキャッシュから返す
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 別オリジン・chrome-extension等はスキップ
  if (url.origin !== location.origin) return;

  // POST/PUT/DELETE は常にネットワーク（キャッシュしない）
  if (request.method !== "GET") return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // 成功したレスポンスをキャッシュに保存（200のみ）
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // ネットワーク失敗 → キャッシュから返す
    const cached = await caches.match(request);
    if (cached) return cached;

    // キャッシュにもない場合はオフラインページ（ルートのキャッシュ）
    const fallback = await caches.match("/");
    return fallback ?? new Response("オフラインです。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

// push: プッシュ通知を受信して表示
self.addEventListener("push", (event) => {
  let data = { title: "VLP System", body: "新しい通知があります。", icon: "/icons/icon-192x192.png" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag ?? "vlp-notification",
      data: { url: data.url ?? "/" },
    })
  );
});

// notificationclick: 通知クリック時にページを開く
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 既存タブがあればそこを開く
      for (const client of clientList) {
        if (client.url.includes(location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // なければ新しいタブを開く
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered:", registration.scope);

        // すでに待機中の SW がある場合
        if (registration.waiting) {
          setWaitingSW(registration.waiting);
          setUpdateAvailable(true);
        }

        // 新しい SW が待機状態になった場合
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingSW(newWorker);
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });

    // SW が制御を引き継いだらページをリロード
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  function handleUpdate() {
    if (!waitingSW) return;
    waitingSW.postMessage({ type: "SKIP_WAITING" });
    setUpdateAvailable(false);
  }

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9998,
        background: "#2a2a2a",
        border: "1px solid #3b82f6",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        maxWidth: 320,
      }}
    >
      <RefreshCw size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0", marginBottom: 6 }}>
          新しいバージョンがあります
        </div>
        <button
          onClick={handleUpdate}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          今すぐ更新
        </button>
      </div>
      <button
        onClick={() => setUpdateAvailable(false)}
        style={{
          padding: 4,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "#666",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
        aria-label="閉じる"
      >
        <X size={14} />
      </button>
    </div>
  );
}

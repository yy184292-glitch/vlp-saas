"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const STORAGE_KEY = "vlp-pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    // すでにインストール済み or 非表示にした場合は表示しない
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    if (isIOS()) {
      setIosMode(true);
      setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    void deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      setShowBanner(false);
      setDeferredPrompt(null);
    });
  }

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "env(safe-area-inset-bottom, 0px)",
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "12px 16px",
        background: "#2a2a2a",
        borderTop: "1px solid #3a3a3a",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <img src="/icons/icon-72x72.png" alt="VLP" width={40} height={40} style={{ borderRadius: 8, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#e0e0e0", marginBottom: 4 }}>
          VLP をホーム画面に追加
        </div>

        {iosMode ? (
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Share size={12} color="#60a5fa" /> 共有ボタン
            </span>
            {" → "}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <PlusSquare size={12} color="#60a5fa" /> 「ホーム画面に追加」
            </span>
            {" をタップしてください。"}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#aaa" }}>
            オフラインでも使えるアプリとしてインストールできます。
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {!iosMode && (
          <button
            onClick={handleInstall}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={13} />
            インストール
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            padding: 6,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "#666",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

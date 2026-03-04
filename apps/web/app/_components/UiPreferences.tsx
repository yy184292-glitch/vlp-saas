"use client";

import { useEffect } from "react";

/**
 * UI設定（軽量版）
 * - 背景ライトグレーON/OFF を localStorage に保存
 * - <html> に class を付け替える
 *
 * NOTE:
 * - next-themes 等の追加依存は使わない
 */
const STORAGE_KEY = "vlp.ui.bgGray";
const CLASS_NAME = "vlp-bg-gray";

export function getBgGrayFromStorage(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true; // デフォルト: ON
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function setBgGrayToStorage(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    // ignore
  }
}

export function applyBgGrayClass(v: boolean): void {
  try {
    const el = document.documentElement;
    if (v) el.classList.add(CLASS_NAME);
    else el.classList.remove(CLASS_NAME);
  } catch {
    // ignore
  }
}

export default function UiPreferences() {
  useEffect(() => {
    const v = getBgGrayFromStorage();
    applyBgGrayClass(v);
  }, []);

  return null;
}

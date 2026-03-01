"use client";

import * as React from "react";

export type ContainerSize = "narrow" | "wide" | "full";

type Props = {
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
};

/**
 * SaaS全体の基準幅コンテナ
 *
 * narrow:
 *   基本画面（車両一覧・見積・指示書・マスタ）
 *   → 画面の約90%（左右5%ずつ余白）
 *
 * wide:
 *   レポート・ダッシュボードなど
 *   → 画面の約96%
 *
 * full:
 *   フル幅（例外用）
 */
export function Container({ size = "narrow", className = "", children }: Props) {
  let widthClass = "";

  switch (size) {
    case "full":
      widthClass = "w-full max-w-none";
      break;

    case "wide":
      widthClass = "w-[96%] max-w-[1800px]";
      break;

    case "narrow":
    default:
      widthClass = "w-[90%] max-w-[1400px]";
      break;
  }

  return (
    <div className={`mx-auto ${widthClass} ${className}`}>
      {children}
    </div>
  );
}
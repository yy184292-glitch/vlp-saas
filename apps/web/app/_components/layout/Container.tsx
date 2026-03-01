"use client";

import * as React from "react";

export type ContainerSize = "narrow" | "wide" | "full";

type Props = {
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
};

/**
 * 画面幅の統一用コンテナ。
 * - narrow: 車両一覧・マスタ・見積など（左右に余白を残す）
 * - wide: レポートなど（少し広め）
 * - full: 例外的に全面を使いたい場合
 */
export function Container({ size = "narrow", className = "", children }: Props) {
  const maxW =
    size === "wide" ? "max-w-7xl" : size === "full" ? "max-w-none" : "max-w-6xl";

  return <div className={`mx-auto w-full ${maxW} ${className}`}>{children}</div>;
}
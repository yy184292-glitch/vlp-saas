"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { Car } from "@/lib/api";
import {
  carTitle,
  formatText,
  statusTone,
  cardBorderClass,
  statusBadgeStyle,
  type CarThumbResolver,
  defaultThumbResolver,
} from "./carPresenters";

export function CarCard({
  car,
  onClick,
  resolveThumb = defaultThumbResolver,
  rightTopSlot,
}: {
  car: Car;
  onClick: () => void;
  resolveThumb?: CarThumbResolver;
  /** 将来：…メニュー、タグ、バッジ等を置ける */
  rightTopSlot?: React.ReactNode;
}) {
  const title = carTitle(car);
  const status = formatText(car.status);
  const carNumber = formatText(car.carNumber);
  const thumbUrl = resolveThumb(car);

  const tone = statusTone(car.status);
  const borderClass = cardBorderClass(tone);
  const badgeStyle = statusBadgeStyle(tone);

  return (
    <Card
      className={`shadow-sm hover:bg-muted/30 cursor-pointer overflow-hidden ${borderClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-semibold truncate">{title}</div>
                  {car.status && (
                    <span
                      style={{
                        ...badgeStyle,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {status}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  登録番号：<span className="font-medium text-foreground">{carNumber}</span>
                </div>

                <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  stock：{formatText(car.stockNo)} / vin：{formatText(car.vin)}
                </div>
              </div>

              {/* 将来の拡張ポイント（カード右上） */}
              {rightTopSlot ? <div className="shrink-0">{rightTopSlot}</div> : null}
            </div>
          </div>

          <div className="shrink-0">
            <div className="relative h-[72px] w-[96px] overflow-hidden rounded-md border bg-muted">
              {thumbUrl ? (
                <Image src={thumbUrl} alt={title} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">NO IMAGE</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

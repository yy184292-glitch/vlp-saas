// app/cars/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { Car, ApiError } from "@/lib/api";
import { listCars } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { toCarCardVM, toneClass, type CarCardVM } from "../_components/cars/cars-ui";

type SortKey = "updated_desc" | "updated_asc";

function toMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function contains(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function carLabel(c: Car): string {
  const parts = [
    c.stockNo ?? "",
    c.make ?? "",
    c.maker ?? "",
    c.model ?? "",
    c.grade ?? "",
    c.carNumber ?? "",
    c.vin ?? "",
    c.modelCode ?? "",
  ];
  return parts.join(" ").trim();
}

function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && (e as any).name === "ApiError") return (e as ApiError).message;
  if (e instanceof Error) return e.message;
  return "Error";
}

export default function CarsListPage() {
  const router = useRouter();

  const [allCars, setAllCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("updated_desc");

  const loadAllCars = React.useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const LIMIT = 100;
      const MAX_TOTAL = 500;

      let offset = 0;
      let items: Car[] = [];
      let total = 0;

      while (true) {
        const res = await listCars({ limit: LIMIT, offset });
        total = res.meta.total ?? total;
        items = items.concat(res.items);
        offset += LIMIT;

        if (items.length >= total) break;
        if (items.length >= MAX_TOTAL) break;
      }

      setAllCars(items);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAllCars();
  }, [loadAllCars]);

  const filteredSorted = React.useMemo(() => {
    const q = query.trim();
    let list = allCars;

    if (q) list = list.filter((c) => contains(carLabel(c), q));

    return [...list].sort((a, b) => {
      switch (sort) {
        case "updated_desc":
          return toMs(b.updatedAt) - toMs(a.updatedAt);
        case "updated_asc":
          return toMs(a.updatedAt) - toMs(b.updatedAt);
        default:
          return 0;
      }
    });
  }, [allCars, query, sort]);

  const vms = React.useMemo(() => filteredSorted.map(toCarCardVM), [filteredSorted]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">車両一覧</div>
          <div className="text-sm text-muted-foreground">
            {vms.length} 件（取得済 {allCars.length}）
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAllCars} disabled={loading}>
            {loading ? "更新中…" : "更新"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">検索</CardTitle>
          <CardDescription>車種 / 登録番号 / stock / vin など</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索: 車種 / 登録番号 / stock / vin..."
            className="md:col-span-2"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
          >
            <option value="updated_desc">更新日（新しい順）</option>
            <option value="updated_asc">更新日（古い順）</option>
          </select>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Grid: 2列/3列 */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {vms.map((vm) => (
          <CarCard
            key={vm.id}
            vm={vm}
            onClick={() => router.push(vm.href)}
          />
        ))}

        {!loading && vms.length === 0 ? (
          <div className="text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            データがありません
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CarCard(props: { vm: CarCardVM; onClick: () => void }) {
  const { vm } = props;

  return (
    <Card
      className="shadow-sm hover:bg-muted/30 cursor-pointer"
      onClick={props.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <CardContent className="p-4">
        {/* 1set: 左テキスト / 右サムネ */}
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {/* 1行目: 車種 + 状態(色文字) */}
            <div className="flex items-baseline gap-2">
              <div className="font-semibold truncate">{vm.title}</div>
              <div className={`text-xs font-medium ${toneClass(vm.statusTone)} whitespace-nowrap`}>
                {vm.statusText}
              </div>
            </div>

            {/* 2行目: 登録番号 */}
            <div className="mt-1 text-sm text-muted-foreground">
              登録番号：<span className="font-medium text-foreground">{vm.regNoText}</span>
            </div>

            {/* 補助情報 */}
            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{vm.metaLine}</div>
          </div>

          {/* 右: サムネ */}
          <div className="shrink-0">
            <div className="relative h-[72px] w-[96px] overflow-hidden rounded-md border bg-muted">
              {vm.thumbUrl ? (
                <Image
                  src={vm.thumbUrl}
                  alt={vm.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">
                  NO IMAGE
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

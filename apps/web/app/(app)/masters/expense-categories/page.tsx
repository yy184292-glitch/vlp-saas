"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Tag } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── 型 ──────────────────────────────────────────────────────

type CategoryOut = {
  id: string;
  store_id: string;
  name: string;
  is_system: boolean;
  usage_count: number;
};

// ─── ユーティリティ ──────────────────────────────────────────

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "エラーが発生しました";
}

// ─── メインページ ────────────────────────────────────────────

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = React.useState<CategoryOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  // カスタムカテゴリのローカル並び順（フロントのみ、DBには保存しない）
  const [customOrder, setCustomOrder] = React.useState<string[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CategoryOut[]>("/api/v1/master/expense-categories?limit=200");
      setCategories(data ?? []);
      // カスタムのみ順序管理
      const customIds = (data ?? [])
        .filter((c) => !c.is_system)
        .map((c) => c.id);
      setCustomOrder((prev) => {
        // 既存の順を維持しつつ、新しいIDを末尾に追加
        const kept = prev.filter((id) => customIds.includes(id));
        const added = customIds.filter((id) => !kept.includes(id));
        return [...kept, ...added];
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const systemCategories = React.useMemo(
    () => categories.filter((c) => c.is_system),
    [categories]
  );

  const customCategories = React.useMemo(() => {
    const map = new Map(categories.filter((c) => !c.is_system).map((c) => [c.id, c]));
    return customOrder.flatMap((id) => {
      const c = map.get(id);
      return c ? [c] : [];
    });
  }, [categories, customOrder]);

  const moveUp = (id: string) => {
    setCustomOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (id: string) => {
    setCustomOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch<CategoryOut>("/api/v1/master/expense-categories", {
        method: "POST",
        body: { name },
      });
      setNewName("");
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const deleteCategory = async (cat: CategoryOut) => {
    if (!window.confirm(`「${cat.name}」を削除しますか？`)) return;
    setError(null);
    try {
      await apiFetch<void>(`/api/v1/master/expense-categories/${cat.id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Tag className="h-5 w-5" />
        経費カテゴリ管理
      </div>
      <div className="text-sm text-muted-foreground">
        プリセット（システム）カテゴリは変更・削除できません。カスタムカテゴリの追加・削除が可能です。
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <>
          {/* プリセット（システム）カテゴリ */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-muted-foreground">
                プリセット（削除不可）
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {systemCategories.map((cat) => (
                  <span
                    key={cat.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#2a2a2a",
                      color: "#888",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    {cat.name}
                    {cat.usage_count > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "#666" }}>
                        {cat.usage_count}件
                      </span>
                    )}
                  </span>
                ))}
                {systemCategories.length === 0 && (
                  <div className="text-sm text-muted-foreground">なし</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* カスタムカテゴリ */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">カスタムカテゴリ</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {customCategories.length === 0 && (
                <div className="text-sm text-muted-foreground">カスタムカテゴリはまだありません。</div>
              )}
              {customCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "#2a2a2a",
                    border: "1px solid #3a3a3a",
                  }}
                >
                  {/* 上下ボタン */}
                  <button
                    type="button"
                    onClick={() => moveUp(cat.id)}
                    disabled={idx === 0}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: idx === 0 ? "default" : "pointer",
                      color: idx === 0 ? "#444" : "#aaa",
                      padding: 2,
                    }}
                    title="上へ"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(cat.id)}
                    disabled={idx === customCategories.length - 1}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: idx === customCategories.length - 1 ? "default" : "pointer",
                      color: idx === customCategories.length - 1 ? "#444" : "#aaa",
                      padding: 2,
                    }}
                    title="下へ"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* カテゴリ名 */}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>
                    {cat.name}
                  </span>

                  {/* 使用件数 */}
                  {cat.usage_count > 0 && (
                    <span style={{ fontSize: 11, color: "#666" }}>{cat.usage_count}件</span>
                  )}

                  {/* 削除ボタン */}
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#ef4444",
                      padding: 4,
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* 追加フォーム */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Input
                  placeholder="新しいカテゴリ名"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addCategory();
                  }}
                  className="flex-1"
                />
                <Button onClick={addCategory} disabled={adding || !newName.trim()}>
                  <Plus size={14} className="mr-1" />
                  追加
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

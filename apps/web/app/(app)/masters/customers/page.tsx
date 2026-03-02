"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Customer {
  id: number;
  customer_name: string;
  email: string;
  phone: string;
  notes: string;
  created_at?: string;
}

interface CustomerCreateForm {
  customer_name: string;
  email: string;
  phone: string;
  notes: string;
}

export default function CustomersPage(): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  const [createForm, setCreateForm] = useState<CustomerCreateForm>({
    customer_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

  // 顧客一覧取得
  async function fetchCustomers(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/api/v1/customers`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("顧客取得失敗");
      }

      const data: Customer[] = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  // フォームリセット
  function resetCreateForm(): void {
    setCreateForm({
      customer_name: "",
      email: "",
      phone: "",
      notes: "",
    });
  }

  // 顧客作成
  async function handleCreateCustomer(): Promise<void> {
    if (!createForm.customer_name.trim()) {
      alert("顧客名は必須です");
      return;
    }

    try {
      setCreateLoading(true);

      const res = await fetch(`${API_URL}/api/v1/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("顧客作成失敗");
      }

      await fetchCustomers();

      setCreateOpen(false);
      resetCreateForm();
    } catch (error) {
      console.error(error);
      alert("作成に失敗しました");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">

      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">顧客マスタ</h1>

        <Dialog
          open={createOpen}
          onOpenChange={(v: boolean) => {
            setCreateOpen(v);
            if (!v) resetCreateForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>顧客追加</Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>顧客追加</DialogTitle>
              <DialogDescription>
                新規顧客を登録します
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">

              <div>
                <Label>顧客名</Label>
                <Input
                  value={createForm.customer_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateForm({
                      ...createForm,
                      customer_name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>メール</Label>
                <Input
                  value={createForm.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateForm({
                      ...createForm,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>電話</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateForm({
                      ...createForm,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>備考</Label>
                <Textarea
                  value={createForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCreateForm({
                      ...createForm,
                      notes: e.target.value,
                    })
                  }
                />
              </div>

            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                キャンセル
              </Button>

              <Button
                onClick={handleCreateCustomer}
                disabled={createLoading}
              >
                {createLoading ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      </div>

      {/* 顧客一覧 */}
      <div className="border rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">顧客名</th>
              <th className="text-left p-2">メール</th>
              <th className="text-left p-2">電話</th>
              <th className="text-left p-2">備考</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c: Customer) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.customer_name}</td>
                <td className="p-2">{c.email}</td>
                <td className="p-2">{c.phone}</td>
                <td className="p-2">{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
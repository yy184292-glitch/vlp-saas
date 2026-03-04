"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import NewCarOcrContent from "./OcrContent";

export default function NewCarOcrPage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">車両 新規登録（車検証OCR）</h1>
        <Button variant="outline" onClick={() => router.push("/cars/new")}>
          手入力へ
        </Button>
      </div>

      <NewCarOcrContent
        onCreated={(carId) => router.push(`/cars/${carId}`)}
      />
    </div>
  );
}

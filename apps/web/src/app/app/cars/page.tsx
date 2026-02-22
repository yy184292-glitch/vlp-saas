import { CarsTable } from "@/components/cars/car-table";

export default function CarsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">車両一覧</h1>
          <p className="text-sm text-muted-foreground">検索・絞り込み・編集（ダイアログ）まで含むテンプレ</p>
        </div>
      </div>
      <CarsTable />
    </div>
  );
}

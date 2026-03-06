import Link from "next/link";
import { Calculator } from "lucide-react";

const TOOLS = [
  {
    href: "/tools/tax-calculator",
    icon: Calculator,
    title: "自賠責・重量税 計算機",
    description: "2024年度法定料金。車種・重量・初年度登録年月・エコカー区分から自賠責保険料と自動車重量税を計算します。",
  },
];

export default function ToolsPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold tracking-tight">ツール</div>
        <div className="text-sm text-muted-foreground">業務に役立つ計算・補助ツール</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex gap-3 rounded-md border bg-card p-4 hover:bg-muted/30 transition-colors"
          >
            <tool.icon className="h-6 w-6 mt-0.5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-semibold">{tool.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tool.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

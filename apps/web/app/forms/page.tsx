import Link from "next/link";

export default function Page() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>書類（原本印刷）</h1>
      <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
        原本PDFをA4で印刷できます。各ページは自動的に印刷ダイアログを開きます。
      </p>

      <ul style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <li><Link href="/forms/ininjou">委任状（原本）</Link></li>
        <li><Link href="/forms/jouto">譲渡証明書（原本）</Link></li>
      </ul>
    </main>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cars UI",
  description: "EXE-like business UI template",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}

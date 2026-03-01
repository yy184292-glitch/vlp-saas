import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "VLP SaaS",
  description: "VLP SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
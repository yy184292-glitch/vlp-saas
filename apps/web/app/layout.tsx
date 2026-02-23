import type { ReactNode } from "react";
import AppShell from "./_components/AppShell";

export const metadata = {
  title: "VLP SaaS",
  description: "VLP SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, color: "#111", background: "#fafafa" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

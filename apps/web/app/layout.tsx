import type { ReactNode } from "react";
import ClientNav from "./_components/ClientNav";

export const metadata = {
  title: "VLP SaaS",
  description: "VLP SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, color: "#111", background: "#fafafa" }}>
        <ClientNav />
        <div style={{ maxWidth: 960, margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  );
}

import type { ReactNode } from "react";
import "./globals.css";
import UiPreferences from "./_components/UiPreferences";

export const metadata = {
  title: "VLP system",
  description: "VLP system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <UiPreferences />
        {children}
      </body>
    </html>
  );
}

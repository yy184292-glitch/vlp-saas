// apps/web/app/(app)/layout.tsx

import AppShell from "../_components/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

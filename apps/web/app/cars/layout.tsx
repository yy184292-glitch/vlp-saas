import type { ReactNode } from "react";
import AppShell from "../_components/AppShell";

export default function CarsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell container="narrow" showRightPanel={false}>
      {children}
    </AppShell>
  );
}
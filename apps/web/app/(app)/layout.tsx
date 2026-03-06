import type { ReactNode } from "react";
import AppShell from "../_components/AppShell";
import ServiceWorkerRegistration from "../_components/ServiceWorkerRegistration";
import PwaInstallPrompt from "../_components/PwaInstallPrompt";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <PwaInstallPrompt />
      <AppShell>{children}</AppShell>
    </>
  );
}
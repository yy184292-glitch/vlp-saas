export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-w-0 flex-1 p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1400px]">{children}</div>
    </main>
  );
}

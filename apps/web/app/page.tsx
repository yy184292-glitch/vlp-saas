export default async function Home() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  let status = "API not configured";

  try {
    if (base) {
      const r = await fetch(`${base}/health`, { cache: "no-store" });
      status = r.ok ? "API OK" : `API NG (${r.status})`;
    }
  } catch {
    status = "API unreachable";
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>VLP SaaS</h1>
      <p><b>{status}</b></p>
      <p>API: {base || "(not set)"}</p>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Home</h1>
      <ul>
        <li>
          <Link href="/login">Login</Link>
        </li>
        <li>
          <Link href="/cars">Cars</Link>
        </li>
      </ul>
    </main>
  );
}

import { NextRequest } from "next/server";
import { proxyPostJson } from "../_proxy";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyPostJson("/admin/search", body);
}

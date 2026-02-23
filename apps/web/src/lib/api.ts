// apps/web/lib/api.ts
/**
 * Compatibility re-export.
 *
 * Your tsconfig.json currently maps "@/*" -> "./*" (project root),
 * while the implementation lives in "src/lib/api.ts".
 *
 * This shim keeps imports like `import { login } from "@/lib/api"` working.
 */
export * from "../src/lib/api";

import { access, constants, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadRoot } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | string> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    console.error("Health check: database", err);
    checks.database = "error";
  }

  try {
    const dir = uploadRoot();
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    checks.uploads = "ok";
  } catch (err) {
    console.error("Health check: uploads", err);
    checks.uploads = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { status: healthy ? "ok" : "error", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

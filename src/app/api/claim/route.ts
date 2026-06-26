import { NextResponse } from "next/server";
import { statusCodeForClaimResult } from "@/lib/api-errors";
import { ClaimService } from "@/lib/claim-service";
import { SqliteClaimsRepository } from "@/lib/claims-repository";
import { openDatabase } from "@/lib/db";
import { createSepoliaEvmAdapterFromEnv } from "@/lib/sepolia-evm-adapter";
import type { ClaimInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "rejected", reason: "invalid_request" }, { status: 400 });
  }

  const db = openDatabase();
  const claims = new SqliteClaimsRepository(db);
  const chain = createSepoliaEvmAdapterFromEnv();
  const service = new ClaimService(claims, chain);
  const result = await service.claim(body as ClaimInput);

  return NextResponse.json(result, { status: statusCodeForClaimResult(result) });
}

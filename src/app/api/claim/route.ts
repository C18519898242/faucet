import { NextResponse } from "next/server";
import { statusCodeForClaimResult } from "@/lib/api-errors";
import type { ChainAdapter } from "@/lib/chain-adapter";
import { ClaimService } from "@/lib/claim-service";
import { SqliteClaimsRepository } from "@/lib/claims-repository";
import { openDatabase } from "@/lib/db";
import { createSepoliaEvmAdapterFromEnv } from "@/lib/sepolia-evm-adapter";
import { createTronAdapterFromEnv } from "@/lib/tron-adapter";
import type { ClaimInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class LazyChainAdapter implements ChainAdapter {
  private adapter: ChainAdapter | undefined;

  constructor(private readonly factory: () => ChainAdapter) {}

  validateAddress(address: string): boolean {
    return this.getAdapter().validateAddress(address);
  }

  getTokenBalance(...args: Parameters<ChainAdapter["getTokenBalance"]>): ReturnType<ChainAdapter["getTokenBalance"]> {
    return this.getAdapter().getTokenBalance(...args);
  }

  transferToken(...args: Parameters<ChainAdapter["transferToken"]>): ReturnType<ChainAdapter["transferToken"]> {
    return this.getAdapter().transferToken(...args);
  }

  getExplorerTxUrl(txHash: string): string {
    return this.getAdapter().getExplorerTxUrl(txHash);
  }

  private getAdapter(): ChainAdapter {
    this.adapter ??= this.factory();
    return this.adapter;
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "rejected", reason: "invalid_request" }, { status: 400 });
  }

  const db = openDatabase();
  const claims = new SqliteClaimsRepository(db);
  const service = new ClaimService(claims, {
    sepolia: new LazyChainAdapter(createSepoliaEvmAdapterFromEnv),
    tron: new LazyChainAdapter(createTronAdapterFromEnv)
  });
  const result = await service.claim(body as Partial<ClaimInput>);

  return NextResponse.json(result, { status: statusCodeForClaimResult(result) });
}

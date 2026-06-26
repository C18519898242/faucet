import { describe, expect, it } from "vitest";
import { FakeChainAdapter, FakeClaimsRepository } from "@/test/fakes";
import { ClaimService } from "./claim-service";

const wallet = "0x000000000000000000000000000000000000dEaD";
const now = () => new Date("2026-06-26T12:00:00.000Z");

function createService() {
  const repo = new FakeClaimsRepository();
  const chain = new FakeChainAdapter();
  return { repo, chain, service: new ClaimService(repo, chain, now) };
}

describe("ClaimService", () => {
  it("sends a valid claim and stores tx hash", async () => {
    const ctx = createService();

    const result = await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({
      status: "sent",
      txHash: "0xtx",
      explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
    });
    expect(ctx.repo.records[0].status).toBe("sent");
  });

  it("rejects a second claim for the same wallet token date", async () => {
    const ctx = createService();
    await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    const result = await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "rejected", reason: "already_claimed_today" });
  });

  it("allows the same wallet to claim another token on the same date", async () => {
    const ctx = createService();
    await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    const result = await ctx.service.claim({ wallet, token: "USDC", amount: "10000" });

    expect(result.status).toBe("sent");
    expect(ctx.repo.records).toHaveLength(2);
  });

  it("rejects insufficient faucet balance", async () => {
    const ctx = createService();
    ctx.chain.balance = 1n;

    const result = await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "rejected", reason: "insufficient_faucet_balance" });
  });

  it("marks failed when transfer submission throws", async () => {
    const ctx = createService();
    ctx.chain.transferError = new Error("private key leaked in raw provider error");

    const result = await ctx.service.claim({ wallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "failed", reason: "transfer_failed" });
    expect(ctx.repo.records[0].status).toBe("failed");
    expect(ctx.repo.records[0].errorMessage).toBe("transfer_failed");
  });
});

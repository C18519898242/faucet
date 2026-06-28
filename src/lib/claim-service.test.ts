import { describe, expect, it } from "vitest";
import { FakeChainAdapter, FakeClaimsRepository } from "@/test/fakes";
import { ClaimService } from "./claim-service";

const evmWallet = "0x000000000000000000000000000000000000dEaD";
const tronWallet = "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu";
const now = () => new Date("2026-06-26T12:00:00.000Z");

function createService() {
  const repo = new FakeClaimsRepository();
  const sepolia = new FakeChainAdapter("sepolia", "0xtx", "https://sepolia.etherscan.io/tx/");
  const tron = new FakeChainAdapter("tron", "trontx", "https://shasta.tronscan.org/#/transaction/");
  return {
    repo,
    sepolia,
    tron,
    service: new ClaimService(repo, { sepolia, tron }, now)
  };
}

describe("ClaimService", () => {
  it("sends a valid Sepolia claim through the Sepolia adapter", async () => {
    const ctx = createService();

    const result = await ctx.service.claim({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({
      status: "sent",
      txHash: "0xtx",
      explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
    });
    expect(ctx.sepolia.transfers).toHaveLength(1);
    expect(ctx.tron.transfers).toHaveLength(0);
    expect(ctx.repo.records[0].network).toBe("sepolia");
  });

  it("sends a valid TRON claim through the TRON adapter", async () => {
    const ctx = createService();

    const result = await ctx.service.claim({ network: "tron", wallet: tronWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({
      status: "sent",
      txHash: "trontx",
      explorerUrl: "https://shasta.tronscan.org/#/transaction/trontx"
    });
    expect(ctx.sepolia.transfers).toHaveLength(0);
    expect(ctx.tron.transfers).toHaveLength(1);
    expect(ctx.repo.records[0].network).toBe("tron");
  });

  it("rejects a second claim for the same wallet network token date", async () => {
    const ctx = createService();
    await ctx.service.claim({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "10000" });

    const result = await ctx.service.claim({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "rejected", reason: "already_claimed_today" });
  });

  it("allows the same wallet to claim Sepolia USDT and TRON USDT on the same date", async () => {
    const ctx = createService();
    await ctx.service.claim({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "10000" });

    const result = await ctx.service.claim({ network: "tron", wallet: tronWallet, token: "USDT", amount: "10000" });

    expect(result.status).toBe("sent");
    expect(ctx.repo.records.map((record) => `${record.network}:${record.token}`)).toEqual(["sepolia:USDT", "tron:USDT"]);
  });

  it("rejects insufficient faucet balance on the selected adapter", async () => {
    const ctx = createService();
    ctx.tron.balance = 1n;

    const result = await ctx.service.claim({ network: "tron", wallet: tronWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "rejected", reason: "insufficient_faucet_balance" });
  });

  it("marks failed when selected adapter transfer submission throws", async () => {
    const ctx = createService();
    ctx.tron.transferError = new Error("private key leaked in raw provider error");

    const result = await ctx.service.claim({ network: "tron", wallet: tronWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ status: "failed", reason: "transfer_failed" });
    expect(ctx.repo.records[0].status).toBe("failed");
    expect(ctx.repo.records[0].errorMessage).toBe("transfer_failed");
  });
});

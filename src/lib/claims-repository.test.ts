import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "./db";
import { SqliteClaimsRepository } from "./claims-repository";

let db: Database.Database | undefined;

function createRepository() {
  db = new Database(":memory:");
  migrateDatabase(db);
  return new SqliteClaimsRepository(db);
}

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("SqliteClaimsRepository", () => {
  it("creates a pending claim and marks it sent", () => {
    const claims = createRepository();
    const claim = claims.createPendingClaim({
      wallet: "0x000000000000000000000000000000000000dEaD",
      token: "USDT",
      amount: "10000",
      claimDate: "2026-06-26"
    });

    claims.markSent(claim.id, "0xabc");
    const found = claims.findActiveClaim(
      "0x000000000000000000000000000000000000dEaD",
      "USDT",
      "2026-06-26"
    );

    expect(found?.status).toBe("sent");
    expect(found?.txHash).toBe("0xabc");
  });

  it("enforces one claim per wallet token date", () => {
    const claims = createRepository();
    const base = {
      wallet: "0x000000000000000000000000000000000000dEaD",
      token: "USDT" as const,
      amount: "10000",
      claimDate: "2026-06-26"
    };

    claims.createPendingClaim(base);

    expect(() => claims.createPendingClaim(base)).toThrow();
  });

  it("allows the same wallet to claim another token on the same date", () => {
    const claims = createRepository();
    const wallet = "0x000000000000000000000000000000000000dEaD";

    claims.createPendingClaim({ wallet, token: "USDT", amount: "10000", claimDate: "2026-06-26" });
    const second = claims.createPendingClaim({ wallet, token: "USDC", amount: "10000", claimDate: "2026-06-26" });

    expect(second.token).toBe("USDC");
  });

  it("does not count failed claims as active", () => {
    const claims = createRepository();
    const wallet = "0x000000000000000000000000000000000000dEaD";
    const claim = claims.createPendingClaim({ wallet, token: "USDT", amount: "10000", claimDate: "2026-06-26" });

    claims.markFailed(claim.id, "transfer_failed");
    const found = claims.findActiveClaim(wallet, "USDT", "2026-06-26");

    expect(found).toBeUndefined();
  });
});

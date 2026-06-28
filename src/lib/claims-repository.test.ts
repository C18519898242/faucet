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
  it("creates a pending claim with network and marks it sent", () => {
    const claims = createRepository();
    const claim = claims.createPendingClaim({
      wallet: "0x000000000000000000000000000000000000dEaD",
      network: "sepolia",
      token: "USDT",
      amount: "10000",
      claimDate: "2026-06-26"
    });

    claims.markSent(claim.id, "0xabc");
    const found = claims.findActiveClaim(
      "0x000000000000000000000000000000000000dEaD",
      "sepolia",
      "USDT",
      "2026-06-26"
    );

    expect(found?.network).toBe("sepolia");
    expect(found?.status).toBe("sent");
    expect(found?.txHash).toBe("0xabc");
  });

  it("enforces one active claim per wallet network token date", () => {
    const claims = createRepository();
    const base = {
      wallet: "0x000000000000000000000000000000000000dEaD",
      network: "sepolia" as const,
      token: "USDT" as const,
      amount: "10000",
      claimDate: "2026-06-26"
    };

    claims.createPendingClaim(base);

    expect(() => claims.createPendingClaim(base)).toThrow();
  });

  it("allows the same wallet and token on another network on the same date", () => {
    const claims = createRepository();
    const wallet = "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu";

    claims.createPendingClaim({ wallet, network: "sepolia", token: "USDT", amount: "10000", claimDate: "2026-06-26" });
    const second = claims.createPendingClaim({ wallet, network: "tron", token: "USDT", amount: "10000", claimDate: "2026-06-26" });

    expect(second.network).toBe("tron");
    expect(second.token).toBe("USDT");
  });

  it("does not count failed claims as active", () => {
    const claims = createRepository();
    const wallet = "0x000000000000000000000000000000000000dEaD";
    const claim = claims.createPendingClaim({
      wallet,
      network: "sepolia",
      token: "USDT",
      amount: "10000",
      claimDate: "2026-06-26"
    });

    claims.markFailed(claim.id, "transfer_failed");
    const found = claims.findActiveClaim(wallet, "sepolia", "USDT", "2026-06-26");

    expect(found).toBeUndefined();
  });

  it("migrates existing claims to sepolia network", () => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet TEXT NOT NULL,
        token TEXT NOT NULL,
        amount TEXT NOT NULL,
        claim_date TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(wallet, token, claim_date)
      );
      INSERT INTO claims (wallet, token, amount, claim_date, status, created_at, updated_at)
      VALUES ('0x000000000000000000000000000000000000dEaD', 'USDT', '10000', '2026-06-26', 'sent', '2026-06-26T00:00:00.000Z', '2026-06-26T00:00:00.000Z');
    `);

    migrateDatabase(db);

    const columns = db.prepare("PRAGMA table_info(claims)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("network");

    const row = db.prepare("SELECT network FROM claims").get() as { network: string };
    expect(row.network).toBe("sepolia");
  });
});

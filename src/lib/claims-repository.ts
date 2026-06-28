import type Database from "better-sqlite3";
import type { NetworkId, TokenSymbol } from "./tokens";

export type ClaimStatus = "pending" | "sent" | "failed";

export type ClaimRecord = {
  id: number;
  wallet: string;
  network: NetworkId;
  token: TokenSymbol;
  amount: string;
  claimDate: string;
  status: ClaimStatus;
  txHash?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateClaimInput = {
  wallet: string;
  network: NetworkId;
  token: TokenSymbol;
  amount: string;
  claimDate: string;
};

export interface ClaimsRepository {
  findActiveClaim(wallet: string, network: NetworkId, token: TokenSymbol, claimDate: string): ClaimRecord | undefined;
  createPendingClaim(input: CreateClaimInput): ClaimRecord;
  markSent(id: number, txHash: string): void;
  markFailed(id: number, message: string): void;
}

type ClaimRow = {
  id: number;
  wallet: string;
  network: NetworkId;
  token: TokenSymbol;
  amount: string;
  claim_date: string;
  status: ClaimStatus;
  tx_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function toRecord(row: ClaimRow): ClaimRecord {
  return {
    id: row.id,
    wallet: row.wallet,
    network: row.network,
    token: row.token,
    amount: row.amount,
    claimDate: row.claim_date,
    status: row.status,
    txHash: row.tx_hash ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteClaimsRepository implements ClaimsRepository {
  constructor(private readonly db: Database.Database) {}

  findActiveClaim(wallet: string, network: NetworkId, token: TokenSymbol, claimDate: string): ClaimRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM claims
         WHERE wallet = ? AND network = ? AND token = ? AND claim_date = ? AND status IN ('pending', 'sent')
         LIMIT 1`
      )
      .get(wallet, network, token, claimDate) as ClaimRow | undefined;

    return row ? toRecord(row) : undefined;
  }

  createPendingClaim(input: CreateClaimInput): ClaimRecord {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO claims (wallet, network, token, amount, claim_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(input.wallet, input.network, input.token, input.amount, input.claimDate, now, now);

    return {
      id: Number(result.lastInsertRowid),
      wallet: input.wallet,
      network: input.network,
      token: input.token,
      amount: input.amount,
      claimDate: input.claimDate,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
  }

  markSent(id: number, txHash: string): void {
    this.db
      .prepare("UPDATE claims SET status = 'sent', tx_hash = ?, updated_at = ? WHERE id = ?")
      .run(txHash, new Date().toISOString(), id);
  }

  markFailed(id: number, message: string): void {
    this.db
      .prepare("UPDATE claims SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
      .run(message, new Date().toISOString(), id);
  }
}

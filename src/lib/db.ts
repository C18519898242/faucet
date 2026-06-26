import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function databasePathFromEnv(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/faucet.sqlite";
  const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
  return path.resolve(process.cwd(), filePath);
}

export function openDatabase(filePath = databasePathFromEnv()): Database.Database {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const db = new Database(filePath);
  migrateDatabase(db);
  return db;
}

export function migrateDatabase(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
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

    CREATE INDEX IF NOT EXISTS idx_claims_wallet_token_date
      ON claims(wallet, token, claim_date);
  `);
}

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
      network TEXT NOT NULL DEFAULT 'sepolia',
      token TEXT NOT NULL,
      amount TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(claims)").all() as Array<{ name: string }>;
  const hasNetwork = columns.some((column) => column.name === "network");
  const indexes = db.prepare("PRAGMA index_list(claims)").all() as Array<{ name: string; origin: string }>;
  const hasTableUniqueConstraint = indexes.some((index) => index.origin === "u");

  if (!hasNetwork || hasTableUniqueConstraint) {
    db.exec(`
      CREATE TABLE claims_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet TEXT NOT NULL,
        network TEXT NOT NULL,
        token TEXT NOT NULL,
        amount TEXT NOT NULL,
        claim_date TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    if (hasNetwork) {
      db.exec(`
        INSERT INTO claims_new (
          id, wallet, network, token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
        )
        SELECT id, wallet, network, token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
        FROM claims;
      `);
    } else {
      db.exec(`
        INSERT INTO claims_new (
          id, wallet, network, token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
        )
        SELECT id, wallet, 'sepolia', token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
        FROM claims;
      `);
    }

    db.exec(`
      DROP TABLE claims;
      ALTER TABLE claims_new RENAME TO claims;
    `);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_active_unique
      ON claims(wallet, network, token, claim_date)
      WHERE status IN ('pending', 'sent');

    CREATE INDEX IF NOT EXISTS idx_claims_wallet_network_token_date
      ON claims(wallet, network, token, claim_date);
  `);
}

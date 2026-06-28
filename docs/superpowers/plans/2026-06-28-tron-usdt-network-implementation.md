# TRON USDT 网络支持实施计划

> **给 agentic workers：** 必须使用子技能：推荐使用 superpowers:subagent-driven-development，或使用 superpowers:executing-plans 按任务实施本计划。所有步骤都使用复选框（`- [ ]`）语法，便于执行时追踪进度。

**目标：** 增加 TRON Shasta USDT 领取能力，同时保持 UI/API 中的币种名为 `USDT`，并通过 `network + token` 区分不同资产。

**架构：** 在领域模型、输入校验、仓库唯一性约束和领取流程中引入 `NetworkId`。`ClaimService` 根据校验后的网络选择 `ChainAdapter`；API route 使用懒加载方式创建 TRON adapter，确保 TRON 配置缺失不会影响 Sepolia 领取。

**技术栈：** Next.js 15、React 19、TypeScript、Vitest、better-sqlite3、ethers v6、tronweb、SQLite。

## 全局约束

- 支持 TRON Shasta 网络的 USDT。
- TRON USDT 合约地址必须是 `TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu`。
- TRON RPC 必须使用 `TRON_RPC_URL=https://api.shasta.trongrid.io`。
- TRON 转账复用现有 `FAUCET_PRIVATE_KEY`。
- UI 和 API 中不得使用 `TRON_USDT`。
- 币种仍然使用 `USDT`；通过 `network + token` 区分资产。
- 保留现有 Sepolia USDT 和 Sepolia USDC 行为。
- API 必须接收 `network: "sepolia" | "tron"` 和 `token: "USDT" | "USDC"`。
- 缺少 `network` 时必须返回 `unsupported_network`，不能默认成 Sepolia。
- 新增公开错误原因 `unsupported_network`。
- 公开 API 错误不得暴露私钥、原始 RPC 错误、stack trace 或敏感合约调用参数。
- TRON 请求缺少 TRON 配置时，必须返回 `{ "status": "failed", "reason": "transfer_failed" }`。
- 每日有效领取记录的唯一性必须是 `wallet + network + token + claim_date`。
- 现有领取记录必须迁移为 `network = 'sepolia'`。
- `pending` 和 `sent` 记录算作有效领取；`failed` 不算。
- 所有支持资产的固定领取数量仍为 `10000`。
- Shasta 浏览器链接必须是 `https://shasta.tronscan.org/#/transaction/{txHash}`。

---

## 文件结构

- 修改 `package.json` 和 `package-lock.json`：加入 `tronweb`。
- 修改 `src/lib/tokens.ts`：定义 `NetworkId`、网络感知的代币配置和查询辅助函数。
- 新建 `src/lib/tron-address.ts`：用一个小函数封装 TRON base58 地址校验，供校验逻辑和 adapter 测试使用。
- 修改 `src/lib/validation.ts`：要求传入 `network`，校验 `network + token`，并按网络校验钱包地址。
- 修改 `src/lib/validation.test.ts`：覆盖 Sepolia/TRON 校验路径和新的 `unsupported_network`。
- 修改 `src/lib/api-errors.ts`：把 `unsupported_network` 映射为 HTTP 400。
- 修改 `src/lib/db.ts`：迁移旧 `claims` 表，加入 `network` 和新的唯一性约束。
- 修改 `src/lib/claims-repository.ts`：在记录、创建输入和 active 查询中加入 `network`。
- 修改 `src/lib/claims-repository.test.ts`：验证网络维度唯一性和迁移。
- 修改 `src/test/fakes.ts`：让 fake repository 和 fake adapters 支持网络维度。
- 修改 `src/lib/claim-service.ts`：按网络接收 adapters，并把领取请求路由到选中的 adapter。
- 修改 `src/lib/claim-service.test.ts`：验证 adapter 选择和独立的每日领取限制。
- 修改 `src/lib/sepolia-evm-adapter.ts`：接受 `string` 类型的 token address，只在合约边界使用。
- 新建 `src/lib/tron-adapter.ts`：实现 TRC20 余额、转账、地址校验和 Shasta 浏览器链接。
- 新建 `src/lib/tron-adapter.test.ts`：在不访问网络的情况下测试私钥标准化、地址校验、转账金额换算和浏览器链接。
- 修改 `src/app/api/claim/route.ts`：把带 network 的 body 传给 service，并懒加载 adapters。
- 修改 `src/app/api/claim/route.test.ts`：验证 network 被转发，且 malformed JSON 行为保持不变。
- 修改 `src/app/page.tsx`：加入网络选择、按网络过滤币种、重置不支持的币种、提交 network，并按网络调整 placeholder/link 文案。
- 修改 `src/app/page.test.tsx`：覆盖网络 UI 和 TRON 提交 body。
- 修改 `src/app/globals.css`：统一网络和币种选项组样式。
- 修改 `.env.example`、`docker-compose.yml` 和 `README.md`：记录 `TRON_RPC_URL` 和新的领取模型。

---

### 任务 1：网络感知的代币配置和输入校验

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`src/lib/tokens.ts`
- 新建：`src/lib/tron-address.ts`
- 修改：`src/lib/validation.ts`
- 修改：`src/lib/validation.test.ts`
- 修改：`src/lib/api-errors.ts`

**接口：**
- 产出：`type NetworkId = "sepolia" | "tron"`
- 产出：`type TokenSymbol = "USDT" | "USDC"`
- 产出：`type TokenConfig = { network: NetworkId; symbol: TokenSymbol; address: string; decimals: number; chainId?: number; maxClaimAmount: string }`
- 产出：`NETWORKS`、`TOKENS`、`isNetworkId(value: string): value is NetworkId`、`isTokenSymbol(value: string): value is TokenSymbol`、`getTokenConfig(network: NetworkId, token: TokenSymbol): TokenConfig | undefined`、`getSupportedTokens(network: NetworkId): TokenSymbol[]`
- 产出：`isTronAddress(address: string): boolean`
- 产出：`ClaimInput = { network: unknown; wallet: unknown; token: unknown; amount: unknown }`
- 产出：`ValidClaimInput = { network: NetworkId; wallet: string; token: TokenSymbol; amount: string }`
- 产出：`ValidationReason` 包含 `unsupported_network`
- 消耗：现有 `ethers.getAddress`

- [ ] **步骤 1：安装 `tronweb`**

运行：

```bash
npm install tronweb
```

预期：`package.json` 增加 `tronweb` 依赖，`package-lock.json` 同步更新。

- [ ] **步骤 2：编写失败的输入校验测试**

将 `src/lib/validation.test.ts` 替换为：

```ts
import { describe, expect, it } from "vitest";
import { validateClaimInput } from "./validation";

const evmWallet = "0x000000000000000000000000000000000000dEaD";
const tronWallet = "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu";

describe("validateClaimInput", () => {
  it("accepts a valid Sepolia USDT request", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: evmWallet,
      token: "USDT",
      amount: "10000"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        network: "sepolia",
        wallet: evmWallet,
        token: "USDT",
        amount: "10000"
      });
    }
  });

  it("accepts a valid TRON USDT request", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: tronWallet,
      token: "USDT",
      amount: "10000"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        network: "tron",
        wallet: tronWallet,
        token: "USDT",
        amount: "10000"
      });
    }
  });

  it("rejects a missing network", () => {
    const result = validateClaimInput({ wallet: evmWallet, token: "USDT", amount: "10000" });

    expect(result).toEqual({ ok: false, reason: "unsupported_network" });
  });

  it("rejects an unsupported network", () => {
    const result = validateClaimInput({
      network: "mainnet",
      wallet: evmWallet,
      token: "USDT",
      amount: "10000"
    });

    expect(result).toEqual({ ok: false, reason: "unsupported_network" });
  });

  it("rejects TRON USDC because TRON Shasta only supports USDT", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: tronWallet,
      token: "USDC",
      amount: "10000"
    });

    expect(result).toEqual({ ok: false, reason: "unsupported_token" });
  });

  it("rejects an EVM wallet on TRON", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: evmWallet,
      token: "USDT",
      amount: "10000"
    });

    expect(result).toEqual({ ok: false, reason: "invalid_wallet" });
  });

  it("rejects a TRON wallet on Sepolia", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: tronWallet,
      token: "USDT",
      amount: "10000"
    });

    expect(result).toEqual({ ok: false, reason: "invalid_wallet" });
  });

  it("rejects amounts above the selected asset max claim amount", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: evmWallet,
      token: "USDC",
      amount: "10001"
    });

    expect(result).toEqual({ ok: false, reason: "amount_too_large" });
  });

  it("rejects zero and negative amounts", () => {
    expect(validateClaimInput({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "0" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
    expect(validateClaimInput({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "-1" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
  });
});
```

- [ ] **步骤 3：运行输入校验测试，确认失败**

运行：

```bash
npm test -- src/lib/validation.test.ts
```

预期：失败，因为 `network`、`unsupported_network`、TRON 校验和 `getTokenConfig` 尚不存在。

- [ ] **步骤 4：实现网络感知的代币配置**

将 `src/lib/tokens.ts` 替换为：

```ts
export type NetworkId = "sepolia" | "tron";
export type TokenSymbol = "USDT" | "USDC";

export type TokenConfig = {
  network: NetworkId;
  symbol: TokenSymbol;
  address: string;
  decimals: number;
  chainId?: number;
  maxClaimAmount: string;
};

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  tokens: Partial<Record<TokenSymbol, TokenConfig>>;
};

export const SEPOLIA_CHAIN_ID = 11155111;
export const MAX_CLAIM_AMOUNT = "10000";

export const NETWORKS = {
  sepolia: {
    id: "sepolia",
    label: "Sepolia",
    tokens: {
      USDT: {
        network: "sepolia",
        symbol: "USDT",
        address: "0xe980e37De697598E0999D09B563e528be6E67316",
        decimals: 6,
        chainId: SEPOLIA_CHAIN_ID,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      },
      USDC: {
        network: "sepolia",
        symbol: "USDC",
        address: "0xED2188e40ee30192231209C0e527B22a41d0BdEa",
        decimals: 6,
        chainId: SEPOLIA_CHAIN_ID,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      }
    }
  },
  tron: {
    id: "tron",
    label: "TRON Shasta",
    tokens: {
      USDT: {
        network: "tron",
        symbol: "USDT",
        address: "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu",
        decimals: 6,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      }
    }
  }
} as const satisfies Record<NetworkId, NetworkConfig>;

export const TOKENS = NETWORKS.sepolia.tokens as Record<TokenSymbol, TokenConfig>;

export function isNetworkId(value: string): value is NetworkId {
  return value === "sepolia" || value === "tron";
}

export function isTokenSymbol(value: string): value is TokenSymbol {
  return value === "USDT" || value === "USDC";
}

export function getTokenConfig(network: NetworkId, token: TokenSymbol): TokenConfig | undefined {
  return NETWORKS[network].tokens[token];
}

export function getSupportedTokens(network: NetworkId): TokenSymbol[] {
  return Object.keys(NETWORKS[network].tokens) as TokenSymbol[];
}
```

- [ ] **步骤 5：新增 TRON 地址辅助函数**

新建 `src/lib/tron-address.ts`：

```ts
import { TronWeb } from "tronweb";

export function isTronAddress(address: string): boolean {
  return TronWeb.isAddress(address);
}
```

- [ ] **步骤 6：实现网络感知的输入校验**

将 `src/lib/validation.ts` 替换为：

```ts
import { getAddress } from "ethers";
import { isTronAddress } from "./tron-address";
import { getTokenConfig, isNetworkId, isTokenSymbol, type NetworkId, type TokenSymbol } from "./tokens";

export type ClaimInput = {
  network: unknown;
  wallet: unknown;
  token: unknown;
  amount: unknown;
};

export type ValidClaimInput = {
  network: NetworkId;
  wallet: string;
  token: TokenSymbol;
  amount: string;
};

export type ValidationReason =
  | "invalid_wallet"
  | "unsupported_network"
  | "unsupported_token"
  | "invalid_amount"
  | "amount_too_large";

export type ValidationResult =
  | { ok: true; value: ValidClaimInput }
  | { ok: false; reason: ValidationReason };

export function validateClaimInput(input: Partial<ClaimInput>): ValidationResult {
  if (typeof input.network !== "string" || !isNetworkId(input.network)) {
    return { ok: false, reason: "unsupported_network" };
  }

  if (typeof input.token !== "string" || !isTokenSymbol(input.token)) {
    return { ok: false, reason: "unsupported_token" };
  }

  const tokenConfig = getTokenConfig(input.network, input.token);
  if (!tokenConfig) {
    return { ok: false, reason: "unsupported_token" };
  }

  if (typeof input.wallet !== "string") {
    return { ok: false, reason: "invalid_wallet" };
  }

  const wallet = normalizeWallet(input.network, input.wallet);
  if (!wallet) {
    return { ok: false, reason: "invalid_wallet" };
  }

  if (typeof input.amount !== "string" && typeof input.amount !== "number") {
    return { ok: false, reason: "invalid_amount" };
  }

  const amount = String(input.amount).trim();
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return { ok: false, reason: "invalid_amount" };
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  if (numericAmount > Number(tokenConfig.maxClaimAmount)) {
    return { ok: false, reason: "amount_too_large" };
  }

  return {
    ok: true,
    value: {
      network: input.network,
      wallet,
      token: input.token,
      amount
    }
  };
}

function normalizeWallet(network: NetworkId, wallet: string): string | undefined {
  if (network === "sepolia") {
    try {
      return getAddress(wallet);
    } catch {
      return undefined;
    }
  }

  return isTronAddress(wallet) ? wallet : undefined;
}
```

- [ ] **步骤 7：把 `unsupported_network` 映射为 HTTP 400**

更新 `src/lib/api-errors.ts`：

```ts
import type { ClaimResult } from "./claim-service";

export function statusCodeForClaimResult(result: ClaimResult): number {
  if (result.status === "sent") {
    return 200;
  }

  if (result.status === "failed") {
    return 502;
  }

  switch (result.reason) {
    case "invalid_wallet":
    case "unsupported_network":
    case "unsupported_token":
    case "invalid_amount":
    case "amount_too_large":
      return 400;
    case "already_claimed_today":
      return 409;
    case "insufficient_faucet_balance":
      return 503;
  }
}
```

- [ ] **步骤 8：运行输入校验测试，确认通过**

运行：

```bash
npm test -- src/lib/validation.test.ts
```

预期：通过。

- [ ] **步骤 9：提交**

```bash
git add package.json package-lock.json src/lib/tokens.ts src/lib/tron-address.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/api-errors.ts
git commit -m "feat: add network-aware claim validation"
```

---

### 任务 2：网络感知的 Claims Repository 和 SQLite 迁移

**文件：**
- 修改：`src/lib/db.ts`
- 修改：`src/lib/claims-repository.ts`
- 修改：`src/lib/claims-repository.test.ts`

**接口：**
- 消耗：`NetworkId`、`TokenSymbol`
- 产出：`ClaimRecord.network: NetworkId`
- 产出：`CreateClaimInput.network: NetworkId`
- 变更：`findActiveClaim(wallet: string, network: NetworkId, token: TokenSymbol, claimDate: string): ClaimRecord | undefined`

- [ ] **步骤 1：编写失败的 repository 和迁移测试**

将 `src/lib/claims-repository.test.ts` 替换为：

```ts
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
```

- [ ] **步骤 2：运行 repository 测试，确认失败**

运行：

```bash
npm test -- src/lib/claims-repository.test.ts
```

预期：失败，因为 schema、记录和 repository 查询中还没有 `network`。

- [ ] **步骤 3：实现 SQLite 迁移**

将 `src/lib/db.ts` 中的 `migrateDatabase` 替换为：

```ts
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
      updated_at TEXT NOT NULL,
      UNIQUE(wallet, network, token, claim_date)
    );
  `);

  const columns = db.prepare("PRAGMA table_info(claims)").all() as Array<{ name: string }>;
  const hasNetwork = columns.some((column) => column.name === "network");

  if (!hasNetwork) {
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
        updated_at TEXT NOT NULL,
        UNIQUE(wallet, network, token, claim_date)
      );

      INSERT INTO claims_new (
        id, wallet, network, token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
      )
      SELECT id, wallet, 'sepolia', token, amount, claim_date, status, tx_hash, error_message, created_at, updated_at
      FROM claims;

      DROP TABLE claims;
      ALTER TABLE claims_new RENAME TO claims;
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_claims_wallet_network_token_date
      ON claims(wallet, network, token, claim_date);
  `);
}
```

- [ ] **步骤 4：实现网络感知的 repository**

将 `src/lib/claims-repository.ts` 替换为：

```ts
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
```

- [ ] **步骤 5：运行 repository 测试，确认通过**

运行：

```bash
npm test -- src/lib/claims-repository.test.ts
```

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/lib/db.ts src/lib/claims-repository.ts src/lib/claims-repository.test.ts
git commit -m "feat: store claim network in sqlite"
```

---

### 任务 3：Claim Service 的 Adapter 选择

**文件：**
- 修改：`src/test/fakes.ts`
- 修改：`src/lib/claim-service.ts`
- 修改：`src/lib/claim-service.test.ts`

**接口：**
- 消耗：`NetworkId`、`getTokenConfig`
- 消耗：`ClaimsRepository.findActiveClaim(wallet, network, token, claimDate)`
- 产出：`type ChainAdaptersByNetwork = Partial<Record<NetworkId, ChainAdapter>>`
- 变更：`new ClaimService(claims, adaptersByNetwork, now?)`
- 产出：`ClaimResult` 的 rejected reason 包含 `unsupported_network`

- [ ] **步骤 1：编写失败的 service 测试**

将 `src/lib/claim-service.test.ts` 替换为：

```ts
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
```

- [ ] **步骤 2：运行 service 测试，确认失败**

运行：

```bash
npm test -- src/lib/claim-service.test.ts
```

预期：失败，因为 `ClaimService` 仍然只接收单个 adapter，且 fakes 尚未包含 network。

- [ ] **步骤 3：更新测试 fakes**

将 `src/test/fakes.ts` 替换为：

```ts
import type { ChainAdapter } from "@/lib/chain-adapter";
import type { ClaimRecord, ClaimsRepository, CreateClaimInput } from "@/lib/claims-repository";
import type { NetworkId, TokenConfig, TokenSymbol } from "@/lib/tokens";

export class FakeClaimsRepository implements ClaimsRepository {
  records: ClaimRecord[] = [];
  nextId = 1;

  findActiveClaim(wallet: string, network: NetworkId, token: TokenSymbol, claimDate: string): ClaimRecord | undefined {
    return this.records.find(
      (record) =>
        record.wallet === wallet &&
        record.network === network &&
        record.token === token &&
        record.claimDate === claimDate &&
        (record.status === "pending" || record.status === "sent")
    );
  }

  createPendingClaim(input: CreateClaimInput): ClaimRecord {
    const now = "2026-06-26T00:00:00.000Z";
    const record: ClaimRecord = {
      id: this.nextId++,
      wallet: input.wallet,
      network: input.network,
      token: input.token,
      amount: input.amount,
      claimDate: input.claimDate,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    this.records.push(record);
    return record;
  }

  markSent(id: number, txHash: string): void {
    const record = this.records.find((item) => item.id === id);
    if (record) {
      record.status = "sent";
      record.txHash = txHash;
    }
  }

  markFailed(id: number, message: string): void {
    const record = this.records.find((item) => item.id === id);
    if (record) {
      record.status = "failed";
      record.errorMessage = message;
    }
  }
}

export class FakeChainAdapter implements ChainAdapter {
  balance = 10000000000n;
  transferError: Error | undefined;
  transfers: Array<{ token: TokenConfig; to: string; amount: string }> = [];

  constructor(
    readonly network: NetworkId,
    readonly txHash = "0xtx",
    private readonly explorerPrefix = "https://sepolia.etherscan.io/tx/"
  ) {}

  validateAddress(address: string): boolean {
    return this.network === "tron" ? address.startsWith("T") : address.startsWith("0x");
  }

  async getTokenBalance(_token: TokenConfig): Promise<bigint> {
    return this.balance;
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    if (this.transferError) {
      throw this.transferError;
    }
    this.transfers.push({ token, to, amount });
    return this.txHash;
  }

  getExplorerTxUrl(txHash: string): string {
    return `${this.explorerPrefix}${txHash}`;
  }
}
```

- [ ] **步骤 4：在 `ClaimService` 中实现网络 adapter 选择**

将 `src/lib/claim-service.ts` 替换为：

```ts
import { parseUnits } from "ethers";
import type { ChainAdapter } from "./chain-adapter";
import type { ClaimsRepository } from "./claims-repository";
import { getClaimDate } from "./date";
import { getTokenConfig, type NetworkId } from "./tokens";
import { validateClaimInput, type ClaimInput } from "./validation";

export type ChainAdaptersByNetwork = Partial<Record<NetworkId, ChainAdapter>>;

export type ClaimResult =
  | { status: "sent"; txHash: string; explorerUrl: string }
  | {
      status: "rejected";
      reason:
        | "invalid_wallet"
        | "unsupported_network"
        | "unsupported_token"
        | "invalid_amount"
        | "amount_too_large"
        | "already_claimed_today"
        | "insufficient_faucet_balance";
    }
  | { status: "failed"; reason: "transfer_failed" };

export class ClaimService {
  constructor(
    private readonly claims: ClaimsRepository,
    private readonly chains: ChainAdaptersByNetwork,
    private readonly now: () => Date = () => new Date()
  ) {}

  async claim(input: Partial<ClaimInput>): Promise<ClaimResult> {
    const validation = validateClaimInput(input);
    if (!validation.ok) {
      return { status: "rejected", reason: validation.reason };
    }

    const { network, wallet, token, amount } = validation.value;
    const tokenConfig = getTokenConfig(network, token);
    const chain = this.chains[network];

    if (!tokenConfig || !chain) {
      return { status: "failed", reason: "transfer_failed" };
    }

    const claimDate = getClaimDate(this.now());
    const existing = this.claims.findActiveClaim(wallet, network, token, claimDate);

    if (existing) {
      return { status: "rejected", reason: "already_claimed_today" };
    }

    const balance = await chain.getTokenBalance(tokenConfig);
    const amountInBaseUnits = parseUnits(amount, tokenConfig.decimals);
    if (balance < amountInBaseUnits) {
      return { status: "rejected", reason: "insufficient_faucet_balance" };
    }

    const claim = this.claims.createPendingClaim({ wallet, network, token, amount, claimDate });

    try {
      const txHash = await chain.transferToken(tokenConfig, wallet, amount);
      this.claims.markSent(claim.id, txHash);
      return {
        status: "sent",
        txHash,
        explorerUrl: chain.getExplorerTxUrl(txHash)
      };
    } catch {
      this.claims.markFailed(claim.id, "transfer_failed");
      return { status: "failed", reason: "transfer_failed" };
    }
  }
}
```

- [ ] **步骤 5：运行 service 测试，确认通过**

运行：

```bash
npm test -- src/lib/claim-service.test.ts
```

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/test/fakes.ts src/lib/claim-service.ts src/lib/claim-service.test.ts
git commit -m "feat: select claim adapter by network"
```

---

### 任务 4：TRON 链 Adapter

**文件：**
- 修改：`src/lib/sepolia-evm-adapter.ts`
- 新建：`src/lib/tron-adapter.ts`
- 新建：`src/lib/tron-adapter.test.ts`

**接口：**
- 消耗：`ChainAdapter`
- 消耗：`TokenConfig`
- 产出：`class TronAdapter implements ChainAdapter`
- 产出：`createTronAdapterFromEnv(): TronAdapter`
- 产出：`normalizeTronPrivateKey(privateKey: string): string`
- 产出：`getExplorerTxUrl(txHash: string): string`

- [ ] **步骤 1：编写失败的 TRON adapter 测试**

新建 `src/lib/tron-adapter.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { NETWORKS } from "./tokens";
import { normalizeTronPrivateKey, TronAdapter } from "./tron-adapter";

const token = NETWORKS.tron.tokens.USDT;

type FakeContract = {
  balanceOf(owner: string): { call(): Promise<string> };
  transfer(to: string, amount: string): { send(): Promise<string> };
};

function createAdapter(contract: FakeContract) {
  return new TronAdapter(
    {
      address: {
        fromPrivateKey: () => "TFaucetAddress"
      },
      contract: async () => contract,
      isAddress: (address: string) => address.startsWith("T")
    },
    "abcdef"
  );
}

describe("TronAdapter", () => {
  it("normalizes 0x-prefixed private keys for TronWeb", () => {
    expect(normalizeTronPrivateKey("0xabcdef")).toBe("abcdef");
    expect(normalizeTronPrivateKey("abcdef")).toBe("abcdef");
  });

  it("validates TRON addresses", () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: () => ({ send: async () => "tx" })
    });

    expect(adapter.validateAddress("TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu")).toBe(true);
    expect(adapter.validateAddress("0x000000000000000000000000000000000000dEaD")).toBe(false);
  });

  it("reads TRC20 balance for faucet address", async () => {
    const adapter = createAdapter({
      balanceOf: (owner: string) => {
        expect(owner).toBe("TFaucetAddress");
        return { call: async () => "123000000" };
      },
      transfer: () => ({ send: async () => "tx" })
    });

    await expect(adapter.getTokenBalance(token)).resolves.toBe(123000000n);
  });

  it("transfers human-readable amount as base units", async () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: (to: string, amount: string) => {
        expect(to).toBe("TReceiverAddress");
        expect(amount).toBe("10000000000");
        return { send: async () => "trontx" };
      }
    });

    await expect(adapter.transferToken(token, "TReceiverAddress", "10000")).resolves.toBe("trontx");
  });

  it("builds Shasta explorer transaction URL", () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: () => ({ send: async () => "tx" })
    });

    expect(adapter.getExplorerTxUrl("abc")).toBe("https://shasta.tronscan.org/#/transaction/abc");
  });
});
```

- [ ] **步骤 2：运行 TRON adapter 测试，确认失败**

运行：

```bash
npm test -- src/lib/tron-adapter.test.ts
```

预期：失败，因为 `src/lib/tron-adapter.ts` 还不存在。

- [ ] **步骤 3：让 Sepolia adapter 适配 string 类型的 token address**

在 `src/lib/sepolia-evm-adapter.ts` 中保持公开行为不变，只调整 `getTokenBalance` 和 `transferToken` 中的 contract factory 调用，让 TypeScript 接受 `TokenConfig.address: string`：

```ts
  async getTokenBalance(token: TokenConfig): Promise<bigint> {
    const contract = this.contractFactory(token.address);
    return contract.balanceOf(this.wallet.address);
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    const contract = this.contractFactory(token.address);
    const amountInBaseUnits = parseUnits(amount, token.decimals);
    const tx = await contract.transfer(to, amountInBaseUnits);
    return tx.hash;
  }
```

- [ ] **步骤 4：实现 TRON adapter**

新建 `src/lib/tron-adapter.ts`：

```ts
import { parseUnits } from "ethers";
import { TronWeb } from "tronweb";
import type { ChainAdapter } from "./chain-adapter";
import type { TokenConfig } from "./tokens";

const TRC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  }
] as const;

type TronContract = {
  balanceOf(owner: string): { call(): Promise<string | number | bigint> };
  transfer(to: string, amount: string): { send(): Promise<string> };
};

type TronWebLike = {
  address: {
    fromPrivateKey(privateKey: string): string | false;
  };
  contract(abi: unknown, address: string): Promise<TronContract>;
  isAddress(address: string): boolean;
};

export class TronAdapter implements ChainAdapter {
  private readonly faucetAddress: string;

  constructor(
    private readonly tronWeb: TronWebLike,
    private readonly privateKey: string
  ) {
    const address = this.tronWeb.address.fromPrivateKey(privateKey);
    if (!address) {
      throw new Error("Invalid FAUCET_PRIVATE_KEY for TRON");
    }
    this.faucetAddress = address;
  }

  validateAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  async getTokenBalance(token: TokenConfig): Promise<bigint> {
    const contract = await this.tronWeb.contract(TRC20_ABI, token.address);
    const balance = await contract.balanceOf(this.faucetAddress).call();
    return BigInt(balance);
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    const contract = await this.tronWeb.contract(TRC20_ABI, token.address);
    const amountInBaseUnits = parseUnits(amount, token.decimals).toString();
    return contract.transfer(to, amountInBaseUnits).send();
  }

  getExplorerTxUrl(txHash: string): string {
    return `https://shasta.tronscan.org/#/transaction/${txHash}`;
  }
}

export function normalizeTronPrivateKey(privateKey: string): string {
  return privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
}

export function createTronAdapterFromEnv(): TronAdapter {
  const rpcUrl = process.env.TRON_RPC_URL;
  const privateKey = process.env.FAUCET_PRIVATE_KEY;

  if (!rpcUrl) {
    throw new Error("Missing TRON_RPC_URL");
  }

  if (!privateKey) {
    throw new Error("Missing FAUCET_PRIVATE_KEY");
  }

  const normalizedPrivateKey = normalizeTronPrivateKey(privateKey);
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    privateKey: normalizedPrivateKey
  }) as unknown as TronWebLike;

  return new TronAdapter(tronWeb, normalizedPrivateKey);
}
```

- [ ] **步骤 5：运行 adapter 测试，确认通过**

运行：

```bash
npm test -- src/lib/sepolia-evm-adapter.test.ts src/lib/tron-adapter.test.ts
```

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/lib/sepolia-evm-adapter.ts src/lib/tron-adapter.ts src/lib/tron-adapter.test.ts
git commit -m "feat: add tron chain adapter"
```

---

### 任务 5：API Route 懒加载 Adapter

**文件：**
- 修改：`src/app/api/claim/route.ts`
- 修改：`src/app/api/claim/route.test.ts`

**接口：**
- 消耗：`ClaimService(claims, adaptersByNetwork)`
- 消耗：`createSepoliaEvmAdapterFromEnv()`
- 消耗：`createTronAdapterFromEnv()`
- 产出：route 请求体必须包含 `network`

- [ ] **步骤 1：编写失败的 route 测试**

将 `src/app/api/claim/route.test.ts` 替换为：

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  openDatabase: vi.fn(() => ({}))
}));

vi.mock("@/lib/claims-repository", () => ({
  SqliteClaimsRepository: vi.fn(() => ({}))
}));

const createSepoliaEvmAdapterFromEnv = vi.fn(() => ({ network: "sepolia" }));
vi.mock("@/lib/sepolia-evm-adapter", () => ({
  createSepoliaEvmAdapterFromEnv
}));

const createTronAdapterFromEnv = vi.fn(() => ({ network: "tron" }));
vi.mock("@/lib/tron-adapter", () => ({
  createTronAdapterFromEnv
}));

const claimMock = vi.fn(async () => ({
  status: "sent",
  txHash: "0xtx",
  explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
}));

const ClaimService = vi.fn().mockImplementation(() => ({
  claim: claimMock
}));

vi.mock("@/lib/claim-service", () => ({
  ClaimService
}));

describe("POST /api/claim", () => {
  it("passes a Sepolia request with network to ClaimService", async () => {
    const { POST } = await import("./route");
    const body = {
      network: "sepolia",
      wallet: "0x000000000000000000000000000000000000dEaD",
      token: "USDT",
      amount: "10000"
    };
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: JSON.stringify(body)
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(claimMock).toHaveBeenCalledWith(body);
    expect(ClaimService).toHaveBeenCalledWith({}, { sepolia: { network: "sepolia" }, tron: expect.any(Object) });
    expect(createSepoliaEvmAdapterFromEnv).toHaveBeenCalled();
  });

  it("returns a sanitized JSON claim response", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: JSON.stringify({
        network: "sepolia",
        wallet: "0x000000000000000000000000000000000000dEaD",
        token: "USDT",
        amount: "10000"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "sent",
      txHash: "0xtx",
      explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
    });
  });

  it("rejects malformed JSON", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: "{"
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "rejected",
      reason: "invalid_request"
    });
  });
});
```

- [ ] **步骤 2：运行 route 测试，确认失败**

运行：

```bash
npm test -- src/app/api/claim/route.test.ts
```

预期：失败，因为 route 仍然只创建单个 adapter，且尚未导入 `createTronAdapterFromEnv`。

- [ ] **步骤 3：实现 route adapter map**

将 `src/app/api/claim/route.ts` 替换为：

```ts
import { NextResponse } from "next/server";
import { statusCodeForClaimResult } from "@/lib/api-errors";
import { ClaimService } from "@/lib/claim-service";
import { SqliteClaimsRepository } from "@/lib/claims-repository";
import { openDatabase } from "@/lib/db";
import { createSepoliaEvmAdapterFromEnv } from "@/lib/sepolia-evm-adapter";
import { createTronAdapterFromEnv } from "@/lib/tron-adapter";
import type { ChainAdapter } from "@/lib/chain-adapter";
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
```

- [ ] **步骤 4：运行 route 测试，确认通过**

运行：

```bash
npm test -- src/app/api/claim/route.test.ts
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/app/api/claim/route.ts src/app/api/claim/route.test.ts
git commit -m "feat: wire claim route for multiple networks"
```

---

### 任务 6：网络选择 UI

**文件：**
- 修改：`src/app/page.tsx`
- 修改：`src/app/page.test.tsx`
- 修改：`src/app/globals.css`

**接口：**
- 消耗：`NETWORKS`、`getSupportedTokens`、`NetworkId`、`TokenSymbol`
- 产出：请求体 `{ network, wallet, token, amount: "10000" }`
- 产出：Sepolia placeholder `0x...`
- 产出：TRON placeholder `T...`
- 产出：Sepolia 成功链接文案 `查看 Sepolia 交易`
- 产出：TRON 成功链接文案 `查看 TRON 交易`

- [ ] **步骤 1：编写失败的 UI 测试**

将 `src/app/page.test.tsx` 替换为：

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";
import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a Sepolia USDT claim and shows Sepolia tx link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "sent",
        txHash: "0xtx",
        explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);
    await userEvent.type(screen.getByLabelText("接收钱包地址"), "0x000000000000000000000000000000000000dEaD");
    await userEvent.click(screen.getByRole("button", { name: "领取测试币" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: "sepolia",
        wallet: "0x000000000000000000000000000000000000dEaD",
        token: "USDT",
        amount: "10000"
      })
    });
    expect(await screen.findByText("交易已发送")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 Sepolia 交易" })).toHaveAttribute(
      "href",
      "https://sepolia.etherscan.io/tx/0xtx"
    );
  });

  it("shows the current app version", () => {
    render(<HomePage />);

    expect(screen.getByText(`v${packageJson.version}`)).toBeInTheDocument();
  });

  it("shows network choices and Sepolia tokens by default", () => {
    render(<HomePage />);

    expect(screen.getByLabelText("Sepolia")).toBeChecked();
    expect(screen.getByLabelText("TRON Shasta")).toBeInTheDocument();
    expect(screen.getByLabelText("USDT")).toBeInTheDocument();
    expect(screen.getByLabelText("USDC")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0x...")).toBeInTheDocument();
  });

  it("shows only USDT and a TRON placeholder after selecting TRON Shasta", async () => {
    render(<HomePage />);

    await userEvent.click(screen.getByLabelText("TRON Shasta"));

    expect(screen.getByLabelText("USDT")).toBeChecked();
    expect(screen.queryByLabelText("USDC")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("T...")).toBeInTheDocument();
  });

  it("resets USDC to USDT when switching from Sepolia to TRON Shasta", async () => {
    render(<HomePage />);

    await userEvent.click(screen.getByLabelText("USDC"));
    await userEvent.click(screen.getByLabelText("TRON Shasta"));

    expect(screen.getByLabelText("USDT")).toBeChecked();
    expect(screen.queryByLabelText("USDC")).not.toBeInTheDocument();
  });

  it("submits a TRON USDT claim and shows TRON tx link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "sent",
        txHash: "trontx",
        explorerUrl: "https://shasta.tronscan.org/#/transaction/trontx"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);
    await userEvent.click(screen.getByLabelText("TRON Shasta"));
    await userEvent.type(screen.getByLabelText("接收钱包地址"), "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu");
    await userEvent.click(screen.getByRole("button", { name: "领取测试币" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/claim",
      expect.objectContaining({
        body: JSON.stringify({
          network: "tron",
          wallet: "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu",
          token: "USDT",
          amount: "10000"
        })
      })
    );
    expect(await screen.findByRole("link", { name: "查看 TRON 交易" })).toHaveAttribute(
      "href",
      "https://shasta.tronscan.org/#/transaction/trontx"
    );
  });

  it("shows already claimed feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ status: "rejected", reason: "already_claimed_today" })
      })
    );

    render(<HomePage />);
    await userEvent.type(screen.getByLabelText("接收钱包地址"), "0x000000000000000000000000000000000000dEaD");
    await userEvent.click(screen.getByRole("button", { name: "领取测试币" }));

    expect(await screen.findByText("该钱包今天已经领取过这个网络的这个币种")).toBeInTheDocument();
  });

  it("shows a visible error when wallet is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);
    await userEvent.click(screen.getByRole("button", { name: "领取测试币" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByText("钱包地址格式不正确")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行 UI 测试，确认失败**

运行：

```bash
npm test -- src/app/page.test.tsx
```

预期：失败，因为页面还没有网络选择，并且提交时仍然没有 `network`。

- [ ] **步骤 3：实现网络选择页面**

将 `src/app/page.tsx` 替换为：

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupportedTokens, NETWORKS, type NetworkId, type TokenSymbol } from "@/lib/tokens";
import packageJson from "../../package.json";

type ClaimResponse =
  | { status: "sent"; txHash: string; explorerUrl: string }
  | { status: "rejected"; reason: string }
  | { status: "failed"; reason: string };

const reasonText: Record<string, string> = {
  invalid_wallet: "钱包地址格式不正确",
  unsupported_network: "不支持的网络",
  unsupported_token: "不支持的币种",
  invalid_amount: "领取数量不正确",
  amount_too_large: "领取数量超过上限",
  already_claimed_today: "该钱包今天已经领取过这个网络的这个币种",
  insufficient_faucet_balance: "Faucet 钱包余额不足",
  invalid_request: "请求格式不正确",
  transfer_failed: "交易提交失败，请稍后再试"
};

const explorerText: Record<NetworkId, string> = {
  sepolia: "查看 Sepolia 交易",
  tron: "查看 TRON 交易"
};

export default function HomePage() {
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState<NetworkId>("sepolia");
  const [token, setToken] = useState<TokenSymbol>("USDT");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [result, setResult] = useState<ClaimResponse | undefined>();

  const supportedTokens = useMemo(() => getSupportedTokens(network), [network]);

  useEffect(() => {
    if (!supportedTokens.includes(token)) {
      setToken(supportedTokens[0]);
    }
  }, [supportedTokens, token]);

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedWallet = wallet.trim();

    if (!trimmedWallet) {
      setStatus("done");
      setResult({ status: "rejected", reason: "invalid_wallet" });
      return;
    }

    setStatus("submitting");
    setResult(undefined);

    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, wallet: trimmedWallet, token, amount: "10000" })
      });
      const data = (await response.json()) as ClaimResponse;
      setResult(data);
    } catch {
      setResult({ status: "failed", reason: "transfer_failed" });
    } finally {
      setStatus("done");
    }
  }

  return (
    <main className="shell">
      <section className="panel faucet-panel">
        <div className="header">
          <div className="title-row">
            <p className="eyebrow">Sepolia / TRON Shasta Faucet</p>
            <span className="app-version">v{packageJson.version}</span>
          </div>
          <h1>测试币接水</h1>
          <p className="muted">同一个钱包、同一个网络、同一个币种，每天最多领取一次，单次固定 10,000。</p>
        </div>

        <form className="form" onSubmit={submitClaim}>
          <fieldset className="option-group">
            <legend>选择网络</legend>
            {(Object.keys(NETWORKS) as NetworkId[]).map((networkId) => (
              <label key={networkId} className={network === networkId ? "option selected" : "option"}>
                <input
                  type="radio"
                  name="network"
                  value={networkId}
                  checked={network === networkId}
                  onChange={() => setNetwork(networkId)}
                />
                {NETWORKS[networkId].label}
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span>接收钱包地址</span>
            <input
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder={network === "tron" ? "T..." : "0x..."}
              autoComplete="off"
            />
          </label>

          <fieldset className="option-group">
            <legend>选择币种</legend>
            {supportedTokens.map((tokenSymbol) => (
              <label key={tokenSymbol} className={token === tokenSymbol ? "option selected" : "option"}>
                <input
                  type="radio"
                  name="token"
                  value={tokenSymbol}
                  checked={token === tokenSymbol}
                  onChange={() => setToken(tokenSymbol)}
                />
                {tokenSymbol}
              </label>
            ))}
          </fieldset>

          <div className="amount-row">
            <span>领取数量</span>
            <strong>10,000</strong>
          </div>

          <button className="claim-button" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "提交中" : "领取测试币"}
          </button>
        </form>

        {result && (
          <div className={result.status === "sent" ? "notice success" : "notice error"}>
            {result.status === "sent" ? (
              <>
                <strong>交易已发送</strong>
                <a href={result.explorerUrl} target="_blank" rel="noreferrer">
                  {explorerText[network]}
                </a>
              </>
            ) : (
              <strong>{reasonText[result.reason] ?? "请求失败，请稍后再试"}</strong>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **步骤 4：更新 option-group CSS**

在 `src/app/globals.css` 中，将 `.token-group`、`.token-option` 和相关媒体查询样式替换为：

```css
.option-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.option-group legend {
  grid-column: 1 / -1;
  margin-bottom: 8px;
  font-weight: 700;
}

.option {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #c9d1df;
  border-radius: 6px;
  padding: 12px 14px;
  cursor: pointer;
}

.option.selected {
  border-color: #3157a4;
  background: #eef4ff;
}
```

在现有移动端 media query 中，将 `.token-group` 替换为：

```css
  .option-group {
    grid-template-columns: 1fr;
  }
```

- [ ] **步骤 5：运行 UI 测试，确认通过**

运行：

```bash
npm test -- src/app/page.test.tsx
```

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/globals.css
git commit -m "feat: add network selection to faucet UI"
```

---

### 任务 7：配置、文档和完整验证

**文件：**
- 修改：`.env.example`
- 修改：`docker-compose.yml`
- 修改：`README.md`

**接口：**
- 消耗：`TRON_RPC_URL`
- 文档记录：`network + token` 维度的每日领取唯一性
- 文档记录：Shasta TRX gas 和 Shasta USDT 余额要求

- [ ] **步骤 1：更新 `.env.example`**

将 `.env.example` 替换为：

```bash
SEPOLIA_RPC_URL=https://sepolia.example
TRON_RPC_URL=https://api.shasta.trongrid.io
FAUCET_PRIVATE_KEY=0xreplace_with_server_side_private_key
DATABASE_URL=file:./data/faucet.sqlite
SEPOLIA_CHAIN_ID=11155111
MAX_CLAIM_AMOUNT=10000
CLAIM_DATE_TIMEZONE=UTC
```

- [ ] **步骤 2：更新 Docker Compose 环境变量**

在 `docker-compose.yml` 中，在 `SEPOLIA_RPC_URL` 下方加入 `TRON_RPC_URL`：

```yaml
      SEPOLIA_RPC_URL: ${SEPOLIA_RPC_URL}
      TRON_RPC_URL: ${TRON_RPC_URL}
      FAUCET_PRIVATE_KEY: ${FAUCET_PRIVATE_KEY}
```

- [ ] **步骤 3：更新 README**

将 README 内容替换为：

```markdown
# Sepolia / TRON Shasta Faucet

公司内部测试币 Faucet，支持 Sepolia USDT、Sepolia USDC 和 TRON Shasta USDT。

## 领取规则

- 用户先选择网络：`Sepolia` 或 `TRON Shasta`。
- 用户再选择该网络支持的币种。
- Sepolia 支持 `USDT` 和 `USDC`。
- TRON Shasta 支持 `USDT`。
- UI 和 API 使用 `USDT`，不使用 `TRON_USDT`。
- 系统通过 `network + token` 区分资产。
- 同一个钱包每天每个 `network + token` 只能领取一次。
- 每次固定发放 `10,000` 测试币。
- Faucet 转账使用后端钱包；浏览器永远不会拿到私钥。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

配置 `.env`：

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc
TRON_RPC_URL=https://api.shasta.trongrid.io
FAUCET_PRIVATE_KEY=0xyour_private_key
DATABASE_URL=file:./data/faucet.sqlite
```

打开：

```text
http://localhost:3000
```

## Docker 部署

在服务器创建 `.env`：

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc
TRON_RPC_URL=https://api.shasta.trongrid.io
FAUCET_PRIVATE_KEY=0xyour_private_key
```

启动：

```bash
docker compose up -d --build
```

SQLite 数据保存在宿主机：

```text
./data/faucet.sqlite
```

升级或重建容器时保留 `data` 目录。

## TRON Shasta 资金要求

由 `FAUCET_PRIVATE_KEY` 派生出的后端钱包需要：

- 用于支付手续费的 Shasta TRX。
- 合约 `TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu` 中的 Shasta USDT。

TRON 交易链接格式：

```text
https://shasta.tronscan.org/#/transaction/{txHash}
```

## 手动部署 / 更新

在服务器执行：

```bash
cd /home/ubuntu/faucet && ./deploy.sh
```

脚本会拉取 GitHub 最新代码、备份 SQLite 数据、重建 Docker，并检查：

```text
http://localhost:3000
```

如果脚本提示工作区有未提交改动，先运行：

```bash
git status
```

确认改动原因后再重新部署。

## 安全提醒

- 不要提交 `.env`。
- 不要把 `FAUCET_PRIVATE_KEY` 写进前端代码。
- 不要在日志或 API 错误中输出私钥。
- 不要向客户端返回原始 RPC、TronWeb 或 provider 错误。
- Faucet 钱包需要 Sepolia ETH 作为 gas，并持有 Sepolia USDT/USDC。
- Faucet 钱包需要 Shasta TRX 作为 gas，并持有 Shasta USDT。
```

- [ ] **步骤 4：运行完整自动化测试套件**

运行：

```bash
npm test
```

预期：通过。

- [ ] **步骤 5：运行生产构建**

运行：

```bash
npm run build
```

预期：通过。

- [ ] **步骤 6：手动验证 TRON 流程**

使用真实 Shasta 配置运行：

```bash
$env:TRON_RPC_URL="https://api.shasta.trongrid.io"
$env:FAUCET_PRIVATE_KEY="0xyour_private_key"
npm run dev
```

预期手动验证结果：

- 页面可在 `http://localhost:3000` 打开。
- 选择 `TRON Shasta` 后，钱包 placeholder 变为 `T...`。
- 币种选项下只显示 `USDT`。
- 提交合法 TRON 收款地址时，发送 `{ network: "tron", token: "USDT", wallet, amount: "10000" }`。
- API 返回 `status: "sent"`、交易 hash 和 Shasta Tronscan 链接。
- 同一天重复领取同一个 `wallet + tron + USDT` 时返回 `already_claimed_today`。
- `wallet + sepolia + USDT` 与 `wallet + tron + USDT` 仍然互相独立。

- [ ] **步骤 7：提交**

```bash
git add .env.example docker-compose.yml README.md
git commit -m "docs: document tron shasta faucet support"
```

---

## 自检

**规格覆盖：** 本计划覆盖网络感知的领域配置、必填 `network` API 输入、TRON Shasta USDT 配置、Sepolia 行为保留、网络特定钱包校验、adapter 选择、TRON adapter 行为、SQLite 迁移、公开错误处理、UI 选择/重置行为、文档、Docker 配置和手动验证。

**占位符扫描：** 本计划不包含延后实现标记。每个涉及代码改动的步骤都写明了具体文件，并提供了完整代码或精确替换片段。

**类型一致性：** `NetworkId`、`TokenSymbol`、`TokenConfig`、`ClaimInput`、`ValidClaimInput`、`CreateClaimInput`、`ClaimRecord`、`ClaimsRepository` 和 `ClaimService` 的签名在各任务之间保持一致。

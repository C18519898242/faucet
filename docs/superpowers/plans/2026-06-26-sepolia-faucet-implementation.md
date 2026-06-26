# Sepolia Faucet 实施计划

> **给执行 agent 的要求：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。每个步骤使用 checkbox（`- [ ]`）跟踪进度。

**目标：** 实现一个轻量级、可 Docker 部署的 Sepolia 测试币 Faucet，公司用户可以按钱包地址领取测试 USDT 或 USDC，每个钱包每个币种每天最多领取一次。

**架构：** 使用一个 Next.js 项目同时承载前端页面和后端 API。业务逻辑放在 `src/lib`，领取记录保存到 SQLite 文件，链上交互通过 `ChainAdapter` 抽象隔离，后续支持 Tron 时新增 adapter 即可。

**技术栈：** Node.js、Next.js App Router、TypeScript、Vitest、React Testing Library、SQLite（`better-sqlite3`）、`ethers`、Docker、docker compose。

## 全局约束

- 第一版只支持 Ethereum Sepolia。
- USDT 合约：`0xe980e37De697598E0999D09B563e528be6E67316`。
- USDC 合约：`0xED2188e40ee30192231209C0e527B22a41d0BdEa`。
- 用户每次只能选择一个币种。
- 单次领取上限是 `10000`。
- 默认领取数量是 `10000`。
- 每日限额维度是 `(wallet, token, claim_date)`，所以同一个钱包同一天可以领一次 USDT，也可以领一次 USDC。
- Faucet 通过 ERC20 `transfer` 发币，不做 mint。
- `FAUCET_PRIVATE_KEY` 只能存在服务端环境变量里，不能进入前端代码、日志或接口返回。
- Docker 部署时 SQLite 持久化路径是 `/app/data/faucet.sqlite`。
- Docker 部署必须把宿主机目录挂载到容器 `/app/data`。
- 不需要 Kubernetes，不需要单独数据库服务，不要求复杂 CI/CD。
- 当前工作区可能存在无效 `.git` 目录。实施前先运行 `git status`；如果失败，可以 `git init`，或者先跳过 commit 步骤。

---

## 文件结构

- `package.json`：脚本和依赖。
- `next.config.ts`：Next.js 配置，启用 standalone 输出方便 Docker 部署。
- `tsconfig.json`：TypeScript 配置。
- `vitest.config.ts`：单元测试配置。
- `vitest.setup.ts`：DOM 测试 setup。
- `src/app/layout.tsx`：根布局。
- `src/app/page.tsx`：Faucet 前端页面。
- `src/app/api/claim/route.ts`：领取 API。
- `src/app/globals.css`：页面样式。
- `src/lib/tokens.ts`：USDT / USDC 白名单配置。
- `src/lib/validation.ts`：钱包地址、币种、数量校验。
- `src/lib/date.ts`：服务端领取日期工具。
- `src/lib/db.ts`：SQLite 连接和建表迁移。
- `src/lib/claims-repository.ts`：领取记录存储接口和 SQLite 实现。
- `src/lib/chain-adapter.ts`：链适配器接口。
- `src/lib/sepolia-evm-adapter.ts`：Sepolia ERC20 转账实现。
- `src/lib/claim-service.ts`：领取业务编排。
- `src/lib/api-errors.ts`：API 状态码映射。
- `src/test/fakes.ts`：测试用假仓储和假链适配器。
- `.env.example`：安全的环境变量示例。
- `.gitignore`：忽略依赖、构建产物、env 和 SQLite 数据。
- `Dockerfile`：生产镜像。
- `docker-compose.yml`：单容器部署，挂载 SQLite 数据目录。
- `README.md`：本地运行和 Docker 部署说明。

---

### 任务 1：项目脚手架和测试环境

**文件：**
- 新建：`package.json`
- 新建：`next.config.ts`
- 新建：`tsconfig.json`
- 新建：`vitest.config.ts`
- 新建：`vitest.setup.ts`
- 新建：`src/app/layout.tsx`
- 新建：`src/app/page.tsx`
- 新建：`src/app/globals.css`
- 新建：`public/.gitkeep`
- 新建：`.gitignore`
- 新建：`.env.example`

**产出接口：**
- 提供 `npm run test`、`npm run build`。
- 提供一个可构建的初始页面。

- [ ] **步骤 1：确认 git 状态**

运行：

```bash
git status --short
```

期望：如果仓库有效则成功。如果失败并提示 `fatal: not a git repository`，运行：

```bash
git init
```

- [ ] **步骤 2：创建项目配置**

创建 `package.json`：

```json
{
  "name": "sepolia-faucet",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "better-sqlite3": "latest",
    "ethers": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

创建 `next.config.ts`：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone"
};

export default nextConfig;
```

创建 `tsconfig.json`、`vitest.config.ts`、`vitest.setup.ts`，配置 TypeScript strict、路径别名 `@/*` 和 jsdom 测试环境。

- [ ] **步骤 3：创建初始页面**

创建 `src/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sepolia Faucet",
  description: "Internal test token faucet for Sepolia USDT and USDC"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

创建 `src/app/page.tsx`：

```tsx
export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Sepolia Faucet</p>
        <h1>测试币接水</h1>
        <p className="muted">USDT / USDC，每个钱包每个币种每天可领取一次。</p>
      </section>
    </main>
  );
}
```

创建 `public/.gitkeep`，保证 Docker 构建时 `public` 目录存在。

- [ ] **步骤 4：安装依赖并验证**

运行：

```bash
npm install
npm run test
npm run build
```

期望：依赖安装成功，测试命令和构建命令可运行。

- [ ] **步骤 5：提交**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json vitest.config.ts vitest.setup.ts src/app public/.gitkeep .gitignore .env.example
git commit -m "chore: scaffold faucet app"
```

---

### 任务 2：代币配置和请求校验

**文件：**
- 新建：`src/lib/tokens.ts`
- 新建：`src/lib/validation.ts`
- 新建：`src/lib/date.ts`
- 新建：`src/lib/validation.test.ts`
- 新建：`src/lib/date.test.ts`

**产出接口：**
- `TokenSymbol`
- `TOKENS`
- `MAX_CLAIM_AMOUNT`
- `validateClaimInput(input)`
- `getClaimDate(now)`

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- 合法 USDT 请求通过。
- 非法钱包地址拒绝，reason 是 `invalid_wallet`。
- 不支持的币种拒绝，reason 是 `unsupported_token`。
- 数量超过 `10000` 拒绝，reason 是 `amount_too_large`。
- `0` 和负数拒绝，reason 是 `invalid_amount`。
- UTC 日期输出 `YYYY-MM-DD`。

运行：

```bash
npm run test -- src/lib/validation.test.ts src/lib/date.test.ts
```

期望：失败，因为实现文件还不存在。

- [ ] **步骤 2：实现代币配置**

`src/lib/tokens.ts` 定义：

```ts
export type TokenSymbol = "USDT" | "USDC";
export const SEPOLIA_CHAIN_ID = 11155111;
export const MAX_CLAIM_AMOUNT = "10000";

export const TOKENS = {
  USDT: {
    symbol: "USDT",
    address: "0xe980e37De697598E0999D09B563e528be6E67316",
    decimals: 18,
    chainId: SEPOLIA_CHAIN_ID,
    maxClaimAmount: MAX_CLAIM_AMOUNT
  },
  USDC: {
    symbol: "USDC",
    address: "0xED2188e40ee30192231209C0e527B22a41d0BdEa",
    decimals: 18,
    chainId: SEPOLIA_CHAIN_ID,
    maxClaimAmount: MAX_CLAIM_AMOUNT
  }
} as const;
```

说明：这里先按 `18` decimals 实现；实施时如果测试币合约实际 decimals 不同，需要读取链上或调整配置。

- [ ] **步骤 3：实现请求校验和日期工具**

`validateClaimInput` 使用 `ethers.getAddress` 标准化地址，币种只能是 `USDT | USDC`，数量必须大于 `0` 且不超过 `10000`。

`getClaimDate` 使用 UTC：

```ts
export function getClaimDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
```

- [ ] **步骤 4：验证并提交**

```bash
npm run test -- src/lib/validation.test.ts src/lib/date.test.ts
git add src/lib/tokens.ts src/lib/validation.ts src/lib/date.ts src/lib/validation.test.ts src/lib/date.test.ts
git commit -m "feat: add faucet validation"
```

---

### 任务 3：SQLite 领取记录仓储

**文件：**
- 新建：`src/lib/db.ts`
- 新建：`src/lib/claims-repository.ts`
- 新建：`src/lib/claims-repository.test.ts`

**产出接口：**
- `ClaimStatus`
- `ClaimRecord`
- `ClaimsRepository`
- `SqliteClaimsRepository`
- `openDatabase(path)`
- `migrateDatabase(db)`

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- 可以创建 `pending` 领取记录，并标记为 `sent`。
- `(wallet, token, claim_date)` 唯一约束生效。
- 同钱包同一天可以领取另一个币种。
- `failed` 记录不再被 `findActiveClaim` 视为活跃领取。

运行：

```bash
npm run test -- src/lib/claims-repository.test.ts
```

期望：失败，因为仓储还不存在。

- [ ] **步骤 2：实现数据库迁移**

`claims` 表字段：

```sql
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
```

同时创建索引：

```sql
CREATE INDEX IF NOT EXISTS idx_claims_wallet_token_date
ON claims(wallet, token, claim_date);
```

- [ ] **步骤 3：实现仓储**

`ClaimsRepository` 必须包含：

```ts
findActiveClaim(wallet, token, claimDate)
createPendingClaim(input)
markSent(id, txHash)
markFailed(id, message)
```

`findActiveClaim` 只查询 `pending` 和 `sent`，不把 `failed` 算作当天已领取。

- [ ] **步骤 4：验证并提交**

```bash
npm run test -- src/lib/claims-repository.test.ts
git add src/lib/db.ts src/lib/claims-repository.ts src/lib/claims-repository.test.ts
git commit -m "feat: persist faucet claims in sqlite"
```

---

### 任务 4：Sepolia EVM 转账适配器

**文件：**
- 新建：`src/lib/chain-adapter.ts`
- 新建：`src/lib/sepolia-evm-adapter.ts`
- 新建：`src/lib/sepolia-evm-adapter.test.ts`

**产出接口：**
- `ChainAdapter`
- `SepoliaEvmAdapter`
- `createSepoliaEvmAdapterFromEnv()`

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- `getExplorerTxUrl("0x123")` 返回 `https://sepolia.etherscan.io/tx/0x123`。
- `transferToken` 会把 `10000` 转成 base units，并调用 ERC20 `transfer(to, amount)`。

运行：

```bash
npm run test -- src/lib/sepolia-evm-adapter.test.ts
```

期望：失败，因为 adapter 文件还不存在。

- [ ] **步骤 2：定义通用链适配器接口**

```ts
export interface ChainAdapter {
  validateAddress(address: string): boolean;
  getTokenBalance(token: TokenConfig): Promise<bigint>;
  transferToken(token: TokenConfig, to: string, amount: string): Promise<string>;
  getExplorerTxUrl(txHash: string): string;
}
```

- [ ] **步骤 3：实现 Sepolia EVM adapter**

使用 `ethers`：

- `JsonRpcProvider(process.env.SEPOLIA_RPC_URL)`
- `Wallet(process.env.FAUCET_PRIVATE_KEY, provider)`
- ERC20 ABI：

```ts
[
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
]
```

`transferToken` 只需要提交交易并返回 `tx.hash`；第一版不等待最终确认。

- [ ] **步骤 4：验证并提交**

```bash
npm run test -- src/lib/sepolia-evm-adapter.test.ts
git add src/lib/chain-adapter.ts src/lib/sepolia-evm-adapter.ts src/lib/sepolia-evm-adapter.test.ts
git commit -m "feat: add sepolia evm adapter"
```

---

### 任务 5：领取业务服务

**文件：**
- 新建：`src/test/fakes.ts`
- 新建：`src/lib/claim-service.ts`
- 新建：`src/lib/claim-service.test.ts`
- 新建：`src/lib/api-errors.ts`

**产出接口：**
- `ClaimService`
- `ClaimService.claim(input)`
- `ClaimResult`
- `statusCodeForClaimResult(result)`

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- 合法领取会发起转账并保存 tx hash。
- 同钱包同币种同一天第二次领取返回 `already_claimed_today`。
- 同钱包同一天领取另一个币种允许成功。
- Faucet 余额不足返回 `insufficient_faucet_balance`。
- 转账提交失败时记录标记为 `failed`，接口返回 `transfer_failed`。

运行：

```bash
npm run test -- src/lib/claim-service.test.ts
```

期望：失败，因为服务还不存在。

- [ ] **步骤 2：实现业务流程**

`ClaimService.claim` 顺序：

1. 调用 `validateClaimInput`。
2. 计算 UTC `claimDate`。
3. 用 `(wallet, token, claimDate)` 查询活跃领取记录。
4. 查询 Faucet 钱包对应 token 余额。
5. 插入 `pending` 记录。
6. 调用 `chain.transferToken`。
7. 成功则 `markSent` 并返回 tx hash 和 explorer URL。
8. 失败则 `markFailed(id, "transfer_failed")`，不返回原始错误，避免泄漏敏感信息。

- [ ] **步骤 3：实现 API 状态码映射**

状态码规则：

- 成功：`200`
- 参数错误：`400`
- 今日已领取同币种：`409`
- Faucet 余额不足：`503`
- 链上提交失败：`502`

- [ ] **步骤 4：验证并提交**

```bash
npm run test -- src/lib/claim-service.test.ts
git add src/test/fakes.ts src/lib/claim-service.ts src/lib/claim-service.test.ts src/lib/api-errors.ts
git commit -m "feat: orchestrate faucet claims"
```

---

### 任务 6：领取 API

**文件：**
- 新建：`src/app/api/claim/route.ts`
- 新建：`src/app/api/claim/route.test.ts`

**产出接口：**
- `POST /api/claim`

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- 正常请求返回：

```json
{
  "status": "sent",
  "txHash": "0xtx",
  "explorerUrl": "https://sepolia.etherscan.io/tx/0xtx"
}
```

- 非法 JSON 返回：

```json
{
  "status": "rejected",
  "reason": "invalid_request"
}
```

运行：

```bash
npm run test -- src/app/api/claim/route.test.ts
```

期望：失败，因为 route 文件还不存在。

- [ ] **步骤 2：实现 API route**

`src/app/api/claim/route.ts` 必须：

- 设置 `runtime = "nodejs"`。
- 设置 `dynamic = "force-dynamic"`。
- 解析 JSON 失败时返回 `400`。
- 创建 SQLite repository。
- 创建 Sepolia adapter。
- 调用 `ClaimService.claim`。
- 用 `statusCodeForClaimResult` 返回对应 HTTP 状态码。

- [ ] **步骤 3：验证并提交**

```bash
npm run test -- src/app/api/claim/route.test.ts
git add src/app/api/claim/route.ts src/app/api/claim/route.test.ts
git commit -m "feat: add claim api route"
```

---

### 任务 7：Faucet 前端页面

**文件：**
- 修改：`src/app/page.tsx`
- 修改：`src/app/globals.css`
- 新建：`src/app/page.test.tsx`

**产出接口：**
- 页面提交 `{ wallet, token, amount }` 到 `/api/claim`。
- 页面展示成功、已领取、余额不足、失败等状态。

- [ ] **步骤 1：先写失败测试**

测试必须覆盖：

- 输入钱包地址后，默认提交 USDT 和 `10000`。
- 可以切换到 USDC。
- 成功后显示“交易已发送”和 Sepolia explorer 链接。
- 今日同币种已领取时显示“该钱包今天已经领取过这个币种”。

运行：

```bash
npm run test -- src/app/page.test.tsx
```

期望：失败，因为初始页面没有表单。

- [ ] **步骤 2：实现页面**

页面包含：

- 钱包地址输入框，label 是 `接收钱包地址`。
- USDT / USDC radio 选择。
- 固定领取数量 `10,000`。
- 按钮文案 `领取测试币`。
- 提交中显示 `提交中`。
- 成功显示 `交易已发送` 和 `查看 Sepolia 交易`。
- 错误 reason 映射成中文提示。

请求体固定为：

```ts
{
  wallet,
  token,
  amount: "10000"
}
```

- [ ] **步骤 3：实现样式**

样式要求：

- 首屏就是工具本身，不做营销页。
- 白色面板、清晰表单、8px 以下圆角。
- 移动端不重叠、不溢出。
- 不使用花哨背景或大面积渐变。

- [ ] **步骤 4：验证并提交**

```bash
npm run test -- src/app/page.test.tsx
npm run test
npm run build
git add src/app/page.tsx src/app/globals.css src/app/page.test.tsx
git commit -m "feat: build faucet page"
```

---

### 任务 8：Docker 部署和使用文档

**文件：**
- 新建：`Dockerfile`
- 新建：`docker-compose.yml`
- 新建：`README.md`
- 修改：`.env.example`

**产出接口：**
- 支持 `docker compose up -d --build`。
- SQLite 通过宿主机 `./data` 挂载到容器 `/app/data`。

- [ ] **步骤 1：创建 Dockerfile**

使用三阶段构建：

1. `deps`：安装依赖。
2. `builder`：执行 `npm run build`。
3. `runner`：复制 `.next/standalone`、`.next/static`、`public`，以非 root 用户运行。

最终容器：

- 工作目录 `/app`
- 暴露端口 `3000`
- 数据目录 `/app/data`
- 启动命令 `node server.js`

- [ ] **步骤 2：创建 docker-compose.yml**

核心配置：

```yaml
services:
  faucet:
    build: .
    container_name: sepolia-faucet
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      SEPOLIA_RPC_URL: ${SEPOLIA_RPC_URL}
      FAUCET_PRIVATE_KEY: ${FAUCET_PRIVATE_KEY}
      DATABASE_URL: file:/app/data/faucet.sqlite
      SEPOLIA_CHAIN_ID: "11155111"
      MAX_CLAIM_AMOUNT: "10000"
      CLAIM_DATE_TIMEZONE: UTC
    volumes:
      - ./data:/app/data
```

- [ ] **步骤 3：补充 README**

README 必须包含：

- 项目用途。
- 领取规则。
- 本地运行：

```bash
npm install
cp .env.example .env
npm run dev
```

- Docker 部署：

```bash
docker compose up -d --build
```

- SQLite 文件位置：

```text
./data/faucet.sqlite
```

- 安全提醒：
  - 不要提交 `.env`。
  - 不要把 `FAUCET_PRIVATE_KEY` 暴露到前端。
  - Faucet 钱包需要有 Sepolia ETH 付 gas，也需要有测试 USDT / USDC。

- [ ] **步骤 4：验证并提交**

```bash
docker compose build
npm run test
npm run build
git add Dockerfile docker-compose.yml README.md .env.example
git commit -m "chore: add docker deployment"
```

---

## 最终验收

- [ ] 全量测试：

```bash
npm run test
```

期望：全部通过。

- [ ] 生产构建：

```bash
npm run build
```

期望：构建成功。

- [ ] Docker 构建：

```bash
docker compose build
```

期望：镜像构建成功。

- [ ] Docker 本地启动：

```bash
docker compose up -d
```

期望：服务监听 `http://localhost:3000`。

- [ ] Sepolia 手动冒烟测试：

```text
1. Faucet 钱包准备 Sepolia ETH。
2. Faucet 钱包准备测试 USDT 和 USDC。
3. 打开 http://localhost:3000。
4. 用有效 Sepolia 钱包领取 USDT。
5. 确认页面展示 Sepolia Etherscan 链接。
6. 同钱包再次领取 USDT，确认被拒绝。
7. 同钱包领取 USDC，确认允许。
```


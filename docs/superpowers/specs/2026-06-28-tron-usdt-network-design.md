# TRON USDT 网络选择设计文档

## 目标

在现有 Faucet 中加入 TRON Shasta 网络的 USDT 支持，同时前端仍然把币种显示为 `USDT`。用户先选择网络，再选择该网络支持的币种。

## 已确认需求

- 支持 TRON Shasta 网络的 USDT。
- TRON USDT 合约地址使用 `TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu`。
- TRON RPC 使用 `TRON_RPC_URL=https://api.shasta.trongrid.io`。
- TRON 转账复用现有 `FAUCET_PRIVATE_KEY`。
- 界面和 API 中不使用 `TRON_USDT` 这种内部币种名。
- 币种仍然使用 `USDT`，通过 `network + token` 区分不同网络上的资产。
- 保留现有 Sepolia USDT 和 Sepolia USDC 行为。

## 当前项目情况

当前项目是一个 Next.js Faucet，关键模块如下：

- `src/app/page.tsx` 渲染钱包地址输入框、币种单选项，并向 `/api/claim` 提交 `wallet`、`token`、`amount`。
- `src/app/api/claim/route.ts` 创建一个 `SepoliaEvmAdapter`，并传给 `ClaimService`。
- `src/lib/claim-service.ts` 负责校验输入、检查每日领取记录、检查 Faucet 钱包余额、提交转账并返回浏览器链接。
- `src/lib/tokens.ts` 当前把 `TokenSymbol` 定义为 `USDT | USDC`，并且只按币种保存 Sepolia 代币配置。
- `src/lib/validation.ts` 当前所有钱包地址都用 `ethers.getAddress` 当作 Ethereum 地址校验。
- `src/lib/claims-repository.ts` 和 `src/lib/db.ts` 当前按 `(wallet, token, claim_date)` 做唯一领取限制。
- `src/lib/sepolia-evm-adapter.ts` 使用 `ethers` 处理 ERC20 余额查询和转账。

现有 `ChainAdapter` 边界适合扩展 TRON，但在选择 adapter 之前，系统需要先引入“网络”维度。

## 推荐方案

在产品、API、服务层、数据库中都显式引入 `network + token` 模型。

### 推荐原因

- 符合你提出的交互：先选网络，再显示该网络支持的币种。
- 避免 `USDT` 语义混乱；Sepolia USDT 和 TRON USDT 是两个不同网络上的资产。
- 每日领取限制更准确；同一个钱包同一天可以分别领取 Sepolia USDT 和 TRON USDT。
- 不需要在界面、API 或数据库中伪造 `TRON_USDT` 这种币种名。
- 后续加网络或加币种时，只需要扩展配置和 adapter。

## 备选方案

### 方案一：内部使用 `TRON_USDT`

前端把“TRON USDT”映射成 `TRON_USDT` 再提交给后端。这个方案实现简单，但会让币种名承担网络信息，数据库记录也不够直观。因为你明确不希望使用 `TRON_USDT`，所以不采用。

### 方案二：把现有 `USDT` 改成 TRON USDT

这个方案能保持旧 API 结构不变，但会破坏现有 Sepolia USDT 的含义、浏览器链接、地址校验和领取历史。因此不采用。

### 方案三：API 和数据库都显式区分网络

这是推荐方案。API 接收 `network: "sepolia" | "tron"` 和 `token: "USDT" | "USDC"`，服务端根据这个组合找到具体资产配置和对应链 adapter。

## 用户体验

Faucet 页面显示两组选择：

1. 网络
   - `Sepolia`
   - `TRON Shasta`
2. 币种
   - 选择 `Sepolia` 时显示 `USDT`、`USDC`
   - 选择 `TRON Shasta` 时只显示 `USDT`

切换网络时，如果当前币种在新网络不支持，需要自动重置成新网络支持的默认币种。例如用户当前选择 `Sepolia + USDC`，切换到 `TRON Shasta` 后，币种自动变成 `USDT`。

钱包地址输入框的 placeholder 随网络变化：

- Sepolia：`0x...`
- TRON Shasta：`T...`

交易成功后的浏览器链接文案随网络变化：

- Sepolia：`查看 Sepolia 交易`
- TRON Shasta：`查看 TRON 交易`

页面说明文案需要改成：同一个钱包、同一个网络、同一个币种，每天最多领取一次。

## API 设计

`POST /api/claim` 接收：

```json
{
  "network": "tron",
  "wallet": "T...",
  "token": "USDT",
  "amount": "10000"
}
```

Sepolia 请求改为：

```json
{
  "network": "sepolia",
  "wallet": "0x...",
  "token": "USDT",
  "amount": "10000"
}
```

`network` 是必填字段。缺少 `network` 的请求不自动默认为 Sepolia，而是返回 `unsupported_network`。

响应结构保持不变：

```json
{
  "status": "sent",
  "txHash": "...",
  "explorerUrl": "https://..."
}
```

尽量保持现有错误原因不变：

- `invalid_wallet`
- `unsupported_token`
- `invalid_amount`
- `amount_too_large`
- `already_claimed_today`
- `insufficient_faucet_balance`
- `transfer_failed`

新增一个错误原因：

- `unsupported_network`

## 领域模型

在 `src/lib/tokens.ts` 或相邻配置文件中引入网络感知类型：

```ts
export type NetworkId = "sepolia" | "tron";
export type TokenSymbol = "USDT" | "USDC";

export type TokenConfig = {
  network: NetworkId;
  symbol: TokenSymbol;
  address: string;
  decimals: number;
  maxClaimAmount: string;
};
```

推荐配置结构：

```ts
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
        maxClaimAmount: "10000"
      },
      USDC: {
        network: "sepolia",
        symbol: "USDC",
        address: "0xED2188e40ee30192231209C0e527B22a41d0BdEa",
        decimals: 6,
        maxClaimAmount: "10000"
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
        maxClaimAmount: "10000"
      }
    }
  }
} as const;
```

`TokenConfig.address` 需要从 `0x${string}` 改成 `string`，因为 TRON 地址不是 EVM 十六进制地址。

## 输入校验

校验顺序：

1. 校验 `network` 是否支持。
2. 校验 `token` 是否被该网络支持。
3. 按所选网络校验 `wallet`。
4. 校验 `amount` 是否为数字、是否大于 0、是否不超过当前资产的 `maxClaimAmount`。

钱包地址校验按网络区分：

- Sepolia 使用 `ethers.getAddress`，返回 checksum 后的 EVM 地址。
- TRON 使用 TRON adapter 或独立 TRON 地址校验函数，返回 base58 TRON 地址。

不能用 `ethers.getAddress` 校验 TRON 地址，也不能用 TRON 地址校验逻辑校验 EVM 地址。

## 链 Adapter 选择

后端根据校验后的网络选择 adapter。

推荐服务结构：

```ts
type ChainAdaptersByNetwork = Record<NetworkId, ChainAdapter>;

new ClaimService(claims, {
  sepolia: createSepoliaEvmAdapterFromEnv(),
  tron: createTronAdapterFromEnv()
});
```

`ClaimService.claim` 流程：

1. 校验请求，得到 `{ network, wallet, token, amount }`。
2. 通过 `network + token` 找到 `TokenConfig`。
3. 通过 `network` 选择 `ChainAdapter`。
4. 按 `wallet + network + token + claimDate` 检查当天是否已领取。
5. 检查 Faucet 钱包在该资产上的余额。
6. 创建带 `network` 的 pending 领取记录。
7. 通过所选 adapter 提交转账。
8. 根据结果标记 sent 或 failed。

## TRON Adapter

新增 `src/lib/tron-adapter.ts`，实现现有 `ChainAdapter` 接口。

TRON adapter 使用标准 `tronweb` 包，从以下环境变量初始化：

- `TRON_RPC_URL`
- `FAUCET_PRIVATE_KEY`

私钥和 Sepolia 使用同一个环境变量，但 adapter 初始化时需要根据 TronWeb 的要求安全地标准化格式，例如去掉 `0x` 前缀。

必须支持的行为：

- `validateAddress(address)` 对合法 TRON base58 地址返回 true，例如 `T...`。
- `getTokenBalance(token)` 调用 TRC20 `balanceOf(faucetAddress)`。
- `transferToken(token, to, amount)` 按 token decimals 把人类可读数量转成最小单位，再调用 TRC20 `transfer(to, amountInBaseUnits)`。
- `getExplorerTxUrl(txHash)` 返回 Shasta 浏览器链接。

推荐 Shasta 浏览器链接：

```ts
`https://shasta.tronscan.org/#/transaction/${txHash}`
```

adapter 不能把可能包含敏感信息的原始 provider 错误记录到公开响应中。

## 数据库设计

给 `claims` 表新增 `network` 字段。

新的逻辑唯一约束：

```text
wallet + network + token + claim_date
```

已有记录迁移为 `network = 'sepolia'`，因为这些记录都是加入 TRON 支持之前产生的 Sepolia 领取记录。

迁移后的 `claims` 字段：

- `id`
- `wallet`
- `network`
- `token`
- `amount`
- `claim_date`
- `status`
- `tx_hash`
- `error_message`
- `created_at`
- `updated_at`

SQLite 迁移需要处理旧的 `(wallet, token, claim_date)` 唯一约束。推荐迁移方式：

1. 检查现有 `claims` 表是否已经有 `network` 字段。
2. 如果没有，创建 `claims_new`，使用新 schema 和新唯一约束。
3. 把旧 `claims` 数据复制到 `claims_new`，并写入 `network = 'sepolia'`。
4. 删除旧 `claims` 表。
5. 把 `claims_new` 重命名为 `claims`。
6. 创建新的 `(wallet, network, token, claim_date)` 索引。

这样既保留历史记录，也允许同一个钱包同一天分别领取 `sepolia + USDT` 和 `tron + USDT`。

## 配置

更新 `.env.example`、README、Docker 和部署文档，加入：

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc
TRON_RPC_URL=https://api.shasta.trongrid.io
FAUCET_PRIVATE_KEY=0xyour_private_key
DATABASE_URL=file:./data/faucet.sqlite
```

`TRON_RPC_URL` 是 TRON 网络领取所需配置。推荐使用懒加载 adapter：只有请求选择 `network: "tron"` 时才创建 TRON adapter。

推荐懒加载原因：

- 如果 TRON 配置临时缺失，不影响 Sepolia 领取。
- 配置错误只影响用户选择的网络。
- API route 不需要在每次请求开始时强制初始化所有网络。

如果 TRON 请求缺少 `TRON_RPC_URL`，公开响应使用通用失败：

```json
{
  "status": "failed",
  "reason": "transfer_failed"
}
```

## 错误处理

公开 API 错误必须脱敏。服务端不能返回：

- 私钥。
- 完整原始 RPC 错误内容。
- 内部 stack trace。
- 可能包含敏感信息的合约调用参数。

缺少 TRON 配置时，对用户返回现有通用失败：

```json
{
  "status": "failed",
  "reason": "transfer_failed"
}
```

网络或币种不支持时返回 rejected：

```json
{
  "status": "rejected",
  "reason": "unsupported_network"
}
```

或：

```json
{
  "status": "rejected",
  "reason": "unsupported_token"
}
```

## 测试计划

实现阶段应按测试优先方式进行。

### 单元测试

新增或更新以下测试：

- `validateClaimInput` 接受 `network: "tron"`、`token: "USDT"` 和合法 TRON 地址。
- `validateClaimInput` 拒绝 TRON 请求中的 EVM `0x...` 地址。
- `validateClaimInput` 拒绝 Sepolia 请求中的 TRON `T...` 地址。
- `validateClaimInput` 拒绝不支持的 network。
- `validateClaimInput` 拒绝 `network: "tron"` 搭配 `token: "USDC"`。
- `ClaimService` 对 `network: "tron"` 选择 TRON adapter。
- `ClaimService` 允许同一个钱包同一天分别领取 Sepolia USDT 和 TRON USDT。
- `SqliteClaimsRepository` 按 `(wallet, network, token, claim_date)` 做唯一约束。
- `SqliteClaimsRepository` 迁移旧数据时把旧记录补成 `sepolia`。
- `TronAdapter` 校验 TRON 地址格式，并生成 Shasta 浏览器链接。

### Route 测试

更新 API route 测试：

- 请求体包含 `network`。
- route 在 JSON 解析后把 body 传给 `ClaimService`。
- malformed JSON 继续返回 `invalid_request`。

### UI 测试

更新页面测试：

- 页面显示网络选择。
- 选择 Sepolia 时显示 `USDT` 和 `USDC`。
- 选择 TRON Shasta 时只显示 `USDT`，隐藏或禁用 `USDC`。
- 从 `Sepolia + USDC` 切换到 `TRON Shasta` 后，token 自动重置为 `USDT`。
- 提交 TRON 领取时发送 `{ network: "tron", token: "USDT", wallet, amount: "10000" }`。

### 手动验证

实现和自动化测试完成后手动验证：

1. 配置 `TRON_RPC_URL=https://api.shasta.trongrid.io` 和 `FAUCET_PRIVATE_KEY`。
2. 确认 Faucet 钱包有 Shasta TRX 作为手续费，并持有合约 `TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu` 的 Shasta USDT。
3. 本地启动应用。
4. 选择 `TRON Shasta` 和 `USDT`。
5. 输入合法 TRON 收款地址并提交。
6. 确认 API 返回交易 hash 和 Shasta Tronscan 链接。
7. 确认同一个钱包同一天不能重复领取 `TRON Shasta + USDT`。
8. 确认同一个钱包同一天仍然可以独立领取 `Sepolia + USDT`。

## 安全说明

- `FAUCET_PRIVATE_KEY` 只允许在服务端使用。
- 不要在浏览器中暴露 Faucet 账户细节。
- 不接受客户端传入的合约地址。
- 不把原始 TRON RPC 或 TronWeb 错误返回给客户端。
- 转账失败的记录标记为 `failed`，允许用户在临时故障恢复后重试。
- `pending` 和 `sent` 都算作当天已领取，避免网络确认慢时重复发币。

## 实现阶段预计改动文件

- `package.json` 和 `package-lock.json`：加入 `tronweb`。
- `src/lib/tokens.ts`：改成网络感知的资产配置。
- `src/lib/validation.ts`：加入网络校验和网络特定地址校验。
- `src/lib/chain-adapter.ts`：保持现有接口稳定。
- `src/lib/sepolia-evm-adapter.ts`：适配 `TokenConfig.address` 从 EVM-only 类型变成 `string`。
- `src/lib/tron-adapter.ts`：新增 TRON/TRC20 实现。
- `src/lib/claim-service.ts`：按 network 选择 adapter，并把 network 写入领取记录。
- `src/lib/claims-repository.ts`：记录、查询和创建领取记录时加入 network。
- `src/lib/db.ts`：增加 network 字段迁移和新唯一约束。
- `src/test/fakes.ts`：支持网络感知 repository 和多个 fake adapter。
- `src/app/api/claim/route.ts`：按请求网络初始化或选择 adapter。
- `src/app/page.tsx`：加入网络选择和按网络过滤币种。
- `src/app/globals.css`：为新增选择组补充样式。
- `.env.example`：记录 `TRON_RPC_URL`。
- `README.md`：记录网络选择、TRON 配置和领取限制。

## 需要你 Review 的决策

推荐实现决策如下：

1. API 使用 `network: "tron"`，界面显示 `TRON Shasta`。
2. 使用懒加载 adapter，避免 TRON 配置缺失影响 Sepolia。
3. Shasta 交易浏览器链接使用 `https://shasta.tronscan.org/#/transaction/{txHash}`。
4. 所有支持资产的固定领取数量仍为 `10000`。
5. Sepolia 和 TRON 共用一个 `FAUCET_PRIVATE_KEY`，在不同 adapter 中按库要求标准化私钥格式。

请先 review 这些设计决策，确认后再进入 implementation plan 阶段。


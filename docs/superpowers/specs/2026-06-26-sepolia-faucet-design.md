# Sepolia 测试币 Faucet 设计文档

## 目标

为公司用户提供一个轻量的内部接水页面，用于领取 Ethereum Sepolia 上的测试 USDT 或 USDC。Faucet 使用一个配置好的资金钱包，通过 ERC20 `transfer` 发币，不依赖 mint 权限。

## 范围

第一版只支持 Ethereum Sepolia。架构上需要把链相关的转账逻辑封装在小的适配层里，方便后续支持 Tron 时复用同一套产品流程。

第一版不包含：

- 公司账号登录。
- 钱包签名验证。
- 多链 UI。
- mint 发币。
- 管理后台。

## 技术栈

第一版优先选择部署简单、依赖少、容易排查问题的技术栈：

- 运行时：Node.js。
- Web 框架：Next.js 或同等的一体化 Node Web 框架，用同一个项目承载页面和 API。
- 链交互：`ethers`，用于 Sepolia RPC 连接、地址校验、ERC20 balance 查询和 `transfer` 调用。
- 数据存储：优先 SQLite 文件数据库。
- ORM / 查询层：可以使用轻量查询库或直接 SQL，避免引入过重的数据库体系。
- 部署方式：单进程服务，配置环境变量后即可启动。
- 容器化：提供 Dockerfile 和 docker compose 配置，方便在轻量级服务器上部署。

推荐使用 SQLite，而不是纯内存对象，原因是每日领取记录需要在服务重启后仍然保留。SQLite 仍然是轻量级方案，不需要单独部署 MySQL、PostgreSQL 或 Redis。

如果只是本地演示或极短期临时使用，可以提供一个内存存储模式；但生产或公司内部长期使用时不建议使用内存模式，因为重启会导致限额记录丢失，用户可以重复领取。

## Docker 部署

项目需要支持 Docker 部署，目标是让一台轻量级服务器也能简单运行。

推荐部署形态：

- 一个 Docker 容器运行 Next.js 应用和后端 API。
- SQLite 数据库文件放在容器内的 `/app/data/faucet.sqlite`。
- 宿主机目录挂载到容器 `/app/data`，保证容器重建或升级后领取记录不丢。
- `SEPOLIA_RPC_URL`、`FAUCET_PRIVATE_KEY` 等敏感配置通过环境变量传入。
- 容器只暴露一个 HTTP 端口，例如 `3000`。
- 可以用 Nginx、Caddy 或服务器已有反向代理做 HTTPS 和域名转发。

示例运行方式：

```bash
docker compose up -d
```

示例数据目录：

```text
./data/faucet.sqlite -> /app/data/faucet.sqlite
```

这种部署方式不需要 Kubernetes，不需要单独数据库服务，也不需要复杂 CI/CD。后续更新时重新构建镜像并重启容器即可，SQLite 数据通过挂载目录保留。

## 代币配置

Sepolia 支持的测试币：

- USDT: `0xe980e37De697598E0999D09B563e528be6E67316`
- USDC: `0xED2188e40ee30192231209C0e527B22a41d0BdEa`

每个代币都需要显式配置 symbol、合约地址、decimals、chain id 和单次最大领取数量。当前 Sepolia USDT 和 USDC 的 decimals 都按 6 配置。服务端不能接受客户端传入的任意代币合约地址。

## 接水规则

- 用户输入接收钱包地址。
- 用户只能选择一个币种：USDT 或 USDC。
- 单次请求最多转账 10,000 个测试币。
- 默认领取数量为 10,000。
- 同一个接收钱包地址，每个币种每个自然日最多领取 1 次。
- 每日限制按币种分别计算，也就是同一个钱包当天可以领取 1 次 USDT，也可以领取 1 次 USDC。
- 领取次数以服务端记录为准，不依赖浏览器本地存储。

自然日由服务端统一计算。第一版默认使用 UTC 日期；如果后续部署要求按公司时区统计，可以再调整为指定时区。

## 用户体验

首屏就是接水工具本身，不做营销落地页。页面包含：

- 接收钱包地址输入框。
- USDT / USDC 币种选择。
- 领取数量展示或输入框，数量上限为 10,000。
- 领取按钮。
- 状态反馈：校验中、提交中、交易已发送、交易已确认、今日已领取、Faucet 余额不足、交易失败。
- 交易发送后展示 Sepolia 区块浏览器链接。

整体 UI 应该简单、直接、偏工具化：表单清楚、规则可见、提交后反馈明确。

## 后端 API

后端提供领取接口：

`POST /api/claim`

请求体：

```json
{
  "wallet": "0x...",
  "token": "USDT",
  "amount": "10000"
}
```

成功响应示例：

```json
{
  "status": "sent",
  "txHash": "0x..."
}
```

被拒绝响应示例：

```json
{
  "status": "rejected",
  "reason": "already_claimed_today"
}
```

接口需要校验：

- 钱包地址是合法 Ethereum 地址。
- 币种必须是已配置的 Sepolia 测试币。
- 数量必须大于 0 且不超过 10,000。
- 接收钱包当天还没有领取过同一个币种。
- Faucet 钱包在发币前有足够的代币余额。

## 转账流程

1. 接收领取请求。
2. 标准化钱包地址。
3. 校验币种和数量。
4. 开启数据库事务。
5. 检查该钱包今天是否已有同币种的成功或待处理领取记录。
6. 插入一条 `pending` 领取记录。
7. 使用配置的 Faucet 私钥调用 ERC20 `transfer(wallet, amountInBaseUnits)`。
8. 保存交易 hash，并把领取记录标记为 `sent`。
9. 返回交易 hash。

如果链上调用在产生交易 hash 前失败，则把领取记录标记为 `failed`，并保存脱敏后的错误信息。如果已经产生交易 hash，即使还没最终确认，也应该占用当天领取次数，避免用户在确认较慢时重复领取。

## 数据模型

第一版使用 SQLite。

`claims` 表：

- `id`
- `wallet`
- `token`
- `amount`
- `claim_date`
- `status`
- `tx_hash`
- `error_message`
- `created_at`
- `updated_at`

在 `(wallet, token, claim_date)` 上添加唯一约束，用于保证同一个钱包每个币种每天只能领取一次。

状态值：

- `pending`
- `sent`
- `failed`

## 配置

服务端必需环境变量：

- `SEPOLIA_RPC_URL`
- `FAUCET_PRIVATE_KEY`
- `DATABASE_URL` 或本地 SQLite 路径

建议的可选环境变量：

- `SEPOLIA_CHAIN_ID=11155111`
- `MAX_CLAIM_AMOUNT=10000`
- `CLAIM_DATE_TIMEZONE=UTC`

私钥不能暴露给前端，不能提交到代码仓库，不能写入日志，也不能出现在接口错误返回中。

## 安全和防滥用

第一版至少包含：

- 服务端校验地址和数量。
- 固定代币白名单。
- 钱包加币种维度的每日唯一约束。
- 私钥只保存在后端环境变量中。
- API 错误信息脱敏。
- 基础请求日志，但不记录任何敏感信息。

后续可以增强：

- IP 限流。
- CAPTCHA 或公司内网限制。
- 如出现滥用，再增加管理员白名单。
- 后台轮询交易确认状态。
- Faucet 钱包低余额告警。

## 后续支持 Tron

把转账逻辑封装在类似 `ChainAdapter` 的边界后面：

- `validateAddress(address)`
- `getTokenBalance(token)`
- `transferToken(token, to, amount)`
- `getExplorerTxUrl(txHash)`

第一版实现 `SepoliaEvmAdapter`。后续支持 Tron 时，可以增加 `TronAdapter`，负责 Tron 地址校验、TRC20 转账和 Tron 区块浏览器链接。

## 测试

核心自动化测试覆盖：

- 拒绝非法 Ethereum 地址。
- 拒绝不支持的代币 symbol。
- 拒绝超过 10,000 的领取数量。
- 允许同一个钱包每天分别领取一次 USDT 和一次 USDC。
- 同一个钱包当天领过某个币种后，拒绝再次领取同一个币种。
- 按代币配置的 decimals 把人类可读数量转换为最小单位。
- 转账成功后保存交易 hash。
- 转账提交失败时把领取记录标记为 `failed`。

手动验证覆盖：

- 本地启动应用。
- 使用有效 Sepolia 地址提交领取。
- 确认接口返回交易 hash。
- 确认交易能在 Sepolia 区块浏览器看到。
- 确认同一个钱包领取同一币种的第二次请求会被拒绝。
- 确认同一个钱包当天仍可领取另一个币种。

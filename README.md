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

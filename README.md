# Sepolia Faucet

公司内部 Sepolia 测试币接水工具，支持测试 USDT 和 USDC。

## 领取规则

- 用户输入一个接收钱包地址。
- 用户每次选择一个币种：USDT 或 USDC。
- 同一个钱包每天可以领取一次 USDT。
- 同一个钱包每天可以领取一次 USDC。
- 每次固定发放 10,000 个测试币。
- Faucet 使用后端钱包调用 ERC20 `transfer`，不需要 mint 权限。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

在 `.env` 中配置：

```bash
SEPOLIA_RPC_URL=
FAUCET_PRIVATE_KEY=
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

升级或重建容器时保留 `data` 目录，领取记录就不会丢。

## 安全提醒

- 不要提交 `.env`。
- 不要把 `FAUCET_PRIVATE_KEY` 写进前端代码。
- 不要在日志或 API 错误里输出私钥。
- Faucet 钱包需要准备 Sepolia ETH 用于 gas。
- Faucet 钱包需要提前持有测试 USDT 和 USDC。


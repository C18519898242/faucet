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

const tokenIcons: Record<TokenSymbol, { mark: string; className: string }> = {
  USDT: { mark: "T", className: "token-icon-usdt" },
  USDC: { mark: "$", className: "token-icon-usdc" }
};

const thirdPartyFaucets = [
  { name: "Alchemy", url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
  { name: "Bitcoin testnet3", url: "https://coinfaucet.eu/en/btc-testnet/" },
  { name: "Bitcoin testnet4", url: "https://coinfaucet.eu/en/btc-testnet4/" },
  { name: "Chainlink", url: "https://faucets.chain.link/" },
  { name: "LearnWeb3", url: "https://learnweb3.io/faucets/sepolia/" },
  {
    name: "Plasma Testnet",
    url: "https://faucet.quicknode.com/plasma/testnet/bonus?wallet=0xc8fc3934380f28C176E5227A9ebAaEFD87d85eC9"
  },
  { name: "QuickNode", url: "https://faucet.quicknode.com/" },
  { name: "Stable", url: "https://faucet.stable.xyz/faucet" },
  { name: "Circle", url: "https://faucet.circle.com/" }
];

export default function HomePage() {
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState<NetworkId>("sepolia");
  const [token, setToken] = useState<TokenSymbol>("USDT");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [result, setResult] = useState<ClaimResponse | undefined>();

  const supportedTokens = useMemo(() => getSupportedTokens(network), [network]);
  const claimAmount = NETWORKS[network].tokens[token]?.maxClaimAmount ?? "1000";
  const claimAmountLabel = formatAmountLabel(claimAmount);
  const activeNetwork = NETWORKS[network];

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
      const response = await fetch("./api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, wallet: trimmedWallet, token, amount: claimAmount })
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
      <div className="workspace" aria-label="测试币领取工作台">
        <section className="console-brief" aria-labelledby="page-title">
          <div className="topline">
            <span className="system-label">内部 Faucet 控制台</span>
            <span className="app-version">v{packageJson.version}</span>
          </div>

          <div className="hero-copy">
            <p className="eyebrow">Sepolia / TRON Shasta</p>
            <h1 id="page-title">测试币领取台</h1>
            <p className="lead">
              为开发和测试环境发放测试币。按钱包、网络和币种限制每日一次，单次固定 {claimAmountLabel}。
            </p>
          </div>

          <dl className="status-grid" aria-label="当前领取规则">
            <div>
              <dt>当前网络</dt>
              <dd>{activeNetwork.label}</dd>
            </div>
            <div>
              <dt>可领币种</dt>
              <dd>{supportedTokens.join(" / ")}</dd>
            </div>
            <div>
              <dt>领取频率</dt>
              <dd>每日一次</dd>
            </div>
            <div>
              <dt>单次数量</dt>
              <dd>{claimAmountLabel}</dd>
            </div>
          </dl>

          <section className="external-faucets" aria-labelledby="external-faucets-title">
            <div className="section-header">
              <h2 id="external-faucets-title">第三方公共 Faucet</h2>
              <p>当前 Faucet 不可用时，可以切换到这些公开入口。</p>
            </div>
            <div className="external-faucet-list">
              {thirdPartyFaucets.map((faucet) => (
                <a key={faucet.url} href={faucet.url} target="_blank" rel="noreferrer">
                  {faucet.name}
                </a>
              ))}
            </div>
          </section>
        </section>

        <section className="claim-card" aria-labelledby="claim-title">
          <div className="section-header">
            <p className="eyebrow">Claim Request</p>
            <h2 id="claim-title">发起领取</h2>
            <p>选择网络和币种后，输入接收钱包地址。</p>
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
                  <span>{NETWORKS[networkId].label}</span>
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
                  <span
                    className={`token-icon ${tokenIcons[tokenSymbol].className}`}
                    data-testid={`${tokenSymbol.toLowerCase()}-token-icon`}
                    aria-hidden="true"
                  >
                    {tokenIcons[tokenSymbol].mark}
                  </span>
                  <span>{tokenSymbol}</span>
                </label>
              ))}
            </fieldset>

            <div className="amount-row">
              <span>领取数量</span>
              <strong>{claimAmountLabel}</strong>
            </div>

            <button className="claim-button" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "提交中" : "领取测试币"}
            </button>
          </form>

          {result && (
            <div className={result.status === "sent" ? "notice success" : "notice error"} aria-live="polite">
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
      </div>
    </main>
  );
}

function formatAmountLabel(amount: string): string {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? new Intl.NumberFormat("en-US").format(numericAmount) : amount;
}

"use client";

import { useState } from "react";
import packageJson from "../../package.json";

type Token = "USDT" | "USDC";

type ClaimResponse =
  | { status: "sent"; txHash: string; explorerUrl: string }
  | { status: "rejected"; reason: string }
  | { status: "failed"; reason: string };

const reasonText: Record<string, string> = {
  invalid_wallet: "钱包地址格式不正确",
  unsupported_token: "不支持的币种",
  invalid_amount: "领取数量不正确",
  amount_too_large: "领取数量超过上限",
  already_claimed_today: "该钱包今天已经领取过这个币种",
  insufficient_faucet_balance: "Faucet 钱包余额不足",
  invalid_request: "请求格式不正确",
  transfer_failed: "交易提交失败，请稍后再试"
};

export default function HomePage() {
  const [wallet, setWallet] = useState("");
  const [token, setToken] = useState<Token>("USDT");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [result, setResult] = useState<ClaimResponse | undefined>();

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
        body: JSON.stringify({ wallet: trimmedWallet, token, amount: "10000" })
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
            <p className="eyebrow">Sepolia Faucet</p>
            <span className="app-version">v{packageJson.version}</span>
          </div>
          <h1>测试币接水</h1>
          <p className="muted">每个钱包每个币种每天可领取一次，单次固定 10,000。</p>
        </div>

        <form className="form" onSubmit={submitClaim}>
          <label className="field">
            <span>接收钱包地址</span>
            <input
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
            />
          </label>

          <fieldset className="token-group">
            <legend>选择币种</legend>
            <label className={token === "USDT" ? "token-option selected" : "token-option"}>
              <input
                type="radio"
                name="token"
                value="USDT"
                checked={token === "USDT"}
                onChange={() => setToken("USDT")}
              />
              USDT
            </label>
            <label className={token === "USDC" ? "token-option selected" : "token-option"}>
              <input
                type="radio"
                name="token"
                value="USDC"
                checked={token === "USDC"}
                onChange={() => setToken("USDC")}
              />
              USDC
            </label>
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
                  查看 Sepolia 交易
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

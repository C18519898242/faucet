import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";
import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a USDT claim and shows tx link", async () => {
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

  it("can select USDC", async () => {
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
    await userEvent.click(screen.getByLabelText("USDC"));
    await userEvent.click(screen.getByRole("button", { name: "领取测试币" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/claim",
      expect.objectContaining({
        body: JSON.stringify({
          wallet: "0x000000000000000000000000000000000000dEaD",
          token: "USDC",
          amount: "10000"
        })
      })
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

    expect(await screen.findByText("该钱包今天已经领取过这个币种")).toBeInTheDocument();
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

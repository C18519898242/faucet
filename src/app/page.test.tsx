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
        amount: "1000"
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
          amount: "1000"
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

  it("shows third-party public faucet links from the bookmark folder", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "第三方公用水龙头" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alchemy" })).toHaveAttribute(
      "href",
      "https://www.alchemy.com/faucets/ethereum-sepolia"
    );
    expect(screen.getByRole("link", { name: "Chainlink" })).toHaveAttribute("href", "https://faucets.chain.link/");
    expect(screen.getByRole("link", { name: "QuickNode" })).toHaveAttribute("href", "https://faucet.quicknode.com/");
    expect(screen.getByRole("link", { name: "Circle" })).toHaveAttribute("target", "_blank");
  });
});

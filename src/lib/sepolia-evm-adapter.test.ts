import { describe, expect, it, vi } from "vitest";
import { SepoliaEvmAdapter } from "./sepolia-evm-adapter";
import { TOKENS } from "./tokens";

describe("SepoliaEvmAdapter", () => {
  it("returns a Sepolia explorer transaction URL", () => {
    const adapter = new SepoliaEvmAdapter({ address: "0xfaucet" } as never, vi.fn());

    expect(adapter.getExplorerTxUrl("0x123")).toBe("https://sepolia.etherscan.io/tx/0x123");
  });

  it("transfers an ERC20 token with parsed base units", async () => {
    const transfer = vi.fn().mockResolvedValue({ hash: "0xhash" });
    const contractFactory = vi.fn().mockReturnValue({ transfer, balanceOf: vi.fn() });
    const adapter = new SepoliaEvmAdapter({ address: "0xfaucet" } as never, contractFactory);

    const txHash = await adapter.transferToken(
      TOKENS.USDT,
      "0x000000000000000000000000000000000000dEaD",
      "10000"
    );

    expect(txHash).toBe("0xhash");
    expect(contractFactory).toHaveBeenCalledWith(TOKENS.USDT.address);
    expect(transfer).toHaveBeenCalledWith("0x000000000000000000000000000000000000dEaD", 10000000000n);
  });
});

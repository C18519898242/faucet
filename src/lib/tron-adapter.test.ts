import { describe, expect, it } from "vitest";
import { NETWORKS } from "./tokens";
import { normalizeTronPrivateKey, TronAdapter } from "./tron-adapter";

const token = NETWORKS.tron.tokens.USDT;

type FakeContract = {
  balanceOf(owner: string): { call(): Promise<string> };
  transfer(to: string, amount: string): { send(): Promise<string> };
};

function createAdapter(contract: FakeContract) {
  return new TronAdapter(
    {
      address: {
        fromPrivateKey: () => "TFaucetAddress"
      },
      contract: async () => contract,
      isAddress: (address: string) => address.startsWith("T")
    },
    "abcdef"
  );
}

describe("TronAdapter", () => {
  it("normalizes 0x-prefixed private keys for TronWeb", () => {
    expect(normalizeTronPrivateKey("0xabcdef")).toBe("abcdef");
    expect(normalizeTronPrivateKey("abcdef")).toBe("abcdef");
  });

  it("validates TRON addresses", () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: () => ({ send: async () => "tx" })
    });

    expect(adapter.validateAddress("TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu")).toBe(true);
    expect(adapter.validateAddress("0x000000000000000000000000000000000000dEaD")).toBe(false);
  });

  it("reads TRC20 balance for faucet address", async () => {
    const adapter = createAdapter({
      balanceOf: (owner: string) => {
        expect(owner).toBe("TFaucetAddress");
        return { call: async () => "123000000" };
      },
      transfer: () => ({ send: async () => "tx" })
    });

    await expect(adapter.getTokenBalance(token)).resolves.toBe(123000000n);
  });

  it("transfers human-readable amount as base units", async () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: (to: string, amount: string) => {
        expect(to).toBe("TReceiverAddress");
        expect(amount).toBe("10000000000");
        return { send: async () => "trontx" };
      }
    });

    await expect(adapter.transferToken(token, "TReceiverAddress", "10000")).resolves.toBe("trontx");
  });

  it("builds Shasta explorer transaction URL", () => {
    const adapter = createAdapter({
      balanceOf: () => ({ call: async () => "0" }),
      transfer: () => ({ send: async () => "tx" })
    });

    expect(adapter.getExplorerTxUrl("abc")).toBe("https://shasta.tronscan.org/#/transaction/abc");
  });
});

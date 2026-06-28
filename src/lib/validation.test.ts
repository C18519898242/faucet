import { describe, expect, it } from "vitest";
import { validateClaimInput } from "./validation";

const evmWallet = "0x000000000000000000000000000000000000dEaD";
const tronWallet = "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu";

describe("validateClaimInput", () => {
  it("accepts a valid Sepolia USDT request", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: evmWallet,
      token: "USDT",
      amount: "1000"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        network: "sepolia",
        wallet: evmWallet,
        token: "USDT",
        amount: "1000"
      });
    }
  });

  it("accepts a valid TRON USDT request", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: tronWallet,
      token: "USDT",
      amount: "1000"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        network: "tron",
        wallet: tronWallet,
        token: "USDT",
        amount: "1000"
      });
    }
  });

  it("rejects a missing network", () => {
    const result = validateClaimInput({ wallet: evmWallet, token: "USDT", amount: "1000" });

    expect(result).toEqual({ ok: false, reason: "unsupported_network" });
  });

  it("rejects an unsupported network", () => {
    const result = validateClaimInput({
      network: "mainnet",
      wallet: evmWallet,
      token: "USDT",
      amount: "1000"
    });

    expect(result).toEqual({ ok: false, reason: "unsupported_network" });
  });

  it("rejects TRON USDC because TRON Shasta only supports USDT", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: tronWallet,
      token: "USDC",
      amount: "1000"
    });

    expect(result).toEqual({ ok: false, reason: "unsupported_token" });
  });

  it("rejects an EVM wallet on TRON", () => {
    const result = validateClaimInput({
      network: "tron",
      wallet: evmWallet,
      token: "USDT",
      amount: "1000"
    });

    expect(result).toEqual({ ok: false, reason: "invalid_wallet" });
  });

  it("rejects a TRON wallet on Sepolia", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: tronWallet,
      token: "USDT",
      amount: "1000"
    });

    expect(result).toEqual({ ok: false, reason: "invalid_wallet" });
  });

  it("rejects amounts above the selected asset max claim amount", () => {
    const result = validateClaimInput({
      network: "sepolia",
      wallet: evmWallet,
      token: "USDC",
      amount: "1001"
    });

    expect(result).toEqual({ ok: false, reason: "amount_too_large" });
  });

  it("rejects zero and negative amounts", () => {
    expect(validateClaimInput({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "0" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
    expect(validateClaimInput({ network: "sepolia", wallet: evmWallet, token: "USDT", amount: "-1" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
  });
});

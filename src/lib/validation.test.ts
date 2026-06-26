import { describe, expect, it } from "vitest";
import { validateClaimInput } from "./validation";

const wallet = "0x000000000000000000000000000000000000dEaD";

describe("validateClaimInput", () => {
  it("accepts a valid USDT request", () => {
    const result = validateClaimInput({ wallet, token: "USDT", amount: "10000" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.wallet).toBe(wallet);
      expect(result.value.token).toBe("USDT");
      expect(result.value.amount).toBe("10000");
    }
  });

  it("rejects an invalid wallet", () => {
    const result = validateClaimInput({ wallet: "abc", token: "USDT", amount: "10000" });

    expect(result).toEqual({ ok: false, reason: "invalid_wallet" });
  });

  it("rejects unsupported tokens", () => {
    const result = validateClaimInput({ wallet, token: "DAI", amount: "10000" });

    expect(result).toEqual({ ok: false, reason: "unsupported_token" });
  });

  it("rejects amounts above 10000", () => {
    const result = validateClaimInput({ wallet, token: "USDC", amount: "10001" });

    expect(result).toEqual({ ok: false, reason: "amount_too_large" });
  });

  it("rejects zero and negative amounts", () => {
    expect(validateClaimInput({ wallet, token: "USDT", amount: "0" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
    expect(validateClaimInput({ wallet, token: "USDT", amount: "-1" })).toEqual({
      ok: false,
      reason: "invalid_amount"
    });
  });
});

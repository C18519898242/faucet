import { getAddress } from "ethers";
import { isTokenSymbol, MAX_CLAIM_AMOUNT, type TokenSymbol } from "./tokens";

export type ClaimInput = {
  wallet: unknown;
  token: unknown;
  amount: unknown;
};

export type ValidClaimInput = {
  wallet: `0x${string}`;
  token: TokenSymbol;
  amount: string;
};

export type ValidationReason =
  | "invalid_wallet"
  | "unsupported_token"
  | "invalid_amount"
  | "amount_too_large";

export type ValidationResult =
  | { ok: true; value: ValidClaimInput }
  | { ok: false; reason: ValidationReason };

export function validateClaimInput(input: ClaimInput): ValidationResult {
  if (typeof input.wallet !== "string") {
    return { ok: false, reason: "invalid_wallet" };
  }

  let wallet: `0x${string}`;
  try {
    wallet = getAddress(input.wallet) as `0x${string}`;
  } catch {
    return { ok: false, reason: "invalid_wallet" };
  }

  if (typeof input.token !== "string" || !isTokenSymbol(input.token)) {
    return { ok: false, reason: "unsupported_token" };
  }

  if (typeof input.amount !== "string" && typeof input.amount !== "number") {
    return { ok: false, reason: "invalid_amount" };
  }

  const amount = String(input.amount).trim();
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return { ok: false, reason: "invalid_amount" };
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  if (numericAmount > Number(MAX_CLAIM_AMOUNT)) {
    return { ok: false, reason: "amount_too_large" };
  }

  return {
    ok: true,
    value: {
      wallet,
      token: input.token,
      amount
    }
  };
}

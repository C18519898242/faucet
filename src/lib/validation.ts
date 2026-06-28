import { getAddress } from "ethers";
import { isTronAddress } from "./tron-address";
import { getTokenConfig, isNetworkId, isTokenSymbol, type NetworkId, type TokenSymbol } from "./tokens";

export type ClaimInput = {
  network: unknown;
  wallet: unknown;
  token: unknown;
  amount: unknown;
};

export type ValidClaimInput = {
  network: NetworkId;
  wallet: string;
  token: TokenSymbol;
  amount: string;
};

export type ValidationReason =
  | "invalid_wallet"
  | "unsupported_network"
  | "unsupported_token"
  | "invalid_amount"
  | "amount_too_large";

export type ValidationResult =
  | { ok: true; value: ValidClaimInput }
  | { ok: false; reason: ValidationReason };

export function validateClaimInput(input: Partial<ClaimInput>): ValidationResult {
  if (typeof input.network !== "string" || !isNetworkId(input.network)) {
    return { ok: false, reason: "unsupported_network" };
  }

  if (typeof input.token !== "string" || !isTokenSymbol(input.token)) {
    return { ok: false, reason: "unsupported_token" };
  }

  const tokenConfig = getTokenConfig(input.network, input.token);
  if (!tokenConfig) {
    return { ok: false, reason: "unsupported_token" };
  }

  if (typeof input.wallet !== "string") {
    return { ok: false, reason: "invalid_wallet" };
  }

  const wallet = normalizeWallet(input.network, input.wallet);
  if (!wallet) {
    return { ok: false, reason: "invalid_wallet" };
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

  if (numericAmount > Number(tokenConfig.maxClaimAmount)) {
    return { ok: false, reason: "amount_too_large" };
  }

  return {
    ok: true,
    value: {
      network: input.network,
      wallet,
      token: input.token,
      amount
    }
  };
}

function normalizeWallet(network: NetworkId, wallet: string): string | undefined {
  if (network === "sepolia") {
    try {
      return getAddress(wallet);
    } catch {
      return undefined;
    }
  }

  return isTronAddress(wallet) ? wallet : undefined;
}

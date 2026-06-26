import type { ClaimResult } from "./claim-service";

export function statusCodeForClaimResult(result: ClaimResult): number {
  if (result.status === "sent") {
    return 200;
  }

  if (result.status === "failed") {
    return 502;
  }

  switch (result.reason) {
    case "invalid_wallet":
    case "unsupported_token":
    case "invalid_amount":
    case "amount_too_large":
      return 400;
    case "already_claimed_today":
      return 409;
    case "insufficient_faucet_balance":
      return 503;
  }
}

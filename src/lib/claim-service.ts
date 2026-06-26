import { parseUnits } from "ethers";
import type { ChainAdapter } from "./chain-adapter";
import type { ClaimsRepository } from "./claims-repository";
import { getClaimDate } from "./date";
import { TOKENS } from "./tokens";
import { validateClaimInput, type ClaimInput } from "./validation";

export type ClaimResult =
  | { status: "sent"; txHash: string; explorerUrl: string }
  | {
      status: "rejected";
      reason:
        | "invalid_wallet"
        | "unsupported_token"
        | "invalid_amount"
        | "amount_too_large"
        | "already_claimed_today"
        | "insufficient_faucet_balance";
    }
  | { status: "failed"; reason: "transfer_failed" };

export class ClaimService {
  constructor(
    private readonly claims: ClaimsRepository,
    private readonly chain: ChainAdapter,
    private readonly now: () => Date = () => new Date()
  ) {}

  async claim(input: ClaimInput): Promise<ClaimResult> {
    const validation = validateClaimInput(input);
    if (!validation.ok) {
      return { status: "rejected", reason: validation.reason };
    }

    const { wallet, token, amount } = validation.value;
    const tokenConfig = TOKENS[token];
    const claimDate = getClaimDate(this.now());
    const existing = this.claims.findActiveClaim(wallet, token, claimDate);

    if (existing) {
      return { status: "rejected", reason: "already_claimed_today" };
    }

    const balance = await this.chain.getTokenBalance(tokenConfig);
    const amountInBaseUnits = parseUnits(amount, tokenConfig.decimals);
    if (balance < amountInBaseUnits) {
      return { status: "rejected", reason: "insufficient_faucet_balance" };
    }

    const claim = this.claims.createPendingClaim({ wallet, token, amount, claimDate });

    try {
      const txHash = await this.chain.transferToken(tokenConfig, wallet, amount);
      this.claims.markSent(claim.id, txHash);
      return {
        status: "sent",
        txHash,
        explorerUrl: this.chain.getExplorerTxUrl(txHash)
      };
    } catch {
      this.claims.markFailed(claim.id, "transfer_failed");
      return { status: "failed", reason: "transfer_failed" };
    }
  }
}

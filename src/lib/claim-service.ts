import { parseUnits } from "ethers";
import type { ChainAdapter } from "./chain-adapter";
import type { ClaimsRepository } from "./claims-repository";
import { getClaimDate } from "./date";
import { getTokenConfig, type NetworkId } from "./tokens";
import { validateClaimInput, type ClaimInput } from "./validation";

export type ChainAdaptersByNetwork = Partial<Record<NetworkId, ChainAdapter>>;

export type ClaimResult =
  | { status: "sent"; txHash: string; explorerUrl: string }
  | {
      status: "rejected";
      reason:
        | "invalid_wallet"
        | "unsupported_network"
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
    private readonly chains: ChainAdaptersByNetwork,
    private readonly now: () => Date = () => new Date()
  ) {}

  async claim(input: Partial<ClaimInput>): Promise<ClaimResult> {
    const validation = validateClaimInput(input);
    if (!validation.ok) {
      return { status: "rejected", reason: validation.reason };
    }

    const { network, wallet, token, amount } = validation.value;
    const tokenConfig = getTokenConfig(network, token);
    const chain = this.chains[network];

    if (!tokenConfig || !chain) {
      return { status: "failed", reason: "transfer_failed" };
    }

    const claimDate = getClaimDate(this.now());
    const existing = this.claims.findActiveClaim(wallet, network, token, claimDate);

    if (existing) {
      return { status: "rejected", reason: "already_claimed_today" };
    }

    const balance = await chain.getTokenBalance(tokenConfig);
    const amountInBaseUnits = parseUnits(amount, tokenConfig.decimals);
    if (balance < amountInBaseUnits) {
      return { status: "rejected", reason: "insufficient_faucet_balance" };
    }

    const claim = this.claims.createPendingClaim({ wallet, network, token, amount, claimDate });

    try {
      const txHash = await chain.transferToken(tokenConfig, wallet, amount);
      this.claims.markSent(claim.id, txHash);
      return {
        status: "sent",
        txHash,
        explorerUrl: chain.getExplorerTxUrl(txHash)
      };
    } catch (error) {
      logTransferFailure({ network, token, error });
      this.claims.markFailed(claim.id, "transfer_failed");
      return { status: "failed", reason: "transfer_failed" };
    }
  }
}

function logTransferFailure(input: { network: NetworkId; token: string; error: unknown }): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.error("Claim transfer failed", {
    network: input.network,
    token: input.token,
    error: sanitizeError(input.error)
  });
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/0x[a-fA-F0-9]{32,}/g, "0x[redacted]")
    .replace(/[A-HJ-NP-Za-km-z1-9]{34,}/g, "[redacted-address-like-value]")
    .slice(0, 500);
}

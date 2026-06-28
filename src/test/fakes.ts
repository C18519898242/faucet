import type { ChainAdapter } from "@/lib/chain-adapter";
import type { ClaimRecord, ClaimsRepository, CreateClaimInput } from "@/lib/claims-repository";
import type { NetworkId, TokenConfig, TokenSymbol } from "@/lib/tokens";

export class FakeClaimsRepository implements ClaimsRepository {
  records: ClaimRecord[] = [];
  nextId = 1;

  findActiveClaim(wallet: string, network: NetworkId, token: TokenSymbol, claimDate: string): ClaimRecord | undefined {
    return this.records.find(
      (record) =>
        record.wallet === wallet &&
        record.network === network &&
        record.token === token &&
        record.claimDate === claimDate &&
        (record.status === "pending" || record.status === "sent")
    );
  }

  createPendingClaim(input: CreateClaimInput): ClaimRecord {
    const now = "2026-06-26T00:00:00.000Z";
    const record: ClaimRecord = {
      id: this.nextId++,
      wallet: input.wallet,
      network: input.network,
      token: input.token,
      amount: input.amount,
      claimDate: input.claimDate,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    this.records.push(record);
    return record;
  }

  markSent(id: number, txHash: string): void {
    const record = this.records.find((item) => item.id === id);
    if (record) {
      record.status = "sent";
      record.txHash = txHash;
    }
  }

  markFailed(id: number, message: string): void {
    const record = this.records.find((item) => item.id === id);
    if (record) {
      record.status = "failed";
      record.errorMessage = message;
    }
  }
}

export class FakeChainAdapter implements ChainAdapter {
  balance = 10000000000n;
  transferError: Error | undefined;
  transfers: Array<{ token: TokenConfig; to: string; amount: string }> = [];

  constructor(
    readonly network: NetworkId,
    readonly txHash = "0xtx",
    private readonly explorerPrefix = "https://sepolia.etherscan.io/tx/"
  ) {}

  validateAddress(address: string): boolean {
    return this.network === "tron" ? address.startsWith("T") : address.startsWith("0x");
  }

  async getTokenBalance(_token: TokenConfig): Promise<bigint> {
    return this.balance;
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    if (this.transferError) {
      throw this.transferError;
    }
    this.transfers.push({ token, to, amount });
    return this.txHash;
  }

  getExplorerTxUrl(txHash: string): string {
    return `${this.explorerPrefix}${txHash}`;
  }
}

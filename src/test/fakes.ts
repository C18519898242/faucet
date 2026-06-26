import type { ChainAdapter } from "@/lib/chain-adapter";
import type { ClaimRecord, ClaimsRepository, CreateClaimInput } from "@/lib/claims-repository";
import type { TokenConfig, TokenSymbol } from "@/lib/tokens";

export class FakeClaimsRepository implements ClaimsRepository {
  records: ClaimRecord[] = [];
  nextId = 1;

  findActiveClaim(wallet: string, token: TokenSymbol, claimDate: string): ClaimRecord | undefined {
    return this.records.find(
      (record) =>
        record.wallet === wallet &&
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
  txHash = "0xtx";
  transferError: Error | undefined;

  validateAddress(address: string): boolean {
    return address.startsWith("0x");
  }

  async getTokenBalance(_token: TokenConfig): Promise<bigint> {
    return this.balance;
  }

  async transferToken(_token: TokenConfig, _to: string, _amount: string): Promise<string> {
    if (this.transferError) {
      throw this.transferError;
    }
    return this.txHash;
  }

  getExplorerTxUrl(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
}

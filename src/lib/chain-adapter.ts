import type { TokenConfig } from "./tokens";

export interface ChainAdapter {
  validateAddress(address: string): boolean;
  getTokenBalance(token: TokenConfig): Promise<bigint>;
  transferToken(token: TokenConfig, to: string, amount: string): Promise<string>;
  getExplorerTxUrl(txHash: string): string;
}

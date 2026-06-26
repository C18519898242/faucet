export type TokenSymbol = "USDT" | "USDC";

export type TokenConfig = {
  symbol: TokenSymbol;
  address: `0x${string}`;
  decimals: number;
  chainId: number;
  maxClaimAmount: string;
};

export const SEPOLIA_CHAIN_ID = 11155111;
export const MAX_CLAIM_AMOUNT = "10000";

export const TOKENS: Record<TokenSymbol, TokenConfig> = {
  USDT: {
    symbol: "USDT",
    address: "0xe980e37De697598E0999D09B563e528be6E67316",
    decimals: 6,
    chainId: SEPOLIA_CHAIN_ID,
    maxClaimAmount: MAX_CLAIM_AMOUNT
  },
  USDC: {
    symbol: "USDC",
    address: "0xED2188e40ee30192231209C0e527B22a41d0BdEa",
    decimals: 6,
    chainId: SEPOLIA_CHAIN_ID,
    maxClaimAmount: MAX_CLAIM_AMOUNT
  }
};

export function isTokenSymbol(value: string): value is TokenSymbol {
  return value === "USDT" || value === "USDC";
}

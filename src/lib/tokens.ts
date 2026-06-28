export type NetworkId = "sepolia" | "tron";
export type TokenSymbol = "USDT" | "USDC";

export type TokenConfig = {
  network: NetworkId;
  symbol: TokenSymbol;
  address: string;
  decimals: number;
  chainId?: number;
  maxClaimAmount: string;
};

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  tokens: Partial<Record<TokenSymbol, TokenConfig>>;
};

export const SEPOLIA_CHAIN_ID = 11155111;
export const MAX_CLAIM_AMOUNT = "10000";

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    id: "sepolia",
    label: "Sepolia",
    tokens: {
      USDT: {
        network: "sepolia",
        symbol: "USDT",
        address: "0xe980e37De697598E0999D09B563e528be6E67316",
        decimals: 6,
        chainId: SEPOLIA_CHAIN_ID,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      },
      USDC: {
        network: "sepolia",
        symbol: "USDC",
        address: "0xED2188e40ee30192231209C0e527B22a41d0BdEa",
        decimals: 6,
        chainId: SEPOLIA_CHAIN_ID,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      }
    }
  },
  tron: {
    id: "tron",
    label: "TRON Shasta",
    tokens: {
      USDT: {
        network: "tron",
        symbol: "USDT",
        address: "TQ6F4gJ72G4qDTKtpGDGppGAMUeGqwsDEu",
        decimals: 6,
        maxClaimAmount: MAX_CLAIM_AMOUNT
      }
    }
  }
};

export const TOKENS = NETWORKS.sepolia.tokens as Record<TokenSymbol, TokenConfig>;

export function isNetworkId(value: string): value is NetworkId {
  return value === "sepolia" || value === "tron";
}

export function isTokenSymbol(value: string): value is TokenSymbol {
  return value === "USDT" || value === "USDC";
}

export function getTokenConfig(network: NetworkId, token: TokenSymbol): TokenConfig | undefined {
  return NETWORKS[network].tokens[token];
}

export function getSupportedTokens(network: NetworkId): TokenSymbol[] {
  return Object.keys(NETWORKS[network].tokens) as TokenSymbol[];
}

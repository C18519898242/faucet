import { Contract, formatUnits, getAddress, JsonRpcProvider, parseUnits, Wallet } from "ethers";
import type { ContractRunner } from "ethers";
import type { ChainAdapter } from "./chain-adapter";
import type { TokenConfig } from "./tokens";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
] as const;

type ContractLike = {
  balanceOf(owner: string): Promise<bigint>;
  transfer(to: string, amount: bigint): Promise<{ hash: string }>;
};

type ContractFactory = (address: string) => ContractLike;

type FaucetSigner = {
  address: string;
};

export class SepoliaEvmAdapter implements ChainAdapter {
  private readonly contractFactory: ContractFactory;

  constructor(
    private readonly wallet: FaucetSigner,
    contractFactory?: ContractFactory
  ) {
    this.contractFactory =
      contractFactory ??
      ((address: string) =>
        new Contract(address, ERC20_ABI, this.wallet as unknown as ContractRunner) as unknown as ContractLike);
  }

  validateAddress(address: string): boolean {
    try {
      getAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  async getTokenBalance(token: TokenConfig): Promise<bigint> {
    const contract = this.contractFactory(token.address);
    return contract.balanceOf(this.wallet.address);
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    const contract = this.contractFactory(token.address);
    const amountInBaseUnits = parseUnits(amount, token.decimals);
    const tx = await contract.transfer(to, amountInBaseUnits);
    return tx.hash;
  }

  getExplorerTxUrl(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
}

export function createSepoliaEvmAdapterFromEnv(): SepoliaEvmAdapter {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.FAUCET_PRIVATE_KEY;

  if (!rpcUrl) {
    throw new Error("Missing SEPOLIA_RPC_URL");
  }

  if (!privateKey) {
    throw new Error("Missing FAUCET_PRIVATE_KEY");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  return new SepoliaEvmAdapter(wallet);
}

export function formatTokenBalance(balance: bigint, token: TokenConfig): string {
  return formatUnits(balance, token.decimals);
}

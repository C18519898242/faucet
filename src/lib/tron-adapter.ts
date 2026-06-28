import { parseUnits } from "ethers";
import { TronWeb } from "tronweb";
import type { ChainAdapter } from "./chain-adapter";
import type { TokenConfig } from "./tokens";

const TRC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

type TronContract = {
  balanceOf(owner: string): { call(): Promise<string | number | bigint> };
  transfer(to: string, amount: string): { send(options?: { feeLimit?: number }): Promise<string> };
};

const TRC20_TRANSFER_FEE_LIMIT = 150_000_000;

type TronWebLike = {
  address: {
    fromPrivateKey(privateKey: string): string | false;
  };
  contract(abi: unknown, address: string): Promise<TronContract>;
  isAddress(address: string): boolean;
};

export class TronAdapter implements ChainAdapter {
  private readonly faucetAddress: string;

  constructor(
    private readonly tronWeb: TronWebLike,
    private readonly privateKey: string
  ) {
    const address = this.tronWeb.address.fromPrivateKey(privateKey);
    if (!address) {
      throw new Error("Invalid FAUCET_PRIVATE_KEY for TRON");
    }
    this.faucetAddress = address;
  }

  validateAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  async getTokenBalance(token: TokenConfig): Promise<bigint> {
    const contract = await this.tronWeb.contract(TRC20_ABI, token.address);
    const balance = await contract.balanceOf(this.faucetAddress).call();
    return BigInt(balance);
  }

  async transferToken(token: TokenConfig, to: string, amount: string): Promise<string> {
    const contract = await this.tronWeb.contract(TRC20_ABI, token.address);
    const amountInBaseUnits = parseUnits(amount, token.decimals).toString();
    return contract.transfer(to, amountInBaseUnits).send({ feeLimit: TRC20_TRANSFER_FEE_LIMIT });
  }

  getExplorerTxUrl(txHash: string): string {
    return `https://shasta.tronscan.org/#/transaction/${txHash}`;
  }
}

export function normalizeTronPrivateKey(privateKey: string): string {
  return privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
}

export function createTronAdapterFromEnv(): TronAdapter {
  const rpcUrl = process.env.TRON_RPC_URL;
  const privateKey = process.env.FAUCET_PRIVATE_KEY;

  if (!rpcUrl) {
    throw new Error("Missing TRON_RPC_URL");
  }

  if (!privateKey) {
    throw new Error("Missing FAUCET_PRIVATE_KEY");
  }

  const normalizedPrivateKey = normalizeTronPrivateKey(privateKey);
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    privateKey: normalizedPrivateKey
  }) as unknown as TronWebLike;

  return new TronAdapter(tronWeb, normalizedPrivateKey);
}

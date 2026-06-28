import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  openDatabase: vi.fn(() => ({}))
}));

vi.mock("@/lib/claims-repository", () => ({
  SqliteClaimsRepository: vi.fn(() => ({}))
}));

const createSepoliaEvmAdapterFromEnv = vi.fn(() => ({ network: "sepolia" }));
vi.mock("@/lib/sepolia-evm-adapter", () => ({
  createSepoliaEvmAdapterFromEnv
}));

const createTronAdapterFromEnv = vi.fn(() => ({ network: "tron" }));
vi.mock("@/lib/tron-adapter", () => ({
  createTronAdapterFromEnv
}));

const claimMock = vi.fn(async () => ({
  status: "sent",
  txHash: "0xtx",
  explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
}));

const ClaimService = vi.fn().mockImplementation(() => ({
  claim: claimMock
}));

vi.mock("@/lib/claim-service", () => ({
  ClaimService
}));

describe("POST /api/claim", () => {
  it("passes a Sepolia request with network to ClaimService", async () => {
    const { POST } = await import("./route");
    const body = {
      network: "sepolia",
      wallet: "0x000000000000000000000000000000000000dEaD",
      token: "USDT",
      amount: "10000"
    };
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: JSON.stringify(body)
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(claimMock).toHaveBeenCalledWith(body);
    expect(ClaimService).toHaveBeenCalledWith({}, { sepolia: expect.any(Object), tron: expect.any(Object) });
    expect(createSepoliaEvmAdapterFromEnv).not.toHaveBeenCalled();
    expect(createTronAdapterFromEnv).not.toHaveBeenCalled();
  });

  it("returns a sanitized JSON claim response", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: JSON.stringify({
        network: "sepolia",
        wallet: "0x000000000000000000000000000000000000dEaD",
        token: "USDT",
        amount: "10000"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "sent",
      txHash: "0xtx",
      explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
    });
  });

  it("rejects malformed JSON", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: "{"
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "rejected",
      reason: "invalid_request"
    });
  });
});

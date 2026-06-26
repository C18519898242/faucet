import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  openDatabase: vi.fn(() => ({}))
}));

vi.mock("@/lib/claims-repository", () => ({
  SqliteClaimsRepository: vi.fn(() => ({}))
}));

vi.mock("@/lib/sepolia-evm-adapter", () => ({
  createSepoliaEvmAdapterFromEnv: vi.fn(() => ({}))
}));

const claimMock = vi.fn(async () => ({
  status: "sent",
  txHash: "0xtx",
  explorerUrl: "https://sepolia.etherscan.io/tx/0xtx"
}));

vi.mock("@/lib/claim-service", () => ({
  ClaimService: vi.fn().mockImplementation(() => ({
    claim: claimMock
  }))
}));

describe("POST /api/claim", () => {
  it("returns a sanitized JSON claim response", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/claim", {
      method: "POST",
      body: JSON.stringify({
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

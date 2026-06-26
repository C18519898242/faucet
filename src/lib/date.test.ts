import { describe, expect, it } from "vitest";
import { getClaimDate } from "./date";

describe("getClaimDate", () => {
  it("returns a UTC yyyy-mm-dd date", () => {
    const date = getClaimDate(new Date("2026-06-26T23:59:59.000Z"));

    expect(date).toBe("2026-06-26");
  });
});

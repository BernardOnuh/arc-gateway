import { describe, it, expect } from "vitest";
import { computeFee } from "./fees.js";

describe("computeFee", () => {
  it("handles basic cases", () => {
    const res = computeFee(10000n, 10);
    expect(res.fee).toBe(1000n);
    expect(res.netAmount).toBe(9000n);
  });

  it("rounds down favoring user", () => {
    const res = computeFee(101n, 10);
    expect(res.fee).toBe(10n);
    expect(res.netAmount).toBe(91n);
  });

  it("zero bps", () => {
    const res = computeFee(123456n, 0);
    expect(res.fee).toBe(0n);
    expect(res.netAmount).toBe(123456n);
  });

  it("100 bps", () => {
    const res = computeFee(100n, 100);
    expect(res.fee).toBe(100n);
    expect(res.netAmount).toBe(0n);
  });
});

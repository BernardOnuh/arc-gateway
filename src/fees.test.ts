import { describe, it, expect } from "vitest";
import { computeFee } from "./fees.js";

describe("computeFee", () => {
  it("charges basis points on the full amount", () => {
    const res = computeFee(1000000n, 10);
    expect(res.fee).toBe(1000n);
    expect(res.netAmount).toBe(999000n);
  });

  it("rounds down favoring user", () => {
    const res = computeFee(101n, 10);
    expect(res.fee).toBe(0n);
    expect(res.netAmount).toBe(101n);
  });

  it("zero bps", () => {
    const res = computeFee(123456n, 0);
    expect(res.fee).toBe(0n);
    expect(res.netAmount).toBe(123456n);
  });

  it("100 bps is 1%", () => {
    const res = computeFee(10000n, 100);
    expect(res.fee).toBe(100n);
    expect(res.netAmount).toBe(9900n);
  });

  it("throws if feeBps out of range", () => {
    expect(() => computeFee(100n, -1)).toThrow();
    expect(() => computeFee(100n, 101)).toThrow();
  });

  it("throws if amountIn is not positive", () => {
    expect(() => computeFee(0n, 10)).toThrow();
  });
});

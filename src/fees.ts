export function computeFee(amountIn: bigint, feeBps: number): { fee: bigint; netAmount: bigint } {
  if (feeBps < 0 || feeBps > 100) {
    throw new Error("feeBps must be between 0 and 100");
  }
  if (amountIn <= 0n) {
    throw new Error("amountIn must be greater than 0");
  }
  const fee = (amountIn * BigInt(feeBps)) / 100n;
  const netAmount = amountIn - fee;
  return { fee, netAmount };
}

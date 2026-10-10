import { afterEach, describe, expect, it, vi } from "vitest";
import { transactionSender } from "./onchain.js";

afterEach(() => vi.unstubAllGlobals());

describe("transactionSender", () => {
  it("reads the sender from the chain's RPC, lowercased", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: { from: "0xABCDEF0000000000000000000000000000000001" } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await transactionSender(8453, `0x${"1".repeat(64)}`)).toBe("0xabcdef0000000000000000000000000000000001");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://mainnet.base.org");
    expect(JSON.parse(String(init.body)).method).toBe("eth_getTransactionByHash");
  });

  it("says 'can't tell' (null) for unknown transactions, RPC errors and unknown chains", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: null }))));
    expect(await transactionSender(8453, "0x1")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await transactionSender(8453, "0x1")).toBeNull();
    expect(await transactionSender(999999, "0x1")).toBeNull();
  });
});

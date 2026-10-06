import { describe, it, expect } from "vitest";
import { buildApp } from "./server.js";

describe("health", () => {
  it("returns 200 for /health", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

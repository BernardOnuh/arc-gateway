import { GatewayError } from "stableflowr-sdk";
import { describe, expect, it } from "vitest";
import { describeError } from "./gateway";

describe("describeError", () => {
  it("treats a bare 401 as an ended session, not a bad API key", () => {
    expect(describeError(new GatewayError(401, { error: "unauthorized" }))).toBe(
      "Your session has ended. Sign in again to continue."
    );
  });

  it("shows the gateway's own reason for other 401s", () => {
    expect(describeError(new GatewayError(401, { error: "invalid email or password" }))).toBe(
      "Invalid email or password."
    );
  });
});

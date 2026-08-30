import { describe, expect, it } from "vitest";
import { hashAdminPassword, verifyAdminPassword } from "../src/lib/auth/admin-password";

describe("admin password hashing", () => {
  it("verifies the original password without storing it in the hash", async () => {
    const password = "VELOX-test-password-2026";
    const hash = await hashAdminPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyAdminPassword(password, hash)).resolves.toBe(true);
    await expect(verifyAdminPassword("incorrect-password", hash)).resolves.toBe(false);
  });

  it("rejects malformed stored values", async () => {
    await expect(verifyAdminPassword("anything", "not-a-supported-password-hash")).resolves.toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { PROFILE_IMAGE_MAX_BYTES, validateProfileImageFile } from "../src/lib/validation/profile-image";

function fileLike(type: string, size = 100) {
  return { arrayBuffer: async () => new ArrayBuffer(size), name: "avatar", size, type };
}

describe("profile image validation", () => {
  it("accepts supported image uploads within the size limit", () => {
    expect(validateProfileImageFile(fileLike("image/jpeg"))).toBe(true);
    expect(validateProfileImageFile(fileLike("image/png"))).toBe(true);
    expect(validateProfileImageFile(fileLike("image/webp"))).toBe(true);
  });

  it("rejects unsupported or oversized files", () => {
    expect(validateProfileImageFile(fileLike("image/gif"))).toBe(false);
    expect(validateProfileImageFile(fileLike("image/png", PROFILE_IMAGE_MAX_BYTES + 1))).toBe(false);
  });
});

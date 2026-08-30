import { describe, expect, it } from "vitest";
import { evidenceExtension, validateEvidenceFile } from "../src/lib/validation/evidence";

function fileLike(type: string, size: number) {
  return { name: "proof.png", type, size, arrayBuffer: async () => new ArrayBuffer(0) };
}

describe("match evidence validation", () => {
  it("allows only supported image MIME types within the size limit", () => {
    expect(validateEvidenceFile(fileLike("image/png", 5 * 1024 * 1024))).toBe(true);
    expect(evidenceExtension("image/png")).toBe("png");
  });

  it("rejects extension-only, oversized, empty, and non-image uploads", () => {
    expect(validateEvidenceFile(fileLike("image/svg+xml", 200))).toBe(false);
    expect(validateEvidenceFile(fileLike("image/jpeg", 5 * 1024 * 1024 + 1))).toBe(false);
    expect(validateEvidenceFile(fileLike("image/webp", 0))).toBe(false);
    expect(validateEvidenceFile({ name: "proof.png", type: "image/png", size: 1 })).toBe(false);
  });
});

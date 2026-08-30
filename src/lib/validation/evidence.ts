const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type EvidenceFile = Pick<File, "arrayBuffer" | "name" | "size" | "type">;

export function validateEvidenceFile(file: unknown): file is EvidenceFile {
  if (!file || typeof file !== "object") return false;
  const candidate = file as Partial<EvidenceFile>;
  return (
    typeof candidate.arrayBuffer === "function"
    && typeof candidate.name === "string"
    && typeof candidate.size === "number"
    && candidate.size > 0
    && candidate.size <= MAX_EVIDENCE_BYTES
    && typeof candidate.type === "string"
    && candidate.type in MIME_EXTENSIONS
  );
}

export function evidenceExtension(mimeType: keyof typeof MIME_EXTENSIONS) {
  return MIME_EXTENSIONS[mimeType];
}

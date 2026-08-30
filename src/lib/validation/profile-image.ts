const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

const PROFILE_IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProfileImageFile = Pick<File, "arrayBuffer" | "name" | "size" | "type">;

export function validateProfileImageFile(file: unknown): file is ProfileImageFile {
  if (!file || typeof file !== "object") return false;
  const candidate = file as Partial<ProfileImageFile>;

  return (
    typeof candidate.arrayBuffer === "function"
    && typeof candidate.name === "string"
    && typeof candidate.size === "number"
    && candidate.size > 0
    && candidate.size <= MAX_PROFILE_IMAGE_BYTES
    && typeof candidate.type === "string"
    && candidate.type in PROFILE_IMAGE_EXTENSIONS
  );
}

export function profileImageExtension(mimeType: keyof typeof PROFILE_IMAGE_EXTENSIONS) {
  return PROFILE_IMAGE_EXTENSIONS[mimeType];
}

export const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const PROFILE_IMAGE_MAX_BYTES = MAX_PROFILE_IMAGE_BYTES;

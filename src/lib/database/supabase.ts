import "server-only";

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { evidenceExtension, type EvidenceFile, validateEvidenceFile } from "@/lib/validation/evidence";
import { profileImageExtension, type ProfileImageFile, validateProfileImageFile } from "@/lib/validation/profile-image";

const EVIDENCE_BUCKET = "match-evidence";
const PROFILE_IMAGES_BUCKET = "profile-images";

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { validateEvidenceFile };

async function ensureProfileImagesBucket() {
  const client = getSupabaseAdminClient();
  const { data: existingBucket } = await client.storage.getBucket(PROFILE_IMAGES_BUCKET);
  if (existingBucket) return client;

  const { error } = await client.storage.createBucket(PROFILE_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (error && !/already exists/i.test(error.message)) {
    console.error("Profile image bucket creation failed", { code: error.name });
    throw new Error("PROFILE_IMAGE_UPLOAD_FAILED");
  }

  return client;
}

export async function uploadMatchEvidence(matchId: string, userId: string, file: EvidenceFile) {
  if (!validateEvidenceFile(file)) {
    throw new Error("INVALID_EVIDENCE_FILE");
  }

  const extension = evidenceExtension(file.type as "image/jpeg" | "image/png" | "image/webp");
  const storagePath = `${matchId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const storage = getSupabaseAdminClient().storage.from(EVIDENCE_BUCKET);
  const { error } = await storage.upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Match evidence upload failed", { code: error.name });
    throw new Error("EVIDENCE_UPLOAD_FAILED");
  }

  return { storagePath, fileType: file.type, fileSize: file.size };
}

export async function createEvidenceSignedUrl(storagePath: string, expiresInSeconds = 10 * 60) {
  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error("Match evidence signed URL creation failed", { code: error?.name });
    throw new Error("EVIDENCE_URL_FAILED");
  }

  return data.signedUrl;
}

export async function uploadProfileImage(userId: string, file: ProfileImageFile) {
  if (!validateProfileImageFile(file)) {
    throw new Error("INVALID_PROFILE_IMAGE");
  }

  const client = await ensureProfileImagesBucket();
  const extension = profileImageExtension(file.type as "image/jpeg" | "image/png" | "image/webp");
  const storagePath = `avatars/${userId}/${crypto.randomUUID()}.${extension}`;
  const storage = client.storage.from(PROFILE_IMAGES_BUCKET);
  const { error } = await storage.upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Profile image upload failed", { code: error.name });
    throw new Error("PROFILE_IMAGE_UPLOAD_FAILED");
  }

  const { data } = storage.getPublicUrl(storagePath);
  if (!data.publicUrl) throw new Error("PROFILE_IMAGE_UPLOAD_FAILED");
  return data.publicUrl;
}

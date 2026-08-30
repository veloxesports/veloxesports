import "server-only";

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { evidenceExtension, type EvidenceFile, validateEvidenceFile } from "@/lib/validation/evidence";

const EVIDENCE_BUCKET = "match-evidence";

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

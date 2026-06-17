"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureBucket,
  uploadFile,
  fileExt,
  DOCS_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/storage";
import { DRIVER_DOC_TYPES, BUSINESS_DOC_TYPES } from "@/lib/account";
import type { DocumentType } from "@/lib/database.types";

export type UploadResult = { ok: true } | { ok: false; message: string };

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

// Upload a proof to the private documents bucket and record a `document` row.
// One action serves both sides: it resolves the caller's role → owner_type +
// owner_id, so a Driver can only file Driver docs against their own id and a
// Business only its own. The row's status stays 'pending' (👤 verified by a
// human in beta). Writes go through the service role (no INSERT RLS on document).
export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const typeRaw = String(formData.get("doc_type") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "File is too large (max 10 MB)." };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, message: "Use a PDF, JPG, PNG or WebP file." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You’re not signed in." };

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let ownerType: "driver" | "business";
  let ownerId: string;
  let allowed: readonly DocumentType[];
  let revalidate: string;

  if (profile?.role === "driver") {
    const { data: driver } = await supabase
      .from("driver")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!driver) return { ok: false, message: "Driver profile not found." };
    ownerType = "driver";
    ownerId = driver.id;
    allowed = DRIVER_DOC_TYPES;
    revalidate = "/settings";
  } else if (profile?.role === "dispatcher") {
    const { data: dispatcher } = await supabase
      .from("dispatcher")
      .select("business_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!dispatcher) return { ok: false, message: "Business profile not found." };
    ownerType = "business";
    ownerId = dispatcher.business_id;
    allowed = BUSINESS_DOC_TYPES;
    revalidate = "/dispatch/settings";
  } else {
    return { ok: false, message: "Unknown account type." };
  }

  if (!allowed.includes(typeRaw as DocumentType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const docType = typeRaw as DocumentType;

  try {
    await ensureBucket(DOCS_BUCKET, false);
    const path = `${ownerType}/${ownerId}/${docType}-${Date.now()}.${fileExt(file)}`;
    await uploadFile(DOCS_BUCKET, path, file);

    const admin = createAdminClient();
    const { error } = await admin.from("document").insert({
      owner_type: ownerType,
      owner_id: ownerId,
      type: docType,
      file_url: path,
    });
    if (error) return { ok: false, message: "Couldn’t save the document record." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Upload failed.",
    };
  }

  revalidatePath(revalidate);
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureBucket,
  uploadFile,
  publicMediaUrl,
  fileExt,
  MEDIA_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/storage";

const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];

// Update the Business profile + the Dispatcher's own contact in one save.
// Service-role, gated to the current user's dispatcher seat / its business
// (business + dispatcher have no UPDATE RLS policy). Logo (optional) → public
// avatars bucket → business.logo_url.
export async function updateBusinessSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: dispatcher } = await admin
    .from("dispatcher")
    .select("id, business_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!dispatcher) redirect("/onboarding-business");

  const businessName = String(formData.get("business_name") ?? "").trim();
  const field = String(formData.get("field_of_activity") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!businessName || !contactName) {
    redirect("/dispatch/settings?error=missing");
  }

  // Optional logo (validate before the upload try — redirect throws).
  let logoUrl: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_UPLOAD_BYTES) redirect("/dispatch/settings?error=filesize");
    if (!IMAGE_MIME.includes(logo.type)) redirect("/dispatch/settings?error=filetype");
    let failed = false;
    try {
      await ensureBucket(MEDIA_BUCKET, true);
      const path = `business/${dispatcher.business_id}.${fileExt(logo)}`;
      await uploadFile(MEDIA_BUCKET, path, logo);
      logoUrl = publicMediaUrl(path, Date.now());
    } catch {
      failed = true;
    }
    if (failed) redirect("/dispatch/settings?error=upload");
  }

  const { error: bizErr } = await admin
    .from("business")
    .update({
      name: businessName,
      field_of_activity: field || null,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    })
    .eq("id", dispatcher.business_id);
  if (bizErr) redirect("/dispatch/settings?error=db");

  const { error: dispErr } = await admin
    .from("dispatcher")
    .update({ name: contactName, phone: phone || null })
    .eq("id", dispatcher.id);
  if (dispErr) redirect("/dispatch/settings?error=db");

  redirect("/dispatch/settings?ok=1");
}

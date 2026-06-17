"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureBucket,
  uploadFile,
  publicMediaUrl,
  MEDIA_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/storage";

export type AvatarResult = { ok: true } | { ok: false; message: string };

const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];

interface Owner {
  kind: "driver" | "business";
  id: string;
  revalidate: string;
}

// Resolve the caller to the avatar they may change (their own only).
async function resolveOwner(): Promise<Owner | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.role === "driver") {
    const { data: d } = await supabase
      .from("driver")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return d ? { kind: "driver", id: d.id, revalidate: "/settings" } : null;
  }
  if (profile?.role === "dispatcher") {
    const { data: disp } = await supabase
      .from("dispatcher")
      .select("business_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return disp
      ? { kind: "business", id: disp.business_id, revalidate: "/dispatch/settings" }
      : null;
  }
  return null;
}

// Cropped image (PNG) from the avatar editor → public avatars bucket at a
// deterministic path (so re-uploads overwrite, no orphans) → set the URL.
export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No image provided." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Image is too large (max 10 MB)." };
  }
  // Server actions are public endpoints — validate the type here, not just in
  // the client editor or the bucket allowlist (which may pre-exist).
  if (!IMAGE_MIME.includes(file.type)) {
    return { ok: false, message: "Please upload a PNG, JPG or WebP image." };
  }

  const owner = await resolveOwner();
  if (!owner) return { ok: false, message: "You’re not signed in." };

  try {
    await ensureBucket(MEDIA_BUCKET, true);
    const path = `${owner.kind}/${owner.id}.png`;
    await uploadFile(MEDIA_BUCKET, path, file);
    const url = publicMediaUrl(path, Date.now());

    const admin = createAdminClient();
    const { error } =
      owner.kind === "driver"
        ? await admin.from("driver").update({ profile_photo_url: url }).eq("id", owner.id)
        : await admin.from("business").update({ logo_url: url }).eq("id", owner.id);
    if (error) return { ok: false, message: "Couldn’t save the image." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Upload failed." };
  }

  revalidatePath(owner.revalidate);
  return { ok: true };
}

// Clear the avatar: delete the stored object and null the column.
export async function removeAvatar(): Promise<AvatarResult> {
  const owner = await resolveOwner();
  if (!owner) return { ok: false, message: "You’re not signed in." };

  const admin = createAdminClient();
  await admin.storage.from(MEDIA_BUCKET).remove([`${owner.kind}/${owner.id}.png`]);
  const { error } =
    owner.kind === "driver"
      ? await admin.from("driver").update({ profile_photo_url: null }).eq("id", owner.id)
      : await admin.from("business").update({ logo_url: null }).eq("id", owner.id);
  if (error) return { ok: false, message: "Couldn’t remove the image." };

  revalidatePath(owner.revalidate);
  return { ok: true };
}

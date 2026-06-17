// Server-only read helper for the documents surface. Gated by (owner_type,
// owner_id) which the caller resolves from auth — mirrors the contact-unlock
// pattern (D7): the service role reads, but only for the caller's own owner id.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { signedDocUrl } from "@/lib/supabase/storage";
import type { DocumentType, DocumentStatus } from "@/lib/database.types";

export interface DocView {
  type: DocumentType;
  status: DocumentStatus | null;
  uploadedAt: string | null;
  viewUrl: string | null;
}

// Latest document per requested type, each with a fresh short-lived view URL.
export async function getLatestDocuments(
  ownerType: "driver" | "business",
  ownerId: string,
  types: readonly DocumentType[],
): Promise<DocView[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("document")
    .select("type, status, file_url, uploaded_at")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("uploaded_at", { ascending: false });

  const latest = new Map<DocumentType, NonNullable<typeof data>[number]>();
  for (const d of data ?? []) {
    if (!latest.has(d.type)) latest.set(d.type, d);
  }

  return Promise.all(
    types.map(async (type) => {
      const d = latest.get(type);
      return {
        type,
        status: d?.status ?? null,
        uploadedAt: d?.uploaded_at ?? null,
        viewUrl: d ? await signedDocUrl(d.file_url) : null,
      };
    }),
  );
}

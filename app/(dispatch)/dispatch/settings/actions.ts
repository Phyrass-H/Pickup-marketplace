"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Update the Business profile + the Dispatcher's own contact in one save.
// Service-role, gated to the current user's dispatcher seat / its business
// (business + dispatcher have no UPDATE RLS policy). The logo is handled
// separately by the avatar editor.
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

  const { error: bizErr } = await admin
    .from("business")
    .update({ name: businessName, field_of_activity: field || null })
    .eq("id", dispatcher.business_id);
  if (bizErr) redirect("/dispatch/settings?error=db");

  const { error: dispErr } = await admin
    .from("dispatcher")
    .update({ name: contactName, phone: phone || null })
    .eq("id", dispatcher.id);
  if (dispErr) redirect("/dispatch/settings?error=db");

  redirect("/dispatch/settings?ok=1");
}

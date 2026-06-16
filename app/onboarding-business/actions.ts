"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates the Business + Dispatcher seat + profile(role=dispatcher) for the
// logged-in user. Service-role because profile/dispatcher/business have no
// INSERT RLS policy in beta — gated strictly to the current user's id.
export async function createBusinessProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessName = String(formData.get("business_name") ?? "").trim();
  const field = String(formData.get("field_of_activity") ?? "").trim();
  const contactName = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!businessName || !contactName) {
    redirect("/onboarding-business?error=missing");
  }

  const admin = createAdminClient();

  // Don't let a direct POST flip an existing driver into a dispatcher.
  const { data: existingProfile } = await admin
    .from("profile")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existingProfile && existingProfile.role !== "dispatcher") redirect("/");

  const { error: profileErr } = await admin
    .from("profile")
    .upsert(
      { auth_user_id: user.id, role: "dispatcher" },
      { onConflict: "auth_user_id" },
    );
  if (profileErr) redirect("/onboarding-business?error=db");

  // A dispatcher seat is unique per auth user — if it exists, we're done.
  const { data: existing } = await admin
    .from("dispatcher")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/dispatch");

  const { data: business, error: bizErr } = await admin
    .from("business")
    .insert({ name: businessName, field_of_activity: field || null })
    .select("id")
    .single();
  if (bizErr || !business) redirect("/onboarding-business?error=db");

  const { error: dispErr } = await admin.from("dispatcher").insert({
    business_id: business!.id,
    auth_user_id: user.id,
    name: contactName,
    email: user.email ?? null,
    phone: phone || null,
  });
  if (dispErr) redirect("/onboarding-business?error=db");

  redirect("/dispatch");
}

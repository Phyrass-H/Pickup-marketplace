"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { parseGuestContacts } from "@/lib/passengers";

// Toggle whether a passenger's phone is shared with the Driver. Called from the
// schedule trip detail (and pre-shared from the new-mission form, which writes the
// flag directly). The write goes through the USER session, so RLS
// (p_guestcontact_business_all) restricts it to a mission this Business owns — a
// Dispatcher can never flip another Business's flag. The number itself stays in
// mission_guest_contact, which Drivers cannot read; the assigned Driver only ever
// sees a SHARED number, revealed server-side in /rides.
export async function shareGuestPhone(
  missionId: string,
  index: number,
  shared: boolean,
): Promise<{ ok: boolean; shared?: boolean }> {
  const ctx = await getAppContext();
  if (!ctx.business || !ctx.dispatcher) return { ok: false };
  if (!missionId || !Number.isInteger(index) || index < 0) return { ok: false };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("mission_guest_contact")
    .select("contacts")
    .eq("mission_id", missionId)
    .maybeSingle();
  if (readErr || !row) return { ok: false };

  const contacts = parseGuestContacts(row.contacts);
  // Can only share a number that exists at that index.
  if (index >= contacts.length || !contacts[index].phone) return { ok: false };
  contacts[index] = { ...contacts[index], shared };

  const { error } = await supabase
    .from("mission_guest_contact")
    .update({ contacts, updated_at: new Date().toISOString() })
    .eq("mission_id", missionId);
  if (error) return { ok: false };

  revalidatePath("/dispatch", "layout");
  return { ok: true, shared };
}

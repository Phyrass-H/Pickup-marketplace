import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { getAppContext } from "@/lib/app-context";
import { AvatarEditor } from "@/components/avatar-editor";
import { LanguagePicker } from "@/components/language-picker";
import { SettingsHeader, SaveNotice } from "@/components/settings-header";
import { updateProfile } from "../actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  missing: "Please fill in your first and last name.",
  db: "Something went wrong saving your changes. Please try again.",
};

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");
  const driver = ctx.driver;
  const { ok, error } = await searchParams;

  return (
    <>
      <SettingsHeader title="Profile" />
      <SaveNotice ok={ok} error={error} messages={NOTICE} />

      <div className="dcard">
        <p className="dcard__label">Photo</p>
        <AvatarEditor
          kind="driver"
          currentUrl={driver.profile_photo_url}
          fallback={driver.first_name}
        />
      </div>

      <form action={updateProfile}>
        <div className="dcard">
          <p className="dcard__label">You</p>
          <div className="grid-2">
            <label className="field">
              <span>First name</span>
              <input type="text" name="first_name" defaultValue={driver.first_name} required />
            </label>
            <label className="field">
              <span>Last name</span>
              <input type="text" name="last_name" defaultValue={driver.last_name} required />
            </label>
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Phone</span>
            <input
              type="tel"
              name="phone"
              defaultValue={driver.phone ?? ""}
              placeholder="+33 6 12 34 56 78"
            />
            <span className="dhint">
              <Eye size={13} strokeWidth={1.9} aria-hidden="true" />
              Hidden until you accept a mission — then the Business can call you.
            </span>
          </label>
        </div>

        <div className="dcard">
          <p className="dcard__label">Languages you speak</p>
          <LanguagePicker defaults={driver.languages} />
          <p className="dhint dhint--block">
            Shown on a trip where the Business asked for a language. Never a filter — you
            still see every mission.
          </p>
        </div>

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app-context";
import { getLatestDocuments } from "@/lib/documents";
import { DRIVER_DOC_TYPES } from "@/lib/account";
import { BETA_ZONES } from "@/lib/zones";
import { DocumentSection } from "@/components/document-section";
import { updateDriverSettings } from "./actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, { tone: string; text: string }> = {
  missing: { tone: "error", text: "Please fill in your name and pick at least one zone." },
  db: { tone: "error", text: "Something went wrong saving your changes. Please try again." },
  upload: { tone: "error", text: "Your photo couldn’t be uploaded. Please try another file." },
  filesize: { tone: "error", text: "That photo is too large (max 10 MB)." },
  filetype: { tone: "error", text: "Please use a PNG, JPG or WebP image." },
};

export default async function DriverSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");
  const driver = ctx.driver;
  const vehicle = ctx.vehicle;

  const { ok, error } = await searchParams;
  const docs = await getLatestDocuments("driver", driver.id, DRIVER_DOC_TYPES);

  return (
    <>
      <h1>Settings</h1>

      {ok && <div className="notice success">Your changes were saved.</div>}
      {error && NOTICE[error] && (
        <div className={`notice ${NOTICE[error].tone}`}>{NOTICE[error].text}</div>
      )}

      <form action={updateDriverSettings} className="card">
        <h2>Profile</h2>

        <div className="avatar-row">
          {driver.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={driver.profile_photo_url} alt="Your profile photo" />
          ) : (
            <span className="avatar avatar-empty">{driver.first_name?.[0] ?? "?"}</span>
          )}
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Profile photo</span>
            <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" />
          </label>
        </div>

        <label className="field">
          <span>First name</span>
          <input type="text" name="first_name" defaultValue={driver.first_name} required />
        </label>
        <label className="field">
          <span>Last name</span>
          <input type="text" name="last_name" defaultValue={driver.last_name} required />
        </label>
        <label className="field">
          <span>Phone (revealed to the Business when you accept)</span>
          <input type="tel" name="phone" defaultValue={driver.phone ?? ""} placeholder="+33 6 12 34 56 78" />
        </label>
        <label className="field">
          <span>Languages (comma-separated)</span>
          <input type="text" name="languages" defaultValue={driver.languages.join(", ")} placeholder="Français, English, Italiano" />
        </label>
        <label className="field">
          <span>Preferred GPS</span>
          <select name="preferred_gps" defaultValue={driver.preferred_gps ?? "google"}>
            <option value="waze">Waze</option>
            <option value="google">Google Maps</option>
            <option value="apple">Apple Maps</option>
          </select>
        </label>

        <div className="field">
          <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
            Operational zones
          </span>
          <div className="checks">
            {BETA_ZONES.map((zone) => (
              <label className="check" key={zone}>
                <input
                  type="checkbox"
                  name="zones"
                  value={zone}
                  defaultChecked={driver.operational_zones.includes(zone)}
                />
                {zone}
              </label>
            ))}
          </div>
        </div>

        <h2 style={{ marginTop: 20 }}>Vehicle</h2>
        <label className="field">
          <span>Category (sets which Pool missions you see)</span>
          <select name="category" defaultValue={vehicle?.category ?? "eco"}>
            <option value="eco">Eco</option>
            <option value="business">Business</option>
            <option value="van">Van</option>
            <option value="luxury">Luxury</option>
          </select>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Make</span>
            <input type="text" name="make" defaultValue={vehicle?.make ?? ""} placeholder="Mercedes" />
          </label>
          <label className="field">
            <span>Model</span>
            <input type="text" name="model" defaultValue={vehicle?.model ?? ""} placeholder="Classe E" />
          </label>
          <label className="field">
            <span>Colour</span>
            <input type="text" name="colour" defaultValue={vehicle?.colour ?? ""} placeholder="Noir" />
          </label>
          <label className="field">
            <span>Plate</span>
            <input type="text" name="plate" defaultValue={vehicle?.plate ?? ""} placeholder="AB-123-CD" />
          </label>
          <label className="field">
            <span>Seats</span>
            <input type="text" inputMode="numeric" name="seats" defaultValue={vehicle?.seats ?? ""} placeholder="4" />
          </label>
        </div>

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>

      <DocumentSection docs={docs} />

      <div className="card">
        <h2>Payouts</h2>
        <p className="muted small" style={{ marginTop: -2 }}>
          {driver.stripe_account_id
            ? "Connected — payouts are set up."
            : "Not connected yet. Your weekly earnings are paid out via Stripe."}
        </p>
        <button className="btn secondary" type="button" disabled>
          Set up payouts with Stripe — coming soon
        </button>
        <p className="muted small" style={{ marginTop: 10 }}>
          Bank details are collected securely by Stripe when payouts go live. PickUp
          never stores your card or IBAN.
        </p>
      </div>

      <p className="small" style={{ marginTop: 8 }}>
        <Link href="/rides/history" className="muted" style={{ textDecoration: "underline" }}>
          View your ride history →
        </Link>
      </p>
    </>
  );
}

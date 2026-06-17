import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app-context";
import { getLatestDocuments } from "@/lib/documents";
import { DRIVER_DOC_TYPES } from "@/lib/account";
import { DocumentSection } from "@/components/document-section";
import { AvatarEditor } from "@/components/avatar-editor";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { updateDriverSettings } from "./actions";

export const dynamic = "force-dynamic";

const RADII = [25, 50, 75, 100, 150, 200, 300];

const NOTICE: Record<string, string> = {
  missing: "Please fill in your first and last name.",
  nobase: "Please pick your base address from the suggestions so the Pool can match by distance.",
  db: "Something went wrong saving your changes. Please try again.",
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

  const base =
    driver.base_lat != null && driver.base_lng != null
      ? { label: driver.base_label ?? "", lat: driver.base_lat, lng: driver.base_lng }
      : null;

  return (
    <>
      <h1>Settings</h1>

      {ok && <div className="notice success">Your changes were saved.</div>}
      {error && NOTICE[error] && <div className="notice error">{NOTICE[error]}</div>}

      <div className="card">
        <h2>Profile</h2>
        <AvatarEditor kind="driver" currentUrl={driver.profile_photo_url} fallback={driver.first_name} />
      </div>

      <form action={updateDriverSettings} className="card">
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

        <h2 style={{ marginTop: 20 }}>Where you work</h2>
        <div className="field">
          <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
            Your base
          </span>
          <AddressAutocomplete
            labelName="base_label"
            latName="base_lat"
            lngName="base_lng"
            defaultValue={base}
            placeholder="Start typing a town or address…"
          />
        </div>
        <label className="field">
          <span>Service radius — how far from your base you’ll drive</span>
          <select name="service_radius_km" defaultValue={String(driver.service_radius_km ?? 50)}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                Up to {r} km
              </option>
            ))}
          </select>
        </label>
        <p className="muted small" style={{ marginTop: -6 }}>
          A mission appears in your Pool when its pickup <strong>or</strong> drop-off is within this
          distance of your base — so a long transfer that ends near you still shows up.
        </p>

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

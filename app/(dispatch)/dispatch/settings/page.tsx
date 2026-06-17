import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app-context";
import { getLatestDocuments } from "@/lib/documents";
import { BUSINESS_DOC_TYPES } from "@/lib/account";
import { DispatchTabs } from "@/components/dispatch-tabs";
import { DocumentSection } from "@/components/document-section";
import { updateBusinessSettings } from "./actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  missing: "Please fill in the business name and your contact name.",
  db: "Something went wrong saving your changes. Please try again.",
  upload: "Your logo couldn’t be uploaded. Please try another file.",
  filesize: "That logo is too large (max 10 MB).",
  filetype: "Please use a PNG, JPG or WebP image.",
};

export default async function BusinessSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.business || !ctx.dispatcher) redirect("/onboarding-business");
  const business = ctx.business;
  const dispatcher = ctx.dispatcher;

  const { ok, error } = await searchParams;
  const docs = await getLatestDocuments("business", business.id, BUSINESS_DOC_TYPES);

  return (
    <main className="container">
      <DispatchTabs />

      <h1>Settings</h1>

      {ok && <div className="notice success">Your changes were saved.</div>}
      {error && NOTICE[error] && <div className="notice error">{NOTICE[error]}</div>}

      <form action={updateBusinessSettings} className="card">
        <h2>Business</h2>

        <div className="avatar-row">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={business.logo_url} alt="Business logo" />
          ) : (
            <span className="avatar avatar-empty">{business.name?.[0] ?? "?"}</span>
          )}
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Logo</span>
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
          </label>
        </div>

        <label className="field">
          <span>Business name</span>
          <input type="text" name="business_name" defaultValue={business.name} required />
        </label>
        <label className="field">
          <span>Field of activity</span>
          <input
            type="text"
            name="field_of_activity"
            defaultValue={business.field_of_activity ?? ""}
            placeholder="Hôtellerie"
          />
        </label>

        <h2 style={{ marginTop: 20 }}>Your contact</h2>
        <label className="field">
          <span>Contact name (the Dispatcher)</span>
          <input type="text" name="contact_name" defaultValue={dispatcher.name} required />
        </label>
        <label className="field">
          <span>Phone (revealed to the Driver on acceptance)</span>
          <input type="tel" name="phone" defaultValue={dispatcher.phone ?? ""} placeholder="+33 4 93 00 00 00" />
        </label>

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>

      <DocumentSection docs={docs} />

      <div className="card">
        <h2>Billing</h2>
        <p className="muted small" style={{ marginTop: -2 }}>
          {business.stripe_customer_id
            ? "Connected — your card is on file."
            : "Not connected yet. Trips are charged to a card on file via Stripe."}
        </p>
        <button className="btn secondary" type="button" disabled>
          Add a payment method — coming soon
        </button>
        <p className="muted small" style={{ marginTop: 10 }}>
          Card details are collected securely by Stripe when billing goes live. PickUp
          never stores your card number.
        </p>
      </div>

      <p className="small" style={{ marginTop: 8 }}>
        <Link href="/dispatch/history" className="muted" style={{ textDecoration: "underline" }}>
          View mission history →
        </Link>
      </p>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getAppContext, routeFor } from "@/lib/app-context";
import { createBusinessProfile } from "./actions";

export default async function BusinessOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (ctx.profile && ctx.profile.role !== "dispatcher") redirect(routeFor(ctx));
  if (ctx.dispatcher && ctx.business) redirect("/dispatch");

  const { error } = await searchParams;

  return (
    <main className="container" style={{ paddingTop: 28 }}>
      <h1>Set up your Business</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Post missions to PickUp Drivers. Signed in as{" "}
        <strong>{ctx.user.email}</strong>.
      </p>

      {error === "missing" && (
        <div className="notice error">
          Please fill in your business name and your contact name.
        </div>
      )}
      {error === "db" && (
        <div className="notice error">
          Something went wrong saving your business. Please try again.
        </div>
      )}

      <form action={createBusinessProfile} className="card">
        <label className="field">
          <span>Business name</span>
          <input type="text" name="business_name" required placeholder="Hôtel …" />
        </label>
        <label className="field">
          <span>Field of activity</span>
          <input
            type="text"
            name="field_of_activity"
            placeholder="Hotel, concierge, event agency…"
          />
        </label>
        <label className="field">
          <span>Your name (Dispatcher contact)</span>
          <input type="text" name="name" required />
        </label>
        <label className="field">
          <span>Phone (revealed to the Driver on acceptance)</span>
          <input type="tel" name="phone" placeholder="+33 …" />
        </label>

        <button className="btn" type="submit">
          Create business and start posting
        </button>
      </form>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getAppContext, routeFor } from "@/lib/app-context";
import { createDriverProfile } from "./actions";
import { BETA_ZONES } from "@/lib/zones";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (ctx.profile && ctx.profile.role !== "driver") redirect(routeFor(ctx));
  if (ctx.driver && ctx.vehicle) redirect("/pool");

  const user = ctx.user;
  const { error } = await searchParams;

  return (
    <main className="container" style={{ paddingTop: 28 }}>
      <h1>Set up your Driver profile</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        We need a few details to show you the right missions. Signed in as{" "}
        <strong>{user.email}</strong>.
      </p>

      {error === "missing" && (
        <div className="notice error">
          Please fill in your name, pick a vehicle category, and select at least
          one zone.
        </div>
      )}
      {error === "db" && (
        <div className="notice error">
          Something went wrong saving your profile. Please try again.
        </div>
      )}

      <form action={createDriverProfile} className="card">
        <label className="field">
          <span>First name</span>
          <input type="text" name="first_name" required />
        </label>
        <label className="field">
          <span>Last name</span>
          <input type="text" name="last_name" required />
        </label>
        <label className="field">
          <span>Phone (revealed to the Business when you accept)</span>
          <input type="tel" name="phone" placeholder="+33 6 12 34 56 78" />
        </label>

        <label className="field">
          <span>Vehicle category</span>
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Choose a category…
            </option>
            <option value="eco">Eco</option>
            <option value="business">Business</option>
            <option value="van">Van</option>
            <option value="luxury">Luxury</option>
          </select>
        </label>

        <label className="field">
          <span>Preferred GPS</span>
          <select name="preferred_gps" defaultValue="google">
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
                <input type="checkbox" name="zones" value={zone} />
                {zone}
              </label>
            ))}
          </div>
        </div>

        <button className="btn" type="submit">
          Save and see the Pool
        </button>
      </form>
    </main>
  );
}

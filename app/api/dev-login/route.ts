// DEV-ONLY one-click sign-in. Lets you try the app locally WITHOUT email or any
// Supabase dashboard config: it ensures a confirmed user (with a fixed dev
// password) via the service role, then signs in server-side so the session
// cookie is set. Blocked on any hosted environment.
//
//   /api/dev-login?as=business   → sign in as the demo Business
//   /api/dev-login?as=driver     → sign in as the demo Driver
//   /api/dev-login?email=you@x   → sign in as any email (created if needed)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEV_PASSWORD = "pickup-dev-password-123";
const DEMO = {
  business: "demo.business@pickup.local",
  driver: "demo.driver@pickup.local",
} as const;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Local dev: open. Hosted (Vercel/prod): require a secret key that matches the
  // DEV_LOGIN_KEY env var, so the live URL isn't a free login for anyone but you
  // can still test without email / Supabase redirect-URL config.
  const hosted = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (hosted) {
    const key = process.env.DEV_LOGIN_KEY;
    if (!key || searchParams.get("key") !== key) {
      return NextResponse.json(
        { error: "Dev sign-in requires a valid key on this environment." },
        { status: 403 },
      );
    }
  }

  const as = searchParams.get("as");
  const email =
    searchParams.get("email")?.trim() ||
    (as === "business" ? DEMO.business : as === "driver" ? DEMO.driver : null);

  if (!email) {
    return NextResponse.json(
      { error: "Pass ?as=business, ?as=driver, or ?email=…" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  await ensureUser(admin, email);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Land on "/", which routes by role (→ /welcome on first sign-in).
  return NextResponse.redirect(new URL("/", origin));
}

async function ensureUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<void> {
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (created?.user) return;

  // Already exists → make sure the password + confirmation are set so sign-in works.
  const { data: list } = await admin.auth.admin.listUsers();
  const found = list?.users.find((u) => u.email === email);
  if (found) {
    await admin.auth.admin.updateUserById(found.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
    });
  }
}

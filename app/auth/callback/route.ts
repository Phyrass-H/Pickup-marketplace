// Magic-link landing: exchange the one-time code for a session cookie, then
// send the Driver into the app. The root page (/) routes them on to /pool or
// /onboarding depending on whether their Driver profile exists yet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Supabase sends error/error_code on expired or already-used links (no code).
  const linkError = searchParams.get("error_code") ?? searchParams.get("error");

  // SECURITY: only honour `next` when it's a host-local absolute path, so a
  // crafted `?next=@evil.com` / `//evil.com` can't turn the post-login redirect
  // into an open redirect. Anything else falls back to "/".
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\")
      ? rawNext
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(new URL("/login?error=exchange", origin));
  }

  const reason = linkError ?? "auth";
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(reason)}`, origin),
  );
}

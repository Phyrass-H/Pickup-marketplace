"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  initialError,
  devEnabled = false,
}: {
  initialError: string | null;
  devEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>PickUp Driver</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          Sign in to see available missions.
        </p>

        {status === "sent" ? (
          <div className="notice success">
            Check your email — we sent a sign-in link to{" "}
            <strong>{email}</strong>. Open it on this device to continue.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            {/* Error from the magic-link callback (expired/invalid link). */}
            {initialError && status === "idle" && (
              <div className="notice error">
                Your sign-in link was invalid or has expired — request a new one
                below.
              </div>
            )}
            {status === "error" && <div className="notice error">{message}</div>}
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              className="btn"
              type="submit"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            <p className="muted small" style={{ marginTop: 12 }}>
              No password needed. We email you a secure one-time link.
            </p>
            {devEnabled && (
              <p className="small" style={{ marginTop: 8 }}>
                <a href="/dev-login" style={{ color: "var(--accent)" }}>
                  Local testing? Use one-click dev sign-in →
                </a>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

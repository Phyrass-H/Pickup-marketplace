"use client";

import { useState, type ReactNode } from "react";

export interface SettingsSection {
  key: string;
  title: string;
  icon: ReactNode;
  soon?: boolean;
  content: ReactNode;
}

// Left-nav settings shell (Company / Contact / Branding / …). Each section's
// content is server-rendered (its own form + server action) and passed in; the
// nav just toggles which one is visible. All sections stay mounted so a hidden
// section's form still works the instant you switch to it. `initial` re-opens the
// section that was just saved (the server action echoes ?s=<key> back).
export function SettingsTabs({
  sections,
  initial,
}: {
  sections: SettingsSection[];
  initial?: string;
}) {
  const [active, setActive] = useState(
    initial && sections.some((s) => s.key === initial) ? initial : sections[0]?.key,
  );

  return (
    <div className="set-wrap">
      <nav className="set-nav" aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`set-nitem${active === s.key ? " is-on" : ""}`}
            aria-current={active === s.key ? "page" : undefined}
            onClick={() => setActive(s.key)}
          >
            <span className="set-nitem__ic" aria-hidden>
              {s.icon}
            </span>
            <span className="set-nitem__label">{s.title}</span>
            {s.soon && <span className="set-soon">soon</span>}
          </button>
        ))}
      </nav>

      <div className="set-content">
        {sections.map((s) => (
          <section key={s.key} hidden={active !== s.key} aria-label={s.title}>
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
}

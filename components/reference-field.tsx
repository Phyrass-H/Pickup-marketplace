"use client";

import { useState } from "react";
import { Bookmark, EyeOff } from "lucide-react";

const MAX = 20;

// A short, ≤20-char booking reference (a room or event tag) the Business types
// for its own schedule line — e.g. "Room 312", "FIF 2026 Chopard". It shows on
// the Dispatch schedule + Review preview ONLY, never to the Driver (Driver-facing
// instructions live in the Driver & service card's private message, S19). Emits
// the form field `reference`; backed by mission.reference. Controlled so the live
// character count tracks input; the cap is also enforced server-side in actions.ts.
export function ReferenceField({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState((defaultValue ?? "").slice(0, MAX));
  const near = value.length >= MAX - 3;

  return (
    <div className="rf">
      <div className="rf-head">
        <span className="rf-label">
          Reference <span className="rf-opt">(optional)</span>
        </span>
        <span className={`rf-count${near ? " rf-count--near" : ""}`} aria-hidden>
          {value.length} / {MAX}
        </span>
      </div>

      <div className="rf-input">
        <Bookmark size={18} aria-hidden />
        <input
          type="text"
          name="reference"
          maxLength={MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Room 312"
          aria-label="Reference"
        />
      </div>

      <p className="rf-hint">A short tag for your own schedule.</p>
      <p className="rf-note">
        <EyeOff size={14} aria-hidden /> Not shown to the Driver
      </p>
    </div>
  );
}

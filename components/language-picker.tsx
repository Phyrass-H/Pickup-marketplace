"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Languages, as chips. It was a comma-separated text field — the weakest input on
// the screen: "Francais, anglais" and "FR/EN" both meant the same thing and neither
// matched what a Business asks for. The chips are the languages the Riviera actually
// runs on; anything else can still be typed.
const COMMON = [
  "Français",
  "English",
  "Italiano",
  "Español",
  "Deutsch",
  "Русский",
  "العربية",
  "Português",
  "中文",
];

export function LanguagePicker({ defaults }: { defaults: string[] }) {
  const [picked, setPicked] = useState<string[]>(defaults);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Anything the Driver typed before that isn't in the common list still shows.
  const extras = picked.filter((p) => !COMMON.includes(p));
  const all = [...COMMON, ...extras];

  function toggle(lang: string) {
    setPicked((p) => (p.includes(lang) ? p.filter((x) => x !== lang) : [...p, lang]));
  }

  function addDraft() {
    const v = draft.trim().replace(/,/g, "");
    if (v && !picked.includes(v)) setPicked((p) => [...p, v]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div>
      <div className="dchips dchips--pick">
        {all.map((lang) => {
          const on = picked.includes(lang);
          return (
            <button
              type="button"
              key={lang}
              className={`dchip dchip--btn${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(lang)}
            >
              {lang}
              {on && <X size={12} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          );
        })}

        {adding ? (
          <input
            className="dchip dchip--input"
            autoFocus
            value={draft}
            placeholder="Language"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraft();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="dchip dchip--add"
            onClick={() => setAdding(true)}
          >
            <Plus size={12} strokeWidth={2.2} aria-hidden="true" />
            Add
          </button>
        )}
      </div>

      <input type="hidden" name="languages" value={picked.join(", ")} />
    </div>
  );
}

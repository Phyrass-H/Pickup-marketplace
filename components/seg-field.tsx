"use client";

import { useState } from "react";

// A segmented control that submits like a <select>: one hidden input, the choice
// visible without a tap. Same `.seg` styling the vehicle body picker already uses.
export function SegField({
  name,
  options,
  defaultValue,
  label,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  label: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            className={`seg-btn${value === o.value ? " is-on" : ""}`}
            aria-pressed={value === o.value}
            onClick={() => setValue(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </>
  );
}

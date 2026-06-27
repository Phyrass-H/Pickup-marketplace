"use client";

import { useState, useTransition } from "react";
import { ShareSwitch } from "@/components/share-switch";
import { shareGuestPhone } from "@/app/(dispatch)/dispatch/passenger-actions";

// The schedule-side share control: a ShareSwitch backed by the shareGuestPhone
// server action. Optimistic — flips immediately, reverts if the write fails.
export function PhoneShareToggle({
  missionId,
  index,
  shared,
  disabled = false,
}: {
  missionId: string;
  index: number;
  shared: boolean;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(shared);
  const [pending, start] = useTransition();

  function toggle() {
    if (disabled || pending) return; // finished trips are read-only
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const res = await shareGuestPhone(missionId, index, next);
      if (!res?.ok) setOn(!next); // revert on failure
    });
  }

  return <ShareSwitch on={on} onToggle={toggle} disabled={disabled || pending} />;
}

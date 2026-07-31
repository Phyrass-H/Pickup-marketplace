"use client";

// Close-on-outside-tap + Escape, for popovers.
//
// Extracted from components/date-time-picker.tsx, which had the same hook inline
// and listened on `mousedown` only. That is enough on a desktop but leaves a
// popover stuck open on a phone in the cases where the browser doesn't synthesise
// a mouse event — which is exactly the class of bug that made the Earnings period
// picker unusable on mobile. `pointerdown` covers mouse, touch and pen in one
// listener on every browser the app targets.
import { useEffect, useRef } from "react";

export function useDismiss<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    // Nothing is listening while it's shut — otherwise every closed popover on the
    // page keeps a document listener alive for no reason.
    if (!open) return;

    function onDown(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return ref;
}

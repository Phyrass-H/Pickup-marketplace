import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Every account sub-page opens the same way: where you came from, then what this
// page is. The back link is a real route, not history — deep links land properly.
export function SettingsHeader({
  title,
  sub,
  back = "/settings",
  backLabel = "Account",
}: {
  title: string;
  sub?: string;
  back?: string;
  backLabel?: string;
}) {
  return (
    <>
      <Link href={back} className="dback">
        <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
        {backLabel}
      </Link>
      <h1 className="dset__h1">{title}</h1>
      {sub && <p className="dset__sub">{sub}</p>}
    </>
  );
}

// Save feedback. Kept as a banner rather than a toast: a Driver saving on a phone
// often looks away mid-tap, and a toast they miss reads as "it didn't save".
export function SaveNotice({
  ok,
  error,
  messages,
}: {
  ok?: string;
  error?: string;
  messages: Record<string, string>;
}) {
  if (ok) return <div className="notice success">Saved.</div>;
  if (error && messages[error]) return <div className="notice error">{messages[error]}</div>;
  return null;
}

// AGREED RELEASE — the Driver's side of it (O7, D45).
//
// Deliberately its own file rather than a section of lib/amendments.ts: a release
// is not an amendment. An amendment asks "will you take these new terms?"; a
// release asks "will you give this trip up?". The glossary is strict everywhere
// else in this codebase and the two words should not blur here either.

export interface ReleaseDeclineReason {
  key: string;
  label: string;
}

/**
 * Why a Driver kept the trip. Optional, and framed so that picking one never
 * reads as an apology — declining a release is always free and always the
 * Driver's right (D46), so these say "here's why it suits me to keep it",
 * never "sorry".
 *
 * NOT the amendment list: "Schedule too tight" is an answer to "can you take a
 * longer route", not to "will you give this up".
 */
export const RELEASE_DECLINE_REASONS: readonly ReleaseDeclineReason[] = [
  { key: "planned_around", label: "I've planned my day around it" },
  { key: "travelling", label: "I'm already on my way" },
  { key: "need_the_work", label: "I'd rather keep the work" },
  { key: "other", label: "Other" },
];

export function releaseDeclineReasonLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return RELEASE_DECLINE_REASONS.find((r) => r.key === key)?.label ?? key;
}

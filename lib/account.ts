// Account & records — shared metadata for the settings/documents surfaces.
// Document labels name the real French legal documents a VTC Driver / Business
// must provide; the surrounding UI chrome stays English (glossary: Driver,
// Business, …). No "client"/"principal". See docs/02 + the document table.
import type { DocumentType, DocumentStatus } from "@/lib/database.types";

// Ordered as a Driver would complete their file (Doc 02 / backlog A).
export const DRIVER_DOC_TYPES: readonly DocumentType[] = [
  "drivers_licence",
  "vtc_card",
  "revtc",
  "insurance",
  "rc_pro",
  "vehicle_registration",
];

// A Business proves who it is with a single registration document for V1.
export const BUSINESS_DOC_TYPES: readonly DocumentType[] = ["company_registration"];

const DOC_LABELS: Record<DocumentType, string> = {
  drivers_licence: "Driver’s licence",
  vtc_card: "VTC card",
  revtc: "VTC register (REVTC)",
  insurance: "Vehicle insurance",
  rc_pro: "Professional liability (RC Pro)",
  vehicle_registration: "Vehicle registration (carte grise)",
  company_registration: "Company registration (Kbis)",
};

export function documentLabel(t: DocumentType): string {
  return DOC_LABELS[t];
}

const DOC_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

export function documentStatusLabel(s: DocumentStatus): string {
  return DOC_STATUS_LABELS[s];
}

// Maps a document status to a CSS notice/pill tone (reuse globals.css classes).
export function documentStatusTone(s: DocumentStatus): "warn" | "success" | "error" {
  return s === "verified" ? "success" : s === "rejected" ? "error" : "warn";
}

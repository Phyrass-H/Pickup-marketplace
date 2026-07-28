import { notFound, redirect } from "next/navigation";
import { CalendarClock, ExternalLink, Lightbulb } from "lucide-react";
import { getAppContext } from "@/lib/app-context";
import { getLatestDocuments } from "@/lib/documents";
import {
  DRIVER_DOC_TYPES,
  documentMeta,
  documentLabel,
  docState,
  docStateLabel,
  docStateTone,
} from "@/lib/account";
import { DocumentCapture } from "@/components/document-capture";
import { SettingsHeader } from "@/components/settings-header";
import type { DocumentType } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const TONE_PILL: Record<string, string> = {
  success: "dpill--go",
  warn: "dpill--warn",
  error: "dpill--danger",
  neutral: "dpill--neutral",
};

function frenchDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: raw } = await params;
  if (!DRIVER_DOC_TYPES.includes(raw as DocumentType)) notFound();
  const type = raw as DocumentType;

  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");

  const [doc] = await getLatestDocuments("driver", ctx.driver.id, [type]);
  const meta = documentMeta(type);
  const state = docState(doc);
  const tone = docStateTone(state);

  const hasFront = !!doc.viewUrl;
  const hasBack = !!doc.back;
  // Open on the side that actually needs work: a rejected side first, then a missing
  // one. The common case is "I did the front, now do the back".
  const defaultSide = !meta.twoSided
    ? null
    : doc.front?.status === "rejected"
      ? "front"
      : doc.back?.status === "rejected"
        ? "back"
        : !hasFront
          ? "front"
          : !hasBack
            ? "back"
            : "front";

  return (
    <>
      <SettingsHeader
        title={documentLabel(type)}
        sub={meta.blurb}
        back="/settings/documents"
        backLabel="Documents"
      />

      <div className="dcard">
        <p className="dcard__label dcard__label--split">
          <span>Where it stands</span>
          <span className={`dpill dpill--sm ${TONE_PILL[tone]}`}>
            {docStateLabel(state, doc)}
          </span>
        </p>

        {doc.reviewNote && state === "rejected" && (
          <p className="dset__body dset__body--warn">{doc.reviewNote}</p>
        )}

        {state === "missing" ? (
          <p className="dset__body">
            Nothing on file yet.
            {meta.expiry === "required" && ` We’ll ask for the expiry date — it renews ${meta.renews}.`}
          </p>
        ) : (
          <>
            <div className="dfact">
              <span className="dfact__l">Filed</span>
              <span className="dfact__v">{frenchDate(doc.uploadedAt)}</span>
            </div>
            {doc.expiresAt && (
              <div className="dfact">
                <span className="dfact__l">
                  <CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />
                  Expires
                </span>
                <span className="dfact__v">{frenchDate(doc.expiresAt)}</span>
              </div>
            )}
            <div className="dfact">
              <span className="dfact__l">{meta.twoSided ? "Front" : "File"}</span>
              <span className="dfact__v">
                {doc.viewUrl ? (
                  <a href={doc.viewUrl} target="_blank" rel="noreferrer">
                    View
                    <ExternalLink size={13} strokeWidth={1.9} aria-hidden="true" />
                  </a>
                ) : (
                  "Missing"
                )}
              </span>
            </div>
            {meta.twoSided && (
              <div className="dfact">
                <span className="dfact__l">Back</span>
                <span className="dfact__v">
                  {doc.back?.viewUrl ? (
                    <a href={doc.back.viewUrl} target="_blank" rel="noreferrer">
                      View
                      <ExternalLink size={13} strokeWidth={1.9} aria-hidden="true" />
                    </a>
                  ) : (
                    "Missing"
                  )}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Keyed on what's on file: after sending a front, the picker has to move to
          the back on its own — a client useState would keep the stale side. */}
      <DocumentCapture
        key={`${hasFront}-${hasBack}-${defaultSide}`}
        type={type}
        meta={meta}
        defaultSide={defaultSide}
        hasFront={hasFront}
        hasBack={hasBack}
      />

      <div className="dlock dlock--foot" style={{ marginTop: 0 }}>
        <Lightbulb size={15} strokeWidth={1.9} aria-hidden="true" />
        <span>
          All four corners in frame, no glare, the small print readable. A photo from
          your phone is fine — it doesn’t have to be a scan.
        </span>
      </div>
    </>
  );
}

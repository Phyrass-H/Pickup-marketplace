"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, RotateCcw } from "lucide-react";
import type { Area } from "react-easy-crop";
import { ImageFramer, framedFile } from "@/components/image-framer";
import { uploadDocument } from "@/lib/document-actions";
import type { DocMeta } from "@/lib/account";
import type { DocumentType, DocumentSide } from "@/lib/database.types";

// Filing one document: choose (camera or file) → frame it if it's a photo → put a
// date on it if it has one → send. A PDF skips framing; you can't crop a PDF in the
// browser and pretending otherwise would just lose the file.
export function DocumentCapture({
  type,
  meta,
  defaultSide,
  hasFront,
  hasBack,
}: {
  type: DocumentType;
  meta: DocMeta;
  defaultSide: DocumentSide | null;
  hasFront: boolean;
  hasBack: boolean;
}) {
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [side, setSide] = useState<DocumentSide | null>(defaultSide);
  const [framing, setFraming] = useState<string | null>(null);
  const [staged, setStaged] = useState<{ file: File; preview: string | null } | null>(null);
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!framing) return;
    return () => URL.revokeObjectURL(framing);
  }, [framing]);
  useEffect(() => {
    const p = staged?.preview;
    if (!p) return;
    return () => URL.revokeObjectURL(p);
  }, [staged]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB. Try a photo instead of a scan.");
      return;
    }
    if (file.type === "application/pdf") {
      setStaged({ file, preview: null });
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Use a PDF, JPG, PNG or WebP file.");
      return;
    }
    setFraming(URL.createObjectURL(file));
  }

  function onFramed(area: Area, rotation: number) {
    if (!framing) return;
    startTransition(async () => {
      try {
        // 1800px keeps small print readable while staying well under the 10 MB cap.
        const file = await framedFile(framing, area, rotation, {
          maxSize: 1800,
          mime: "image/jpeg",
          filename: `${type}${side ? `-${side}` : ""}.jpg`,
        });
        setStaged({ file, preview: URL.createObjectURL(file) });
        setFraming(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not process that photo.");
      }
    });
  }

  function send() {
    if (!staged) return;
    setError(null);
    const fd = new FormData();
    fd.set("doc_type", type);
    fd.set("file", staged.file);
    if (side) fd.set("side", side);
    if (expiry) fd.set("expires_at", expiry);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (res.ok) {
        setStaged(null);
        setExpiry("");
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  // The back of a two-sided paper reuses the front's date — asking twice is noise.
  const needsExpiry = meta.expiry === "required" && side !== "back";

  return (
    <div className="dcard">
      <p className="dcard__label">
        {staged ? "Ready to send" : hasFront || hasBack ? "Replace it" : "Add it"}
      </p>

      {meta.twoSided && !staged && (
        <div className="seg" role="group" aria-label="Which side" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`seg-btn${side === "front" ? " is-on" : ""}`}
            aria-pressed={side === "front"}
            onClick={() => setSide("front")}
          >
            Front {hasFront && "✓"}
          </button>
          <button
            type="button"
            className={`seg-btn${side === "back" ? " is-on" : ""}`}
            aria-pressed={side === "back"}
            onClick={() => setSide("back")}
          >
            Back {hasBack && "✓"}
          </button>
        </div>
      )}

      {staged ? (
        <>
          <div className="dstage">
            {staged.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staged.preview} alt="The photo you're about to send" />
            ) : (
              <span className="dstage__pdf">
                <FileUp size={20} strokeWidth={1.75} aria-hidden="true" />
                {staged.file.name}
              </span>
            )}
          </div>

          {needsExpiry && (
            <label className="field" style={{ marginTop: 14 }}>
              <span>Expiry date shown on it</span>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
              />
              <span className="dhint">
                We’ll remind you a month before, and again the week it lapses.
              </span>
            </label>
          )}

          {error && <p className="derr">{error}</p>}

          <button className="btn" type="button" onClick={send} disabled={pending}>
            {pending ? "Sending…" : "Send for review"}
          </button>
          <button
            className="btn dquiet"
            type="button"
            onClick={() => setStaged(null)}
            disabled={pending}
          >
            <RotateCcw size={14} strokeWidth={1.9} aria-hidden="true" />
            Start again
          </button>
        </>
      ) : (
        <>
          <button
            className="btn"
            type="button"
            onClick={() => camRef.current?.click()}
            disabled={pending}
          >
            <Camera size={16} strokeWidth={1.9} aria-hidden="true" />
            Take a photo
          </button>
          <button
            className="btn secondary dfile"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <FileUp size={16} strokeWidth={1.9} aria-hidden="true" />
            Upload a file or PDF
          </button>
          {error && <p className="derr">{error}</p>}
        </>
      )}

      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        style={{ display: "none" }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={onPick}
        style={{ display: "none" }}
      />

      {framing && (
        <ImageFramer
          src={framing}
          shape="rect"
          title="Frame the document"
          hint="All four corners inside the box, text the right way up."
          saveLabel="Use this"
          pending={pending}
          error={error}
          onCancel={() => setFraming(null)}
          onSave={onFramed}
        />
      )}
    </div>
  );
}

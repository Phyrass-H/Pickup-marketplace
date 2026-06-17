"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/document-actions";
import {
  documentLabel,
  documentStatusLabel,
  documentStatusTone,
} from "@/lib/account";
import type { DocView } from "@/lib/documents";

const TONE_STYLE: Record<string, { bg: string; color: string }> = {
  warn: { bg: "var(--warn-bg)", color: "var(--warn)" },
  success: { bg: "#edfcf2", color: "var(--success)" },
  error: { bg: "#fef3f2", color: "var(--danger)" },
};

function DocumentRow({ doc }: { doc: DocView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const tone = doc.status ? TONE_STYLE[documentStatusTone(doc.status)] : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file.");
      return;
    }
    const fd = new FormData();
    fd.set("doc_type", doc.type);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (res.ok) {
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <form className="doc-row" onSubmit={onSubmit}>
      <div className="doc-row-head">
        <span className="doc-label">{documentLabel(doc.type)}</span>
        {doc.status && tone ? (
          <span
            className="status-pill"
            style={{ background: tone.bg, color: tone.color }}
          >
            <span className="dot" style={{ background: tone.color }} />
            {documentStatusLabel(doc.status)}
          </span>
        ) : (
          <span className="muted small">Not uploaded</span>
        )}
      </div>

      <div className="doc-row-actions">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <button className="btn secondary doc-upload" type="submit" disabled={pending}>
          {pending ? "Uploading…" : doc.status ? "Replace" : "Upload"}
        </button>
        {doc.viewUrl && (
          <a
            className="small"
            href={doc.viewUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            View
          </a>
        )}
      </div>

      {fileName && !pending && (
        <p className="muted small" style={{ margin: "2px 0 0" }}>
          Selected: {fileName}
        </p>
      )}
      {error && (
        <p className="small" style={{ color: "var(--danger)", margin: "2px 0 0" }}>
          {error}
        </p>
      )}
    </form>
  );
}

// Documents surface shared by Driver + Business settings. Each row uploads to
// the private documents bucket via the uploadDocument server action; status
// stays "pending" until a human verifies it (👤 manual in beta).
export function DocumentSection({ docs }: { docs: DocView[] }) {
  return (
    <div className="card">
      <h2>Documents</h2>
      <p className="muted small" style={{ marginTop: -2, marginBottom: 12 }}>
        PDF or image, up to 10 MB. We review each document before it’s marked
        verified.
      </p>
      {docs.map((doc) => (
        <DocumentRow key={doc.type} doc={doc} />
      ))}
    </div>
  );
}

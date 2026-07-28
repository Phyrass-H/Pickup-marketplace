"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Area } from "react-easy-crop";
import { ImageFramer, framedFile } from "@/components/image-framer";
import { uploadAvatar, removeAvatar } from "@/lib/avatar-actions";

// Profile photo / Business logo. The framing itself lives in <ImageFramer> (shared
// with document capture); this owns the source file, the upload and the removal.
export function AvatarEditor({
  kind,
  currentUrl,
  fallback,
}: {
  kind: "driver" | "business";
  currentUrl: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Release the object URL when the framer closes or the component goes away.
  useEffect(() => {
    if (!src) return;
    return () => URL.revokeObjectURL(src);
  }, [src]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please use a PNG, JPG or WebP image.");
      return;
    }
    setSrc(URL.createObjectURL(file));
  }

  function close() {
    setSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function save(area: Area, rotation: number) {
    if (!src) return;
    startTransition(async () => {
      try {
        const file = await framedFile(src, area, rotation, {
          maxSize: 512,
          mime: "image/png",
          filename: "avatar.png",
        });
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadAvatar(fd);
        if (res.ok) {
          close();
          router.refresh();
        } else {
          setError(res.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeAvatar();
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  const isRound = kind === "driver";

  return (
    <div className="avatar-row">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={isRound ? "avatar" : "avatar avatar-square"}
          src={currentUrl}
          alt={kind === "driver" ? "Your profile photo" : "Business logo"}
        />
      ) : (
        <span className={`avatar avatar-empty${isRound ? "" : " avatar-square"}`}>
          {fallback?.[0] ?? "?"}
        </span>
      )}

      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
          {kind === "driver" ? "Profile photo" : "Logo"}
        </span>
        {kind === "driver" && (
          <p className="muted small" style={{ margin: "-2px 0 8px" }}>
            A clear face, no sunglasses. The Business sees it when you accept.
          </p>
        )}
        <div className="doc-row-actions">
          <button
            type="button"
            className="btn secondary doc-upload"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            {currentUrl ? "Change" : "Upload"}
          </button>
          {currentUrl && (
            <button
              type="button"
              className="btn secondary doc-upload"
              onClick={remove}
              disabled={pending}
            >
              {pending ? "…" : "Remove"}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          style={{ display: "none" }}
        />
        {error && (
          <p className="small" style={{ color: "var(--danger)", margin: "6px 0 0" }}>
            {error}
          </p>
        )}
      </div>

      {src && (
        <ImageFramer
          src={src}
          shape={isRound ? "round" : "rect"}
          aspect={1}
          title="Frame your photo"
          hint="Drag to move, pinch or use the sliders."
          saveLabel="Save photo"
          pending={pending}
          error={error}
          onCancel={close}
          onSave={save}
        />
      )}
    </div>
  );
}

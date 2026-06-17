"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { uploadAvatar, removeAvatar } from "@/lib/avatar-actions";

// Crop the chosen source to a square PNG (max 512px) using the pixel area that
// react-easy-crop reports, then hand back a File for upload.
async function croppedPng(src: string, area: Area): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const size = Math.min(512, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Could not process the image.");
  return new File([blob], "avatar.png", { type: "image/png" });
}

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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  // While the crop modal is open: revoke the object URL on close/unmount (no
  // leak), close on Escape, and lock background scroll.
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fileRef.current) fileRef.current.value = "";
        setSrc(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      URL.revokeObjectURL(src);
    };
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
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  function close() {
    setSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function save() {
    if (!src || !area) return;
    startTransition(async () => {
      try {
        const file = await croppedPng(src, area);
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="crop-title">
          <div className="modal-card">
            <h2 id="crop-title" style={{ marginBottom: 12 }}>Crop &amp; zoom</h2>
            <div className="crop-area">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape={isRound ? "round" : "rect"}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button type="button" className="btn secondary" onClick={close} disabled={pending} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

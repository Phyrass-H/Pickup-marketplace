"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

// One framing surface for every photo the app takes: the round profile crop and
// the rectangular document crop are the same interaction with different edges.
// Phone cameras hand back a photo that is never quite straight, so rotation is
// part of framing here rather than a separate "edit" step.

function radians(deg: number) {
  return (deg * Math.PI) / 180;
}

// The box a rotated image needs — without it a straightened photo loses corners.
function rotatedSize(w: number, h: number, deg: number) {
  const r = radians(deg);
  return {
    width: Math.abs(Math.cos(r) * w) + Math.abs(Math.sin(r) * h),
    height: Math.abs(Math.sin(r) * w) + Math.abs(Math.cos(r) * h),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not read that image."));
    i.src = src;
  });
}

export interface FramerOutput {
  /** Longest edge of the result, in pixels. Keeps uploads small. */
  maxSize: number;
  mime: "image/png" | "image/jpeg";
  filename: string;
}

/** Rotate → crop → downscale, entirely in the browser. */
export async function framedFile(
  src: string,
  area: Area,
  rotation: number,
  out: FramerOutput,
): Promise<File> {
  const img = await loadImage(src);
  const box = rotatedSize(img.width, img.height, rotation);

  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");

  ctx.translate(box.width / 2, box.height / 2);
  ctx.rotate(radians(rotation));
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  const cropped = ctx.getImageData(area.x, area.y, area.width, area.height);

  // Scale the crop down to the output ceiling in one step.
  const scale = Math.min(1, out.maxSize / Math.max(area.width, area.height));
  const w = Math.max(1, Math.round(area.width * scale));
  const h = Math.max(1, Math.round(area.height * scale));

  const stage = document.createElement("canvas");
  stage.width = area.width;
  stage.height = area.height;
  stage.getContext("2d")!.putImageData(cropped, 0, 0);

  canvas.width = w;
  canvas.height = h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(stage, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, out.mime, out.mime === "image/jpeg" ? 0.9 : undefined),
  );
  if (!blob) throw new Error("Could not process the image.");
  return new File([blob], out.filename, { type: out.mime });
}

export function ImageFramer({
  src,
  shape = "rect",
  aspect,
  title,
  hint,
  saveLabel = "Use this photo",
  pending = false,
  error,
  onCancel,
  onSave,
}: {
  src: string;
  shape?: "round" | "rect";
  /** Omit for a free crop (documents come in every shape). */
  aspect?: number;
  title: string;
  hint?: string;
  saveLabel?: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (area: Area, rotation: number) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Kept apart on purpose: quarter turns are "the photo is sideways", tilt is
  // "the photo is crooked". One slider doing both fights itself.
  const [turns, setTurns] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const rotation = turns * 90 + tilt;

  // With no aspect given, react-easy-crop falls back to 4:3 — which slices the ends
  // off an ID card. Starting from the photo's own shape means the first thing the
  // Driver sees is their whole document; tightening it is then their choice.
  const [natural, setNatural] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadImage(src)
      .then((img) => live && setNatural(img.width / img.height))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [src]);
  // A quarter turn swaps the frame's width and height with it.
  const baseAspect = aspect ?? natural ?? 4 / 3;
  const effectiveAspect = turns % 2 === 1 ? 1 / baseAspect : baseAspect;

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  // Escape closes; the page behind must not scroll while framing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, pending]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="framer-title">
      <div className="modal-card">
        <h2 id="framer-title" style={{ marginBottom: hint ? 6 : 12 }}>
          {title}
        </h2>
        {hint && <p className="muted small" style={{ margin: "0 0 12px" }}>{hint}</p>}

        <div className={`crop-area${shape === "rect" ? " crop-area--doc" : ""}`}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={effectiveAspect}
            cropShape={shape}
            objectFit="contain"
            showGrid={shape === "rect"}
            restrictPosition={false}
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

        <label className="field">
          <span>Straighten</span>
          <input
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={tilt}
            onChange={(e) => setTilt(Number(e.target.value))}
          />
        </label>

        <button
          type="button"
          className="btn secondary dframe__turn"
          onClick={() => setTurns((t) => (t + 1) % 4)}
          disabled={pending}
        >
          Turn 90°
        </button>

        {error && (
          <p className="small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => area && onSave(area, rotation)}
            disabled={pending || !area}
          >
            {pending ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

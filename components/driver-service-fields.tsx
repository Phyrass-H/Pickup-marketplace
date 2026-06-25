"use client";

import { useEffect, useRef, useState } from "react";
import {
  Baby,
  Check,
  ClipboardList,
  FileText,
  Info,
  Luggage,
  PawPrint,
  Paperclip,
  Sparkles,
  UserPlus,
  VolumeX,
  X,
} from "lucide-react";
import { TIER_LABEL, type ServiceTier } from "@/lib/vehicle-catalog";
import {
  DRESS_CODES,
  DRESS_CODE_DESC,
  DRESS_CODE_LABEL,
  REQUEST_FLAG_KEYS,
  REQUEST_FLAG_LABEL,
  REQUEST_LANGUAGES,
  TIER_DRESS_DEFAULT,
  type DressCode,
  type DriverFlags,
  type RequestFlagKey,
} from "@/lib/driver-service";

const FLAG_ICON: Record<RequestFlagKey, typeof ClipboardList> = {
  meet_greet: ClipboardList,
  greeter: UserPlus,
  luggage_help: Luggage,
  child_seat: Baby,
  quiet_ride: VolumeX,
  pets: PawPrint,
};

// The "Driver & service" card body (S19). Emits hidden form fields the
// createMission action reads: required_languages (JSON array), dress_code
// (string), driver_flags (JSON object), plus board_name (text), board_file
// (file), driver_message (textarea). `tier` is lifted from the Vehicle & class
// card so the dress-code default tracks the service class.
export function DriverServiceFields({
  tier,
  defaults,
}: {
  tier: ServiceTier;
  defaults?: {
    languages?: string[];
    dressCode?: string | null;
    flags?: DriverFlags;
    boardName?: string | null;
    driverMessage?: string | null;
    hasBoardFile?: boolean;
  };
}) {
  const [langs, setLangs] = useState<string[]>(defaults?.languages ?? []);

  // Dress code: pre-select the tier default. It keeps tracking the tier until
  // the Dispatcher touches it (then their pick stands for THIS mission). A
  // resumed draft with a saved dress_code counts as already touched.
  const validDefault =
    defaults?.dressCode && (DRESS_CODES as readonly string[]).includes(defaults.dressCode)
      ? (defaults.dressCode as DressCode)
      : null;
  const touchedRef = useRef<boolean>(!!validDefault);
  const [dress, setDress] = useState<DressCode>(validDefault ?? TIER_DRESS_DEFAULT[tier]);
  useEffect(() => {
    if (!touchedRef.current) setDress(TIER_DRESS_DEFAULT[tier]);
  }, [tier]);

  const [flags, setFlags] = useState<DriverFlags>(defaults?.flags ?? {});
  const [boardFileName, setBoardFileName] = useState<string | null>(null);
  const [keepExisting, setKeepExisting] = useState<boolean>(!!defaults?.hasBoardFile);
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultTierCode = TIER_DRESS_DEFAULT[tier];

  // Signal the server to clear a previously-attached board when the Dispatcher
  // removes it (dismiss) or turns meet & greet off entirely — but not when a new
  // file replaces it (the upload overwrites) or the existing one is kept.
  const clearBoard =
    !!defaults?.hasBoardFile && !boardFileName && (!flags.meet_greet || !keepExisting);

  function toggleLang(label: string) {
    setLangs((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }
  function selectDress(code: DressCode) {
    touchedRef.current = true;
    setDress(code);
  }
  function toggleFlag(key: RequestFlagKey) {
    setFlags((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBoardFileName(e.target.files?.[0]?.name ?? null);
  }
  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
    setBoardFileName(null);
  }

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      {/* ---- Languages ---- */}
      <span className="scf-label">Languages the Driver should speak</span>
      <div className="ds-chips" role="group" aria-label="Languages the Driver should speak">
        {REQUEST_LANGUAGES.map((label) => {
          const on = langs.includes(label);
          return (
            <button
              type="button"
              key={label}
              className={`ds-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleLang(label)}
            >
              {on && <Check size={14} aria-hidden />}
              {label}
            </button>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        Matched against the languages each Driver lists on their profile.
      </p>
      <input type="hidden" name="required_languages" value={JSON.stringify(langs)} />

      <div className="mx-sumdiv" />

      {/* ---- Dress code ---- */}
      <div className="ds-head">
        <span className="scf-label" style={{ marginBottom: 0 }}>
          Dress code
        </span>
        <span className="ds-head__hint">
          <Info size={13} aria-hidden /> Default set from your service class
        </span>
      </div>
      <div className="ds-dress" role="radiogroup" aria-label="Dress code">
        {DRESS_CODES.map((code) => {
          const on = dress === code;
          const isDefault = code === defaultTierCode;
          return (
            <button
              type="button"
              key={code}
              role="radio"
              aria-checked={on}
              className={`ds-dress__opt${on ? " is-on" : ""}`}
              onClick={() => selectDress(code)}
            >
              <span className="ds-dress__radio" aria-hidden />
              <span className="ds-dress__body">
                <span className="ds-dress__top">
                  <span className="ds-dress__name">{DRESS_CODE_LABEL[code]}</span>
                  {isDefault && (
                    <span className="ds-dress__tag">Default · {TIER_LABEL[tier]} tier</span>
                  )}
                </span>
                <span className="ds-dress__desc">{DRESS_CODE_DESC[code]}</span>
                {code === "suit_tie" && (
                  <span className="ds-note">
                    <Sparkles size={13} aria-hidden /> Specific event or VIP protocol
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <input type="hidden" name="dress_code" value={dress} />

      <div className="mx-sumdiv" />

      {/* ---- Requests ---- */}
      <span className="scf-label">
        Requests <span className="ds-optional">(optional)</span>
      </span>
      <div className="ds-chips" role="group" aria-label="Requests">
        {REQUEST_FLAG_KEYS.map((key) => {
          const Icon = FLAG_ICON[key];
          const on = !!flags[key];
          return (
            <button
              type="button"
              key={key}
              className={`ds-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleFlag(key)}
            >
              <Icon size={14} aria-hidden />
              {REQUEST_FLAG_LABEL[key]}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="driver_flags" value={JSON.stringify(flags)} />
      <input type="hidden" name="board_file_clear" value={clearBoard ? "1" : ""} />

      {flags.meet_greet && (
        <div className="ds-board">
          <label className="field" style={{ marginBottom: 10 }}>
            <span className="ds-board__label">Name on the board</span>
            <input
              type="text"
              name="board_name"
              placeholder="e.g. Mr. Laurent Chopard"
              defaultValue={defaults?.boardName ?? ""}
            />
          </label>

          <div className="ds-file">
            <label className="ds-file__btn">
              <Paperclip size={14} aria-hidden /> Attach a board
              <input
                ref={fileRef}
                type="file"
                name="board_file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={onFileChange}
                hidden
              />
            </label>
            <span className="muted small">PDF, JPG or PNG — for a company or brand board</span>
          </div>

          {boardFileName ? (
            <div className="ds-fname">
              <FileText size={15} aria-hidden />
              <span>{boardFileName}</span>
              <button type="button" className="ds-fname__x" onClick={clearFile} aria-label="Remove attachment">
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : keepExisting ? (
            <div className="ds-fname">
              <FileText size={15} aria-hidden />
              <span className="muted">A board is already attached</span>
              <button
                type="button"
                className="ds-fname__x"
                onClick={() => setKeepExisting(false)}
                aria-label="Remove attached board"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : null}

          <p className="muted small" style={{ margin: "8px 0 0" }}>
            Type a name, or attach a board — handy when it’s a company or brand name
            rather than a person. Leave the name blank to use the Guest.
          </p>
        </div>
      )}

      <div className="mx-sumdiv" />

      {/* ---- Message to the Driver ---- */}
      <span className="scf-label">
        Message to the Driver <span className="ds-optional">(optional)</span>
      </span>
      <textarea
        name="driver_message"
        rows={2}
        defaultValue={defaults?.driverMessage ?? ""}
        placeholder="Special instructions for this trip — e.g. wait at the lobby desk and call the room on arrival."
        className="ds-textarea"
      />
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        Private to the Driver — revealed once they accept.
      </p>
    </div>
  );
}

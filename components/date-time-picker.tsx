"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { utcToParisLocalInput } from "@/lib/time";

// Separate DATE picker (calendar popover) + TIME picker (typed + quick list),
// the modern booking pattern (less cognitive load than one datetime-local).
// Controlled by a single "YYYY-MM-DDTHH:mm" Paris wall-clock string; renders the
// hidden <input name> the form submits. Dependency-free, styled to match the app.

const DOW = ["lu", "ma", "me", "je", "ve", "sa", "di"];
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const firstDowMon = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
const todayParis = () => utcToParisLocalInput(new Date().toISOString()).slice(0, 10);

// 15-minute quick list 00:00 → 23:45.
const QUICK_TIMES = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return ref;
}

export function DateTimePicker({
  value,
  onChange,
  name = "pickup_at",
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  const datePart = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  const timePart = value.length >= 16 ? value.slice(11, 16) : "";

  function emit(d: string, t: string) {
    if (!d && !t) return onChange("");
    onChange(`${d || todayParis()}T${t || "09:00"}`);
  }

  return (
    <div className="dtp">
      <DateField value={datePart} onPick={(d) => emit(d, timePart)} />
      <TimeField value={timePart} onPick={(t) => emit(datePart, t)} />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function DateField({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const today = todayParis();
  const init = value || today;
  const [view, setView] = useState({ y: Number(init.slice(0, 4)), m: Number(init.slice(5, 7)) });

  const label = value ? DAY_FMT.format(new Date(`${value}T12:00:00Z`)) : "Choisir une date";
  const grid = useMemo(() => {
    const lead = firstDowMon(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(`${view.y}-${pad(view.m)}-${pad(d)}`);
    return cells;
  }, [view]);

  function shift(delta: number) {
    const d = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  }

  return (
    <div className="dtp-field" ref={ref}>
      <button
        type="button"
        className={`dtp-btn${value ? " is-set" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={17} aria-hidden />
        <span>{label}</span>
      </button>

      {open && (
        <div className="dtp-pop dtp-cal" role="dialog" aria-label="Choisir une date">
          <div className="dtp-cal__head">
            <button type="button" className="dtp-nav" onClick={() => shift(-1)} aria-label="Mois précédent">
              <ChevronLeft size={18} />
            </button>
            <span className="dtp-cal__title">
              {MONTH_FMT.format(new Date(Date.UTC(view.y, view.m - 1, 1)))}
            </span>
            <button type="button" className="dtp-nav" onClick={() => shift(1)} aria-label="Mois suivant">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="dtp-cal__dow">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="dtp-cal__grid">
            {grid.map((iso, i) =>
              iso === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={iso}
                  type="button"
                  className={`dtp-day${iso === value ? " is-sel" : ""}${iso === today ? " is-today" : ""}`}
                  disabled={iso < today}
                  onClick={() => {
                    onPick(iso);
                    setOpen(false);
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeField({ value, onPick }: { value: string; onPick: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the selected (or nearest) time into view when the list opens.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const sel = listRef.current.querySelector<HTMLElement>(".is-sel") ?? listRef.current.querySelector<HTMLElement>("[data-near]");
    sel?.scrollIntoView({ block: "center" });
  }, [open]);

  const nearest = value || "09:00";

  return (
    <div className="dtp-field dtp-field--time" ref={ref}>
      <button
        type="button"
        className={`dtp-btn${value ? " is-set" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Clock size={17} aria-hidden />
        <span>{value || "Heure"}</span>
      </button>

      {open && (
        <div className="dtp-pop dtp-time" role="dialog" aria-label="Choisir l’heure">
          <input
            type="time"
            className="dtp-time__exact"
            value={value}
            step={300}
            onChange={(e) => e.target.value && onPick(e.target.value)}
            aria-label="Heure exacte"
          />
          <div className="dtp-time__list" ref={listRef}>
            {QUICK_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                className={`dtp-time__item${t === value ? " is-sel" : ""}`}
                data-near={t === nearest ? "" : undefined}
                onClick={() => {
                  onPick(t);
                  setOpen(false);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

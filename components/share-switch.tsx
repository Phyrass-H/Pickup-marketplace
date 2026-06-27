"use client";

// A small on/off switch for "Share with Driver". Presentational only — the
// caller owns the state. Used by the new-mission PassengerList (controlled by row
// state) and by the schedule PhoneShareToggle (which calls the share action).
export function ShareSwitch({
  on,
  onToggle,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="sw"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Shared with Driver — tap to stop sharing" : "Share this number with the Driver"}
      onClick={onToggle}
      disabled={disabled}
    >
      <span className={`sw-track${on ? " sw-track--on" : ""}`}>
        <span className="sw-knob" />
      </span>
      <span className={`sw-label${on ? " sw-label--on" : ""}`}>
        {on ? "Shared with Driver" : "Share with Driver"}
      </span>
    </button>
  );
}

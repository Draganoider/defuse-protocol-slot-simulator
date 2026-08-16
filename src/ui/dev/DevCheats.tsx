export interface DevCheatsProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  onForceBonus: (cores: 3 | 4 | 5) => void;
  onReset: () => void;
}

/**
 * Development-only controls. Prototype loads this module behind import.meta.env.DEV
 * so its UI and labels are excluded from production bundles.
 */
export default function DevCheats({ open, setOpen, onForceBonus, onReset }: DevCheatsProps) {
  return (
    <aside className="dp-cheats" aria-label="Development cheats">
      <button
        type="button"
        className="dp-cheats__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        DEV CHEATS {open ? '−' : '+'}
      </button>
      {open && (
        <div className="dp-cheats__content">
          <p>Forced results are test-only requests to the engine; they remain visibly marked and do not alter RTP calculation rules.</p>
          <div>
            <button type="button" onClick={() => onForceBonus(3)}>Force 3 CORE</button>
            <button type="button" onClick={() => onForceBonus(4)}>Force 4 CORE</button>
            <button type="button" onClick={() => onForceBonus(5)}>Force 5 CORE</button>
          </div>
          <button type="button" className="dp-cheats__reset" onClick={onReset}>Quick reset session</button>
        </div>
      )}
    </aside>
  );
}

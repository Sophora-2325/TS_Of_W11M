interface ToggleSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-copy">
        <span className="toggle-title">{label}</span>
        <span className="toggle-desc">{description}</span>
      </span>
    </label>
  );
}

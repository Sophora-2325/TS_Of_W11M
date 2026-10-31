import { useEffect, useRef } from "react";

export const LANGS = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

interface LanguageSegmentProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function LanguageSegment({
  label,
  value,
  disabled = false,
  onChange,
}: LanguageSegmentProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);

  const move = (direction: 1 | -1) => {
    const index = Math.max(0, LANGS.findIndex((lang) => lang.id === value));
    const next = LANGS[(index + direction + LANGS.length) % LANGS.length];
    focusAfterMove.current = true;
    onChange(next.id);
  };

  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    groupRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [value]);

  return (
    <div
      ref={groupRef}
      className="lang-segment"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {LANGS.map((lang) => {
        const selected = value === lang.id;
        return (
          <button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? "is-selected" : ""}
            disabled={disabled}
            onClick={() => onChange(lang.id)}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}

import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowHeaderProps {
  subtitle: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function WindowHeader({
  subtitle,
  pinned = false,
  onTogglePin,
  onMinimize,
  onClose,
}: WindowHeaderProps) {
  const handleDragStart = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    void getCurrentWindow().startDragging();
  };

  return (
    <header className="window-header" onMouseDown={handleDragStart}>
      <div className="window-brand">
        <SelectionMark />
        <span className="window-brand-name">STOR</span>
        <span className="window-brand-rule" aria-hidden="true" />
        <span className="window-brand-subtitle">{subtitle}</span>
      </div>
      <div className="window-controls">
        {onTogglePin && (
          <button
            type="button"
            className={`icon-btn ${pinned ? "is-active" : ""}`}
            aria-label={pinned ? "取消置顶" : "窗口置顶"}
            aria-pressed={pinned}
            title={pinned ? "取消置顶" : "窗口置顶"}
            onClick={onTogglePin}
          >
            <PinIcon filled={pinned} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="最小化到任务栏"
          title="最小化到任务栏"
          onClick={onMinimize}
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="关闭"
          title="关闭"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}

function SelectionMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3.2 6.2V3.2H6.2M11.8 3.2h3v3M14.8 11.8v3h-3M6.2 14.8h-3v-3" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6.2 2.4h3.6l-.7 3.2 2.2 1.5v1.3H8.7V13.6L8 14.4l-.7-.8V8.4H4.7V7.1l2.2-1.5-.7-3.2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8h9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
    </svg>
  );
}

interface ResultPanelProps {
  title: string;
  copyLabel: string;
  canCopy: boolean;
  copyNote: string | null;
  onCopy: () => void;
  status?: string | null;
  statusTone?: "info" | "error" | "muted";
  empty: boolean;
  emptyText: string;
  children: string;
}

export function ResultPanel({
  title,
  copyLabel,
  canCopy,
  copyNote,
  onCopy,
  status,
  statusTone = "info",
  empty,
  emptyText,
  children,
}: ResultPanelProps) {
  return (
    <section className="result-panel">
      <div className="result-panel-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="text-action"
          disabled={!canCopy}
          aria-label={copyLabel}
          onClick={onCopy}
        >
          {copyNote === "已复制" ? "已复制" : copyLabel}
        </button>
      </div>
      <div className={`result-body ${empty ? "is-empty" : ""}`}>
        {empty ? emptyText : children}
      </div>
      {(status || (copyNote && copyNote !== "已复制")) && (
        <p className={`result-status is-${copyNote && copyNote !== "已复制" ? "error" : statusTone}`} role="status">
          {copyNote && copyNote !== "已复制" ? copyNote : status}
        </p>
      )}
    </section>
  );
}

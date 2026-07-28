import { SOURCE_LABELS, type SourceId } from "@ai-dashboard/core";
import { Icon, type IconName } from "./Icons";

const SOURCE_ICON: Record<SourceId, IconName> = {
  "claude-code": "claude",
  codex: "codex",
  git: "git",
};

export function SourceMark({
  source,
  showLabel = false,
  compact = false,
  className = "ui-muted",
}: {
  source: SourceId;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={SOURCE_LABELS[source]}
      aria-label={SOURCE_LABELS[source]}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full ${
          compact ? "h-5 w-5" : "h-6 w-6"
        }`}
        style={{ background: "var(--surface-soft)" }}
      >
        <Icon name={SOURCE_ICON[source]} size={compact ? 11 : 13} />
      </span>
      {showLabel && <span className="text-xs">{SOURCE_LABELS[source]}</span>}
    </span>
  );
}

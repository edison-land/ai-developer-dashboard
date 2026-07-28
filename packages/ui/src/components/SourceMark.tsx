import { SOURCE_LABELS, type SourceId } from "@ai-dashboard/core";
import claudeCodeLogo from "../assets/source-logos/claude-code.png";
import codexDarkLogo from "../assets/source-logos/codex-dark.png";
import codexLightLogo from "../assets/source-logos/codex-light.png";
import gitLogo from "../assets/source-logos/git.svg";

const SOURCE_LOGO: Record<
  SourceId,
  { light: string; dark?: string }
> = {
  "claude-code": { light: claudeCodeLogo },
  codex: { light: codexLightLogo, dark: codexDarkLogo },
  git: { light: gitLogo },
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
  const logo = SOURCE_LOGO[source];
  const logoSize = compact ? "h-[13px] w-[13px]" : "h-[15px] w-[15px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={SOURCE_LABELS[source]}
      aria-label={SOURCE_LABELS[source]}
    >
      <span
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${
          compact ? "h-5 w-5" : "h-6 w-6"
        }`}
        style={{ background: "var(--surface-soft)" }}
      >
        <img
          src={logo.light}
          alt=""
          draggable={false}
          className={`${logoSize} object-contain ${
            logo.dark ? "source-logo-light" : ""
          }`}
        />
        {logo.dark && (
          <img
            src={logo.dark}
            alt=""
            draggable={false}
            className={`source-logo-dark absolute ${logoSize} object-contain`}
          />
        )}
      </span>
      {showLabel && <span className="text-xs">{SOURCE_LABELS[source]}</span>}
    </span>
  );
}

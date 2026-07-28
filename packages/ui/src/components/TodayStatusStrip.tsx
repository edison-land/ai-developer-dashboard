import { Icon } from "./Icons";

export function TodayStatusStrip({
  running,
  needsAction,
  activeThisWeek,
}: {
  running: number;
  needsAction: number;
  activeThisWeek: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm ui-muted">
      <Status icon="spark" value={running} label="正在运行" tone="success" />
      <Status icon="alert" value={needsAction} label="需要你处理" tone="warning" />
      <Status icon="clock" value={activeThisWeek} label="本周活跃" />
    </div>
  );
}

function Status({
  icon,
  value,
  label,
  tone,
}: {
  icon: "spark" | "alert" | "clock";
  value: number;
  label: string;
  tone?: "success" | "warning";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={
          "inline-flex h-7 w-7 items-center justify-center rounded-full " +
          (tone === "success"
            ? "ui-success"
            : tone === "warning"
              ? "ui-warning"
              : "ui-muted")
        }
        style={{ background: "var(--surface-soft)" }}
      >
        <Icon name={icon} size={14} />
      </span>
      <span>
        <strong className="mr-1 ui-text">{value}</strong>
        {label}
      </span>
    </span>
  );
}

// One shared formatter (locale from the browser, falling back to zh-CN). `numeric:
// "auto"` yields natural forms like 昨天 / 上个月 / 去年 for single-unit values.
const relativeTime = new Intl.RelativeTimeFormat(
  typeof navigator !== "undefined" ? navigator.language : "zh-CN",
  { numeric: "auto" },
);

export function formatRelative(ms: number | undefined, now = Date.now()): string {
  if (!ms) return "—";
  const diff = Math.max(0, now - ms);
  const s = Math.floor(diff / 1000);
  // Intl.RelativeTimeFormat renders 0 as "0 秒钟前", which is worse than 刚刚 —
  // so the sub-minute bucket stays hand-rolled.
  if (s < 60) return "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return relativeTime.format(-m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return relativeTime.format(-h, "hour");
  const d = Math.floor(h / 24);
  if (d < 30) return relativeTime.format(-d, "day");
  const mo = Math.floor(d / 30);
  if (mo < 12) return relativeTime.format(-mo, "month");
  return relativeTime.format(-Math.floor(mo / 12), "year");
}

export function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

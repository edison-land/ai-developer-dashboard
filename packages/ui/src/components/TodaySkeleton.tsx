export function TodaySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-label="正在加载今日重点">
      {[0, 1, 2].map((item) => (
        <div key={item} className="ui-card min-h-[268px] animate-pulse p-5">
          <div className="h-3 w-8 rounded" style={{ background: "var(--surface-soft)" }} />
          <div className="mt-6 h-5 w-2/3 rounded" style={{ background: "var(--surface-soft)" }} />
          <div className="mt-8 h-3 w-20 rounded" style={{ background: "var(--surface-soft)" }} />
          <div className="mt-3 h-4 w-full rounded" style={{ background: "var(--surface-soft)" }} />
          <div className="mt-2 h-4 w-4/5 rounded" style={{ background: "var(--surface-soft)" }} />
          <div className="mt-6 h-16 rounded-xl" style={{ background: "var(--accent-soft)" }} />
        </div>
      ))}
    </div>
  );
}

import { Icon } from "./Icons";
import { useTheme } from "../theme";

export function ThemeToggle() {
  const { resolvedTheme, setPreference } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "切换到深墨主题" : "切换到暖白主题";

  return (
    <button
      type="button"
      className="ui-icon-button"
      onClick={() => setPreference(next)}
      title={label}
      aria-label={label}
    >
      <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}

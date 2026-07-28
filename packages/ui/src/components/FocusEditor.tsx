import { Icon } from "./Icons";

export function FocusEditor({
  pinned,
  canMoveLeft,
  canMoveRight,
  onPin,
  onUnpin,
  onMoveLeft,
  onMoveRight,
  onDismiss,
  disabled,
}: {
  pinned: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDismiss: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 ui-divider"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="ui-button px-2.5 py-1.5 text-xs"
        onClick={pinned ? onUnpin : onPin}
        disabled={disabled}
      >
        <Icon name="pin" size={13} />
        {pinned ? "取消置顶" : "置顶"}
      </button>
      {pinned && (
        <>
          <button
            type="button"
            className="ui-icon-button h-8 w-8"
            onClick={onMoveLeft}
            disabled={!canMoveLeft || disabled}
            title="向左移动"
            aria-label="向左移动"
          >
            <Icon name="left" size={14} />
          </button>
          <button
            type="button"
            className="ui-icon-button h-8 w-8"
            onClick={onMoveRight}
            disabled={!canMoveRight || disabled}
            title="向右移动"
            aria-label="向右移动"
          >
            <Icon name="right" size={14} />
          </button>
        </>
      )}
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ui-muted transition hover:ui-text"
        onClick={onDismiss}
        disabled={disabled}
      >
        <Icon name="dismiss" size={13} />
        今天移除
      </button>
    </div>
  );
}

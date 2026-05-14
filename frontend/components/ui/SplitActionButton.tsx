"use client";

export interface SplitActionItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "warning" | "danger";
  helperText?: string;
}

interface SplitActionButtonProps {
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryDisabled?: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  actions: SplitActionItem[];
  minMenuWidthClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

const TONE_CLASS_MAP: Record<NonNullable<SplitActionItem["tone"]>, string> = {
  default: "text-slate-700 hover:bg-blue-50",
  warning: "text-amber-700 hover:bg-amber-50",
  danger: "text-red-700 hover:bg-red-50",
};

export function SplitActionButton({
  primaryLabel,
  onPrimaryClick,
  primaryDisabled,
  menuOpen,
  onMenuToggle,
  actions,
  minMenuWidthClassName = "min-w-[160px]",
  buttonClassName = "bg-[#0d6efd] hover:bg-[#0b5ed7] text-white",
  menuClassName = "",
}: SplitActionButtonProps) {
  return (
    <div className="relative flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPrimaryClick();
        }}
        disabled={primaryDisabled}
        className={`rounded-r border-l border-blue-400 px-4 py-1.5 text-xs transition-colors disabled:opacity-50 ${buttonClassName}`}
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMenuToggle();
        }}
        disabled={primaryDisabled}
        className={`rounded-l px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${buttonClassName}`}
      >
        ▾
      </button>
      {menuOpen && (
        <div className={`absolute bottom-full left-0 z-50 mb-1 rounded border border-slate-200 bg-white text-right shadow-lg ${minMenuWidthClassName} ${menuClassName}`}>
          {actions.map((action, index) => {
            const tone = action.tone ?? "default";
            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick();
                }}
                disabled={action.disabled}
                className={`block w-full px-4 py-2 text-right text-xs ${
                  index < actions.length - 1 ? "border-b border-slate-100" : ""
                } ${
                  action.disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-400"
                    : TONE_CLASS_MAP[tone]
                }`}
              >
                {action.label}
                {action.helperText && (
                  <span className="block text-[10px] leading-tight text-slate-400">
                    {action.helperText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

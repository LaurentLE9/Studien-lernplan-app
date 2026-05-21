import React from "react";
import { EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export const SortableTile = React.forwardRef(({
  id,
  className,
  children,
  isEditing,
  layout = { colSpan: 6, rowSpan: 2 },
  onHide,
  style,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      style={style}
      {...props}
      data-dashboard-tile
      data-dashboard-col-span={layout?.colSpan ?? layout?.w ?? 6}
      data-dashboard-row-span={layout?.rowSpan ?? layout?.h ?? 2}
      className={cn(
        "relative group overflow-hidden rounded-2xl bg-white dark:bg-slate-950",
        isEditing ? "ring-2 ring-primary/20 bg-slate-50 dark:bg-slate-900 shadow-sm" : "",
        className
      )}
    >
      {isEditing ? (
        <div className="absolute right-3 top-3 z-50 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="dashboard-drag-handle cursor-grab rounded border border-slate-200 bg-white p-2 shadow-sm transition-opacity hover:bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Kachel verschieben"
            aria-label="Kachel verschieben"
          >
            <GripVertical className="h-5 w-5 text-slate-500" />
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white p-2 shadow-sm transition-opacity hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Kachel ausblenden"
            aria-label={`${id} ausblenden`}
            onClick={() => onHide?.(id)}
          >
            <EyeOff className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      ) : null}
      <div className={cn("min-w-0 w-full h-full", isEditing && "pt-14")}>
        {children}
      </div>
    </div>
  );
});

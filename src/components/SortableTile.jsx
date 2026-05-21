import { EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableTile({
  id,
  className,
  children,
  isEditing,
  layout = { colSpan: 6, rowSpan: 2 },
  onHide,
}) {
  const colSpan = Number(layout?.colSpan ?? layout?.w) || 6;
  const rowSpan = Number(layout?.rowSpan ?? layout?.h) || 2;

  return (
    <div
      data-dashboard-tile
      data-dashboard-col-span={colSpan}
      data-dashboard-row-span={rowSpan}
      className={cn(
        "relative group min-w-0 w-full max-w-full overflow-hidden rounded-2xl",
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
}

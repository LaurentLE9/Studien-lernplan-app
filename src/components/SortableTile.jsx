import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_COL_SPAN = 4;
const MAX_COL_SPAN = 12;
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 6;
const GRID_COLUMNS = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function SortableTile({
  id,
  className,
  children,
  isEditing,
  size = { colSpan: 6, rowSpan: 2 },
  onSizeChange,
  tileStyle,
}) {
  const resizeStartRef = React.useRef(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    ...tileStyle,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  function handleResizePointerDown(event) {
    if (!isEditing || event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();

    const tile = event.currentTarget.closest("[data-dashboard-tile]");
    const grid = tile?.closest(".dashboard-grid");
    if (!tile || !grid) return;

    const gridStyle = window.getComputedStyle(grid);
    const gap = parseFloat(gridStyle.columnGap || gridStyle.gap || "0") || 0;
    const rowGap = parseFloat(gridStyle.rowGap || gridStyle.gap || "0") || gap;
    const gridWidth = grid.clientWidth;
    const columnWidth = (gridWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    const rowHeight = parseFloat(gridStyle.gridAutoRows || "0") || 140;

    resizeStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: Number(size?.colSpan) || 6,
      startRowSpan: Number(size?.rowSpan) || 2,
      columnStep: columnWidth + gap,
      rowStep: rowHeight + rowGap,
    };

    document.body.classList.add("dashboard-resizing");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleResizePointerMove(event) {
    const start = resizeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const colDelta = Math.round((event.clientX - start.startX) / Math.max(1, start.columnStep));
    const rowDelta = Math.round((event.clientY - start.startY) / Math.max(1, start.rowStep));
    onSizeChange?.(id, {
      colSpan: clamp(start.startColSpan + colDelta, MIN_COL_SPAN, MAX_COL_SPAN),
      rowSpan: clamp(start.startRowSpan + rowDelta, MIN_ROW_SPAN, MAX_ROW_SPAN),
    });
  }

  function handleResizePointerEnd(event) {
    const start = resizeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = null;
    document.body.classList.remove("dashboard-resizing");
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      ref={setNodeRef}
      data-dashboard-tile
      style={style}
      className={cn(
        "relative group min-w-0 w-full max-w-full overflow-hidden rounded-2xl",
        className,
        isEditing ? "ring-2 ring-primary/20 bg-slate-50 dark:bg-slate-900 shadow-sm" : ""
      )}
    >
      {isEditing ? (
        <div className="absolute right-3 top-3 z-50 flex flex-wrap items-center justify-end gap-2">
          <div
            {...attributes}
            {...listeners}
            className="rounded border border-slate-200 bg-white p-2 shadow-sm transition-opacity hover:bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Kachel verschieben"
          >
            <GripVertical className="h-5 w-5 text-slate-500" />
          </div>
        </div>
      ) : null}
      <div className={cn("min-w-0 w-full h-full", isEditing && "pt-14")}>
        {children}
      </div>
      {isEditing ? (
        <button
          type="button"
          className="absolute bottom-2 right-2 z-50 h-5 w-5 cursor-se-resize rounded-md border border-slate-300 bg-white/90 shadow-sm transition hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-800"
          aria-label="Kachelgroesse mit der Maus aendern"
          title="Kachelgröße ändern"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerEnd}
          onPointerCancel={handleResizePointerEnd}
        >
          <span className="block h-full w-full rounded-sm bg-[linear-gradient(135deg,transparent_50%,rgba(100,116,139,0.9)_50%,rgba(100,116,139,0.9)_58%,transparent_58%,transparent_68%,rgba(100,116,139,0.9)_68%,rgba(100,116,139,0.9)_76%,transparent_76%)]" />
        </button>
      ) : null}
    </div>
  );
}

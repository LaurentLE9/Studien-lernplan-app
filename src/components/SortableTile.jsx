import React from "react";
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

function getGridMetrics(tile) {
  const grid = tile?.closest(".dashboard-grid");
  if (!tile || !grid) return null;
  const gridStyle = window.getComputedStyle(grid);
  const gap = parseFloat(gridStyle.columnGap || gridStyle.gap || "0") || 0;
  const rowGap = parseFloat(gridStyle.rowGap || gridStyle.gap || "0") || gap;
  const gridWidth = grid.clientWidth;
  const columnWidth = (gridWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const rowHeight = parseFloat(gridStyle.gridAutoRows || "0") || 140;
  return {
    columnStep: columnWidth + gap,
    rowStep: rowHeight + rowGap,
  };
}

export function SortableTile({
  id,
  className,
  children,
  isEditing,
  layout = { x: 0, y: 0, colSpan: 6, rowSpan: 2 },
  onLayoutChange,
  tileStyle,
}) {
  const interactionRef = React.useRef(null);
  const colSpan = Number(layout?.colSpan) || 6;
  const rowSpan = Number(layout?.rowSpan) || 2;

  const style = {
    ...tileStyle,
    zIndex: interactionRef.current ? 40 : 1,
  };

  function startInteraction(event, mode) {
    if (!isEditing || event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();

    const tile = event.currentTarget.closest("[data-dashboard-tile]");
    const metrics = getGridMetrics(tile);
    if (!metrics) return;

    interactionRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTileX: Number(layout?.x) || 0,
      startTileY: Number(layout?.y) || 0,
      startColSpan: colSpan,
      startRowSpan: rowSpan,
      ...metrics,
    };

    document.body.classList.add(mode === "resize" ? "dashboard-resizing" : "dashboard-dragging");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const colDelta = Math.round((event.clientX - start.startX) / Math.max(1, start.columnStep));
    const rowDelta = Math.round((event.clientY - start.startY) / Math.max(1, start.rowStep));

    if (start.mode === "resize") {
      const nextColSpan = clamp(start.startColSpan + colDelta, MIN_COL_SPAN, MAX_COL_SPAN);
      const nextRowSpan = clamp(start.startRowSpan + rowDelta, MIN_ROW_SPAN, MAX_ROW_SPAN);
      onLayoutChange?.(id, {
        colSpan: nextColSpan,
        rowSpan: nextRowSpan,
        x: clamp(start.startTileX, 0, GRID_COLUMNS - nextColSpan),
        y: start.startTileY,
      });
      return;
    }

    const nextX = clamp(start.startTileX + colDelta, 0, GRID_COLUMNS - start.startColSpan);
    const nextY = Math.max(0, start.startTileY + rowDelta);
    onLayoutChange?.(id, { x: nextX, y: nextY });
  }

  function endInteraction(event) {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = null;
    document.body.classList.remove("dashboard-resizing");
    document.body.classList.remove("dashboard-dragging");
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      data-dashboard-tile
      data-dashboard-col-span={colSpan}
      data-dashboard-row-span={rowSpan}
      style={style}
      className={cn(
        "relative group min-w-0 w-full max-w-full overflow-hidden rounded-2xl",
        className,
        isEditing ? "ring-2 ring-primary/20 bg-slate-50 dark:bg-slate-900 shadow-sm" : ""
      )}
    >
      {isEditing ? (
        <div className="absolute right-3 top-3 z-50 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white p-2 shadow-sm transition-opacity hover:bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Kachel verschieben"
            aria-label="Kachel verschieben"
            onPointerDown={(event) => startInteraction(event, "drag")}
            onPointerMove={handlePointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
            onLostPointerCapture={endInteraction}
          >
            <GripVertical className="h-5 w-5 text-slate-500" />
          </button>
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
          title="Kachelgroesse aendern"
          onPointerDown={(event) => startInteraction(event, "resize")}
          onPointerMove={handlePointerMove}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onLostPointerCapture={endInteraction}
        >
          <span className="block h-full w-full rounded-sm bg-[linear-gradient(135deg,transparent_50%,rgba(100,116,139,0.9)_50%,rgba(100,116,139,0.9)_58%,transparent_58%,transparent_68%,rgba(100,116,139,0.9)_68%,rgba(100,116,139,0.9)_76%,transparent_76%)]" />
        </button>
      ) : null}
    </div>
  );
}

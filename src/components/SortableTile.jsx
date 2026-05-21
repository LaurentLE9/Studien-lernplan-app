import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const TILE_SIZE_OPTIONS = ["small", "medium", "wide", "tall", "large"];

export function SortableTile({ id, className, children, isEditing, size = "medium", sizeLabels = {}, onSizeChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group rounded-2xl", className, isEditing ? "ring-2 ring-primary/20 bg-slate-50 dark:bg-slate-900 shadow-sm" : "")}>
      {isEditing && (
        <div className="absolute right-3 top-3 z-50 flex flex-wrap items-center justify-end gap-2">
          <select
            value={size}
            onChange={(event) => onSizeChange?.(id, event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Kachelgröße wählen"
          >
            {TILE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{sizeLabels[option] || option}</option>
            ))}
          </select>
          <div
            {...attributes}
            {...listeners}
            className="rounded border border-slate-200 bg-white p-2 shadow-sm transition-opacity hover:bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Kachel verschieben"
          >
            <GripVertical className="h-5 w-5 text-slate-500" />
          </div>
        </div>
      )}
      <div className={cn("w-full h-full", isEditing && "pt-14")}>
         {children}
      </div>
    </div>
  );
}

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableTile({ id, className, children, isEditing }) {
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
        <div
          {...attributes}
          {...listeners}
          className="absolute top-3 right-3 z-50 p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-grab active:cursor-grabbing border border-slate-200 dark:border-slate-700 shadow-sm transition-opacity opacity-70 group-hover:opacity-100"
          title="Kachel verschieben"
        >
          <GripVertical className="w-5 h-5 text-slate-500" />
        </div>
      )}
      <div className={cn("w-full h-full", isEditing && "pointer-events-none opacity-50")}>
         {children}
      </div>
    </div>
  );
}

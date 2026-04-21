import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function EditSubjectSheet({
  open,
  onOpenChange,
  title = "Fach bearbeiten",
  description = "Bearbeite das ausgewählte Fach und die zugehörigen Einstellungen.",
  darkMode,
  subject,
  children
}) {
  const [panelWidth, setPanelWidth] = useState(() => {
    // Same default size as ManualStudySheet
    const saved = localStorage.getItem("editSubjectSheetWidth");
    return saved ? parseInt(saved, 10) : 600;
  });

  const panelWidthRef = React.useRef(panelWidth);
  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  const handleDrag = React.useCallback((e) => {
    const newWidth = document.documentElement.clientWidth - e.clientX;
    if (newWidth >= 400 && newWidth <= 900) {
      setPanelWidth(newWidth);
    }
  }, []);

  const stopDrag = React.useCallback(() => {
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
    localStorage.setItem("editSubjectSheetWidth", panelWidthRef.current);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [handleDrag]);

  const startDrag = React.useCallback((e) => {
    e.preventDefault();
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  }, [handleDrag, stopDrag]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        position="right"
        showClose={false}
        className={cn(
          "border-l !max-w-none sm:!max-w-none transition-none", 
          darkMode ? "border-slate-800 bg-[#0f172a] text-slate-50" : "border-slate-200 bg-white text-slate-900"
        )}
        style={{ width: `${panelWidth}px` }}
      >
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 sm:w-2 cursor-ew-resize hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-50",
            darkMode ? "bg-transparent" : "bg-transparent"
          )}
          onMouseDown={startDrag}
        />
        <div className="flex h-full min-h-0 flex-col pl-[2px]">
          <div className={cn("border-b px-4 pb-4 pt-5 sm:px-6", darkMode ? "border-slate-800 bg-slate-950/72" : "border-slate-200 bg-white")}>
            <div className="flex items-start justify-between gap-4">
              <DialogHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full px-3 py-1.5", darkMode ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    Bearbeiten
                  </Badge>
                  {subject && subject.color ? (
                    <span className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold text-slate-950" style={{ backgroundColor: subject.color }}>
                      <span className="truncate">{subject.name}</span>
                    </span>
                  ) : null}
                </div>
                <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
                <DialogDescription>
                  {description}
                </DialogDescription>
              </DialogHeader>

              <Button type="button" variant="ghost" size="icon" className="rounded-[1rem]" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-5 sm:px-6">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
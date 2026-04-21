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

export default function ResizablePanel({
  open,
  onOpenChange,
  title,
  description,
  darkMode,
  badgeText,
  color,
  children,
  defaultWidth = 600,
  storageKey = "genericPanelWidth"
}) {
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : defaultWidth;
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
    localStorage.setItem(storageKey, panelWidthRef.current);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [handleDrag, storageKey]);

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
                  {badgeText ? (
                    <Badge variant="outline" className={cn("rounded-full px-3 py-1.5", darkMode ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                      {badgeText}
                    </Badge>
                  ) : null}
                  {color ? (
                    <span className="inline-flex max-w-full items-center rounded-full h-3 w-6" style={{ backgroundColor: color }}></span>
                  ) : null}
                </div>
                <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
                {description && (
                  <DialogDescription>
                    {description}
                  </DialogDescription>
                )}
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
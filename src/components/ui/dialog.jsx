import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-slate-950/78 supports-[backdrop-filter]:backdrop-blur-[1px]", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(({
  className,
  children,
  position = "center",
  mobileSheet = false,
  showClose = true,
  ...props
}, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 grid w-full gap-4 border border-border/85 bg-[hsl(var(--surface-strong))] text-foreground shadow-[var(--shadow-medium)]",
        position === "right"
          ? "right-0 top-0 h-[100dvh] max-h-[100dvh] translate-x-0 translate-y-0 overflow-hidden border-l p-0 max-w-none w-full sm:max-w-[480px]"
          : position === "left"
            ? "left-0 top-0 h-[100dvh] max-h-[100dvh] translate-x-0 translate-y-0 overflow-hidden border-r p-0 max-w-none w-full sm:max-w-[360px]"
            : mobileSheet
              ? "bottom-0 left-0 right-0 top-auto max-h-[92dvh] translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-t-[1.6rem] border-b-0 border-x-0 p-5 sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-h-none sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-visible sm:overscroll-auto sm:rounded-[1.6rem] sm:border sm:p-6"
              : "left-[50%] top-[50%] max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[1.6rem] p-5 sm:max-h-none sm:w-full sm:overflow-visible sm:overscroll-auto sm:p-6",
        position !== "center" ? "" : mobileSheet ? "" : "rounded-[1.6rem]",
        className
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogClose className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-[hsl(var(--surface-soft))] text-muted-foreground transition hover:text-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 pr-12", className)} {...props} />
);

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-xl font-semibold tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };

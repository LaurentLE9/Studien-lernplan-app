import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 shadow-[var(--shadow-xs)] hover:-translate-y-px active:translate-y-0",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground hover:brightness-110",
        destructive: "border border-red-600 bg-red-600 text-white hover:bg-red-500",
        outline: "border border-border/80 bg-[hsl(var(--surface)/0.88)] text-foreground hover:bg-muted/75",
        secondary: "border border-transparent bg-muted text-foreground hover:bg-muted/80",
        ghost: "border border-transparent bg-transparent shadow-none hover:bg-muted/70",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };

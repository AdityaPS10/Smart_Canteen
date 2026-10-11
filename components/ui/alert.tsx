import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status alerts: a strong left edge in the status colour; body text stays foreground for contrast.
const alertVariants = cva(
  "relative w-full rounded-lg border border-l-4 bg-card px-4 py-3 text-sm text-card-foreground shadow-xs",
  {
    variants: {
      variant: {
        default: "border-l-foreground",
        destructive: "border-danger/40 border-l-danger bg-danger/5",
        success: "border-success/40 border-l-success bg-success/5",
        warning: "border-warning/60 border-l-warning bg-warning/10",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-semibold leading-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

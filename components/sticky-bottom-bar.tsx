import * as React from "react";
import { cn } from "@/lib/utils";

/** Fixed action bar at the bottom of the screen (thumb reach on phones), respecting the safe area. */
export function StickyBottomBar({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  /** Match the page's content width, e.g. "max-w-4xl". */
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={cn("mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3", innerClassName)}>
        {children}
      </div>
    </div>
  );
}

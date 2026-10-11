import { cn } from "@/lib/utils";

const SIZES = {
  sm: "min-w-10 h-10 px-2.5 text-lg rounded-md",
  md: "min-w-14 h-14 px-3 text-3xl rounded-lg",
  lg: "min-w-20 h-20 px-4 text-5xl rounded-xl",
  xl: "min-w-28 h-28 px-5 text-7xl rounded-2xl",
} as const;

const TONES = {
  outline: "border-2 border-foreground/80 bg-card text-foreground",
  solid: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  muted: "bg-muted text-foreground",
} as const;

/** A token number as people see it on the counter, the TV and the kitchen. */
export function TokenChip({
  token,
  size = "md",
  tone = "outline",
  className,
}: {
  token: number | string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn("token-num inline-flex items-center justify-center", SIZES[size], TONES[tone], className)}
      aria-label={`Token ${token}`}
    >
      {token}
    </span>
  );
}

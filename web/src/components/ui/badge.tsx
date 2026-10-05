import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-slate-800 text-slate-300 border border-white/10",
        active:
          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        pending:
          "bg-amber-500/15 text-amber-400 border border-amber-500/30",
        disabled:
          "bg-rose-500/15 text-rose-400 border border-rose-500/30",
        indigo:
          "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
        purple:
          "bg-purple-500/15 text-purple-400 border border-purple-500/30",
        outline:
          "border border-white/20 text-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:text-white hover:border-white/20",
        outline:
          "border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white",
        ghost:
          "text-slate-400 hover:text-slate-100 hover:bg-white/5",
        destructive:
          "bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600",
        success:
          "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
      },
      size: {
        default: "px-4 py-2 text-sm",
        sm: "px-3 py-1.5 text-xs rounded-md",
        xs: "px-2 py-1 text-[11px] rounded",
        lg: "px-6 py-3 text-base rounded-xl",
        icon: "h-8 w-8 p-0 rounded-lg",
        "icon-sm": "h-7 w-7 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && <Loader2 size={14} className="animate-spin shrink-0" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

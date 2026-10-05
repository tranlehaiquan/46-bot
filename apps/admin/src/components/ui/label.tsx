import React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-xs font-medium text-slate-300 flex items-center gap-1 mb-1.5 select-none",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="text-rose-400 font-bold">*</span>}
    </label>
  );
}

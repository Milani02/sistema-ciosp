import * as React from "react";
import { cn } from "../lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-linen px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70",
        "focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-1 focus:ring-offset-surface",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-xl border border-line bg-linen px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70",
        "focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-1 focus:ring-offset-surface",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-linen px-3 py-2.5 text-sm text-ink",
        "focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-1 focus:ring-offset-surface",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function FieldLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-1 mt-3 text-xs font-semibold text-ink-soft", className)} {...props} />;
}

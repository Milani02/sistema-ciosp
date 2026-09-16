import * as React from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-1.5 flex items-center gap-2 text-[0.86rem] font-extrabold tracking-tight text-moss-deep",
        className
      )}
      {...props}
    />
  );
}

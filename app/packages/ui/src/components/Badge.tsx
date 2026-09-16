import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-bold",
  {
    variants: {
      tone: {
        ok: "bg-sage-tint text-moss-deep",
        wait: "bg-clay-tint text-clay",
        crit: "bg-brick-tint text-brick",
        neutral: "border border-line bg-linen text-ink-soft",
      },
    },
    defaultVariants: { tone: "ok" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

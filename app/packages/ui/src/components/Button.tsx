import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-moss text-moss-on shadow-sm hover:bg-moss-deep",
        outline: "border border-line bg-surface text-ink-soft hover:border-sage hover:text-moss-deep",
        ghost: "text-ink-soft hover:bg-sage-tint hover:text-moss-deep",
        danger: "bg-brick text-white hover:opacity-95",
      },
      size: {
        default: "px-4 py-2.5 text-sm w-full",
        sm: "px-3 py-1.5 text-xs",
        icon: "h-9 w-9 shrink-0 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

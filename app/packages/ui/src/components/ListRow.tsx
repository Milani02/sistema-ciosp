import * as React from "react";
import { cn } from "../lib/cn";

const CHIP_TONES = {
  sage: "bg-sage-tint text-moss-deep",
  clay: "bg-clay-tint text-clay",
  brick: "bg-brick-tint text-brick",
  moss: "bg-moss text-moss-on",
} as const;

export function IconChip({
  icon: Icon,
  tone = "sage",
  className,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof CHIP_TONES;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", CHIP_TONES[tone], className)}>
      <Icon className={cn("h-[18px] w-[18px]", iconClassName)} />
    </span>
  );
}

export function ListRow({
  icon,
  iconTone,
  title,
  subtitle,
  trailing,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: keyof typeof CHIP_TONES;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      {icon && <IconChip icon={icon} tone={iconTone} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.88rem] font-semibold text-ink">{title}</div>
        {subtitle && <div className="truncate text-[0.78rem] text-ink-soft">{subtitle}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}

export function ListEmpty({ children }: { children: React.ReactNode }) {
  return <div className="py-3 text-sm text-ink-soft">{children}</div>;
}

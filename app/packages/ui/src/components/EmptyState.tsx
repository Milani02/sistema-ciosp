import * as React from "react";
import { IconChip } from "./ListRow";

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-8 text-center">
      <IconChip icon={icon} tone="sage" className="h-11 w-11" />
      <div className="text-[0.86rem] font-semibold text-ink">{title}</div>
      {subtitle && <div className="max-w-[32ch] text-[0.78rem] text-ink-soft">{subtitle}</div>}
    </div>
  );
}

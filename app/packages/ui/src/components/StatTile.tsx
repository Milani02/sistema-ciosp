import * as React from "react";
import { useCountUp } from "../lib/useCountUp";
import { IconChip } from "./ListRow";

export function StatTile({
  value,
  label,
  live,
  icon,
  tone = "sage",
}: {
  value: React.ReactNode;
  label: string;
  live?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "sage" | "clay" | "brick" | "moss";
}) {
  const isNumber = typeof value === "number";
  const animated = useCountUp(isNumber ? value : 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5">
      {icon && <IconChip icon={icon} tone={tone} className="mb-2.5 h-8 w-8" />}
      <div className="text-[1.7rem] font-black leading-none tracking-tight tabular-nums text-moss-deep">
        {isNumber ? animated : value}
      </div>
      <div className="mt-1 flex items-center text-xs text-ink-soft">
        {live && <span className="live-dot" />}
        {label}
      </div>
    </div>
  );
}

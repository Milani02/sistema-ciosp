import * as React from "react";
import { IconChip } from "./ListRow";

export function PageHeader({
  icon,
  tone = "sage",
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "sage" | "clay" | "brick" | "moss";
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="animate-rise mb-4 flex items-start gap-3">
      <IconChip icon={icon} tone={tone} className="h-11 w-11 shrink-0" iconClassName="h-[22px] w-[22px]" />
      <div className="min-w-0 pt-0.5">
        <h2 className="text-[1.2rem] font-black leading-tight tracking-tight text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-[60ch] text-[0.82rem] text-white/60">{subtitle}</p>}
      </div>
    </div>
  );
}

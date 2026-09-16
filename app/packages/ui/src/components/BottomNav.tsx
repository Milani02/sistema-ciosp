import * as React from "react";
import { cn } from "../lib/cn";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.active)
  );
  const width = 100 / items.length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="relative flex w-full max-w-3xl">
        <span
          aria-hidden
          className="nav-indicator absolute top-1.5 h-[calc(100%-0.75rem)] rounded-2xl bg-sage-tint"
          style={{ width: `calc(${width}% - 8px)`, left: `calc(${activeIndex * width}% + 4px)` }}
        />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={cn(
                "relative z-10 flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-ink-soft transition-colors duration-200",
                item.active && "text-moss"
              )}
            >
              <Icon className={cn("h-[19px] w-[19px] transition-transform duration-200", item.active && "scale-110")} />
              <span className="text-center text-[0.6rem] font-bold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

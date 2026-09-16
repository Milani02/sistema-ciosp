import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../lib/cn";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[58] bg-[#141a0c]/40" />
        <Dialog.Content
          className={cn(
            "sheet-content fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-3xl rounded-t-[18px] bg-surface p-4 pb-[calc(1.3rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)]"
          )}
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
          <Dialog.Title className="mb-2 text-[0.95rem] font-extrabold text-moss-deep">{title}</Dialog.Title>
          <div className="flex flex-col gap-1.5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SheetOption({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-line bg-linen px-3.5 py-3 text-left hover:border-sage"
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-moss" />
      <div>
        <b className="block text-sm text-ink">{title}</b>
        <span className="block text-xs text-ink-soft">{subtitle}</span>
      </div>
    </button>
  );
}

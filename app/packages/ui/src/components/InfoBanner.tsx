import * as React from "react";
import { Info, X } from "lucide-react";

export function InfoBanner({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-sage-tint px-3.5 py-3 text-[0.78rem] leading-relaxed text-moss-deep">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Fechar dica" className="shrink-0 text-moss">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

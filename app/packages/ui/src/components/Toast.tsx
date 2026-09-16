import * as React from "react";
import { CheckCircle2 } from "lucide-react";

type Listener = (msg: string | null) => void;
let listeners: Listener[] = [];
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string) {
  listeners.forEach((l) => l(msg));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => listeners.forEach((l) => l(null)), 2200);
}

/** Mount once near the root of each app. Toast anchors near the top so it
 *  never sits over the bottom tab bar / floating help button. */
export function Toaster() {
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    listeners.push(setMsg);
    return () => {
      listeners = listeners.filter((l) => l !== setMsg);
    };
  }, []);

  return (
    <div
      data-show={msg !== null}
      className="toast-pop pointer-events-none fixed left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-[70] max-w-[calc(100%-2.2rem)] rounded-full bg-moss-deep px-4 py-2.5 text-center text-[0.82rem] font-semibold text-white shadow-[var(--shadow-lift)]"
    >
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {msg}
      </span>
    </div>
  );
}

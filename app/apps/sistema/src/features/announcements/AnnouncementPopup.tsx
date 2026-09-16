import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Megaphone } from "lucide-react";
import { useLiveData } from "../live-data/useLiveData";
import { useAuth } from "../auth/useAuth";

const LAST_SEEN_KEY = "biodinamica_last_seen_announcement";

export function AnnouncementPopup() {
  const { announcements } = useLiveData();
  const { profile } = useAuth();
  const [dismissedId, setDismissedId] = useState<number | null>(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    return stored ? Number(stored) : null;
  });

  const latest = announcements.find((a) => a.target === "ambas" || a.target === profile?.department) ?? null;
  const open = !!latest && latest.id !== dismissedId;

  function dismiss() {
    if (!latest) return;
    localStorage.setItem(LAST_SEEN_KEY, String(latest.id));
    setDismissedId(latest.id);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && dismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[68] bg-black/55" />
        <Dialog.Content className="alert-pop fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2.5rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-surface p-5 text-center shadow-[var(--shadow-lift)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-tint text-clay">
            <Megaphone className="h-6 w-6" />
          </span>
          <Dialog.Title className="mt-3 text-[1.05rem] font-black tracking-tight text-ink">Comunicado</Dialog.Title>
          <Dialog.Description className="mt-1.5 whitespace-pre-wrap text-[0.9rem] text-ink">
            {latest?.text}
          </Dialog.Description>
          {latest && <p className="mt-2 text-[0.72rem] text-ink-soft">— {latest.author_name}</p>}

          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-moss-on"
            >
              Ok, entendi
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

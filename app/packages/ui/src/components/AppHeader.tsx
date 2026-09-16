import * as React from "react";
import { cn } from "../lib/cn";

export function AppHeader({
  eyebrow,
  title,
  right,
  transparent = false,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  /** Pass true when the page itself already provides the noir + living-lines
   *  canvas (e.g. the sistema app shell) — the header then just blurs
   *  whatever's behind it instead of painting its own dark band. */
  transparent?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 -mx-4 flex items-center justify-between gap-3 px-4 py-3 sm:-mx-6 sm:px-6",
        transparent ? "border-b border-white/10 bg-black/25 backdrop-blur-md" : "noir-bg header-noir"
      )}
    >
      {!transparent && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
          <path className="noir-line noir-line-4" d="M -40 90 C 80 130, 180 40, 440 100" />
          <path className="noir-line noir-line-2" d="M -40 40 C 100 10, 200 70, 440 30" />
          <path className="noir-line noir-line-1" d="M -40 65 C 120 100, 220 10, 440 65" />
          <path className="noir-line noir-line-3" d="M -40 20 C 90 55, 250 -10, 440 45" />
        </svg>
      )}

      <div className="relative flex min-w-0 items-center gap-2.5">
        <img
          src="/logo-icon.png"
          alt="Grupo Biodinâmica"
          className="h-[34px] w-[34px] shrink-0 rounded-[10px] shadow-[0_4px_14px_rgba(0,0,0,0.45),0_0_16px_-2px_#34d17c66]"
        />
        <div className="min-w-0">
          <span className="block truncate text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/65">
            {eyebrow}
          </span>
          <h1 className="truncate text-[1.02rem] font-extrabold tracking-tight text-white">{title}</h1>
        </div>
      </div>
      {right && <div className="relative shrink-0">{right}</div>}
    </header>
  );
}

export function ConnectionPill({ ok }: { ok: boolean | null }) {
  const label = ok === null ? "conectando..." : ok ? "ao vivo" : "sem conexão";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.7rem] font-bold " +
        (ok ? "bg-sage-tint text-moss-deep" : ok === false ? "bg-brick-tint text-brick" : "bg-white/15 text-white/80")
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

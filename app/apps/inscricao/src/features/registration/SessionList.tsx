import { useEffect, useState } from "react";
import { Badge, Button } from "@biodinamica/ui";
import { Lock, Users } from "lucide-react";
import type { Activity, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";
import handsonCover from "../../assets/handson-cover.jpg";
import palestraCover from "../../assets/palestra-cover.jpg";

interface ListedSession extends Session {
  filled: number;
  full: boolean;
  locked: boolean;
  ended: boolean;
}

// Foto de capa, sem nenhuma informação escrita em cima — as infos da sessão
// ficam todas na área de conteúdo abaixo dela.
function SessionCover({ activity, dimmed }: { activity: Activity; dimmed?: boolean }) {
  const src = activity === "handson" ? handsonCover : palestraCover;
  const alt = activity === "handson" ? "Prática de hands-on odontológico" : "Palestra em auditório";
  return (
    <div className="aspect-[16/9] w-full shrink-0 overflow-hidden bg-linen">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={"h-full w-full object-cover " + (dimmed ? "grayscale" : "")}
      />
    </div>
  );
}

export function SessionList({
  activity,
  onBack,
  onSelect,
}: {
  activity: Activity;
  onBack: () => void;
  onSelect: (session: Session) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ListedSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const now = new Date();
      const [{ data: sess }, { data: checkins }] = await Promise.all([
        supabase.from("sessions").select("*").eq("activity", activity),
        supabase.from("checkins").select("session_id,status"),
      ]);
      if (cancelled) return;
      const all = (sess ?? [])
        .map((s) => {
          const t = new Date(s.session_time);
          const opensAt = new Date(t.getTime() - 60 * 60000);
          const filled = (checkins ?? []).filter(
            (c) => c.session_id === s.id && (c.status === "confirmed" || c.status === "checked_in")
          ).length;
          return {
            ...s,
            filled,
            full: filled >= s.capacity,
            locked: now < opensAt,
            ended: now > t,
          };
        })
        .sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime());
      setSessions(all);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activity]);

  const label = activity === "handson" ? "Hands-on" : "Palestra";

  return (
    <>
      <div className="mb-3 text-[0.8rem] font-semibold text-white/70">Todas as sessões — {label}</div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
              <div className="aspect-[16/9] w-full animate-pulse bg-linen" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-linen" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-linen" />
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-ink-soft shadow-[var(--shadow-card)]">
          Nenhuma sessão cadastrada ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sessions.map((s) => {
            const disabled = s.locked || s.ended;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s)}
                className="overflow-hidden rounded-2xl bg-surface text-left shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                <SessionCover activity={activity} dimmed={disabled} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-[1rem] font-bold leading-snug text-ink">{s.title}</div>
                      <div className="mt-1 text-[0.82rem] text-ink-soft">{fmtDT(s.session_time)}</div>
                    </div>
                    {!s.ended && (
                      <Badge tone={s.locked ? "neutral" : s.full ? "wait" : "ok"} className="shrink-0">
                        {s.locked ? (
                          <>
                            <Lock className="h-3 w-3" /> bloqueada
                          </>
                        ) : s.full ? (
                          "fila de espera"
                        ) : (
                          "vaga livre"
                        )}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2.5 text-[0.78rem] text-ink-soft">
                    {s.ended ? (
                      "Sessão encerrada"
                    ) : s.locked ? (
                      `Inscrição abre às ${fmtDT(new Date(new Date(s.session_time).getTime() - 60 * 60000).toISOString())}`
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {s.filled}/{s.capacity} vagas
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onBack}>
        ← Voltar
      </Button>
    </>
  );
}

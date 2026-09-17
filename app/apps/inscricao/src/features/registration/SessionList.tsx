import { useEffect, useState } from "react";
import { Badge, Button } from "@biodinamica/ui";
import { Lock, Users } from "lucide-react";
import type { Activity, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";
import handson1 from "../../assets/handson-1.jpg";
import handson2 from "../../assets/handson-2.jpg";
import handson3 from "../../assets/handson-3.jpg";
import handson4 from "../../assets/handson-4.jpg";
import handson5 from "../../assets/handson-5.jpg";
import handson6 from "../../assets/handson-6.jpg";
import handson7 from "../../assets/handson-7.jpg";
import palestra1 from "../../assets/palestra-1.jpg";
import palestra2 from "../../assets/palestra-2.jpg";
import palestra3 from "../../assets/palestra-3.jpg";
import palestra4 from "../../assets/palestra-4.jpg";
import palestra5 from "../../assets/palestra-5.jpg";
import palestra6 from "../../assets/palestra-6.jpg";
import palestra7 from "../../assets/palestra-7.jpg";

interface ListedSession extends Session {
  filled: number;
  full: boolean;
  locked: boolean;
  ended: boolean;
}

const HANDSON_COVERS = [handson1, handson2, handson3, handson4, handson5, handson6, handson7];
const PALESTRA_COVERS = [palestra1, palestra2, palestra3, palestra4, palestra5, palestra6, palestra7];

// Cada sessão pega uma foto diferente do pool (nunca a mesma pra duas
// sessões seguidas da mesma atividade) — sem nenhuma informação escrita
// em cima da foto, as infos ficam todas ao lado, no conteúdo do card.
function coverFor(activity: Activity, index: number) {
  const pool = activity === "handson" ? HANDSON_COVERS : PALESTRA_COVERS;
  return pool[index % pool.length];
}

function SessionThumb({
  activity,
  index,
  locked,
  dimmed,
}: {
  activity: Activity;
  index: number;
  locked?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-linen">
      <img
        src={coverFor(activity, index)}
        alt=""
        loading="lazy"
        className={"h-full w-full object-cover " + (dimmed ? "grayscale" : "")}
      />
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55">
          <Lock className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
      )}
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
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface p-2.5 shadow-[var(--shadow-card)]">
              <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-linen" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-linen" />
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
        <div className="flex flex-col gap-2">
          {sessions.map((s, index) => {
            const disabled = s.locked || s.ended;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s)}
                className="flex w-full items-center gap-3 rounded-xl bg-surface p-2.5 text-left shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0"
              >
                <SessionThumb activity={activity} index={index} locked={s.locked} dimmed={disabled} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 truncate text-[0.86rem] font-bold leading-snug text-ink">{s.title}</div>
                    {!s.ended && (
                      <Badge tone={s.locked ? "neutral" : s.full ? "wait" : "ok"} className="shrink-0 text-[0.68rem]">
                        {s.locked ? "bloqueada" : s.full ? "fila de espera" : "vaga livre"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[0.76rem] text-ink-soft">{fmtDT(s.session_time)}</div>
                  <div className="mt-0.5 text-[0.72rem] text-ink-soft">
                    {s.ended ? (
                      "Sessão encerrada"
                    ) : s.locked ? (
                      `Abre às ${fmtDT(new Date(new Date(s.session_time).getTime() - 60 * 60000).toISOString())}`
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
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

import { useEffect, useState } from "react";
import { Badge, Button } from "@biodinamica/ui";
import { Lock } from "lucide-react";
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

// Cada sessão pega uma foto diferente do pool (por posição na lista, nunca
// repete entre as visíveis).
function coverFor(activity: Activity, index: number) {
  const pool = activity === "handson" ? HANDSON_COVERS : PALESTRA_COVERS;
  return pool[index % pool.length];
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
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-ink-soft shadow-[var(--shadow-card)]">
          Nenhuma sessão cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sessions.map((s, index) => {
            const disabled = s.locked || s.ended;
            const pct = s.capacity > 0 ? Math.min(100, Math.round((s.filled / s.capacity) * 100)) : 0;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s)}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl text-left shadow-[var(--shadow-card)] transition-transform duration-200 active:scale-[0.97] disabled:cursor-not-allowed"
              >
                <img
                  src={coverFor(activity, index)}
                  alt=""
                  loading="lazy"
                  className={"absolute inset-0 h-full w-full object-cover " + (disabled ? "grayscale" : "")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/5" />

                {!s.ended && (
                  <div className="absolute right-2 top-2">
                    <Badge tone={s.locked ? "neutral" : s.full ? "wait" : "ok"} className="text-[0.62rem]">
                      {s.locked ? "bloqueada" : s.full ? "fila" : "livre"}
                    </Badge>
                  </div>
                )}

                {s.locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/55 p-2.5">
                      <Lock className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="line-clamp-2 text-[0.86rem] font-bold leading-tight text-white">{s.title}</div>
                  <div className="mt-1 text-[0.7rem] text-white/75">{fmtDT(s.session_time)}</div>

                  {s.ended ? (
                    <div className="mt-1.5 text-[0.66rem] text-white/60">Sessão encerrada</div>
                  ) : s.locked ? (
                    <div className="mt-1.5 text-[0.66rem] text-white/60">
                      Abre às {fmtDT(new Date(new Date(s.session_time).getTime() - 60 * 60000).toISOString())}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
                        <div className="h-full rounded-full bg-moss-bright" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[0.64rem] text-white/70">
                        {s.filled}/{s.capacity} vagas
                      </div>
                    </div>
                  )}
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

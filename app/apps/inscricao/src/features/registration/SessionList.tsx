import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@biodinamica/ui";
import type { Activity, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";

interface OpenSession extends Session {
  filled: number;
  full: boolean;
}

export function SessionList({
  activity,
  onBack,
  onSelect,
}: {
  activity: Activity;
  onBack: () => void;
  onSelect: (sessionId: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<OpenSession[]>([]);

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
      const open = (sess ?? [])
        .filter((s) => {
          const t = new Date(s.session_time);
          const opensAt = new Date(t.getTime() - 60 * 60000);
          return now >= opensAt && now <= t;
        })
        .map((s) => {
          const filled = (checkins ?? []).filter(
            (c) => c.session_id === s.id && (c.status === "confirmed" || c.status === "checked_in")
          ).length;
          return { ...s, filled, full: filled >= s.capacity };
        })
        .sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime());
      setSessions(open);
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
      <Card>
        <div className="mb-2 text-xs font-semibold text-ink-soft">Sessões abertas agora — {label}</div>
        {loading ? (
          <div className="py-4 text-center text-sm text-ink-soft">Carregando sessões...</div>
        ) : sessions.length === 0 ? (
          <div className="py-4 text-center text-sm text-ink-soft">
            Nenhuma sessão com inscrição aberta no momento.
            <br />A inscrição abre 1h antes do início de cada sessão.
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className="mb-2.5 flex w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5 text-left last:mb-0 hover:border-sage"
            >
              <div>
                <div className="text-[0.92rem] font-bold text-ink">
                  {fmtDT(s.session_time)} · {s.title}
                </div>
                <div className="text-[0.78rem] text-ink-soft">
                  {s.filled}/{s.capacity} vagas
                </div>
              </div>
              <Badge tone={s.full ? "wait" : "ok"}>{s.full ? "fila de espera" : "vaga livre"}</Badge>
            </button>
          ))
        )}
      </Card>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onBack}>
        ← Voltar
      </Button>
    </>
  );
}

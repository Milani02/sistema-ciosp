import { useMemo, useState } from "react";
import { Badge, Card, PageHeader, showToast } from "@biodinamica/ui";
import { CheckCircle2, Clock, Timer, UtensilsCrossed } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SelfAlmocoPage() {
  const { profile } = useAuth();
  const { staff, lunchQueue, lunchAttendance, loading } = useLiveData();
  const [busy, setBusy] = useState(false);

  const me = useMemo(() => staff.find((s) => s.id === profile?.staff_id) ?? null, [staff, profile]);
  const myAttendance = useMemo(
    () => lunchAttendance.find((a) => a.staff_id === profile?.staff_id && !a.ended_at) ?? null,
    [lunchAttendance, profile]
  );
  const myQueuePosition = useMemo(() => {
    const sorted = [...lunchQueue].sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
    const idx = sorted.findIndex((q) => q.staff_id === profile?.staff_id);
    return idx === -1 ? null : idx + 1;
  }, [lunchQueue, profile]);

  async function fuiAlmocar() {
    setBusy(true);
    const { error } = await supabase.rpc("self_enter_lunch");
    setBusy(false);
    if (error) showToast("Erro: " + error.message);
  }

  async function terminei() {
    setBusy(true);
    const { error } = await supabase.rpc("self_return_from_lunch");
    setBusy(false);
    if (error) showToast("Erro: " + error.message);
  }

  return (
    <>
      <PageHeader icon={UtensilsCrossed} tone="clay" title="Meu almoço" subtitle="Marque sozinho quando for e quando voltar." />

      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-ink-soft">Carregando...</div>
        ) : !me ? (
          <div className="py-8 text-center text-sm text-ink-soft">
            Sua conta não está vinculada a ninguém da equipe — peça pro admin corrigir.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div>
              <div className="text-[1.1rem] font-black text-ink">{me.name}</div>
              <Badge tone="neutral" className="mt-1">
                {me.team}
              </Badge>
            </div>

            {me.status === "pending" && (
              <>
                <p className="text-[0.86rem] text-ink-soft">Toque no botão quando for almoçar.</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={fuiAlmocar}
                  className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-full bg-moss text-moss-on shadow-[var(--shadow-lift)] disabled:opacity-60"
                >
                  <UtensilsCrossed className="h-8 w-8" />
                  <span className="text-[0.9rem] font-black">Fui almoçar</span>
                </button>
              </>
            )}

            {me.status === "queued" && (
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-tint text-clay">
                  <Clock className="h-8 w-8" />
                </span>
                <p className="text-[0.95rem] font-bold text-ink">Você está na fila{myQueuePosition ? ` — posição #${myQueuePosition}` : ""}</p>
                <p className="max-w-[260px] text-[0.82rem] text-ink-soft">
                  A mesa está cheia agora (máx. 2 de uma vez). Assim que alguém voltar, você entra automaticamente.
                </p>
              </div>
            )}

            {me.status === "eating" && myAttendance && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-tint text-moss-deep">
                    <Timer className="h-8 w-8" />
                  </span>
                  <p className="text-[0.86rem] text-ink-soft">Almoçando desde {formatTime(myAttendance.started_at)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={terminei}
                  className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-full bg-brick text-white shadow-[var(--shadow-lift)] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-8 w-8" />
                  <span className="text-[0.9rem] font-black">Terminei</span>
                </button>
              </>
            )}

            {me.status === "done" && (
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-tint text-moss-deep">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <p className="text-[0.95rem] font-bold text-ink">Você já almoçou hoje ✓</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

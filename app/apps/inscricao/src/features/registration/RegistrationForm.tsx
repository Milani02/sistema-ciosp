import { useEffect, useState } from "react";
import { Badge, Button, Card, FieldLabel, Input, cn, showToast } from "@biodinamica/ui";
import type { Activity, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OpenSession extends Session {
  filled: number;
  full: boolean;
}

export function RegistrationForm({
  activity,
  sessionId,
  onBack,
  onRegistered,
}: {
  activity: Activity;
  /** Already chosen (palestra flow, picked on the previous screen). When
   *  absent (hands-on flow), the form itself lets the visitor pick which
   *  hands-on session — see `handsonSessions` below. */
  sessionId?: number;
  onBack: () => void;
  onRegistered: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [cro, setCro] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsSessionPick = activity === "handson" && sessionId === undefined;
  const [handsonSessions, setHandsonSessions] = useState<OpenSession[]>([]);
  const [chosenSessionId, setChosenSessionId] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(needsSessionPick);

  useEffect(() => {
    if (!needsSessionPick) return;
    let cancelled = false;
    async function load() {
      setLoadingSessions(true);
      const now = new Date();
      const [{ data: sess }, { data: checkins }] = await Promise.all([
        supabase.from("sessions").select("*").eq("activity", "handson"),
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
      setHandsonSessions(open);
      setLoadingSessions(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [needsSessionPick]);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedCro = cro.trim();
    const trimmedEsp = especialidade.trim();
    const trimmedEmail = email.trim();
    const finalSessionId = needsSessionPick ? parseInt(chosenSessionId, 10) : sessionId!;

    if (!trimmedName) return showToast("Digite seu nome completo.");
    if (!trimmedCro) return showToast("Digite seu CRO de CD.");
    if (!trimmedEsp) return showToast("Digite sua especialidade.");
    if (telefone.length < 10) return showToast("Digite um telefone válido com DDD.");
    if (!EMAIL_RE.test(trimmedEmail)) return showToast("Digite um e-mail válido.");
    if (needsSessionPick && !chosenSessionId) return showToast("Escolha o hands-on que você vai fazer.");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_visitor", {
      p_session_id: finalSessionId,
      p_name: trimmedName,
      p_cro: trimmedCro,
      p_especialidade: trimmedEsp,
      p_telefone: telefone,
      p_email: trimmedEmail,
    });
    if (error) {
      showToast("Erro: " + error.message);
      setSubmitting(false);
      return;
    }
    const token = data[0].out_token as string;
    history.replaceState(null, "", "?r=" + token);
    onRegistered(token);
  }

  return (
    <Card>
      <FieldLabel className="mt-0">Nome Completo *</FieldLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />

      <FieldLabel>CRO de CD *</FieldLabel>
      <Input value={cro} onChange={(e) => setCro(e.target.value)} placeholder="CRO-SP 00000" />

      <FieldLabel>Especialidade *</FieldLabel>
      <Input
        value={especialidade}
        onChange={(e) => setEspecialidade(e.target.value)}
        placeholder="Ex.: Ortodontia, Endodontia..."
      />

      <FieldLabel>Telefone com DDD * — somente números</FieldLabel>
      <Input
        type="tel"
        inputMode="numeric"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value.replace(/\D/g, "").slice(0, 11))}
        placeholder="11999998888"
      />

      <FieldLabel>E-mail *</FieldLabel>
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />

      {needsSessionPick && (
        <>
          <FieldLabel>Hands-on Inscrito *</FieldLabel>
          {loadingSessions ? (
            <p className="py-2 text-sm text-ink-soft">Carregando hands-on disponíveis...</p>
          ) : handsonSessions.length === 0 ? (
            <p className="py-2 text-sm text-ink-soft">
              Nenhum hands-on com inscrição aberta agora. A inscrição abre 1h antes do início de cada sessão.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {handsonSessions.map((s) => {
                const selected = chosenSessionId === String(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setChosenSessionId(String(s.id))}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
                      selected ? "border-moss bg-sage-tint" : "border-line bg-surface hover:border-sage"
                    )}
                  >
                    <div>
                      <div className="text-[0.92rem] font-bold text-ink">{s.title}</div>
                      <div className="text-[0.78rem] text-ink-soft">
                        {fmtDT(s.session_time)} · {s.filled}/{s.capacity} vagas
                      </div>
                    </div>
                    <Badge tone={s.full ? "wait" : "ok"}>{s.full ? "fila de espera" : "vaga livre"}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <Button className="mt-4" loading={submitting} onClick={submit}>
        {submitting ? "Enviando..." : "Confirmar inscrição"}
      </Button>
      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={onBack}>
        ← Voltar
      </Button>
    </Card>
  );
}

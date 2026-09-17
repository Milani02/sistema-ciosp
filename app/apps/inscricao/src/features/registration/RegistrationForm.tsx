import { useState } from "react";
import { Button, Card, FieldLabel, IconChip, Input, showToast } from "@biodinamica/ui";
import { FlaskConical, Mic } from "lucide-react";
import type { Activity, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegistrationForm({
  activity,
  session,
  onBack,
  onRegistered,
}: {
  activity: Activity;
  session: Session;
  onBack: () => void;
  onRegistered: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [cro, setCro] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedCro = cro.trim();
    const trimmedEsp = especialidade.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) return showToast("Digite seu nome completo.");
    if (!trimmedCro) return showToast("Digite seu CRO de CD.");
    if (!trimmedEsp) return showToast("Digite sua especialidade.");
    if (telefone.length < 10) return showToast("Digite um telefone válido com DDD.");
    if (!EMAIL_RE.test(trimmedEmail)) return showToast("Digite um e-mail válido.");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_visitor", {
      p_session_id: session.id,
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
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-linen/60 px-3 py-2.5">
        <IconChip icon={activity === "handson" ? FlaskConical : Mic} tone={activity === "handson" ? "clay" : "moss"} className="h-9 w-9" iconClassName="h-4 w-4" />
        <div className="min-w-0">
          <div className="truncate text-[0.88rem] font-bold text-ink">{session.title}</div>
          <div className="text-[0.76rem] text-ink-soft">{fmtDT(session.session_time)}</div>
        </div>
      </div>

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

      <Button className="mt-4" loading={submitting} onClick={submit}>
        {submitting ? "Enviando..." : "Confirmar inscrição"}
      </Button>
      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={onBack}>
        ← Voltar
      </Button>
    </Card>
  );
}

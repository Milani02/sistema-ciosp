import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  FieldLabel,
  Input,
  ListEmpty,
  ListRow,
  PageHeader,
  Select,
  SkeletonRow,
  showToast,
} from "@biodinamica/ui";
import {
  Calendar,
  ChevronDown,
  FlaskConical,
  Mail,
  Mic,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Activity, Checkin, CheckinStatus, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { capacityLevel, sessionFillCount, sessionRatingAvg } from "../../lib/derived";
import { fmtDT } from "../../lib/format";
import { useLiveData } from "../live-data/useLiveData";

const STATUS_BADGE: Record<CheckinStatus, { tone: "ok" | "wait" | "crit" | "neutral"; label: string }> = {
  confirmed: { tone: "wait", label: "aguardando chegada" },
  checked_in: { tone: "ok", label: "check-in feito" },
  waitlisted: { tone: "neutral", label: "fila de espera" },
  no_show: { tone: "crit", label: "não compareceu" },
  cancelled: { tone: "neutral", label: "cancelado" },
};

function RegistrantRow({ c }: { c: Checkin }) {
  const status = STATUS_BADGE[c.status];
  return (
    <ListRow
      icon={UserRound}
      title={c.visitor_name}
      subtitle={
        [c.cro, c.especialidade].filter(Boolean).join(" · ") ||
        undefined
      }
      trailing={<Badge tone={status.tone}>{status.label}</Badge>}
      className="items-start"
    />
  );
}

function SessionRating({ sessionId }: { sessionId: number }) {
  const { feedback } = useLiveData();
  const [sending, setSending] = useState(false);
  const rating = sessionRatingAvg(feedback, sessionId);

  async function rate(value: number) {
    setSending(true);
    const { error } = await supabase.from("session_feedback").insert({ session_id: sessionId, rating: value });
    setSending(false);
    if (error) showToast("Erro: " + error.message);
    else showToast("Avaliação registrada.");
  }

  return (
    <div className="mb-3 ml-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-linen/60 px-3 py-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={sending}
            onClick={() => rate(n)}
            aria-label={`Avaliar com ${n} estrela${n === 1 ? "" : "s"}`}
            className="text-clay hover:scale-110 disabled:opacity-50"
          >
            <Star className="h-4 w-4" fill="currentColor" />
          </button>
        ))}
      </div>
      <span className="text-[0.74rem] text-ink-soft">
        {rating ? `${rating.avg.toFixed(1)} · ${rating.count} avaliação${rating.count === 1 ? "" : "ões"}` : "sem avaliações ainda"}
      </span>
    </div>
  );
}

export function AgendaPage() {
  const { sessions, checkins, loading } = useLiveData();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity>("handson");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime()),
    [sessions]
  );

  function startEdit(s: Session) {
    setEditingId(s.id);
    setActivity(s.activity);
    setTitle(s.title);
    setTime(toLocalInputValue(s.session_time));
    setCapacity(String(s.capacity));
  }

  function cancelEdit() {
    setEditingId(null);
    setActivity("handson");
    setTitle("");
    setTime("");
    setCapacity("8");
  }

  function toLocalInputValue(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function saveSession() {
    if (!time) {
      showToast("Escolha data e horário da sessão.");
      return;
    }
    setSubmitting(true);
    const payload = {
      activity,
      title: title.trim() || (activity === "handson" ? "Bancada" : "Palestra"),
      session_time: new Date(time).toISOString(),
      capacity: parseInt(capacity, 10) || 8,
    };
    const { error } = editingId
      ? await supabase.from("sessions").update(payload).eq("id", editingId)
      : await supabase.from("sessions").insert(payload);
    setSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    showToast(editingId ? "Sessão atualizada." : "Sessão adicionada.");
    cancelEdit();
  }

  async function removeSession(id: number) {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) showToast("Erro: " + error.message);
    if (editingId === id) cancelEdit();
  }

  return (
    <>
      <PageHeader
        icon={Calendar}
        tone="sage"
        title="Agenda de sessões"
        subtitle="Cadastre, edite e acompanhe quem se inscreveu em cada hands-on e palestra. Atualiza sozinho conforme os check-ins acontecem."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>{editingId ? "Editar sessão" : "Nova sessão"}</CardTitle>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-ink-soft hover:text-ink" aria-label="Cancelar edição">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FieldLabel className="mt-0">Atividade</FieldLabel>
          <Select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            <option value="handson">Hands-on</option>
            <option value="palestra">Palestra</option>
          </Select>
          <FieldLabel>Título</FieldLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Restauração Estética" />
          <FieldLabel>Data e horário</FieldLabel>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          <FieldLabel>Vagas</FieldLabel>
          <Input type="number" min={1} className="w-24" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <Button className="mt-3" loading={submitting} onClick={saveSession}>
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Salvar alterações" : "Adicionar sessão"}
          </Button>
          {editingId && (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={cancelEdit}>
              Cancelar edição
            </Button>
          )}
        </Card>

        <Card>
          <CardTitle>Sessões cadastradas</CardTitle>
          <div className="mt-2 max-h-[560px] divide-y divide-line overflow-y-auto border-t border-line">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : sorted.length === 0 ? (
              <EmptyState icon={Calendar} title="Nenhuma sessão ainda" subtitle="Cadastre a primeira sessão de hands-on ou palestra ao lado." />
            ) : (
              sorted.map((s) => {
                const filled = sessionFillCount(checkins, s.id);
                const level = capacityLevel(filled, s.capacity);
                const started = new Date(s.session_time).getTime() <= Date.now();
                const expanded = expandedId === s.id;
                const registrants = checkins
                  .filter((c) => c.session_id === s.id)
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                return (
                  <div key={s.id}>
                    <ListRow
                      icon={s.activity === "handson" ? FlaskConical : Mic}
                      title={s.title}
                      subtitle={`${fmtDT(s.session_time)} · ${s.activity === "handson" ? "Hands-on" : "Palestra"}`}
                      trailing={
                        <>
                          <Badge tone={level}>
                            {filled}/{s.capacity}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : s.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-sage-tint hover:text-moss-deep"
                            aria-label={expanded ? "Esconder inscritos" : "Ver inscritos"}
                          >
                            <ChevronDown className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-sage-tint hover:text-moss-deep"
                            aria-label="Editar sessão"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <Button variant="danger" size="sm" className="w-auto" onClick={() => removeSession(s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      }
                    />
                    {expanded && started && <SessionRating sessionId={s.id} />}
                    {expanded && (
                      <div className="mb-3 ml-4 rounded-xl border border-line bg-linen/60 px-3 py-1.5">
                        {registrants.length === 0 ? (
                          <ListEmpty>Ninguém inscrito ainda.</ListEmpty>
                        ) : (
                          <div className="divide-y divide-line">
                            {registrants.map((c) => (
                              <div key={c.id} className="py-2.5">
                                <RegistrantRow c={c} />
                                <div className="ml-[calc(2.25rem+0.75rem)] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.74rem] text-ink-soft">
                                  {c.telefone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="h-3 w-3" /> {c.telefone}
                                    </span>
                                  )}
                                  {c.email && (
                                    <span className="inline-flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> {c.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

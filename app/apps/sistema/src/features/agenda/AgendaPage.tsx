import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  IconChip,
  Input,
  ListEmpty,
  PageHeader,
  Select,
  SkeletonRow,
  showToast,
} from "@biodinamica/ui";
import {
  Calendar,
  FlaskConical,
  Mail,
  Mic,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UserRound,
  Users,
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
    <div className="flex items-start gap-2.5 py-2.5">
      <IconChip icon={UserRound} tone="sage" className="h-8 w-8" iconClassName="h-4 w-4" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[0.85rem] font-semibold text-ink">{c.visitor_name}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {(c.cro || c.especialidade) && (
          <div className="mt-0.5 text-[0.76rem] text-ink-soft">{[c.cro, c.especialidade].filter(Boolean).join(" · ")}</div>
        )}
        {(c.telefone || c.email) && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.74rem] text-ink-soft">
            {c.telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" /> {c.telefone}
              </span>
            )}
            {c.email && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
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
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-linen/60 px-3 py-2.5">
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity>("handson");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime()),
    [sessions]
  );

  function openNew() {
    setEditingId(null);
    setActivity("handson");
    setTitle("");
    setTime("");
    setCapacity("8");
    setSheetOpen(true);
  }

  function openEdit(s: Session) {
    setEditingId(s.id);
    setActivity(s.activity);
    setTitle(s.title);
    setTime(toLocalInputValue(s.session_time));
    setCapacity(String(s.capacity));
    setSheetOpen(true);
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
    setSheetOpen(false);
  }

  async function removeSession(id: number) {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) showToast("Erro: " + error.message);
  }

  return (
    <>
      <PageHeader
        icon={Calendar}
        tone="sage"
        title="Agenda de sessões"
        subtitle="Cadastre, edite e acompanhe quem se inscreveu em cada hands-on e palestra. Atualiza sozinho conforme os check-ins acontecem."
      />

      <Button className="w-auto" onClick={openNew}>
        <Plus className="h-4 w-4" />
        Nova sessão
      </Button>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <Card>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : sorted.length === 0 ? (
          <Card>
            <EmptyState icon={Calendar} title="Nenhuma sessão ainda" subtitle='Toque em "Nova sessão" pra cadastrar a primeira.' />
          </Card>
        ) : (
          sorted.map((s) => {
            const filled = sessionFillCount(checkins, s.id);
            const level = capacityLevel(filled, s.capacity);
            const started = new Date(s.session_time).getTime() <= Date.now();
            const registrants = checkins
              .filter((c) => c.session_id === s.id)
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return (
              <Card key={s.id}>
                <div className="flex items-start gap-3">
                  <IconChip icon={s.activity === "handson" ? FlaskConical : Mic} tone={s.activity === "handson" ? "clay" : "moss"} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[0.9rem] font-semibold leading-snug text-ink">{s.title}</div>
                    <div className="mt-0.5 text-[0.78rem] text-ink-soft">
                      {fmtDT(s.session_time)} · {s.activity === "handson" ? "Hands-on" : "Palestra"}
                    </div>
                  </div>
                  <Badge tone={level} className="shrink-0">
                    {filled}/{s.capacity}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="w-auto" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button variant="danger" size="sm" className="w-auto" onClick={() => removeSession(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>

                <Accordion type="single" collapsible className="mt-1">
                  <AccordionItem value={String(s.id)} className="border-t border-line">
                    <AccordionTrigger>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Ver inscritos ({registrants.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {started && <SessionRating sessionId={s.id} />}
                      {registrants.length === 0 ? (
                        <ListEmpty>Ninguém inscrito ainda.</ListEmpty>
                      ) : (
                        <div className="divide-y divide-line">
                          {registrants.map((c) => (
                            <RegistrantRow key={c.id} c={c} />
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            );
          })
        )}
      </div>

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={editingId ? "Editar sessão" : "Nova sessão"}>
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
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" loading={submitting} onClick={saveSession}>
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

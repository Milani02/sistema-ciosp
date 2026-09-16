import { useMemo, useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  CardTitle,
  EmptyState,
  FieldLabel,
  Input,
  PageHeader,
  Select,
  showToast,
  SkeletonRow,
  StatTile,
} from "@biodinamica/ui";
import { CheckCircle2, Clock, Plus, RotateCcw, Timer, Trash2, Users, UtensilsCrossed } from "lucide-react";
import type { Staff } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";

const TEAM_OPTIONS = ["Comercial", "Técnica", "Caixa"] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AlmocoPage() {
  const { profile } = useAuth();
  const { staff, lunchQueue, lunchSessions, loading } = useLiveData();
  const [selected, setSelected] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState<(typeof TEAM_OPTIONS)[number]>("Comercial");
  const [addingStaff, setAddingStaff] = useState(false);
  const [removingStaff, setRemovingStaff] = useState<Staff | null>(null);
  const [removingStaffBusy, setRemovingStaffBusy] = useState(false);

  // Admin comercial só manda gente do Comercial pro almoço; admin técnica
  // manda gente da Técnica OU do Caixa (o Caixa fica sob responsabilidade
  // da Técnica). Mesma regra é validada de novo dentro da RPC no banco —
  // isso aqui é só pra já filtrar a lista antes de tentar.
  const allowedTeams: string[] =
    profile?.department === "comercial" ? ["Comercial"] : profile?.department === "tecnica" ? ["Técnica", "Caixa"] : [];

  const pending = useMemo(() => staff.filter((s) => s.status === "pending"), [staff]);
  const sendablePending = useMemo(() => pending.filter((s) => allowedTeams.includes(s.team)), [pending, allowedTeams]);
  const outOfScopePendingCount = pending.length - sendablePending.length;
  const done = useMemo(() => staff.filter((s) => s.status === "done"), [staff]);
  const eatingSessions = useMemo(
    () => lunchSessions.filter((s) => !s.end_time).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [lunchSessions]
  );
  const queued = useMemo(() => {
    const byId = new Map(staff.map((s) => [s.id, s] as const));
    return [...lunchQueue]
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
      .map((q) => byId.get(q.staff_id))
      .filter((s): s is Staff => !!s);
  }, [lunchQueue, staff]);
  const allStaffSorted = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff]);

  function toggleSelected(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function mandarPraAlmoco() {
    if (selected.length === 0) return;
    setSending(true);
    const { error } = await supabase.rpc("enter_lunch_queue_group", { p_staff_ids: selected });
    setSending(false);
    if (error) {
      showToast("Erro ao mandar pro almoço: " + error.message);
      return;
    }
    setSelected([]);
  }

  async function voltouDoAlmoco(sessionId: number) {
    setReturningId(sessionId);
    const { error } = await supabase.rpc("return_from_lunch", { p_session_id: sessionId });
    setReturningId(null);
    if (error) showToast("Erro ao marcar volta: " + error.message);
  }

  async function resetarDia() {
    setResetting(true);
    const { error } = await supabase.rpc("reset_lunch_day");
    setResetting(false);
    setResetOpen(false);
    if (error) showToast("Erro ao resetar o dia: " + error.message);
  }

  async function adicionarPessoa() {
    const name = newName.trim();
    if (!name) {
      showToast("Digite o nome da pessoa.");
      return;
    }
    setAddingStaff(true);
    const { error } = await supabase.from("staff").insert({ name, team: newTeam });
    setAddingStaff(false);
    if (error) {
      showToast("Erro ao adicionar: " + error.message);
      return;
    }
    setNewName("");
    showToast("Adicionado à equipe.");
  }

  async function removerPessoa() {
    if (!removingStaff) return;
    setRemovingStaffBusy(true);
    const { error } = await supabase.from("staff").delete().eq("id", removingStaff.id);
    setRemovingStaffBusy(false);
    setRemovingStaff(null);
    if (error) showToast("Erro ao remover: " + error.message);
  }

  return (
    <>
      <PageHeader
        icon={UtensilsCrossed}
        tone="clay"
        title="Almoço"
        subtitle="Fila da copa — no máximo 2 pessoas almoçando por vez."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile value={pending.length} label="Aguardando" icon={Users} tone="sage" live />
        <StatTile value={queued.length} label="Na fila" icon={Clock} tone="clay" />
        <StatTile
          value={eatingSessions.reduce((sum, s) => sum + s.member_ids.length, 0)}
          label="Almoçando"
          icon={Timer}
          tone="moss"
        />
        <StatTile value={done.length} label="Já almoçou" icon={CheckCircle2} tone="sage" />
      </div>

      <Card className="mt-4">
        <CardTitle>Almoçando agora</CardTitle>
        {loading ? (
          <SkeletonRow />
        ) : eatingSessions.length === 0 ? (
          <EmptyState icon={Timer} title="Ninguém almoçando" subtitle="A mesa da copa está livre." />
        ) : (
          <div className="divide-y divide-line">
            {eatingSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[0.85rem] font-semibold text-ink">{s.member_names}</div>
                  <div className="text-[0.72rem] text-ink-soft">desde {formatTime(s.start_time)}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-auto shrink-0"
                  loading={returningId === s.id}
                  onClick={() => voltouDoAlmoco(s.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Voltou
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {queued.length > 0 && (
        <Card className="mt-4">
          <CardTitle>Na fila</CardTitle>
          <div className="divide-y divide-line">
            {queued.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-[0.85rem] text-ink">
                  <span className="mr-2 text-[0.72rem] font-bold text-ink-soft">#{i + 1}</span>
                  {s.name}
                </span>
                <Badge tone="neutral">{s.team}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle>Mandar pro almoço</CardTitle>
        <p className="mb-2 mt-1 text-[0.78rem] text-ink-soft">
          Escolha 1 ou 2 pessoas por vez — só do seu time ({allowedTeams.join(" ou ")}).
        </p>
        {loading ? (
          <SkeletonRow />
        ) : sendablePending.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Ninguém do seu time aguardando"
            subtitle={
              outOfScopePendingCount > 0
                ? `Tem ${outOfScopePendingCount} pessoa${outOfScopePendingCount === 1 ? "" : "s"} aguardando de outro time — quem manda é o admin de lá.`
                : "Todo mundo já foi pro almoço ou já almoçou."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sendablePending.map((s) => {
                const isSelected = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSelected(s.id)}
                    disabled={!isSelected && selected.length >= 2}
                    className={
                      "flex items-center justify-between gap-2 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-40 " +
                      (isSelected ? "border-moss bg-sage-tint" : "border-line bg-surface")
                    }
                  >
                    <div>
                      <div className="text-[0.85rem] font-semibold text-ink">{s.name}</div>
                      <div className="text-[0.72rem] text-ink-soft">{s.team}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-moss-deep" />}
                  </button>
                );
              })}
            </div>
            {outOfScopePendingCount > 0 && (
              <p className="mt-2 text-[0.72rem] text-ink-soft">
                +{outOfScopePendingCount} de outro time aguardando (não aparece aqui — quem manda é o admin de lá).
              </p>
            )}
          </>
        )}
        <Button className="mt-3" disabled={selected.length === 0} loading={sending} onClick={mandarPraAlmoco}>
          <UtensilsCrossed className="h-4 w-4" />
          Mandar pro almoço {selected.length > 0 && `(${selected.length})`}
        </Button>
      </Card>

      {done.length > 0 && (
        <Card className="mt-4">
          <CardTitle>Já almoçou hoje</CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {done.map((s) => (
              <Badge key={s.id} tone="ok">
                {s.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle>Equipe</CardTitle>
        <p className="mb-2 mt-1 text-[0.78rem] text-ink-soft">Cadastre quem vai estar no estande — inclusive o Caixa.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <FieldLabel className="mt-0">Nome</FieldLabel>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="sm:w-40">
            <FieldLabel className="mt-0">Time</FieldLabel>
            <Select value={newTeam} onChange={(e) => setNewTeam(e.target.value as (typeof TEAM_OPTIONS)[number])}>
              {TEAM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button variant="outline" className="mt-2 w-auto" loading={addingStaff} onClick={adicionarPessoa}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>

        {allStaffSorted.length > 0 && (
          <div className="mt-3 divide-y divide-line border-t border-line">
            {allStaffSorted.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[0.84rem] text-ink">{s.name}</span>
                  <Badge tone="neutral">{s.team}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovingStaff(s)}
                  aria-label={`Remover ${s.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-brick-tint hover:text-brick"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <Button variant="outline" className="w-auto" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-3.5 w-3.5" />
          Resetar o dia
        </Button>
        <p className="mt-1.5 text-[0.72rem] text-ink-soft">
          Reseta tudo pra "aguardando" e limpa a fila/mesa — usa só se precisar forçar antes do reset automático da meia-noite.
        </p>
      </Card>

      <BottomSheet open={resetOpen} onOpenChange={setResetOpen} title="Resetar o dia do almoço?">
        <p className="mb-3 text-[0.8rem] text-ink-soft">
          Isso limpa a fila, tira todo mundo da mesa e volta todo mundo pra "aguardando". Não afeta o histórico de vendas nem check-ins — só o controle de almoço.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" loading={resetting} onClick={resetarDia}>
            Resetar
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={removingStaff !== null} onOpenChange={(v) => !v && setRemovingStaff(null)} title="Remover da equipe?">
        {removingStaff && (
          <>
            <p className="mb-3 text-[0.8rem] text-ink-soft">
              <b className="text-ink">{removingStaff.name}</b> vai sair do controle de almoço. Isso não afeta nada do
              histórico de vendas ou check-ins.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemovingStaff(null)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" loading={removingStaffBusy} onClick={removerPessoa}>
                Remover
              </Button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}

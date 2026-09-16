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
import type { LunchAttendance, Staff } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useLiveData } from "../live-data/useLiveData";

const TEAM_OPTIONS = ["Comercial", "Técnica", "Caixa"] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AlmocoPage() {
  const { staff, lunchQueue, lunchAttendance, loading } = useLiveData();
  const [endingId, setEndingId] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState<(typeof TEAM_OPTIONS)[number]>("Comercial");
  const [addingStaff, setAddingStaff] = useState(false);
  const [removingStaff, setRemovingStaff] = useState<Staff | null>(null);
  const [removingStaffBusy, setRemovingStaffBusy] = useState(false);

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s] as const)), [staff]);

  const pending = useMemo(() => staff.filter((s) => s.status === "pending"), [staff]);
  const done = useMemo(() => staff.filter((s) => s.status === "done"), [staff]);
  const eating = useMemo(
    () =>
      lunchAttendance
        .filter((a) => !a.ended_at)
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()),
    [lunchAttendance]
  );
  const queued = useMemo(() => {
    return [...lunchQueue]
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
      .map((q) => byId.get(q.staff_id))
      .filter((s): s is Staff => !!s);
  }, [lunchQueue, byId]);
  const allStaffSorted = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff]);

  async function marcarVoltou(a: LunchAttendance) {
    setEndingId(a.staff_id);
    const { error } = await supabase.rpc("admin_end_lunch", { p_staff_id: a.staff_id });
    setEndingId(null);
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
        subtitle="Autoatendimento — cada pessoa marca sozinha quando vai e quando volta. Aqui você só acompanha."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile value={pending.length} label="Aguardando" icon={Users} tone="sage" live />
        <StatTile value={queued.length} label="Na fila" icon={Clock} tone="clay" />
        <StatTile value={eating.length} label="Almoçando" icon={Timer} tone="moss" />
        <StatTile value={done.length} label="Já almoçou" icon={CheckCircle2} tone="sage" />
      </div>

      <Card className="mt-4">
        <CardTitle>Almoçando agora</CardTitle>
        {loading ? (
          <SkeletonRow />
        ) : eating.length === 0 ? (
          <EmptyState icon={Timer} title="Ninguém almoçando" subtitle="A mesa da copa está livre." />
        ) : (
          <div className="divide-y divide-line">
            {eating.map((a) => {
              const s = byId.get(a.staff_id);
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[0.85rem] font-semibold text-ink">{s?.name ?? "—"}</span>
                      {s && <Badge tone="neutral">{s.team}</Badge>}
                    </div>
                    <div className="text-[0.72rem] text-ink-soft">desde {formatTime(a.started_at)}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-auto shrink-0"
                    loading={endingId === a.staff_id}
                    onClick={() => marcarVoltou(a)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Marcar volta
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[0.72rem] text-ink-soft">
          "Marcar volta" é só uma rede de segurança — use apenas se a pessoa esqueceu de apertar "terminei" sozinha.
        </p>
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
        <p className="mb-2 mt-1 text-[0.78rem] text-ink-soft">
          Cadastre quem vai estar no estande — inclusive o Caixa. O <b>#número</b> ao lado do nome é o que você usa
          pra vincular o login individual dessa pessoa (metadata <code>staff_id</code> ao criar a conta dela).
        </p>
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
                  <span className="text-[0.72rem] font-bold text-ink-soft">#{s.id}</span>
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

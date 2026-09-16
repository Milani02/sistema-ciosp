import { useMemo, useState, type ComponentType } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  PageHeader,
  Select,
  SkeletonStat,
  SkeletonRow,
  cn,
  showToast,
} from "@biodinamica/ui";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  Mail,
  Phone,
  RotateCcw,
  UserCheck,
  UserRound,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import type { Activity, Checkin, CheckinAudit, CheckinStatus, Session } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { sessionLabel } from "../../lib/derived";
import { useLiveData } from "../live-data/useLiveData";

const STATUS_BADGE: Record<CheckinStatus, { tone: "ok" | "wait" | "crit" | "neutral"; label: string }> = {
  confirmed: { tone: "wait", label: "aguardando chegada" },
  checked_in: { tone: "ok", label: "check-in feito" },
  waitlisted: { tone: "neutral", label: "fila de espera" },
  no_show: { tone: "crit", label: "não compareceu" },
  cancelled: { tone: "neutral", label: "cancelado" },
};

const STATUS_OPTIONS: { value: CheckinStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "confirmed", label: "Aguardando chegada" },
  { value: "checked_in", label: "Check-in feito" },
  { value: "waitlisted", label: "Fila de espera" },
  { value: "no_show", label: "Não compareceu" },
  { value: "cancelled", label: "Cancelado" },
];

function FilterStat({
  value,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  value: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left shadow-[var(--shadow-card)] transition-colors",
        active ? "border-moss bg-sage-tint" : "border-line bg-surface hover:border-sage"
      )}
    >
      <Icon className={cn("mb-2.5 h-6 w-6", active ? "text-moss-deep" : "text-ink-soft")} />
      <div className="text-[1.7rem] font-black leading-none tracking-tight tabular-nums text-moss-deep">{value}</div>
      <div className="mt-1 text-xs text-ink-soft">{label}</div>
    </button>
  );
}

function escapeCsv(value: string) {
  return /[",\n;]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function exportCsv(rows: Checkin[], sessions: Session[]) {
  const headers = [
    "Nome",
    "CRO",
    "Especialidade",
    "Telefone",
    "E-mail",
    "Atividade",
    "Sessão",
    "Status",
    "Inscrito em",
    "Check-in em",
  ];
  const lines = rows.map((c) => [
    c.visitor_name,
    c.cro ?? "",
    c.especialidade ?? "",
    c.telefone ?? "",
    c.email ?? "",
    c.activity === "handson" ? "Hands-on" : "Palestra",
    sessionLabel(sessions, c.session_id),
    STATUS_BADGE[c.status].label,
    new Date(c.created_at).toLocaleString("pt-BR"),
    c.checked_in_at ? new Date(c.checked_in_at).toLocaleString("pt-BR") : "",
  ]);
  const csv = [headers, ...lines].map((row) => row.map((v) => escapeCsv(String(v))).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscritos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InscritosPage() {
  const { checkins, sessions, loading } = useLiveData();

  const [activityFilter, setActivityFilter] = useState<Activity | "all">("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<CheckinStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<number, CheckinAudit[]>>({});

  const sessionsForActivity = useMemo(
    () =>
      [...sessions]
        .filter((s) => activityFilter === "all" || s.activity === activityFilter)
        .sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime()),
    [sessions, activityFilter]
  );

  const baseFiltered = useMemo(
    () =>
      checkins
        .filter((c) => activityFilter === "all" || c.activity === activityFilter)
        .filter((c) => sessionFilter === "all" || c.session_id === Number(sessionFilter)),
    [checkins, activityFilter, sessionFilter]
  );

  const statCheckedIn = baseFiltered.filter((c) => c.status === "checked_in").length;
  const statAguardando = baseFiltered.filter((c) => c.status === "confirmed").length;
  const statFila = baseFiltered.filter((c) => c.status === "waitlisted").length;

  function toggleStatusFilter(status: CheckinStatus) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseFiltered
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.visitor_name.toLowerCase().includes(q) ||
          (c.cro ?? "").toLowerCase().includes(q) ||
          (c.especialidade ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.telefone ?? "").includes(q)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [baseFiltered, statusFilter, search]);

  async function setStatus(c: Checkin, status: CheckinStatus) {
    setBusyId(c.id);
    const { error } = await supabase.rpc("staff_set_checkin_status", { p_checkin_id: c.id, p_status: status });
    setBusyId(null);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    showToast(`${c.visitor_name}: ${STATUS_BADGE[status].label}.`);
    setHistoryCache((prev) => {
      if (!(c.id in prev)) return prev;
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
  }

  async function toggleHistory(checkinId: number) {
    if (historyOpenId === checkinId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(checkinId);
    if (historyCache[checkinId]) return;
    setHistoryLoadingId(checkinId);
    const { data } = await supabase
      .from("checkin_audit")
      .select("*")
      .eq("checkin_id", checkinId)
      .order("created_at", { ascending: true });
    setHistoryCache((prev) => ({ ...prev, [checkinId]: data ?? [] }));
    setHistoryLoadingId(null);
  }

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        tone="moss"
        title="Inscritos"
        subtitle="Todo mundo que já se inscreveu em Hands-on ou Palestra, com controle direto de status — busca, filtra e ajusta na mão quando precisar."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {loading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <FilterStat
              value={statCheckedIn}
              label="Check-ins feitos hoje"
              icon={CheckCircle2}
              active={statusFilter === "checked_in"}
              onClick={() => toggleStatusFilter("checked_in")}
            />
            <FilterStat
              value={statAguardando}
              label="Aguardando chegada"
              icon={Clock}
              active={statusFilter === "confirmed"}
              onClick={() => toggleStatusFilter("confirmed")}
            />
            <FilterStat
              value={statFila}
              label="Na fila de espera"
              icon={Users}
              active={statusFilter === "waitlisted"}
              onClick={() => toggleStatusFilter("waitlisted")}
            />
          </>
        )}
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel className="mt-0">Atividade</FieldLabel>
            <Select
              value={activityFilter}
              onChange={(e) => {
                setActivityFilter(e.target.value as Activity | "all");
                setSessionFilter("all");
              }}
            >
              <option value="all">Todas</option>
              <option value="handson">Hands-on</option>
              <option value="palestra">Palestra</option>
            </Select>
          </div>
          <div>
            <FieldLabel className="mt-0">Sessão</FieldLabel>
            <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
              <option value="all">Todas as sessões</option>
              {sessionsForActivity.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(sessions, s.id)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel className="mt-0">Status</FieldLabel>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CheckinStatus | "all")}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FieldLabel>Buscar</FieldLabel>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CRO, e-mail ou telefone" />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[0.78rem] font-semibold text-ink-soft">
            {loading ? "Carregando..." : `${filtered.length} inscrito${filtered.length === 1 ? "" : "s"}`}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-auto"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(filtered, sessions)}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
        <div className="divide-y divide-line">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Ninguém encontrado" subtitle="Ajuste os filtros ou a busca acima." />
          ) : (
            filtered.map((c) => {
              const status = STATUS_BADGE[c.status];
              const busy = busyId === c.id;
              return (
                <div key={c.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-tint text-moss-deep">
                      <UserRound className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.88rem] font-semibold text-ink">{c.visitor_name}</div>
                      <div className="truncate text-[0.78rem] text-ink-soft">
                        {[c.cro, c.especialidade].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className="truncate text-[0.76rem] text-ink-soft">
                        {c.activity === "handson" ? "Hands-on" : "Palestra"} · {sessionLabel(sessions, c.session_id)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.74rem] text-ink-soft">
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
                    <Badge tone={status.tone} className="shrink-0">
                      {status.label}
                    </Badge>
                  </div>

                  <div className="ml-[calc(2.25rem+0.75rem)] flex flex-wrap gap-2">
                    {(c.status === "confirmed" || c.status === "waitlisted") && (
                      <Button size="sm" className="w-auto" loading={busy} onClick={() => setStatus(c, "checked_in")}>
                        <UserCheck className="h-3.5 w-3.5" />
                        Check-in manual
                      </Button>
                    )}
                    {c.status === "confirmed" && (
                      <Button variant="outline" size="sm" className="w-auto" loading={busy} onClick={() => setStatus(c, "no_show")}>
                        <UserX className="h-3.5 w-3.5" />
                        Não compareceu
                      </Button>
                    )}
                    {c.status === "waitlisted" && (
                      <Button variant="outline" size="sm" className="w-auto" loading={busy} onClick={() => setStatus(c, "confirmed")}>
                        <UserCheck className="h-3.5 w-3.5" />
                        Confirmar vaga
                      </Button>
                    )}
                    {(c.status === "confirmed" || c.status === "waitlisted") && (
                      <Button variant="danger" size="sm" className="w-auto" loading={busy} onClick={() => setStatus(c, "cancelled")}>
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    )}
                    {(c.status === "no_show" || c.status === "cancelled" || c.status === "checked_in") && (
                      <Button variant="outline" size="sm" className="w-auto" loading={busy} onClick={() => setStatus(c, "confirmed")}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Voltar pra aguardando
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleHistory(c.id)}
                      className="ml-auto flex items-center gap-1 text-[0.76rem] font-semibold text-ink-soft hover:text-ink"
                    >
                      Histórico
                      <ChevronDown
                        className={"h-3.5 w-3.5 transition-transform " + (historyOpenId === c.id ? "rotate-180" : "")}
                      />
                    </button>
                  </div>

                  {historyOpenId === c.id && (
                    <div className="ml-[calc(2.25rem+0.75rem)] rounded-xl border border-line bg-linen/60 px-3 py-2">
                      {historyLoadingId === c.id ? (
                        <SkeletonRow />
                      ) : (historyCache[c.id]?.length ?? 0) === 0 ? (
                        <div className="text-[0.76rem] text-ink-soft">Nenhuma mudança manual registrada ainda.</div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {historyCache[c.id]!.map((h) => (
                            <div key={h.id} className="text-[0.76rem] text-ink-soft">
                              <span className="font-semibold text-ink">{h.actor_name}</span>
                              {" · "}
                              {h.from_status ? STATUS_BADGE[h.from_status].label : "novo"} →{" "}
                              {STATUS_BADGE[h.to_status].label}
                              {" · "}
                              {new Date(h.created_at).toLocaleString("pt-BR")}
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
    </>
  );
}

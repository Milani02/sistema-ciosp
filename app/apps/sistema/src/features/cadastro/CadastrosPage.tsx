import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  showToast,
  SkeletonRow,
  StatTile,
} from "@biodinamica/ui";
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Clock, Search, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatCpfCnpj } from "../../lib/docs";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";

type StatusFilter = "all" | "pendente" | "lancado";

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatBirthDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-ink-soft/70">{label}</div>
      <div className="break-words text-[0.82rem] text-ink">{value}</div>
    </div>
  );
}

export function CadastrosPage() {
  const { profile } = useAuth();
  const { customers, loading, patchCustomer } = useLiveData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => statusFilter === "all" || (statusFilter === "lancado" ? c.lancado : !c.lancado))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.doc_number.includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [customers, search, statusFilter]);

  const pendentes = customers.filter((c) => !c.lancado).length;
  const lancados = customers.filter((c) => c.lancado).length;

  async function marcarLancado(id: number) {
    setSavingId(id);
    patchCustomer(id, {
      lancado: true,
      lancado_at: new Date().toISOString(),
      lancado_by: profile?.id ?? null,
      lancado_by_name: profile?.name ?? null,
    });
    const { error } = await supabase
      .from("customers")
      .update({
        lancado: true,
        lancado_at: new Date().toISOString(),
        lancado_by: profile?.id ?? null,
        lancado_by_name: profile?.name ?? null,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      patchCustomer(id, { lancado: false, lancado_at: null, lancado_by: null, lancado_by_name: null });
      showToast("Erro ao marcar como lançado: " + error.message);
    }
  }

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        tone="clay"
        title="Cadastros"
        subtitle="Clientes cadastrados pelo Comercial na hora da venda, em tempo real."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={customers.length} label="Total de cadastros" icon={Users} tone="sage" live />
        <StatTile value={pendentes} label="Aguardando lançamento" icon={Clock} tone="clay" />
        <StatTile value={lancados} label="Já lançados" icon={CheckCircle2} tone="moss" />
      </div>

      <Card className="mt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="mt-3">
          <option value="all">Todos os status</option>
          <option value="pendente">Aguardando lançamento</option>
          <option value="lancado">Já lançados</option>
        </Select>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 text-[0.78rem] font-semibold text-ink-soft">
          {loading ? "Carregando..." : `${filtered.length} cliente${filtered.length === 1 ? "" : "s"}`}
        </div>
        <div className="divide-y divide-line">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum cliente encontrado" subtitle="Ajuste os filtros ou a busca acima." />
          ) : (
            filtered.map((c) => {
              const expanded = expandedId === c.id;
              return (
                <div key={c.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                        )}
                        <span className="min-w-0 truncate text-[0.88rem] font-semibold text-ink">{c.name}</span>
                        <span className="shrink-0 text-[0.72rem] font-semibold text-ink-soft">{formatTime(c.created_at)}</span>
                      </div>
                      <div className="mt-0.5 break-words pl-5 text-[0.78rem] text-ink-soft">
                        {c.doc_type.toUpperCase()} {formatCpfCnpj(c.doc_number)}
                        {c.phone && ` · ${c.phone}`}
                        {c.email && ` · ${c.email}`}
                      </div>
                      {c.lancado && c.lancado_by_name && (
                        <div className="mt-1 pl-5 text-[0.72rem] font-semibold text-moss-deep">
                          Lançado por {c.lancado_by_name}
                          {c.lancado_at && ` às ${formatTime(c.lancado_at)}`}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">{c.lancado && <Badge tone="ok">lançado</Badge>}</div>
                  </button>

                  {expanded && (
                    <div className="ml-5 mt-3 rounded-xl border border-line bg-linen/60 p-3">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
                        <DetailField label={c.doc_type === "cnpj" ? "Razão social / Nome" : "Nome"} value={c.name} />
                        <DetailField label={c.doc_type.toUpperCase()} value={formatCpfCnpj(c.doc_number)} />
                        {c.doc_type === "cnpj" && c.cnpj_razao_social && (
                          <DetailField label="Razão social" value={c.cnpj_razao_social} />
                        )}
                        {c.doc_type === "cnpj" && c.cnpj_nome_fantasia && (
                          <DetailField label="Nome fantasia" value={c.cnpj_nome_fantasia} />
                        )}
                        <DetailField label="Telefone" value={c.phone || "—"} />
                        <DetailField label="E-mail" value={c.email || "—"} />
                        {c.birth_date && <DetailField label="Data de nascimento" value={formatBirthDate(c.birth_date)} />}
                        <DetailField label="Endereço" value={c.address || "—"} />
                        <DetailField label="CEP" value={c.zip_code || "—"} />
                        <DetailField label="Cidade" value={c.city || "—"} />
                        <DetailField label="Estado" value={c.state || "—"} />
                        <DetailField label="Cadastrado em" value={formatFull(c.created_at)} />
                        {c.lancado && (
                          <DetailField
                            label="Lançado"
                            value={`${c.lancado_by_name ?? "—"}${c.lancado_at ? ` · ${formatFull(c.lancado_at)}` : ""}`}
                          />
                        )}
                      </div>

                      {!c.lancado && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-auto"
                          loading={savingId === c.id}
                          onClick={() => marcarLancado(c.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar lançado
                        </Button>
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

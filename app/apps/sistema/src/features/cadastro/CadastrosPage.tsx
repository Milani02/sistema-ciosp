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
import type { Customer, Order } from "@biodinamica/supabase";

type StatusFilter = "all" | "pendente" | "lancado";

type Row = { order: Order; customer: Customer | null };

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

function formatDoc(docType: string, docNumber: string) {
  return docType === "exterior" ? docNumber : formatCpfCnpj(docNumber);
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
  const { customers, orders, loading, patchOrder } = useLiveData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const rows: Row[] = useMemo(
    () => orders.map((order) => ({ order, customer: customers.find((c) => c.id === order.customer_id) ?? null })),
    [orders, customers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(({ order }) => statusFilter === "all" || (statusFilter === "lancado" ? order.lancado : !order.lancado))
      .filter(({ customer }) => {
        if (!q) return true;
        if (!customer) return false;
        return (
          customer.name.toLowerCase().includes(q) ||
          customer.doc_number.includes(q) ||
          (customer.phone ?? "").includes(q) ||
          (customer.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());
  }, [rows, search, statusFilter]);

  const pendentes = rows.filter((r) => !r.order.lancado).length;
  const lancados = rows.filter((r) => r.order.lancado).length;

  async function marcarLancado(id: number) {
    setSavingId(id);
    patchOrder(id, {
      lancado: true,
      lancado_at: new Date().toISOString(),
      lancado_by: profile?.id ?? null,
      lancado_by_name: profile?.name ?? null,
    });
    const { error } = await supabase
      .from("orders")
      .update({
        lancado: true,
        lancado_at: new Date().toISOString(),
        lancado_by: profile?.id ?? null,
        lancado_by_name: profile?.name ?? null,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      patchOrder(id, { lancado: false, lancado_at: null, lancado_by: null, lancado_by_name: null });
      showToast("Erro ao marcar como lançado: " + error.message);
    }
  }

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        tone="clay"
        title="Cadastros"
        subtitle="Vendas do Comercial, em tempo real — inclusive de quem já tinha cadastro."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={rows.length} label="Total de vendas" icon={Users} tone="sage" live />
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
          {loading ? "Carregando..." : `${filtered.length} venda${filtered.length === 1 ? "" : "s"}`}
        </div>
        <div className="divide-y divide-line">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Nenhuma venda encontrada" subtitle="Ajuste os filtros ou a busca acima." />
          ) : (
            filtered.map(({ order, customer }) => {
              const expanded = expandedId === order.id;
              return (
                <div key={order.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                        )}
                        <span className="min-w-0 truncate text-[0.88rem] font-semibold text-ink">
                          {customer?.name ?? "Cliente removido"}
                        </span>
                        <span className="shrink-0 text-[0.72rem] font-semibold text-ink-soft">
                          {formatTime(order.created_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 break-words pl-5 text-[0.78rem] text-ink-soft">
                        {customer && (
                          <>
                            {customer.doc_type.toUpperCase()} {formatDoc(customer.doc_type, customer.doc_number)}
                            {customer.phone && ` · ${customer.phone}`}
                            {customer.email && ` · ${customer.email}`}
                          </>
                        )}
                      </div>
                      {order.lancado && order.lancado_by_name && (
                        <div className="mt-1 pl-5 text-[0.72rem] font-semibold text-moss-deep">
                          Lançado por {order.lancado_by_name}
                          {order.lancado_at && ` às ${formatTime(order.lancado_at)}`}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!order.is_novo_cliente && <Badge tone="neutral">já cadastrado</Badge>}
                      {order.lancado && <Badge tone="ok">lançado</Badge>}
                    </div>
                  </button>

                  {expanded && (
                    <div className="ml-5 mt-3 rounded-xl border border-line bg-linen/60 p-3">
                      {customer ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
                          <DetailField label={customer.doc_type !== "cpf" ? "Razão social / Nome" : "Nome"} value={customer.name} />
                          <DetailField label={customer.doc_type.toUpperCase()} value={formatDoc(customer.doc_type, customer.doc_number)} />
                          {customer.doc_type === "cnpj" && customer.cnpj_razao_social && (
                            <DetailField label="Razão social" value={customer.cnpj_razao_social} />
                          )}
                          {customer.doc_type === "cnpj" && customer.cnpj_nome_fantasia && (
                            <DetailField label="Nome fantasia" value={customer.cnpj_nome_fantasia} />
                          )}
                          <DetailField label="Telefone" value={customer.phone || "—"} />
                          <DetailField label="E-mail" value={customer.email || "—"} />
                          {customer.birth_date && <DetailField label="Data de nascimento" value={formatBirthDate(customer.birth_date)} />}
                          <DetailField label="Endereço" value={customer.address || "—"} />
                          <DetailField label="CEP" value={customer.zip_code || "—"} />
                          <DetailField label="Cidade" value={customer.city || "—"} />
                          <DetailField label="Estado" value={customer.state || "—"} />
                          <DetailField
                            label="Cadastro do cliente"
                            value={order.is_novo_cliente ? "Novo, feito nesta venda" : "Já existia antes desta venda"}
                          />
                          <DetailField label="Venda em" value={formatFull(order.created_at)} />
                          {order.lancado && (
                            <DetailField
                              label="Lançado"
                              value={`${order.lancado_by_name ?? "—"}${order.lancado_at ? ` · ${formatFull(order.lancado_at)}` : ""}`}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-[0.82rem] text-ink-soft">Cliente não encontrado.</div>
                      )}

                      {!order.lancado && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-auto"
                          loading={savingId === order.id}
                          onClick={() => marcarLancado(order.id)}
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

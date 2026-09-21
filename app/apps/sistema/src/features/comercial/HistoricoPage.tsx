import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  ListEmpty,
  ListRow,
  PageHeader,
  Select,
  SkeletonRow,
  StatTile,
} from "@biodinamica/ui";
import { ChevronLeft, ChevronRight, Download, History, Package2, Printer, Receipt, TrendingUp } from "lucide-react";
import type { Order, OrderPayment, OrderStatus, PaymentMethod, SinglePaymentMethod } from "@biodinamica/supabase";
import { useLiveData } from "../live-data/useLiveData";
import { printReceipt } from "./receipt";

const PAGE_SIZE = 10;

const PAYMENT_LABEL: Record<SinglePaymentMethod, string> = { dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix" };

const STATUS_BADGE: Record<OrderStatus, { tone: "ok" | "wait" | "crit" | "neutral"; label: string }> = {
  aguardando_pagamento: { tone: "wait", label: "aguardando pagamento" },
  pago: { tone: "wait", label: "pago · a separar" },
  entregue: { tone: "ok", label: "entregue" },
  cancelado: { tone: "neutral", label: "cancelado" },
};

const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "aguardando_pagamento", label: "Aguardando pagamento" },
  { value: "pago", label: "Pago · a separar" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const PAYMENT_OPTIONS: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "Todas as formas" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "pix", label: "Pix" },
  { value: "misto", label: "Dividido (misto)" },
];

function escapeCsv(value: string) {
  return /[",\n;]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function formatOrderTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

export function HistoricoPage({ itemsVariant = "compact" }: { itemsVariant?: "compact" | "detailed" }) {
  const { orders, orderItems, orderPayments, customers, products, loading } = useLiveData();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const paymentsByOrder = useMemo(() => {
    const map = new Map<number, OrderPayment[]>();
    for (const p of orderPayments) {
      const list = map.get(p.order_id) ?? [];
      list.push(p);
      map.set(p.order_id, list);
    }
    return map;
  }, [orderPayments]);

  const rawItemsByOrder = useMemo(() => {
    const map = new Map<number, { product_name: string; quantity: number }[]>();
    for (const it of orderItems) {
      const list = map.get(it.order_id) ?? [];
      list.push(it);
      map.set(it.order_id, list);
    }
    return map;
  }, [orderItems]);

  const itemsByOrder = useMemo(() => {
    const map = new Map<number, string>();
    for (const [orderId, items] of rawItemsByOrder) {
      map.set(orderId, items.map((i) => `${i.quantity}× ${i.product_name}`).join(" · "));
    }
    return map;
  }, [rawItemsByOrder]);

  function customerFor(order: Order) {
    return customers.find((c) => c.id === order.customer_id) ?? null;
  }

  function reimprimir(o: Order) {
    const items = orderItems.filter((i) => i.order_id === o.id);
    printReceipt({
      order: o,
      customerName: customerFor(o)?.name ?? null,
      items: items.map((i) => ({
        code: products.find((p) => p.id === i.product_id)?.code ?? null,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      payments: (paymentsByOrder.get(o.id) ?? []).map((p) => ({ method: p.method, amount: p.amount })),
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => paymentFilter === "all" || o.payment_method === paymentFilter)
      .filter((o) => {
        if (!q) return true;
        const c = customerFor(o);
        return (c?.name ?? "").toLowerCase().includes(q) || (c?.doc_number ?? "").includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, statusFilter, paymentFilter, search, customers]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const concluidos = orders.filter((o) => o.status === "pago" || o.status === "entregue");
  const totalVendido = concluidos.reduce((sum, o) => sum + o.total, 0);
  const ticketMedio = concluidos.length === 0 ? 0 : totalVendido / concluidos.length;

  function handleExport() {
    const headers = [
      "Data/Hora",
      "Cliente",
      "CPF/CNPJ",
      "Vendedor",
      "Itens",
      "Total",
      "Forma de pagamento",
      "Status",
      "Pago por",
      "Entregue por",
    ];
    const lines = filtered.map((o) => {
      const c = customerFor(o);
      const paymentLabel =
        o.payment_method === "misto"
          ? (paymentsByOrder.get(o.id) ?? [])
              .map((p) => `${PAYMENT_LABEL[p.method]}:${p.amount.toFixed(2)}`)
              .join(" + ")
          : o.payment_method;
      return [
        new Date(o.created_at).toLocaleString("pt-BR"),
        c?.name ?? "—",
        c?.doc_number ?? "—",
        o.seller_name ?? "—",
        itemsByOrder.get(o.id) ?? "—",
        o.total.toFixed(2),
        paymentLabel,
        o.status,
        o.paid_by_name ?? "",
        o.delivered_by_name ?? "",
      ];
    });
    const csv = [headers, ...lines].map((row) => row.map((v) => escapeCsv(String(v))).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        icon={History}
        tone="moss"
        title="Histórico de vendas"
        subtitle="Todo pedido já criado, com filtro por status e forma de pagamento."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={concluidos.length} label="Pedidos pagos/entregues" icon={Receipt} tone="moss" live />
        <StatTile
          value={totalVendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          label="Total vendido"
          icon={TrendingUp}
          tone="sage"
        />
        <StatTile
          value={ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          label="Ticket médio"
          icon={Package2}
          tone="clay"
        />
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel className="mt-0">Status</FieldLabel>
            <Select
              value={statusFilter}
              onChange={(e) => updateFilter(setStatusFilter)(e.target.value as OrderStatus | "all")}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel className="mt-0">Forma de pagamento</FieldLabel>
            <Select
              value={paymentFilter}
              onChange={(e) => updateFilter(setPaymentFilter)(e.target.value as PaymentMethod | "all")}
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FieldLabel>Buscar cliente</FieldLabel>
        <Input value={search} onChange={(e) => updateFilter(setSearch)(e.target.value)} placeholder="Nome ou CPF/CNPJ" />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[0.78rem] font-semibold text-ink-soft">
            {loading ? "Carregando..." : `${filtered.length} pedido${filtered.length === 1 ? "" : "s"}`}
          </div>
          <Button variant="outline" size="sm" className="w-auto" disabled={filtered.length === 0} onClick={handleExport}>
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
            <EmptyState icon={History} title="Nenhum pedido encontrado" subtitle="Ajuste os filtros ou a busca acima." />
          ) : (
            paged.map((o) => {
              const status = STATUS_BADGE[o.status];
              const c = customerFor(o);
              const paymentBreakdown =
                o.payment_method === "misto"
                  ? (paymentsByOrder.get(o.id) ?? [])
                      .map((p) => `${PAYMENT_LABEL[p.method]} ${p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
                      .join(" + ")
                  : null;
              if (itemsVariant === "detailed") {
                const items = rawItemsByOrder.get(o.id) ?? [];
                return (
                  <div key={o.id} className="items-start py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="min-w-0 truncate text-[0.88rem] font-semibold text-ink">
                            {c?.name ?? "Cliente"}
                          </span>
                          <span className="shrink-0 text-[0.72rem] font-semibold text-ink-soft">
                            {formatOrderTime(o.created_at)}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md bg-sage-tint px-2 py-1 text-[0.78rem] font-semibold text-moss-deep"
                              >
                                <span className="text-[0.88rem] font-black">{it.quantity}×</span>
                                {it.product_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {paymentBreakdown && (
                          <div className="mt-1 text-[0.72rem] font-semibold text-clay">{paymentBreakdown}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="text-[0.8rem] font-bold tabular-nums text-ink">
                          {o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        {(o.status === "pago" || o.status === "entregue") && (
                          <button
                            type="button"
                            onClick={() => reimprimir(o)}
                            className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[0.7rem] font-semibold text-ink-soft hover:bg-sage-tint hover:text-moss-deep"
                          >
                            <Printer className="h-3 w-3" />
                            Reimprimir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <ListRow
                  key={o.id}
                  title={c?.name ?? "Cliente"}
                  subtitle={
                    paymentBreakdown
                      ? `${formatOrderTime(o.created_at)} · ${paymentBreakdown}`
                      : `${formatOrderTime(o.created_at)} · ${itemsByOrder.get(o.id) ?? "—"}`
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-[0.8rem] font-bold tabular-nums text-ink">
                        {o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  }
                  className="items-start"
                />
              );
            })
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <ListEmpty>
              {paged.length < filtered.length
                ? `${(currentPage - 1) * PAGE_SIZE + 1}–${(currentPage - 1) * PAGE_SIZE + paged.length} de ${filtered.length} pedidos`
                : `${filtered.length} de ${orders.length} pedidos no total.`}
            </ListEmpty>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-full text-[0.78rem] font-bold " +
                      (n === currentPage ? "bg-moss text-moss-on" : "text-ink-soft hover:bg-linen")
                    }
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  aria-label="Próxima página"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

import { useMemo, useState } from "react";
import { BottomSheet, Badge, Button, Card, CardTitle, EmptyState, FieldLabel, Input, PageHeader, Textarea, showToast } from "@biodinamica/ui";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  LogOut,
  Mail,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  QrCode,
  Wallet,
} from "lucide-react";
import type { CashMovement, CashMovementType, CashSession, Customer, Order, OrderPayment, SinglePaymentMethod } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { formatCpfCnpj } from "../../lib/docs";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";
import { printReceipt } from "./receipt";

function CustomerInfo({ customer }: { customer: Customer | null }) {
  if (!customer) return <div className="truncate text-[0.86rem] font-semibold text-ink">Cliente</div>;
  return (
    <>
      <div className="truncate text-[0.86rem] font-semibold text-ink">{customer.name}</div>
      <div className="text-[0.76rem] text-ink-soft">
        {customer.doc_type === "cpf" ? "CPF" : "CNPJ"} {formatCpfCnpj(customer.doc_number)}
      </div>
      {(customer.phone || customer.email) && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.74rem] text-ink-soft">
          {customer.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {customer.phone}
            </span>
          )}
          {customer.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> {customer.email}
            </span>
          )}
        </div>
      )}
    </>
  );
}

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

function ItemChips({ items }: { items: { product_name: string; quantity: number }[] }) {
  if (items.length === 0) return null;
  return (
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
  );
}

const PAYMENT_LABEL: Record<SinglePaymentMethod, string> = { dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix" };

const PAYMENT_ICON: Record<SinglePaymentMethod, typeof Banknote> = {
  dinheiro: Banknote,
  cartao: CreditCard,
  pix: QrCode,
};

function PaymentBadge({ method }: { method: SinglePaymentMethod }) {
  const Icon = PAYMENT_ICON[method];
  return (
    <Badge tone="neutral">
      <Icon className="h-3 w-3" />
      {PAYMENT_LABEL[method]}
    </Badge>
  );
}

/** Pagamento único vira um badge só; pagamento dividido ('misto') vira um
 *  badge por forma usada, cada um com o valor exato daquela parte. */
function PaymentInfo({ order, payments }: { order: Order; payments: OrderPayment[] }) {
  if (order.payment_method === "misto") {
    return (
      <div className="flex flex-wrap gap-1">
        {payments.map((p) => {
          const Icon = PAYMENT_ICON[p.method];
          return (
            <Badge key={p.id} tone="neutral">
              <Icon className="h-3 w-3" />
              {PAYMENT_LABEL[p.method]} {p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </Badge>
          );
        })}
      </div>
    );
  }
  return <PaymentBadge method={order.payment_method} />;
}

function cashAmountFor(order: Order, payments: OrderPayment[]): number {
  if (order.payment_method === "dinheiro") return order.total;
  if (order.payment_method === "misto") {
    return payments.filter((p) => p.method === "dinheiro").reduce((sum, p) => sum + p.amount, 0);
  }
  return 0;
}

function exportCsv(
  orders: Order[],
  itemsByOrder: Map<number, { product_name: string; unit_price: number; quantity: number }[]>,
  paymentsByOrder: Map<number, OrderPayment[]>,
  customerLabel: (o: Order) => string,
  docLabel: (o: Order) => string
) {
  const headers = [
    "Data/Hora",
    "Cliente",
    "CPF/CNPJ",
    "Vendedor",
    "Produto",
    "Quantidade",
    "Valor unitário",
    "Valor total item",
    "Forma de pagamento",
    "Status",
    "Pago em",
    "Entregue em",
  ];
  const lines: string[][] = [];
  for (const o of orders) {
    const items = itemsByOrder.get(o.id) ?? [];
    const paymentLabel =
      o.payment_method === "misto"
        ? (paymentsByOrder.get(o.id) ?? [])
            .map((p) => `${PAYMENT_LABEL[p.method]}:${p.amount.toFixed(2)}`)
            .join(" + ")
        : o.payment_method;
    for (const it of items) {
      lines.push([
        new Date(o.created_at).toLocaleString("pt-BR"),
        customerLabel(o),
        docLabel(o),
        o.seller_name ?? "",
        it.product_name,
        String(it.quantity),
        it.unit_price.toFixed(2),
        (it.unit_price * it.quantity).toFixed(2),
        paymentLabel,
        o.status,
        o.paid_at ? new Date(o.paid_at).toLocaleString("pt-BR") : "",
        o.delivered_at ? new Date(o.delivered_at).toLocaleString("pt-BR") : "",
      ]);
    }
  }
  const csv = [headers, ...lines].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Relatório de fechamento — resumo de vendas por forma de pagamento na
 *  janela da sessão, mais a conferência de dinheiro físico (saldo
 *  inicial + vendas em dinheiro + reforços - sangrias = esperado) e o
 *  detalhamento de cada movimentação/venda em dinheiro. */
function exportCaixaReport(
  session: CashSession,
  movements: CashMovement[],
  cashOrders: Order[],
  windowOrders: Order[],
  paymentsByOrder: Map<number, OrderPayment[]>,
  customerFor: (o: Order) => Customer | null
) {
  const rows: (string | number)[][] = [];
  const push = (row: (string | number)[]) => rows.push(row);

  push(["Relatório de Caixa"]);
  push(["Aberto por", session.opened_by_name ?? "—", "em", new Date(session.opened_at).toLocaleString("pt-BR")]);
  if (session.closed_at) {
    push(["Fechado por", session.closed_by_name ?? "—", "em", new Date(session.closed_at).toLocaleString("pt-BR")]);
  }
  push([]);

  const paid = windowOrders.filter((o) => o.status === "pago" || o.status === "entregue");
  const totalsByMethod: Partial<Record<SinglePaymentMethod, number>> = {};
  for (const o of paid) {
    if (o.payment_method === "misto") {
      for (const p of paymentsByOrder.get(o.id) ?? []) {
        totalsByMethod[p.method] = (totalsByMethod[p.method] ?? 0) + p.amount;
      }
    } else {
      totalsByMethod[o.payment_method] = (totalsByMethod[o.payment_method] ?? 0) + o.total;
    }
  }
  push(["Resumo de vendas (todas as formas, desde a abertura)"]);
  push(["Forma", "Total"]);
  for (const [method, total] of Object.entries(totalsByMethod)) {
    push([PAYMENT_LABEL[method as SinglePaymentMethod] ?? method, (total ?? 0).toFixed(2)]);
  }
  const totalGeral = Object.values(totalsByMethod).reduce((s, v) => s + (v ?? 0), 0);
  push(["Total geral", totalGeral.toFixed(2)]);
  push([]);

  const totalDinheiroVendas = cashOrders.reduce((s, o) => s + cashAmountFor(o, paymentsByOrder.get(o.id) ?? []), 0);
  const totalReforcos = movements.filter((m) => m.type === "reforco").reduce((s, m) => s + m.amount, 0);
  const totalSangrias = movements.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amount, 0);
  const saldoEsperado = session.opening_balance + totalDinheiroVendas + totalReforcos - totalSangrias;

  push(["Conferência do dinheiro físico na gaveta"]);
  push(["Saldo inicial", session.opening_balance.toFixed(2)]);
  push(["+ Vendas em dinheiro", totalDinheiroVendas.toFixed(2)]);
  push(["+ Reforços", totalReforcos.toFixed(2)]);
  push(["- Sangrias", totalSangrias.toFixed(2)]);
  push(["= Saldo esperado", saldoEsperado.toFixed(2)]);
  if (session.closing_counted != null) {
    push(["Saldo contado", session.closing_counted.toFixed(2)]);
    push(["Diferença", (session.closing_counted - saldoEsperado).toFixed(2)]);
  }
  push([]);

  push(["Movimentações manuais (reforço/sangria)"]);
  push(["Hora", "Tipo", "Valor", "Motivo", "Responsável"]);
  for (const m of movements) {
    push([
      new Date(m.created_at).toLocaleString("pt-BR"),
      m.type === "reforco" ? "Reforço" : "Sangria",
      m.amount.toFixed(2),
      m.note,
      m.staff_name ?? "—",
    ]);
  }
  push([]);

  push(["Vendas em dinheiro confirmadas nesta sessão"]);
  push(["Hora", "Cliente", "Total do pedido", "Valor em dinheiro", "Recebido", "Troco", "Confirmado por"]);
  for (const o of cashOrders) {
    const c = customerFor(o);
    push([
      new Date(o.paid_at ?? o.created_at).toLocaleString("pt-BR"),
      c?.name ?? "—",
      o.total.toFixed(2),
      cashAmountFor(o, paymentsByOrder.get(o.id) ?? []).toFixed(2),
      o.cash_received != null ? o.cash_received.toFixed(2) : "",
      o.cash_change != null ? o.cash_change.toFixed(2) : "",
      o.paid_by_name ?? "—",
    ]);
  }

  const csv = rows.map((row) => row.map((v) => escapeCsv(String(v))).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-caixa-${new Date(session.opened_at).toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CaixaEstoquePage() {
  const { profile } = useAuth();
  const {
    orders,
    orderItems,
    orderPayments,
    cashSessions,
    cashMovements,
    customers,
    products,
    patchOrder,
    patchProduct,
  } = useLiveData();
  const [pendingDeliver, setPendingDeliver] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);

  const openSession = useMemo(() => cashSessions.find((s) => s.status === "aberto") ?? null, [cashSessions]);

  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [openingSubmitting, setOpeningSubmitting] = useState(false);

  const [movementType, setMovementType] = useState<CashMovementType | null>(null);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [movementSubmitting, setMovementSubmitting] = useState(false);

  const [closeSheetOpen, setCloseSheetOpen] = useState(false);
  const [closingCountedInput, setClosingCountedInput] = useState("");
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  const [pendingCashConfirm, setPendingCashConfirm] = useState<Order | null>(null);
  const [receivedInput, setReceivedInput] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const itemsByOrder = useMemo(() => {
    const map = new Map<number, { product_id: number | null; product_name: string; unit_price: number; quantity: number }[]>();
    for (const it of orderItems) {
      const list = map.get(it.order_id) ?? [];
      list.push(it);
      map.set(it.order_id, list);
    }
    return map;
  }, [orderItems]);

  const paymentsByOrder = useMemo(() => {
    const map = new Map<number, OrderPayment[]>();
    for (const p of orderPayments) {
      const list = map.get(p.order_id) ?? [];
      list.push(p);
      map.set(p.order_id, list);
    }
    return map;
  }, [orderPayments]);

  function customerFor(order: Order) {
    return customers.find((c) => c.id === order.customer_id) ?? null;
  }

  const aguardandoPagamento = orders
    .filter((o) => o.status === "aguardando_pagamento")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const paraSeparar = orders
    .filter((o) => o.status === "pago")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function abrirCaixa() {
    const parsed = parseFloat(openingBalanceInput.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      showToast("Digite um saldo inicial válido.");
      return;
    }
    setOpeningSubmitting(true);
    const { error } = await supabase.from("cash_sessions").insert({
      opened_by: profile?.id ?? null,
      opened_by_name: profile?.name ?? null,
      opening_balance: parsed,
    });
    setOpeningSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    setOpeningBalanceInput("");
  }

  async function lancarMovimento() {
    if (!openSession || !movementType) return;
    const parsed = parseFloat(movementAmount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      showToast("Digite um valor válido.");
      return;
    }
    if (!movementNote.trim()) {
      showToast("Digite o motivo.");
      return;
    }
    setMovementSubmitting(true);
    const { error } = await supabase.from("cash_movements").insert({
      session_id: openSession.id,
      type: movementType,
      amount: parsed,
      note: movementNote.trim(),
      staff_id: profile?.id ?? null,
      staff_name: profile?.name ?? null,
    });
    setMovementSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    showToast(movementType === "reforco" ? "Reforço lançado." : "Sangria lançada.");
    setMovementType(null);
    setMovementAmount("");
    setMovementNote("");
  }

  async function fecharCaixa() {
    if (!openSession) return;
    const parsed = parseFloat(closingCountedInput.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      showToast("Digite quanto tem contado na gaveta.");
      return;
    }
    setClosingSubmitting(true);
    const closedAt = new Date().toISOString();
    const { error } = await supabase
      .from("cash_sessions")
      .update({
        status: "fechado",
        closed_by: profile?.id ?? null,
        closed_by_name: profile?.name ?? null,
        closed_at: closedAt,
        closing_counted: parsed,
      })
      .eq("id", openSession.id);
    setClosingSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    const sessionForReport: CashSession = {
      ...openSession,
      status: "fechado",
      closed_at: closedAt,
      closed_by_name: profile?.name ?? null,
      closing_counted: parsed,
    };
    const sessionMovements = cashMovements.filter((m) => m.session_id === openSession.id);
    const sessionCashOrders = orders.filter((o) => o.cash_session_id === openSession.id);
    const windowOrders = orders.filter((o) => new Date(o.created_at) >= new Date(openSession.opened_at));
    exportCaixaReport(sessionForReport, sessionMovements, sessionCashOrders, windowOrders, paymentsByOrder, customerFor);
    setCloseSheetOpen(false);
    setClosingCountedInput("");
    showToast("Caixa fechado. Relatório baixado.");
  }

  function abrirConfirmacaoPagamento(order: Order) {
    setPendingCashConfirm(order);
    setReceivedInput("");
  }

  async function confirmarPagamentoComTroco() {
    if (!pendingCashConfirm || !openSession) return;
    const order = pendingCashConfirm;
    const payments = paymentsByOrder.get(order.id) ?? [];
    const due = cashAmountFor(order, payments);
    const received = parseFloat(receivedInput.replace(",", "."));
    if (isNaN(received) || received < due - 0.001) {
      showToast(
        `O valor recebido precisa ser pelo menos ${due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
      );
      return;
    }
    const change = Math.round((received - due) * 100) / 100;
    const patch = {
      status: "pago" as const,
      paid_by: profile?.id ?? null,
      paid_by_name: profile?.name ?? null,
      paid_at: new Date().toISOString(),
      cash_session_id: openSession.id,
      cash_received: received,
      cash_change: change,
    };
    setConfirmSubmitting(true);
    patchOrder(order.id, patch);
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    setConfirmSubmitting(false);
    if (error) {
      patchOrder(order.id, {
        status: order.status,
        paid_by: order.paid_by,
        paid_by_name: order.paid_by_name,
        paid_at: order.paid_at,
        cash_session_id: order.cash_session_id,
        cash_received: order.cash_received,
        cash_change: order.cash_change,
      });
      showToast("Erro: " + error.message);
      return;
    }
    setPendingCashConfirm(null);
    setReceivedInput("");
    const customer = customerFor(order);
    printReceipt({
      order: { ...order, ...patch },
      customerName: customer?.name ?? null,
      items: (itemsByOrder.get(order.id) ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      payments,
    });
  }

  async function marcarEntregue(order: Order) {
    if (delivering) return;
    setDelivering(true);
    const patch = {
      status: "entregue" as const,
      delivered_by: profile?.id ?? null,
      delivered_by_name: profile?.name ?? null,
      delivered_at: new Date().toISOString(),
    };
    patchOrder(order.id, patch);

    // Baixa otimista do estoque — a função `deliver_order` faz a mesma
    // conta de verdade no banco; isso aqui é só pra tela reagir na hora.
    const stockBefore = new Map<number, number>();
    for (const item of itemsByOrder.get(order.id) ?? []) {
      if (item.product_id == null) continue;
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;
      if (!stockBefore.has(product.id)) stockBefore.set(product.id, product.stock);
      patchProduct(product.id, { stock: Math.max(0, product.stock - item.quantity) });
    }

    const { error } = await supabase.rpc("deliver_order", {
      p_order_id: order.id,
      p_staff_id: profile?.id ?? null,
      p_staff_name: profile?.name ?? null,
    });
    if (error) {
      patchOrder(order.id, {
        status: order.status,
        delivered_by: order.delivered_by,
        delivered_by_name: order.delivered_by_name,
        delivered_at: order.delivered_at,
      });
      for (const [productId, stock] of stockBefore) patchProduct(productId, { stock });
      showToast("Erro: " + error.message);
    }
    setDelivering(false);
  }

  async function cancelarPedido(order: Order) {
    const { error } = await supabase.from("orders").update({ status: "cancelado" }).eq("id", order.id);
    if (error) showToast("Erro: " + error.message);
  }

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10);
    const todays = orders.filter((o) => o.created_at.slice(0, 10) === today);
    if (todays.length === 0) {
      showToast("Nenhum pedido hoje ainda.");
      return;
    }
    exportCsv(
      todays,
      itemsByOrder,
      paymentsByOrder,
      (o) => customerFor(o)?.name ?? "—",
      (o) => customerFor(o)?.doc_number ?? "—"
    );
  }

  if (!openSession) {
    return (
      <>
        <PageHeader icon={Lock} tone="brick" title="Abrir caixa" subtitle="Separe o troco inicial antes de começar a vender." />
        <Card>
          <CardTitle>Saldo inicial (troco)</CardTitle>
          <p className="mt-0.5 text-[0.78rem] text-ink-soft">
            Quanto em espécie você já tem na gaveta pra começar a dar troco.
          </p>
          <FieldLabel>Valor (R$)</FieldLabel>
          <Input
            value={openingBalanceInput}
            onChange={(e) => setOpeningBalanceInput(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            autoFocus
          />
          <Button className="mt-3" loading={openingSubmitting} onClick={abrirCaixa}>
            <Wallet className="h-4 w-4" />
            Abrir caixa
          </Button>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Wallet}
        tone="brick"
        title="Caixa & Estoque"
        subtitle="Confirme o dinheiro que entrou e separe/entregue os pedidos já pagos."
      />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[0.82rem] font-bold text-ink">
              Caixa aberto · {new Date(openSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[0.76rem] text-ink-soft">
              Saldo inicial {openSession.opening_balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              {" · "}
              {openSession.opened_by_name ?? "—"}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="w-auto" onClick={() => setMovementType("reforco")}>
            <Plus className="h-3.5 w-3.5" />
            Reforço
          </Button>
          <Button variant="outline" size="sm" className="w-auto" onClick={() => setMovementType("sangria")}>
            <Minus className="h-3.5 w-3.5" />
            Sangria
          </Button>
          <Button variant="danger" size="sm" className="w-auto" onClick={() => setCloseSheetOpen(true)}>
            <LogOut className="h-3.5 w-3.5" />
            Fechar caixa
          </Button>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Aguardando pagamento em dinheiro</CardTitle>
          <Badge tone={aguardandoPagamento.length > 0 ? "wait" : "neutral"}>{aguardandoPagamento.length}</Badge>
        </div>
        {aguardandoPagamento.length === 0 ? (
          <EmptyState icon={Banknote} title="Ninguém aguardando" subtitle="Assim que uma venda em dinheiro chegar, aparece aqui." />
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {aguardandoPagamento.map((o) => {
              const items = itemsByOrder.get(o.id) ?? [];
              const customer = customerFor(o);
              const payments = paymentsByOrder.get(o.id) ?? [];
              const cash = cashAmountFor(o, payments);
              return (
                <div key={o.id} className="rounded-xl border border-line bg-linen/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CustomerInfo customer={customer} />
                      <ItemChips items={items} />
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <PaymentInfo order={o} payments={payments} />
                        <span className="text-[0.76rem] text-ink-soft">Vendedor: {o.seller_name ?? "—"}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[0.7rem] font-semibold text-ink-soft">{formatOrderTime(o.created_at)}</div>
                      <div className="text-[1rem] font-black tabular-nums text-ink">
                        {cash.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                      {o.payment_method === "misto" && (
                        <div className="text-[0.66rem] text-ink-soft">
                          em dinheiro · pedido {o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="w-auto" onClick={() => abrirConfirmacaoPagamento(o)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmar recebido
                    </Button>
                    <Button variant="outline" size="sm" className="w-auto" onClick={() => cancelarPedido(o)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Pra separar e entregar</CardTitle>
          <Badge tone={paraSeparar.length > 0 ? "wait" : "neutral"}>{paraSeparar.length}</Badge>
        </div>
        {paraSeparar.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nada pra separar agora" subtitle="Pedidos pagos (cartão, pix ou dinheiro confirmado) aparecem aqui." />
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {paraSeparar.map((o) => {
              const items = itemsByOrder.get(o.id) ?? [];
              const customer = customerFor(o);
              const payments = paymentsByOrder.get(o.id) ?? [];
              return (
                <div key={o.id} className="rounded-xl border border-line bg-sage-tint/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CustomerInfo customer={customer} />
                      <ItemChips items={items} />
                      <div className="mt-1.5">
                        <PaymentInfo order={o} payments={payments} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[0.7rem] font-semibold text-ink-soft">{formatOrderTime(o.created_at)}</div>
                      <div className="text-[1rem] font-black tabular-nums text-ink">
                        {o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" className="mt-2 w-auto" onClick={() => setPendingDeliver(o)}>
                    <PackageCheck className="h-3.5 w-3.5" />
                    Entregue
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Exportar pedidos de hoje</CardTitle>
        <p className="mt-0.5 text-[0.78rem] text-ink-soft">
          CSV com um item por linha (cliente, documento, produto, quantidade, valor, forma de pagamento) — pronto pra
          importar no Protheus.
        </p>
        <Button variant="outline" className="mt-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </Card>

      <BottomSheet
        open={pendingDeliver !== null}
        onOpenChange={(v) => !v && setPendingDeliver(null)}
        title="Confirmar entrega"
      >
        {pendingDeliver && (
          <>
            <p className="text-[0.84rem] text-ink-soft">
              Confirma que <b className="text-ink">{customerFor(pendingDeliver)?.name ?? "o cliente"}</b> já recebeu em
              mãos:
            </p>
            <ItemChips items={itemsByOrder.get(pendingDeliver.id) ?? []} />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPendingDeliver(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={delivering}
                onClick={async () => {
                  await marcarEntregue(pendingDeliver);
                  setPendingDeliver(null);
                }}
              >
                <PackageCheck className="h-4 w-4" />
                Confirmar entrega
              </Button>
            </div>
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={pendingCashConfirm !== null}
        onOpenChange={(v) => !v && setPendingCashConfirm(null)}
        title="Confirmar dinheiro recebido"
      >
        {pendingCashConfirm &&
          (() => {
            const due = cashAmountFor(pendingCashConfirm, paymentsByOrder.get(pendingCashConfirm.id) ?? []);
            const parsedReceived = parseFloat(receivedInput.replace(",", "."));
            const troco = !isNaN(parsedReceived) ? Math.round((parsedReceived - due) * 100) / 100 : null;
            return (
              <>
                <p className="text-[0.84rem] text-ink-soft">
                  Valor a receber em dinheiro:{" "}
                  <b className="text-ink">{due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
                </p>
                <FieldLabel className="mt-2">Quanto o cliente entregou</FieldLabel>
                <Input
                  value={receivedInput}
                  onChange={(e) => setReceivedInput(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  autoFocus
                />
                {troco !== null && !isNaN(troco) && (
                  <div className={"mt-2 text-[0.9rem] font-bold " + (troco < 0 ? "text-brick" : "text-moss-deep")}>
                    {troco < 0
                      ? `Falta ${Math.abs(troco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : `Troco: ${troco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setPendingCashConfirm(null)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" loading={confirmSubmitting} onClick={confirmarPagamentoComTroco}>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar
                  </Button>
                </div>
              </>
            );
          })()}
      </BottomSheet>

      <BottomSheet
        open={movementType !== null}
        onOpenChange={(v) => !v && setMovementType(null)}
        title={movementType === "reforco" ? "Reforço de caixa" : "Sangria de caixa"}
      >
        <p className="text-[0.8rem] text-ink-soft">
          {movementType === "reforco"
            ? "Dinheiro entrando na gaveta fora de uma venda (ex: repor troco)."
            : "Dinheiro saindo da gaveta (ex: levar excesso pro cofre)."}
        </p>
        <FieldLabel className="mt-2">Valor (R$)</FieldLabel>
        <Input value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0,00" inputMode="decimal" autoFocus />
        <FieldLabel>Motivo</FieldLabel>
        <Textarea
          value={movementNote}
          onChange={(e) => setMovementNote(e.target.value)}
          placeholder="Ex.: reposição de troco"
          rows={2}
        />
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setMovementType(null)}>
            Cancelar
          </Button>
          <Button className="flex-1" loading={movementSubmitting} onClick={lancarMovimento}>
            Confirmar
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={closeSheetOpen} onOpenChange={setCloseSheetOpen} title="Fechar caixa">
        {(() => {
          const sessionCashOrders = orders.filter((o) => o.cash_session_id === openSession.id);
          const totalDinheiro = sessionCashOrders.reduce(
            (s, o) => s + cashAmountFor(o, paymentsByOrder.get(o.id) ?? []),
            0
          );
          const sessionMovements = cashMovements.filter((m) => m.session_id === openSession.id);
          const totalReforcos = sessionMovements.filter((m) => m.type === "reforco").reduce((s, m) => s + m.amount, 0);
          const totalSangrias = sessionMovements.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amount, 0);
          const esperado = openSession.opening_balance + totalDinheiro + totalReforcos - totalSangrias;
          return (
            <>
              <div className="space-y-1 text-[0.82rem]">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Saldo inicial</span>
                  <span className="font-semibold">
                    {openSession.opening_balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">+ Vendas em dinheiro</span>
                  <span className="font-semibold">{totalDinheiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">+ Reforços</span>
                  <span className="font-semibold">{totalReforcos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">- Sangrias</span>
                  <span className="font-semibold">{totalSangrias.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-1">
                  <span className="font-bold text-ink">Saldo esperado</span>
                  <span className="font-bold text-ink">{esperado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              </div>
              <FieldLabel>Quanto tem contado na gaveta agora</FieldLabel>
              <Input
                value={closingCountedInput}
                onChange={(e) => setClosingCountedInput(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCloseSheetOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" loading={closingSubmitting} onClick={fecharCaixa}>
                  <LogOut className="h-4 w-4" />
                  Fechar e baixar relatório
                </Button>
              </div>
            </>
          );
        })()}
      </BottomSheet>
    </>
  );
}

import type { Order, SinglePaymentMethod } from "@biodinamica/supabase";

const PAYMENT_LABEL: Record<SinglePaymentMethod, string> = { dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix" };

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface ReceiptPayment {
  method: SinglePaymentMethod;
  amount: number;
}

export interface ReceiptData {
  order: Pick<Order, "id" | "created_at" | "total" | "payment_method" | "seller_name" | "cash_received" | "cash_change">;
  customerName: string | null;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
}

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReceiptHtml({ order, customerName, items, payments }: ReceiptData) {
  const dt = new Date(order.created_at);
  const dateStr = dt.toLocaleDateString("pt-BR");
  const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const itemRows = items
    .map(
      (i) => `
    <div class="row"><span>${i.quantity}x ${escapeHtml(i.product_name)}</span><span>${money(i.unit_price * i.quantity)}</span></div>
    <div class="row sub"><span>${money(i.unit_price)} cada</span></div>`
    )
    .join("");

  const paymentBlock =
    order.payment_method === "misto"
      ? payments
          .map((p) => `<div class="row"><span>${PAYMENT_LABEL[p.method]}</span><span>${money(p.amount)}</span></div>`)
          .join("")
      : `<div class="row"><span>${PAYMENT_LABEL[order.payment_method as SinglePaymentMethod] ?? order.payment_method}</span><span>${money(order.total)}</span></div>`;

  const trocoBlock =
    order.cash_received != null && order.cash_change != null
      ? `<div class="row"><span>Recebido</span><span>${money(order.cash_received)}</span></div>
         <div class="row"><span>Troco</span><span>${money(order.cash_change)}</span></div>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Cupom #${order.id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 76mm; margin: 0 auto; padding: 4mm 2mm; font-family: "Courier New", monospace; font-size: 12px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row.sub { color: #444; font-size: 10px; margin-bottom: 3px; }
  .title { font-size: 14px; }
  .footer { margin-top: 10px; font-size: 10px; }
</style>
</head>
<body>
  <div class="center bold title">Grupo Biodinâmica</div>
  <div class="center">44º CIOSP · 27-30/01/2027</div>
  <div class="divider"></div>
  <div class="row"><span>Pedido</span><span>#${order.id}</span></div>
  <div class="row"><span>Data</span><span>${dateStr} ${timeStr}</span></div>
  ${customerName ? `<div class="row"><span>Cliente</span><span>${escapeHtml(customerName)}</span></div>` : ""}
  ${order.seller_name ? `<div class="row"><span>Vendedor</span><span>${escapeHtml(order.seller_name)}</span></div>` : ""}
  <div class="divider"></div>
  ${itemRows}
  <div class="divider"></div>
  <div class="row bold"><span>Total</span><span>${money(order.total)}</span></div>
  <div class="divider"></div>
  ${paymentBlock}
  ${trocoBlock}
  <div class="footer center">Obrigado pela visita!</div>
</body>
</html>`;
}

/** Imprime o cupom numa impressora térmica USB comum (com driver do
 *  Windows) — usa um iframe escondido em vez de window.open() porque
 *  esse é chamado depois de um await (salvar o pedido no banco), e
 *  nesse ponto o navegador já não considera mais "clique direto do
 *  usuário" pra liberar popup — iframe não sofre esse bloqueio. */
export function printReceipt(data: ReceiptData) {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 200);
}

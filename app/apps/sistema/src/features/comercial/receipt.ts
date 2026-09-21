import type { Order, SinglePaymentMethod } from "@biodinamica/supabase";

const PAYMENT_LABEL: Record<SinglePaymentMethod, string> = { dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix" };

const COMPANY = {
  name: "D.P.O",
  cnpj: "00969561000100",
  ie: "906.84481-80 PR",
  addressLine1: "Rua Ronat Walter Sodré, 4.560 - Parque Industrial IV",
  addressLine2: "Ibiporã, PR- CEP: 86200000",
};

export interface ReceiptItem {
  code?: string | null;
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

function num(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReceiptHtml({ order, customerName, items, payments }: ReceiptData) {
  const dt = new Date(order.created_at);
  const dateStr = dt.toLocaleDateString("pt-BR");
  const timeStr = dt.toLocaleTimeString("pt-BR");

  const itemRows = items
    .map((i) => {
      const label = i.code ? `${i.code} - ${i.product_name}` : i.product_name;
      return `
    <tr>
      <td class="desc">${escapeHtml(label)}</td>
      <td class="num">${qty(i.quantity)}</td>
      <td class="num">PC</td>
      <td class="num">${num(i.unit_price)}</td>
      <td class="num">${num(i.unit_price * i.quantity)}</td>
    </tr>`;
    })
    .join("");

  const totalItens = items.reduce((sum, i) => sum + i.quantity, 0);
  const desconto = 0;
  const valorAPagar = order.total - desconto;
  const troco = order.cash_change ?? 0;

  const paymentRows =
    order.payment_method === "misto"
      ? payments
          .map((p) => `<tr><td>${PAYMENT_LABEL[p.method]}</td><td class="num">${num(p.amount)}</td></tr>`)
          .join("")
      : `<tr><td>${PAYMENT_LABEL[order.payment_method as SinglePaymentMethod] ?? order.payment_method}</td><td class="num">${num(order.cash_received ?? order.total)}</td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Comprovante de venda #${order.id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 76mm; margin: 0 auto; padding: 4mm 2mm; font-family: "Courier New", monospace; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .title { font-size: 14px; }
  .company-name { font-size: 13px; }
  .small { font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { padding: 1px 0; vertical-align: top; }
  th.desc, td.desc { text-align: left; }
  th.num, td.num { text-align: right; white-space: nowrap; padding-left: 4px; }
  thead tr { border-bottom: 1px dashed #000; }
  .totals .row { margin: 1px 0; }
  .footer { margin-top: 10px; font-size: 10px; }
</style>
</head>
<body>
  <div class="center bold company-name">${escapeHtml(COMPANY.name)}</div>
  <div class="center small">CNPJ - ${escapeHtml(COMPANY.cnpj)}</div>
  <div class="center small">IE - ${escapeHtml(COMPANY.ie)}</div>
  <div class="center small">${escapeHtml(COMPANY.addressLine1)}</div>
  <div class="center small">${escapeHtml(COMPANY.addressLine2)}</div>

  <div class="divider"></div>
  <div class="center bold title">COMPROVANTE DE VENDA</div>
  <div class="center small">&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt; SEM VALOR FISCAL &lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>

  <div class="divider"></div>
  <div class="row"><span>Pedido</span><span>#${order.id}</span></div>
  <div class="row"><span>Data</span><span>${dateStr} ${timeStr}</span></div>
  ${customerName ? `<div class="row"><span>Cliente</span><span>${escapeHtml(customerName)}</span></div>` : ""}
  ${order.seller_name ? `<div class="row"><span>Vendedor</span><span>${escapeHtml(order.seller_name)}</span></div>` : ""}

  <div class="divider"></div>
  <div class="center small">Itens da Venda</div>
  <table>
    <thead>
      <tr>
        <th class="desc">DESCRIÇÃO</th>
        <th class="num">QTD</th>
        <th class="num">UN</th>
        <th class="num">VLR UNIT</th>
        <th class="num">VLR TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="divider"></div>
  <div class="totals">
    <div class="row"><span>QTD. TOTAL DE ITENS</span><span>${totalItens}</span></div>
    <div class="row"><span>VALOR TOTAL</span><span>${num(order.total)}</span></div>
    <div class="row"><span>VALOR DESCONTO</span><span>${num(desconto)}</span></div>
    <div class="row bold"><span>VALOR A PAGAR</span><span>${num(valorAPagar)}</span></div>
    <div class="row"><span>TROCO</span><span>${num(troco)}</span></div>
  </div>

  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th class="desc">FORMA DE PAGAMENTO</th>
        <th class="num">Valor Pago</th>
      </tr>
    </thead>
    <tbody>
      ${paymentRows}
    </tbody>
  </table>

  <div class="divider"></div>
  <div class="center bold">VENDA NÚMERO INTERNO ${order.id}</div>
  <div class="center small">EMISSÃO EM ${dateStr} ${timeStr}</div>

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

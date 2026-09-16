import { useRef, useState } from "react";
import { Badge, Card, EmptyState, Input, PageHeader, SkeletonRow, showToast } from "@biodinamica/ui";
import { Boxes, Minus, Plus, TriangleAlert } from "lucide-react";
import type { Product } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";
import { RemoveStockSheet } from "./RemoveStockSheet";

const LOW_STOCK_THRESHOLD = 5;

export function EstoqueControlePage() {
  const { profile } = useAuth();
  const { products, loading, patchProduct } = useLiveData();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{ product: Product; base: number; next: number } | null>(
    null
  );
  // Guarda o valor "de verdade" enquanto uma sequência de cliques ainda não
  // voltou do banco — sem isso, dois cliques rápidos em +/- liam o mesmo
  // `product.stock` (do render antigo) e um dos dois se perdia.
  const pendingStockRef = useRef(new Map<number, number>());

  function currentStock(product: Product) {
    return pendingStockRef.current.get(product.id) ?? product.stock;
  }

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const lowStock = sorted.filter((p) => p.active && p.stock <= LOW_STOCK_THRESHOLD);

  async function applyStockChange(product: Product, base: number, next: number, note?: string) {
    if (next === base) return;
    pendingStockRef.current.set(product.id, next);
    patchProduct(product.id, { stock: next });
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", product.id);
    // Só limpa a referência se ninguém mexeu de novo nesse meio-tempo —
    // um clique mais novo pode já ter posto outro valor ali, e apagar sem
    // checar faria o próximo clique cair de volta no estado antigo.
    const stillCurrent = pendingStockRef.current.get(product.id) === next;
    if (error) {
      if (stillCurrent) pendingStockRef.current.delete(product.id);
      patchProduct(product.id, { stock: base });
      showToast("Erro: " + error.message);
      return;
    }
    if (stillCurrent) pendingStockRef.current.delete(product.id);
    if (next < base && note) {
      const { error: logError } = await supabase.from("stock_adjustments").insert({
        product_id: product.id,
        delta: next - base,
        note,
        staff_id: profile?.id ?? null,
        staff_name: profile?.name ?? null,
      });
      if (logError) showToast("Estoque ajustado, mas não salvei a observação: " + logError.message);
    }
  }

  function requestStockChange(product: Product, next: number) {
    const base = currentStock(product);
    if (next < base) {
      setPendingRemoval({ product, base, next });
    } else {
      applyStockChange(product, base, next);
    }
  }

  function adjustStock(product: Product, delta: number) {
    requestStockChange(product, Math.max(0, currentStock(product) + delta));
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditValue(String(currentStock(product)));
  }

  function saveEdit(product: Product) {
    setEditingId(null);
    const parsed = parseInt(editValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      showToast("Digite uma quantidade válida.");
      return;
    }
    requestStockChange(product, parsed);
  }

  return (
    <>
      <PageHeader
        icon={Boxes}
        tone="clay"
        title="Estoque"
        subtitle="Quantidade física de cada produto — desconta sozinho quando um pedido é marcado entregue."
      />

      {lowStock.length > 0 && (
        <Card className="mb-4 border-brick/30 bg-brick-tint">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brick" />
            <div>
              <div className="text-[0.84rem] font-bold text-brick">
                {lowStock.length} produto{lowStock.length === 1 ? "" : "s"} com estoque baixo
              </div>
              <div className="mt-0.5 text-[0.78rem] text-brick/90">
                {lowStock.map((p) => `${p.name} (${p.stock})`).join(" · ")}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="divide-y divide-line">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : sorted.length === 0 ? (
            <EmptyState icon={Boxes} title="Nenhum produto cadastrado" subtitle="Peça pro admin cadastrar em Produtos." />
          ) : (
            sorted.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.86rem] font-semibold text-ink">{p.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.76rem] text-ink-soft">
                    <span>{p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    {p.stock === 0 && <Badge tone="crit">esgotado</Badge>}
                    {p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD && <Badge tone="wait">estoque baixo</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStock(p, -1)}
                    aria-label={`Diminuir estoque de ${p.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-linen"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  {editingId === p.id ? (
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ""))}
                      onBlur={() => saveEdit(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      inputMode="numeric"
                      className="w-14 px-1 py-1.5 text-center"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      aria-label={`Editar estoque de ${p.name}`}
                      className="w-12 text-center text-[0.95rem] font-black tabular-nums text-ink"
                    >
                      {p.stock}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => adjustStock(p, 1)}
                    aria-label={`Aumentar estoque de ${p.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-linen"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <RemoveStockSheet
        open={pendingRemoval !== null}
        productName={pendingRemoval?.product.name ?? ""}
        quantity={pendingRemoval ? pendingRemoval.base - pendingRemoval.next : 0}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={(note) => {
          if (pendingRemoval) applyStockChange(pendingRemoval.product, pendingRemoval.base, pendingRemoval.next, note);
          setPendingRemoval(null);
        }}
      />
    </>
  );
}

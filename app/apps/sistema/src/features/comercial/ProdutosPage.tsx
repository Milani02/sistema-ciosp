import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  FieldLabel,
  IconChip,
  Input,
  PageHeader,
  SkeletonRow,
  showToast,
} from "@biodinamica/ui";
import { Minus, Package, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import type { Product } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";
import { RemoveStockSheet } from "./RemoveStockSheet";

const LOW_STOCK_THRESHOLD = 5;

export function ProdutosPage() {
  const { profile } = useAuth();
  const { products, loading, patchProduct } = useLiveData();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ product: Product; base: number; next: number } | null>(
    null
  );
  // Guarda o valor "de verdade" enquanto uma sequência de cliques ainda não
  // voltou do banco — sem isso, dois cliques rápidos em +/- liam o mesmo
  // `p.stock` (do render antigo) e um dos dois se perdia.
  const pendingStockRef = useRef(new Map<number, number>());

  function currentStock(p: Product) {
    return pendingStockRef.current.get(p.id) ?? p.stock;
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setCode(p.code ?? "");
    setPrice(String(p.price));
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setCode("");
    setPrice("");
  }

  async function saveProduct() {
    if (!name.trim()) {
      showToast("Digite o nome do produto.");
      return;
    }
    const parsedPrice = parseFloat(price.replace(",", "."));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast("Digite um preço válido.");
      return;
    }
    setSubmitting(true);
    const payload = { name: name.trim(), code: code.trim() || null, price: parsedPrice };
    const { error } = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert(payload);
    setSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    showToast(editingId ? "Produto atualizado." : "Produto adicionado.");
    cancelEdit();
  }

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) showToast("Erro: " + error.message);
  }

  async function applyStockChange(p: Product, base: number, next: number, note?: string) {
    if (next === base) return;
    pendingStockRef.current.set(p.id, next);
    patchProduct(p.id, { stock: next });
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", p.id);
    // Só limpa a referência se ninguém mexeu de novo nesse meio-tempo —
    // um clique mais novo pode já ter posto outro valor ali, e apagar sem
    // checar faria o próximo clique cair de volta no estado antigo.
    const stillCurrent = pendingStockRef.current.get(p.id) === next;
    if (error) {
      if (stillCurrent) pendingStockRef.current.delete(p.id);
      patchProduct(p.id, { stock: base });
      showToast("Erro: " + error.message);
      return;
    }
    if (stillCurrent) pendingStockRef.current.delete(p.id);
    if (next < base && note) {
      const { error: logError } = await supabase.from("stock_adjustments").insert({
        product_id: p.id,
        delta: next - base,
        note,
        staff_id: profile?.id ?? null,
        staff_name: profile?.name ?? null,
      });
      if (logError) showToast("Estoque ajustado, mas não salvei a observação: " + logError.message);
    }
  }

  function adjustStock(p: Product, delta: number) {
    const base = currentStock(p);
    const next = Math.max(0, base + delta);
    if (next < base) {
      setPendingRemoval({ product: p, base, next });
    } else {
      applyStockChange(p, base, next);
    }
  }

  async function removeProduct(id: number) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) showToast("Erro: " + error.message);
    if (editingId === id) cancelEdit();
  }

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const lowStock = sorted.filter((p) => p.active && p.stock <= LOW_STOCK_THRESHOLD);

  return (
    <>
      <PageHeader
        icon={Package}
        tone="clay"
        title="Catálogo de produtos"
        subtitle="Cadastre os produtos e preços que aparecem no carrinho da tela de Venda."
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>{editingId ? "Editar produto" : "Novo produto"}</CardTitle>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-ink-soft hover:text-ink" aria-label="Cancelar edição">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FieldLabel className="mt-0">Nome</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Kit Implante XYZ" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Código</FieldLabel>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: KI-01" />
            </div>
            <div>
              <FieldLabel>Preço (R$)</FieldLabel>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <Button className="mt-3" loading={submitting} onClick={saveProduct}>
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Salvar alterações" : "Adicionar produto"}
          </Button>
          {editingId && (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={cancelEdit}>
              Cancelar edição
            </Button>
          )}
        </Card>

        <Card>
          <CardTitle>Produtos cadastrados</CardTitle>
          <div className="mt-2 max-h-[560px] divide-y divide-line overflow-y-auto border-t border-line">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : sorted.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum produto ainda" subtitle="Cadastre o primeiro produto ao lado." />
            ) : (
              sorted.map((p) => (
                <div key={p.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <IconChip icon={Package} tone={p.active ? "sage" : "clay"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.88rem] font-semibold text-ink">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[0.78rem] text-ink-soft">
                        <span>{p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        {p.code && <span className="text-ink-soft/80">· cód. {p.code}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleActive(p)} className="shrink-0">
                      <Badge tone={p.active ? "ok" : "neutral"}>{p.active ? "ativo" : "inativo"}</Badge>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 pl-12">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustStock(p, -1)}
                        aria-label={`Diminuir estoque de ${p.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-linen"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-[0.82rem] font-bold tabular-nums text-ink">{p.stock}</span>
                      <button
                        type="button"
                        onClick={() => adjustStock(p, 1)}
                        aria-label={`Aumentar estoque de ${p.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-linen"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <span className="ml-1 text-[0.7rem] text-ink-soft">em estoque</span>
                      {p.active && p.stock <= LOW_STOCK_THRESHOLD && <Badge tone="crit">baixo</Badge>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-sage-tint hover:text-moss-deep"
                        aria-label="Editar produto"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <Button variant="danger" size="sm" className="w-auto" onClick={() => removeProduct(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

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

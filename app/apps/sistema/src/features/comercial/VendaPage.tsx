import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardTitle,
  EmptyState,
  FieldLabel,
  Input,
  ListRow,
  PageHeader,
  showToast,
} from "@biodinamica/ui";
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  SplitSquareHorizontal,
  Trash2,
  User,
} from "lucide-react";
import type { PaymentMethod, SinglePaymentMethod } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fetchCnpjInfo, formatCpfCnpj, isValidCnpj, isValidCpf, onlyDigits } from "../../lib/docs";
import { useAuth } from "../auth/useAuth";
import { useLiveData } from "../live-data/useLiveData";
import { printReceipt } from "./receipt";

type DocType = "cpf" | "cnpj";
type LookupState = "idle" | "checking" | "invalid" | "found" | "new";
interface CartLine {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

const PAYMENT_OPTIONS: { value: SinglePaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "cartao", label: "Cartão", icon: CreditCard },
  { value: "pix", label: "Pix", icon: QrCode },
];

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Rascunho salvo em sessionStorage — trocar de aba (Venda -> Caixa/Produtos
// e voltar) desmonta este componente, o que apagaria o carrinho/cliente
// se ficasse só em useState. Sobrevive também a um F5 sem querer.
const DRAFT_KEY = "biodinamica:venda:draft";

interface VendaDraft {
  docType: DocType;
  docInput: string;
  name: string;
  phone: string;
  email: string;
  cnpjRazaoSocial: string;
  cnpjNomeFantasia: string;
  birthDate: string;
  address: string;
  zipCode: string;
  city: string;
  state: string;
  cart: CartLine[];
  paymentMethod: PaymentMethod | null;
  splitMode: boolean;
  splitAmounts: Record<SinglePaymentMethod, string>;
}

function loadDraft(): Partial<VendaDraft> {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function VendaPage() {
  const { profile } = useAuth();
  const { products } = useLiveData();
  const navigate = useNavigate();
  const draft = useMemo(loadDraft, []);

  const [docType, setDocType] = useState<DocType>(draft.docType ?? "cpf");
  const [docInput, setDocInput] = useState(draft.docInput ?? "");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [existingCustomerId, setExistingCustomerId] = useState<number | null>(null);
  const [name, setName] = useState(draft.name ?? "");
  const [phone, setPhone] = useState(draft.phone ?? "");
  const [email, setEmail] = useState(draft.email ?? "");
  const [cnpjRazaoSocial, setCnpjRazaoSocial] = useState(draft.cnpjRazaoSocial ?? "");
  const [cnpjNomeFantasia, setCnpjNomeFantasia] = useState(draft.cnpjNomeFantasia ?? "");
  const [birthDate, setBirthDate] = useState(draft.birthDate ?? "");
  const [address, setAddress] = useState(draft.address ?? "");
  const [zipCode, setZipCode] = useState(draft.zipCode ?? "");
  const [city, setCity] = useState(draft.city ?? "");
  const [state, setState] = useState(draft.state ?? "");

  const [cart, setCart] = useState<CartLine[]>(draft.cart ?? []);
  const [productSearch, setProductSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(draft.paymentMethod ?? null);
  const [splitMode, setSplitMode] = useState(draft.splitMode ?? false);
  const [splitAmounts, setSplitAmounts] = useState<Record<SinglePaymentMethod, string>>(
    draft.splitAmounts ?? { dinheiro: "", cartao: "", pix: "" }
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const toSave: VendaDraft = {
      docType,
      docInput,
      name,
      phone,
      email,
      cnpjRazaoSocial,
      cnpjNomeFantasia,
      birthDate,
      address,
      zipCode,
      city,
      state,
      cart,
      paymentMethod,
      splitMode,
      splitAmounts,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
  }, [
    docType,
    docInput,
    name,
    phone,
    email,
    cnpjRazaoSocial,
    cnpjNomeFantasia,
    birthDate,
    address,
    zipCode,
    city,
    state,
    cart,
    paymentMethod,
    splitMode,
    splitAmounts,
  ]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.code ?? "").toLowerCase().includes(q)
    );
  }, [activeProducts, productSearch]);

  const docDigits = onlyDigits(docInput);

  useEffect(() => {
    const expectedLen = docType === "cpf" ? 11 : 14;
    setExistingCustomerId(null);
    if (docDigits.length !== expectedLen) {
      setLookupState("idle");
      return;
    }
    const valid = docType === "cpf" ? isValidCpf(docDigits) : isValidCnpj(docDigits);
    if (!valid) {
      setLookupState("invalid");
      return;
    }
    let cancelled = false;
    setLookupState("checking");
    (async () => {
      const { data: existing } = await supabase.from("customers").select("*").eq("doc_number", docDigits).maybeSingle();
      if (cancelled) return;
      if (existing) {
        setName(existing.name);
        setPhone(existing.phone ?? "");
        setEmail(existing.email ?? "");
        setCnpjRazaoSocial(existing.cnpj_razao_social ?? "");
        setCnpjNomeFantasia(existing.cnpj_nome_fantasia ?? "");
        setBirthDate(existing.birth_date ?? "");
        setAddress(existing.address ?? "");
        setZipCode(existing.zip_code ?? "");
        setCity(existing.city ?? "");
        setState(existing.state ?? "");
        setExistingCustomerId(existing.id);
        setLookupState("found");
        return;
      }
      if (docType === "cnpj") {
        const info = await fetchCnpjInfo(docDigits);
        if (cancelled) return;
        if (info) {
          setCnpjRazaoSocial(info.razaoSocial);
          setCnpjNomeFantasia(info.nomeFantasia);
          setName(info.nomeFantasia || info.razaoSocial);
        }
      }
      setLookupState("new");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docDigits, docType]);

  function addToCart(productId: number) {
    const product = activeProducts.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.price, quantity: 1 }];
    });
  }

  function changeQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const splitEntries = (Object.entries(splitAmounts) as [SinglePaymentMethod, string][])
    .map(([method, raw]) => ({ method, amount: parseAmount(raw) }))
    .filter((e) => e.amount > 0);
  const splitAllocated = splitEntries.reduce((sum, e) => sum + e.amount, 0);
  const splitRemaining = Math.round((total - splitAllocated) * 100) / 100;

  function resetForm() {
    setDocInput("");
    setLookupState("idle");
    setExistingCustomerId(null);
    setName("");
    setPhone("");
    setEmail("");
    setCnpjRazaoSocial("");
    setCnpjNomeFantasia("");
    setBirthDate("");
    setAddress("");
    setZipCode("");
    setCity("");
    setState("");
    setCart([]);
    setProductSearch("");
    setPaymentMethod(null);
    setSplitMode(false);
    setSplitAmounts({ dinheiro: "", cartao: "", pix: "" });
    sessionStorage.removeItem(DRAFT_KEY);
  }

  async function finalizeOrder() {
    if (lookupState === "idle" || lookupState === "checking") {
      showToast(`Digite um ${docType.toUpperCase()} válido.`);
      return;
    }
    if (lookupState === "invalid") {
      showToast(`${docType.toUpperCase()} inválido — confira os números.`);
      return;
    }
    if (!name.trim()) {
      showToast("Digite o nome do cliente.");
      return;
    }
    if (cart.length === 0) {
      showToast("Adicione pelo menos um produto ao carrinho.");
      return;
    }
    if (!splitMode && !paymentMethod) {
      showToast("Escolha a forma de pagamento.");
      return;
    }
    if (splitMode) {
      if (splitEntries.length === 0) {
        showToast("Digite o valor de pelo menos uma forma de pagamento.");
        return;
      }
      if (splitRemaining > 0) {
        showToast(`Falta alocar ${splitRemaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
        return;
      }
      if (splitRemaining < 0) {
        showToast(`O valor alocado passou o total em ${Math.abs(splitRemaining).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
        return;
      }
    }

    setSubmitting(true);

    let customerId = existingCustomerId;
    if (!customerId) {
      const { data: created, error: customerError } = await supabase
        .from("customers")
        .insert({
          doc_type: docType,
          doc_number: docDigits,
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          cnpj_razao_social: docType === "cnpj" ? cnpjRazaoSocial || null : null,
          cnpj_nome_fantasia: docType === "cnpj" ? cnpjNomeFantasia || null : null,
          birth_date: birthDate || null,
          address: address.trim() || null,
          zip_code: onlyDigits(zipCode) || null,
          city: city.trim() || null,
          state: state.trim() || null,
        })
        .select()
        .single();
      if (customerError || !created) {
        setSubmitting(false);
        showToast("Erro ao salvar cliente: " + (customerError?.message ?? "desconhecido"));
        return;
      }
      customerId = created.id;
    }

    const hasCash = splitMode ? splitEntries.some((e) => e.method === "dinheiro") : paymentMethod === "dinheiro";
    const isPago = !hasCash;
    const finalPaymentMethod: PaymentMethod = splitMode ? "misto" : (paymentMethod as PaymentMethod);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        seller_id: profile?.id ?? null,
        seller_name: profile?.name ?? null,
        payment_method: finalPaymentMethod,
        status: isPago ? "pago" : "aguardando_pagamento",
        total,
        paid_by: isPago ? profile?.id ?? null : null,
        paid_by_name: isPago ? profile?.name ?? null : null,
        paid_at: isPago ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (orderError || !order) {
      setSubmitting(false);
      showToast("Erro ao criar pedido: " + (orderError?.message ?? "desconhecido"));
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      cart.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        unit_price: i.unitPrice,
        quantity: i.quantity,
      }))
    );
    if (itemsError) {
      setSubmitting(false);
      showToast("Erro ao salvar itens: " + itemsError.message);
      return;
    }

    if (splitMode) {
      const { error: paymentsError } = await supabase.from("order_payments").insert(
        splitEntries.map((e) => ({ order_id: order.id, method: e.method, amount: e.amount }))
      );
      if (paymentsError) {
        setSubmitting(false);
        showToast("Erro ao salvar formas de pagamento: " + paymentsError.message);
        return;
      }
    }

    setSubmitting(false);
    if (isPago) {
      printReceipt({
        order: {
          id: order.id,
          created_at: order.created_at,
          total,
          payment_method: finalPaymentMethod,
          seller_name: profile?.name ?? null,
          cash_received: null,
          cash_change: null,
        },
        customerName: name.trim() || null,
        items: cart.map((i) => ({ product_name: i.name, quantity: i.quantity, unit_price: i.unitPrice })),
        payments: splitMode ? splitEntries : [],
      });
    }
    showToast(isPago ? "Pedido enviado pro estoque separar." : "Pedido enviado pro caixa confirmar o dinheiro.");
    resetForm();
    navigate("/comercial/historico");
  }

  return (
    <>
      <PageHeader
        icon={ShoppingCart}
        tone="clay"
        title="Venda"
        subtitle="Cadastre o cliente, monte o carrinho e escolha a forma de pagamento — sem ficha de papel."
      />

      <Card>
        <CardTitle>Cliente</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={docType === "cpf" ? undefined : "outline"}
            size="sm"
            className="w-auto"
            onClick={() => {
              setDocType("cpf");
              setDocInput("");
            }}
          >
            <User className="h-3.5 w-3.5" />
            CPF
          </Button>
          <Button
            variant={docType === "cnpj" ? undefined : "outline"}
            size="sm"
            className="w-auto"
            onClick={() => {
              setDocType("cnpj");
              setDocInput("");
            }}
          >
            <Building2 className="h-3.5 w-3.5" />
            CNPJ
          </Button>
        </div>

        <FieldLabel>{docType === "cpf" ? "CPF" : "CNPJ"}</FieldLabel>
        <Input
          value={formatCpfCnpj(docInput)}
          onChange={(e) => setDocInput(e.target.value)}
          placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
          inputMode="numeric"
        />
        {lookupState === "checking" && <div className="mt-1 text-[0.76rem] text-ink-soft">Consultando...</div>}
        {lookupState === "invalid" && (
          <div className="mt-1 text-[0.76rem] font-semibold text-brick">
            {docType === "cpf" ? "CPF" : "CNPJ"} inválido — confere os números.
          </div>
        )}
        {lookupState === "found" && (
          <div className="mt-1 text-[0.76rem] font-semibold text-moss-deep">Cliente já cadastrado — dados preenchidos.</div>
        )}
        {lookupState === "new" && docType === "cnpj" && cnpjRazaoSocial && (
          <div className="mt-1 text-[0.76rem] text-ink-soft">Razão social encontrada — confira o nome abaixo.</div>
        )}

        {(lookupState === "found" || lookupState === "new") && (
          <>
            <FieldLabel>Nome{docType === "cnpj" ? " / Razão social" : ""}</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Telefone (opcional)</FieldLabel>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <FieldLabel>E-mail (opcional)</FieldLabel>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Data de nascimento (opcional)</FieldLabel>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div>
                <FieldLabel>CEP (opcional)</FieldLabel>
                <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000" inputMode="numeric" />
              </div>
            </div>
            <FieldLabel>Endereço (opcional)</FieldLabel>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Cidade (opcional)</FieldLabel>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
              </div>
              <div>
                <FieldLabel>Estado (opcional)</FieldLabel>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Produtos</CardTitle>
        {activeProducts.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Nenhum produto cadastrado" subtitle="Peça pro admin cadastrar em Produtos." />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nome ou código..."
                className="pl-9"
              />
            </div>
            {visibleProducts.length === 0 ? (
              <EmptyState icon={Search} title="Nenhum produto encontrado" subtitle="Tenta buscar por outro nome ou código." />
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {visibleProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p.id)}
                    className="rounded-xl border border-line bg-surface p-3 text-left hover:border-sage hover:bg-sage-tint"
                  >
                    <div className="truncate text-[0.82rem] font-semibold text-ink">{p.name}</div>
                    <div className="text-[0.76rem] text-ink-soft">
                      {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {p.code && ` · ${p.code}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Carrinho</CardTitle>
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Carrinho vazio" subtitle="Toque num produto acima pra adicionar." />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {cart.map((i) => (
              <ListRow
                key={i.productId}
                title={i.name}
                subtitle={`${i.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} cada`}
                trailing={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(i.productId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-[0.85rem] font-bold tabular-nums">{i.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(i.productId, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => removeFromCart(i.productId)} className="text-ink-soft hover:text-brick">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-[0.82rem] font-semibold text-ink-soft">Total</span>
          <span className="text-[1.3rem] font-black tabular-nums text-ink">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Forma de pagamento</CardTitle>
          <button
            type="button"
            onClick={() => setSplitMode((v) => !v)}
            className={
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.74rem] font-semibold " +
              (splitMode ? "bg-sage-tint text-moss-deep" : "text-ink-soft hover:bg-linen")
            }
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
            Dividir pagamento
          </button>
        </div>

        {!splitMode ? (
          <>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 " +
                    (paymentMethod === opt.value ? "border-moss bg-sage-tint text-moss-deep" : "border-line text-ink-soft")
                  }
                >
                  <opt.icon className="h-5 w-5" />
                  <span className="text-[0.78rem] font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
            {paymentMethod === "dinheiro" && (
              <div className="mt-2 text-[0.76rem] text-ink-soft">
                Cliente vai até o Caixa pagar — o pedido fica "aguardando pagamento" até lá.
              </div>
            )}
            {(paymentMethod === "cartao" || paymentMethod === "pix") && (
              <div className="mt-2 text-[0.76rem] text-ink-soft">
                Passe a maquininha na bancada antes de confirmar — o pedido já vai direto pro estoque separar.
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mt-1 flex flex-col gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2 rounded-xl border border-line p-2">
                  <opt.icon className="h-4 w-4 shrink-0 text-ink-soft" />
                  <span className="w-16 shrink-0 text-[0.8rem] font-semibold text-ink">{opt.label}</span>
                  <Input
                    value={splitAmounts[opt.value]}
                    onChange={(e) =>
                      setSplitAmounts((prev) => ({ ...prev, [opt.value]: e.target.value.replace(/[^0-9,.]/g, "") }))
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="py-1.5 text-right"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-[0.78rem] font-semibold">
              {splitRemaining > 0 && (
                <span className="text-clay">
                  Falta alocar {splitRemaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              )}
              {splitRemaining < 0 && (
                <span className="text-brick">
                  Passou {Math.abs(splitRemaining).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} do total
                </span>
              )}
              {splitRemaining === 0 && splitEntries.length > 0 && (
                <span className="text-moss-deep">Valores batem com o total ✓</span>
              )}
            </div>
            {splitEntries.some((e) => e.method === "dinheiro") && (
              <div className="mt-2 text-[0.76rem] text-ink-soft">
                Tem parte em dinheiro — o pedido fica "aguardando pagamento" até o Caixa confirmar esse valor.
              </div>
            )}
          </>
        )}

        <Button className="mt-4" loading={submitting} onClick={finalizeOrder}>
          <CheckCircle2 className="h-4 w-4" />
          Finalizar pedido {total > 0 && `· ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
        </Button>
      </Card>
    </>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  Alert,
  Announcement,
  CashMovement,
  CashSession,
  Checkin,
  Customer,
  LunchQueueEntry,
  LunchSession,
  Order,
  OrderItem,
  OrderPayment,
  Product,
  Session,
  SessionFeedback,
  Shift,
  Staff,
} from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";

interface LiveData {
  connected: boolean | null;
  loading: boolean;
  checkins: Checkin[];
  staff: Staff[];
  sessions: Session[];
  shifts: Shift[];
  alerts: Alert[];
  announcements: Announcement[];
  feedback: SessionFeedback[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  orderPayments: OrderPayment[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  lunchQueue: LunchQueueEntry[];
  lunchSessions: LunchSession[];
  /** Aplica a mudança na hora, sem esperar o realtime/poll — usado depois
   *  de um update no banco pra a tela reagir instantaneamente (ex.: Caixa
   *  confirmando pagamento ou marcando entregue). O poll de 5s corrige
   *  sozinho se o valor otimista divergir do banco por algum motivo. */
  patchOrder: (id: number, patch: Partial<Order>) => void;
  /** Mesma ideia do `patchOrder`, pra estoque — usado ao ajustar a
   *  quantidade manualmente ou logo após entregar um pedido. */
  patchProduct: (id: number, patch: Partial<Product>) => void;
  /** Mesma ideia do `patchOrder`, pro Cadastro marcar um cliente como
   *  lançado sem esperar o poll. */
  patchCustomer: (id: number, patch: Partial<Customer>) => void;
}

const LiveDataContext = createContext<LiveData | null>(null);

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error("useLiveData must be used inside <LiveDataProvider>");
  return ctx;
}

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  // Sinal estável — NÃO usar `profile` em si como dependência do efeito
  // abaixo. `onAuthStateChange` recria o objeto `profile` a cada evento
  // (refresh de token, aba voltando o foco), não só quando o usuário
  // realmente muda. Se o efeito dependesse do objeto, ele derrubava e
  // recriava o canal de tempo real toda hora — e um INSERT/UPDATE que
  // chegasse bem nessa janela de troca de canal se perdia (foi exatamente
  // isso que causava produto cadastrado não aparecer em Venda sem F5).
  const hasProfile = !!profile;
  // Cada departamento só busca/assina os dados do próprio lado — o RLS do
  // banco já trava o Comercial por department, mas nem por isso o cliente
  // da Técnica precisa baixar pedido/cliente de ninguém pra memória (e
  // vice-versa). `announcements` é a única tabela genuinamente cruzada.
  const isTecnica = profile?.department === "tecnica";
  const isComercial = profile?.department === "comercial";
  const isCaixa = profile?.department === "caixa";
  const isCadastro = profile?.department === "cadastro";
  // Caixa também precisa de customers/orders/order_items (confirmar
  // pagamento, ver o que separar) e de products (aba de estoque).
  const needsOrdersData = isComercial || isCaixa;
  const needsProducts = isComercial || isCaixa;
  // Cadastro só precisa de customers (nem orders nem products) — pra
  // acompanhar em tempo real quem o Comercial cadastrou na venda.
  const needsCustomers = needsOrdersData || isCadastro;
  // Almoço é gerido por admin comercial OU admin técnica — staff/fila/
  // sessão da copa precisam estar disponíveis pros dois lados (o nível
  // staff/admin é filtrado na própria rota, não aqui).
  const needsLunch = isTecnica || isComercial;

  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedback, setFeedback] = useState<SessionFeedback[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [lunchQueue, setLunchQueue] = useState<LunchQueueEntry[]>([]);
  const [lunchSessions, setLunchSessions] = useState<LunchSession[]>([]);

  useEffect(() => {
    if (!hasProfile) return;
    let cancelled = false;

    async function loadTecnica() {
      const [ci, al, se, sh, fb] = await Promise.all([
        supabase.from("checkins").select("*"),
        supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("sessions").select("*"),
        supabase.from("shifts").select("*"),
        supabase.from("session_feedback").select("*"),
      ]);
      if (cancelled) return;
      setCheckins(ci.data ?? []);
      setAlerts(al.data ?? []);
      setSessions(se.data ?? []);
      setShifts(sh.data ?? []);
      setFeedback(fb.data ?? []);
      supabase.rpc("expire_noshows");
    }

    async function loadLunch() {
      const [st, lq, ls] = await Promise.all([
        supabase.from("staff").select("*").order("id"),
        supabase.from("lunch_queue").select("*").order("joined_at"),
        supabase.from("lunch_sessions").select("*").order("start_time", { ascending: false }),
      ]);
      if (cancelled) return;
      setStaff(st.data ?? []);
      setLunchQueue(lq.data ?? []);
      setLunchSessions(ls.data ?? []);
    }

    async function loadProducts() {
      const { data } = await supabase.from("products").select("*").order("name");
      if (!cancelled) setProducts(data ?? []);
    }

    async function loadOrdersData() {
      const [or, oi, op, cs, cm] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*"),
        supabase.from("order_payments").select("*"),
        supabase.from("cash_sessions").select("*").order("opened_at", { ascending: false }),
        supabase.from("cash_movements").select("*"),
      ]);
      if (cancelled) return;
      setOrders(or.data ?? []);
      setOrderItems(oi.data ?? []);
      setOrderPayments(op.data ?? []);
      setCashSessions(cs.data ?? []);
      setCashMovements(cm.data ?? []);
    }

    async function loadCustomers() {
      const { data } = await supabase.from("customers").select("*");
      if (!cancelled) setCustomers(data ?? []);
    }

    async function loadAll() {
      const { data: an } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setAnnouncements(an ?? []);
      await Promise.all([
        isTecnica ? loadTecnica() : null,
        needsLunch ? loadLunch() : null,
        needsProducts ? loadProducts() : null,
        needsCustomers ? loadCustomers() : null,
        needsOrdersData ? loadOrdersData() : null,
      ]);
      if (!cancelled) setLoading(false);
    }

    async function refetch<T>(table: string, setter: (rows: T[]) => void, order?: string) {
      let query = supabase.from(table).select("*");
      if (order) query = query.order(order);
      const { data } = await query;
      if (!cancelled) setter((data as T[]) ?? []);
    }

    loadAll().then(() => {
      if (cancelled) return;
      // Nome único por montagem — não usar uma string fixa aqui. Em dev, o
      // StrictMode monta/desmonta/remonta os efeitos de propósito; se dois
      // canais disputarem o MESMO nome de tópico nessa janela de troca, o
      // servidor pode deixar o canal marcado como "joined" no cliente sem
      // realmente entregar nenhum evento (foi exatamente essa a causa real
      // do produto cadastrado não aparecer em Venda sem F5).
      const channel = supabase.channel(`sistema-live-${crypto.randomUUID()}`);

      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, async () => {
        const { data } = await supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
        if (!cancelled) setAnnouncements(data ?? []);
      });

      if (isTecnica) {
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, () =>
            refetch<Checkin>("checkins", setCheckins)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, async () => {
            const { data } = await supabase
              .from("alerts")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(30);
            if (!cancelled) setAlerts(data ?? []);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () =>
            refetch<Session>("sessions", setSessions)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () =>
            refetch<Shift>("shifts", setShifts)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "session_feedback" }, () =>
            refetch<SessionFeedback>("session_feedback", setFeedback)
          );
      }

      if (needsLunch) {
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () =>
            refetch<Staff>("staff", setStaff, "id")
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "lunch_queue" }, () =>
            refetch<LunchQueueEntry>("lunch_queue", setLunchQueue, "joined_at")
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "lunch_sessions" }, async () => {
            const { data } = await supabase.from("lunch_sessions").select("*").order("start_time", { ascending: false });
            if (!cancelled) setLunchSessions(data ?? []);
          });
      }

      if (needsProducts) {
        channel.on("postgres_changes", { event: "*", schema: "public", table: "products" }, () =>
          refetch<Product>("products", setProducts, "name")
        );
      }

      if (needsCustomers) {
        channel.on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () =>
          refetch<Customer>("customers", setCustomers)
        );
      }

      if (needsOrdersData) {
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
            refetch<Order>("orders", setOrders)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () =>
            refetch<OrderItem>("order_items", setOrderItems)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "order_payments" }, () =>
            refetch<OrderPayment>("order_payments", setOrderPayments)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "cash_sessions" }, () =>
            refetch<CashSession>("cash_sessions", setCashSessions)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, () =>
            refetch<CashMovement>("cash_movements", setCashMovements)
          );
      }

      channel.subscribe((status) => {
        if (!cancelled) setConnected(status === "SUBSCRIBED");
      });
    });

    return () => {
      cancelled = true;
      supabase.removeAllChannels();
    };
  }, [hasProfile, isTecnica, needsLunch, needsProducts, needsCustomers, needsOrdersData]);

  // A cada 20s, expira check-ins não confirmados (no-show) — só faz
  // sentido pro lado Técnica. Roda no cliente pra não depender de um
  // cron separado só pra isso.
  useEffect(() => {
    if (!isTecnica) return;
    const id = setInterval(() => {
      supabase.rpc("expire_noshows");
    }, 20000);
    return () => clearInterval(id);
  }, [isTecnica]);

  // Sincronização periódica de segurança — o tempo real do Supabase pode,
  // em raras janelas (reconexão, canal duplicado etc.), deixar de entregar
  // algum evento sem avisar erro nenhum. Em vez de depender 100% dele,
  // a cada 5s a tela também busca os dados de novo por conta própria —
  // pior caso, uma mudança demora até 5s pra aparecer, nunca precisa de F5.
  useEffect(() => {
    if (!hasProfile) return;
    let stopped = false;

    async function resync() {
      const tasks: PromiseLike<unknown>[] = [
        supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data }) => {
            if (!stopped) setAnnouncements(data ?? []);
          }),
      ];
      if (isTecnica) {
        tasks.push(
          supabase
            .from("checkins")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setCheckins(data ?? []);
            }),
          supabase
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30)
            .then(({ data }) => {
              if (!stopped) setAlerts(data ?? []);
            }),
          supabase
            .from("sessions")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setSessions(data ?? []);
            }),
          supabase
            .from("shifts")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setShifts(data ?? []);
            }),
          supabase
            .from("session_feedback")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setFeedback(data ?? []);
            })
        );
      }
      if (needsLunch) {
        tasks.push(
          supabase
            .from("staff")
            .select("*")
            .order("id")
            .then(({ data }) => {
              if (!stopped) setStaff(data ?? []);
            }),
          supabase
            .from("lunch_queue")
            .select("*")
            .order("joined_at")
            .then(({ data }) => {
              if (!stopped) setLunchQueue(data ?? []);
            }),
          supabase
            .from("lunch_sessions")
            .select("*")
            .order("start_time", { ascending: false })
            .then(({ data }) => {
              if (!stopped) setLunchSessions(data ?? []);
            })
        );
      }
      if (needsProducts) {
        tasks.push(
          supabase
            .from("products")
            .select("*")
            .order("name")
            .then(({ data }) => {
              if (!stopped) setProducts(data ?? []);
            })
        );
      }
      if (needsCustomers) {
        tasks.push(
          supabase
            .from("customers")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setCustomers(data ?? []);
            })
        );
      }
      if (needsOrdersData) {
        tasks.push(
          supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              if (!stopped) setOrders(data ?? []);
            }),
          supabase
            .from("order_items")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setOrderItems(data ?? []);
            }),
          supabase
            .from("order_payments")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setOrderPayments(data ?? []);
            }),
          supabase
            .from("cash_sessions")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setCashSessions(data ?? []);
            }),
          supabase
            .from("cash_movements")
            .select("*")
            .then(({ data }) => {
              if (!stopped) setCashMovements(data ?? []);
            })
        );
      }
      await Promise.all(tasks);
    }

    const id = setInterval(resync, 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [hasProfile, isTecnica, needsLunch, needsProducts, needsCustomers, needsOrdersData]);

  function patchOrder(id: number, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function patchCustomer(id: number, patch: Partial<Customer>) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function patchProduct(id: number, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <LiveDataContext.Provider
      value={{
        connected,
        loading,
        checkins,
        staff,
        sessions,
        shifts,
        alerts,
        announcements,
        feedback,
        products,
        customers,
        orders,
        orderItems,
        orderPayments,
        cashSessions,
        cashMovements,
        lunchQueue,
        lunchSessions,
        patchOrder,
        patchProduct,
        patchCustomer,
      }}
    >
      {children}
    </LiveDataContext.Provider>
  );
}

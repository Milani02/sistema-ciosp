export type Activity = "handson" | "palestra";
export type CheckinStatus = "confirmed" | "checked_in" | "waitlisted" | "no_show" | "cancelled";

/** Which side of the booth a login account belongs to. "caixa" is a
 *  narrow, single-purpose login (confirm payment + hand out product)
 *  separate from the regular comercial staff/admin accounts. */
export type Department = "comercial" | "tecnica" | "caixa" | "cadastro";
/** Within a department: regular staff, or the admin who also plans/oversees it. */
export type AccessLevel = "staff" | "admin";

export interface Session {
  id: number;
  activity: Activity;
  title: string;
  session_time: string;
  capacity: number;
}

export interface Checkin {
  id: number;
  session_id: number;
  activity: Activity;
  visitor_name: string;
  cro: string | null;
  especialidade: string | null;
  telefone: string | null;
  email: string | null;
  status: CheckinStatus;
  qr_token: string;
  created_at: string;
  checked_in_at: string | null;
  redeemed: boolean;
  wristband: string | null;
  sessions?: Session;
}

/** Booth roster used for shift tracking — separate from the login
 *  account in `profiles`. A técnico's login identity doesn't need to match
 *  a row here. */
export type LunchStatus = "pending" | "queued" | "eating" | "done";

export interface Staff {
  id: number;
  name: string;
  team: string;
  status: LunchStatus;
}

export interface LunchQueueEntry {
  id: number;
  staff_id: number;
  joined_at: string;
}

export interface LunchSession {
  id: number;
  member_ids: number[];
  member_names: string;
  start_time: string;
  end_time: string | null;
}

export interface Shift {
  id: number;
  staff_id: number;
  area: Activity;
  day: string;
  start_time: string;
  end_time: string;
}

export interface Alert {
  id: number;
  text: string;
  created_at: string;
}

/** One row per manual status change made through `staff_set_checkin_status` —
 *  who did it, from what to what, and when. */
export interface CheckinAudit {
  id: number;
  checkin_id: number;
  actor_id: string | null;
  actor_name: string;
  from_status: CheckinStatus | null;
  to_status: CheckinStatus;
  created_at: string;
}

/** Quick 1-5 tap rating left for a session, no visitor identity attached. */
export interface SessionFeedback {
  id: number;
  session_id: number;
  rating: number;
  created_at: string;
}

/** Broadcast comunicado from an admin to the whole team. One-way — staff
 *  can read but not write. */
export interface Announcement {
  id: number;
  text: string;
  author_name: string;
  target: Department | "ambas";
  created_at: string;
}

/** Login identity, one row per Supabase Auth account. Department decides
 *  which set of screens shows up; level decides staff vs. admin within it. */
export interface Profile {
  id: string;
  name: string;
  department: Department;
  level: AccessLevel;
}

export type DocType = "cpf" | "cnpj";
export type SinglePaymentMethod = "dinheiro" | "cartao" | "pix";
export type PaymentMethod = SinglePaymentMethod | "misto";
export type OrderStatus = "aguardando_pagamento" | "pago" | "entregue" | "cancelado";

export interface Product {
  id: number;
  name: string;
  code: string | null;
  price: number;
  active: boolean;
  stock: number;
  created_at: string;
}

export interface Customer {
  id: number;
  doc_type: DocType;
  doc_number: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj_razao_social: string | null;
  cnpj_nome_fantasia: string | null;
  birth_date: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  lancado: boolean;
  lancado_at: string | null;
  lancado_by: string | null;
  lancado_by_name: string | null;
}

export interface Order {
  id: number;
  customer_id: number | null;
  seller_id: string | null;
  seller_name: string | null;
  payment_method: PaymentMethod;
  status: OrderStatus;
  total: number;
  paid_by: string | null;
  paid_by_name: string | null;
  paid_at: string | null;
  delivered_by: string | null;
  delivered_by_name: string | null;
  delivered_at: string | null;
  cash_session_id: number | null;
  cash_received: number | null;
  cash_change: number | null;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface OrderPayment {
  id: number;
  order_id: number;
  method: SinglePaymentMethod;
  amount: number;
}

export interface StockAdjustment {
  id: number;
  product_id: number;
  delta: number;
  note: string;
  staff_id: string | null;
  staff_name: string | null;
  created_at: string;
}

export type CashSessionStatus = "aberto" | "fechado";

export interface CashSession {
  id: number;
  opened_by: string | null;
  opened_by_name: string | null;
  opening_balance: number;
  opened_at: string;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  closing_counted: number | null;
  status: CashSessionStatus;
}

export type CashMovementType = "reforco" | "sangria";

export interface CashMovement {
  id: number;
  session_id: number;
  type: CashMovementType;
  amount: number;
  note: string;
  staff_id: string | null;
  staff_name: string | null;
  created_at: string;
}

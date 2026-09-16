-- ============================================================
-- Migração: sessão de caixa (abertura/fechamento), sangria/reforço
-- e troco.
--
-- 1) cash_sessions: cada dia (ou turno) o caixa "abre" com um saldo
--    inicial (o troco em espécie que ela separou), e "fecha" no fim
--    informando quanto contou fisicamente na gaveta. Só pode existir
--    UMA sessão com status='aberto' por vez (índice único parcial).
-- 2) cash_movements: reforço (dinheiro entrando na gaveta fora de
--    venda, ex: repor troco) ou sangria (dinheiro saindo, ex: levar
--    pro cofre) — cada um com motivo obrigatório.
-- 3) orders ganha cash_session_id (a qual sessão aquele pagamento em
--    dinheiro pertence — só preenchido quando o Caixa confirma
--    dinheiro/misto), cash_received (quanto o cliente entregou em
--    espécie) e cash_change (troco devolvido).
--
-- Roda isso no SQL Editor do Supabase (depois de
-- ajustes-estoque.sql).
-- ============================================================

create table if not exists cash_sessions (
  id serial primary key,
  opened_by uuid references profiles(id),
  opened_by_name text,
  opening_balance numeric(10,2) not null default 0,
  opened_at timestamptz not null default now(),
  closed_by uuid references profiles(id),
  closed_by_name text,
  closed_at timestamptz,
  closing_counted numeric(10,2),
  status text not null default 'aberto' check (status in ('aberto', 'fechado'))
);

-- Só uma sessão aberta por vez.
create unique index if not exists cash_sessions_only_one_open
  on cash_sessions ((status)) where status = 'aberto';

create table if not exists cash_movements (
  id serial primary key,
  session_id int not null references cash_sessions(id) on delete cascade,
  type text not null check (type in ('reforco', 'sangria')),
  amount numeric(10,2) not null check (amount > 0),
  note text not null,
  staff_id uuid references profiles(id),
  staff_name text,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists cash_session_id int references cash_sessions(id);
alter table orders add column if not exists cash_received numeric(10,2);
alter table orders add column if not exists cash_change numeric(10,2);

alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;

create policy "comercial e caixa leem sessoes" on cash_sessions for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial e caixa abrem sessoes" on cash_sessions for insert
  with check (has_access('comercial', true) or has_access('caixa'));
create policy "comercial e caixa fecham sessoes" on cash_sessions for update
  using (has_access('comercial', true) or has_access('caixa'))
  with check (has_access('comercial', true) or has_access('caixa'));

create policy "comercial e caixa leem movimentos" on cash_movements for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial e caixa lancam movimentos" on cash_movements for insert
  with check (has_access('comercial', true) or has_access('caixa'));

grant select, insert, update on cash_sessions to authenticated;
grant select, insert on cash_movements to authenticated;
alter publication supabase_realtime add table cash_sessions, cash_movements;

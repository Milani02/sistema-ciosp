-- ============================================================
-- Migração: "lançado" passa a ser por PEDIDO, não por CLIENTE.
--
-- Motivo: quando um cliente que já tinha cadastro (CPF/CNPJ já
-- existente) fazia uma nova compra, a Venda reaproveitava o
-- customer_id já existente e não criava linha nova em `customers`
-- — então a tela de Cadastro nunca ficava sabendo dessa segunda
-- venda. Agora cada pedido (`orders`) tem seu próprio controle de
-- lançamento, e a tela de Cadastro passa a listar PEDIDOS (com os
-- dados do cliente já preenchidos), marcando com um selo "já
-- cadastrado" quando o pedido reaproveitou um cliente existente.
--
-- Roda isso no SQL Editor do Supabase (depois de
-- departamento-cadastro.sql).
-- ============================================================

alter table orders add column if not exists is_novo_cliente boolean not null default true;
alter table orders add column if not exists lancado boolean not null default false;
alter table orders add column if not exists lancado_at timestamptz;
alter table orders add column if not exists lancado_by uuid references profiles(id);
alter table orders add column if not exists lancado_by_name text;

-- Backfill: marca como "não é cliente novo" todo pedido que não é
-- o primeiro pedido do respectivo cliente (proxy razoável já que o
-- campo não existia antes de hoje).
update orders o set is_novo_cliente = false
where customer_id is not null
  and exists (
    select 1 from orders o2
    where o2.customer_id = o.customer_id
      and o2.created_at < o.created_at
  );

-- Backfill: transporta o "lançado" que hoje mora em customers pro
-- pedido mais antigo (= o cadastro original) daquele cliente.
update orders o set
  lancado = c.lancado,
  lancado_at = c.lancado_at,
  lancado_by = c.lancado_by,
  lancado_by_name = c.lancado_by_name
from customers c
where o.customer_id = c.id
  and o.is_novo_cliente = true
  and c.lancado = true;

-- ---------- orders: cadastro ganha select + update (só lançamento) ----------
drop policy if exists "comercial e caixa leem pedidos" on orders;
create policy "comercial caixa e cadastro leem pedidos" on orders for select
  using (has_access('comercial') or has_access('caixa') or has_access('cadastro'));

drop policy if exists "admin comercial e caixa atualizam pedidos" on orders;
create policy "admin comercial caixa e cadastro atualizam pedidos" on orders for update
  using (has_access('comercial', true) or has_access('caixa') or has_access('cadastro'))
  with check (has_access('comercial', true) or has_access('caixa') or has_access('cadastro'));

-- ---------- customers: cadastro perde o update, o controle agora é em orders ----------
drop policy if exists "cadastro marca clientes como lancados" on customers;

alter table customers drop column if exists lancado;
alter table customers drop column if exists lancado_at;
alter table customers drop column if exists lancado_by;
alter table customers drop column if exists lancado_by_name;

-- ============================================================
-- Migração: novo departamento "cadastro" — login exclusivo pra
-- quem fica lançando no sistema interno os clientes que o
-- Comercial cadastra na hora da venda (CPF/CNPJ, nome, contato,
-- endereço). Vê tudo em tempo real e marca cada cliente como
-- "lançado" depois de repassar pro sistema interno.
--
-- Não enxerga produtos, pedidos nem caixa — só a tabela customers,
-- em modo leitura + um único campo de controle (lancado).
--
-- Roda isso no SQL Editor do Supabase (depois de
-- departamento-caixa.sql).
-- ============================================================

alter table profiles drop constraint if exists profiles_department_check;
alter table profiles add constraint profiles_department_check
  check (department in ('tecnica', 'comercial', 'caixa', 'cadastro'));

alter table customers add column if not exists lancado boolean not null default false;
alter table customers add column if not exists lancado_at timestamptz;
alter table customers add column if not exists lancado_by uuid references profiles(id);
alter table customers add column if not exists lancado_by_name text;

-- ---------- customers ----------
drop policy if exists "comercial e caixa leem clientes" on customers;
drop policy if exists "comercial edita clientes" on customers;

create policy "comercial caixa e cadastro leem clientes" on customers for select
  using (has_access('comercial') or has_access('caixa') or has_access('cadastro'));
create policy "comercial edita clientes" on customers for update
  using (has_access('comercial')) with check (has_access('comercial'));
create policy "cadastro marca clientes como lancados" on customers for update
  using (has_access('cadastro')) with check (has_access('cadastro'));

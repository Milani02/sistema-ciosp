-- ============================================================
-- Migração: observação obrigatória ao remover estoque manualmente.
--
-- Toda vez que alguém tira uma quantidade do estoque na mão (não é a
-- baixa automática de `deliver_order`), fica registrado aqui o motivo
-- (quebrado, perdido, contagem errada etc.) junto de quem fez e quando.
-- Não existe uma tela pra ver esse histórico ainda — é só o registro
-- no banco por enquanto, pra auditoria futura se precisar.
--
-- Roda isso no SQL Editor do Supabase (depois de venda-avancada.sql).
-- ============================================================

create table if not exists stock_adjustments (
  id serial primary key,
  product_id int not null references products(id) on delete cascade,
  delta int not null check (delta < 0),
  note text not null,
  staff_id uuid references profiles(id),
  staff_name text,
  created_at timestamptz not null default now()
);

alter table stock_adjustments enable row level security;

create policy "comercial e caixa leem ajustes de estoque" on stock_adjustments for select
  using (has_access('comercial', true) or has_access('caixa'));
create policy "comercial e caixa registram ajustes de estoque" on stock_adjustments for insert
  with check (has_access('comercial', true) or has_access('caixa'));

grant select, insert on stock_adjustments to authenticated;
alter publication supabase_realtime add table stock_adjustments;

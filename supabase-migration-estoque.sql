-- ============================================================
-- Migração: controle de estoque por produto.
--
-- Adiciona `products.stock` (quantidade física disponível). O caixa
-- ganha uma aba nova ("Estoque") pra ver e ajustar essa quantidade
-- (reposição, contagem, correção manual) — por isso o caixa também
-- precisa passar a LER a tabela products, que antes era 100%
-- exclusiva do comercial.
--
-- A baixa automática acontece quando o pedido é marcado "Entregue":
-- a função `deliver_order` atualiza o status do pedido E desconta
-- a quantidade de cada item do pedido do estoque, tudo numa
-- transação só (evita ficar em estado inconsistente se uma das
-- duas partes falhar). Ela é security definer (mesmo motivo do
-- has_access — Realtime descarta update de RLS que dependa de
-- subconsulta em outra tabela) mas confere internamente se quem
-- chamou é admin comercial ou caixa antes de fazer qualquer coisa.
--
-- Roda isso no SQL Editor do Supabase (depois de
-- departamento-caixa.sql).
-- ============================================================

alter table products add column if not exists stock int not null default 0 check (stock >= 0);

-- ---------- products: caixa também lê e ajusta a quantidade ----------
drop policy if exists "comercial le produtos" on products;
create policy "comercial e caixa leem produtos" on products for select
  using (has_access('comercial') or has_access('caixa'));

drop policy if exists "admin comercial edita produtos" on products;
create policy "admin comercial e caixa editam produtos" on products for update
  using (has_access('comercial', true) or has_access('caixa'))
  with check (has_access('comercial', true) or has_access('caixa'));

-- insert/delete de produto (catálogo) continuam exclusivos do admin comercial —
-- não mexi nessas duas policies.

-- ---------- baixa automática de estoque ao entregar ----------
create or replace function deliver_order(p_order_id int, p_staff_id uuid, p_staff_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_access('comercial', true) or has_access('caixa')) then
    raise exception 'not authorized';
  end if;

  update orders
  set status = 'entregue',
      delivered_by = p_staff_id,
      delivered_by_name = p_staff_name,
      delivered_at = now()
  where id = p_order_id and status = 'pago';

  if not found then
    raise exception 'pedido % não está pago ou não existe', p_order_id;
  end if;

  update products pr
  set stock = greatest(0, pr.stock - oi.quantity)
  from order_items oi
  where oi.order_id = p_order_id and oi.product_id = pr.id;
end;
$$;

grant execute on function deliver_order(int, uuid, text) to authenticated;

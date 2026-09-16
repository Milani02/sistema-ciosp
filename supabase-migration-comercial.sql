-- ============================================================
-- Migração: sistema de vendas do Comercial (bancada + caixa/estoque)
-- Substitui a ficha de papel. Roda isso no SQL Editor do Supabase
-- (depois da migração auth-profiles — depende de `profiles`).
-- ============================================================

-- ---------- Catálogo (cadastrado pelo admin do Comercial) ----------
create table if not exists products (
  id serial primary key,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Cliente (CPF ou CNPJ) ----------
create table if not exists customers (
  id serial primary key,
  doc_type text not null check (doc_type in ('cpf','cnpj')),
  doc_number text not null unique,
  name text not null,
  phone text,
  email text,
  -- Preenchidos automaticamente via BrasilAPI quando doc_type = 'cnpj'.
  -- Pra CPF não tem consulta pública gratuita de dado pessoal (LGPD) —
  -- fica manual, só o dígito verificador é validado no cliente.
  cnpj_razao_social text,
  cnpj_nome_fantasia text,
  created_at timestamptz not null default now()
);

-- ---------- Pedido ----------
-- Os campos *_name ficam gravados direto (não só o id) porque a política
-- de RLS de `profiles` só deixa cada um ler a própria linha — não dá pra
-- resolver "quem é o id X" depois. Cada tela já conhece o próprio nome
-- (o do usuário logado) no momento da ação, então grava direto.
create table if not exists orders (
  id serial primary key,
  customer_id int references customers(id),
  seller_id uuid references profiles(id),
  seller_name text,
  payment_method text not null check (payment_method in ('dinheiro','cartao','pix')),
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','pago','entregue','cancelado')),
  total numeric(10,2) not null default 0,
  paid_by uuid references profiles(id),
  paid_by_name text,
  paid_at timestamptz,
  delivered_by uuid references profiles(id),
  delivered_by_name text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Itens do pedido (snapshot de nome/preço no momento da venda) ----------
create table if not exists order_items (
  id serial primary key,
  order_id int not null references orders(id) on delete cascade,
  product_id int references products(id),
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

-- ============================================================
-- Segurança: diferente do resto do sistema (booth interno sem
-- dado financeiro), aqui exigimos login — sem acesso anônimo.
-- ============================================================
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "equipe autenticada" on products;
drop policy if exists "equipe autenticada" on customers;
drop policy if exists "equipe autenticada" on orders;
drop policy if exists "equipe autenticada" on order_items;

create policy "equipe autenticada" on products for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "equipe autenticada" on customers for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "equipe autenticada" on orders for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "equipe autenticada" on order_items for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete on products, customers, orders, order_items to authenticated;

-- ============================================================
-- Tempo real
-- ============================================================
alter publication supabase_realtime add table products, customers, orders, order_items;

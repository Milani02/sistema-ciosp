-- ============================================================
-- Migração: reconhecimento do número do crachá
-- Roda isso no SQL Editor do Supabase (depois do schema.sql).
-- Não apaga nada que já existe.
-- ============================================================

create table if not exists visitors (
  badge_id text primary key,
  name text not null,
  info text,
  updated_at timestamptz not null default now()
);

alter table checkins add column if not exists badge_id text references visitors(badge_id);

alter table visitors enable row level security;

drop policy if exists "acesso interno" on visitors;
create policy "acesso interno" on visitors for all using (true) with check (true);

alter publication supabase_realtime add table visitors;

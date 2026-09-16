-- ============================================================
-- Migração: comunicados (avisos de admin pra equipe, mão única).
-- Qualquer pessoa logada lê; só admin (tecnica ou comercial) escreve.
-- Quando um admin manda um comunicado, aparece um popup na tela de
-- quem está com nível "staff".
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores,
-- em especial a de auth/profiles).
-- ============================================================

create table if not exists announcements (
  id bigint generated always as identity primary key,
  text text not null check (char_length(trim(text)) > 0),
  author_name text not null,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

drop policy if exists "todo mundo le" on announcements;
create policy "todo mundo le" on announcements for select using (true);

drop policy if exists "so admin escreve" on announcements;
create policy "so admin escreve" on announcements for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.level = 'admin'
    )
  );

grant select, insert on announcements to authenticated;
grant usage on sequence announcements_id_seq to authenticated;

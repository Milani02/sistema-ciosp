-- ============================================================
-- Migração: login de verdade (e-mail + senha) via Supabase Auth,
-- com duas dimensões de acesso:
--   department: 'tecnica' (consultoria técnica) ou 'comercial'
--   level:      'staff' ou 'admin'
-- Cada pessoa vê só as telas do próprio departamento. Quem é
-- admin (dos dois departamentos) também vê a tela de Almoço,
-- que é compartilhada — a copa é uma só pro time inteiro.
-- A tela do visitante continua sem login.
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores).
-- Substitui qualquer versão anterior deste arquivo que você já tenha rodado.
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  department text not null default 'tecnica' check (department in ('tecnica','comercial')),
  level text not null default 'staff' check (level in ('staff','admin')),
  created_at timestamptz not null default now()
);

-- Se você já rodou uma versão antiga deste arquivo (com uma coluna "role"),
-- isso limpa o que não se aplica mais.
alter table profiles drop column if exists role;
alter table profiles add column if not exists department text not null default 'tecnica' check (department in ('tecnica','comercial'));
alter table profiles add column if not exists level text not null default 'staff' check (level in ('staff','admin'));

alter table profiles enable row level security;

drop policy if exists "ver o próprio perfil" on profiles;
create policy "ver o próprio perfil" on profiles for select using (auth.uid() = id);

-- ---------- Cria o perfil sozinho quando uma conta é criada ----------
-- Puxa department/level do "User Metadata" que você define ao criar o
-- usuário no painel do Supabase (Authentication > Users > Add user >
-- User Metadata), por exemplo:
--   { "name": "Carlos Mendes", "department": "comercial", "level": "admin" }
--   { "name": "Beatriz Santos", "department": "tecnica", "level": "staff" }
-- Sem metadata, cai como tecnica/staff com o nome tirado do e-mail.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, department, level)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'department', 'tecnica'),
    coalesce(new.raw_user_meta_data->>'level', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Depois de rodar este script, crie as contas da equipe em:
-- Supabase > Authentication > Users > Add user
--   - Marque "Auto Confirm User" (sem isso, teria que confirmar por e-mail)
--   - Em "User Metadata" (JSON), preencha name/department/level, ex:
--     { "name": "Carlos Mendes",   "department": "comercial", "level": "admin" }
--     { "name": "Beatriz Santos",  "department": "tecnica",   "level": "staff" }
--     { "name": "Rafael Costa",    "department": "tecnica",   "level": "admin" }
-- O perfil é criado sozinho pelo gatilho acima.
-- ============================================================

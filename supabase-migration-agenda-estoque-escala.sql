-- ============================================================
-- Migração: agenda de sessões, estoque de materiais, escala de turnos
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores).
-- Não apaga nada que já existe.
-- ============================================================

-- ---------- Agenda de sessões ----------
create table if not exists sessions (
  id serial primary key,
  activity text not null check (activity in ('handson','palestra')),
  title text not null,
  session_time timestamptz not null,
  capacity int not null default 8,
  created_at timestamptz not null default now()
);

alter table checkins add column if not exists session_id int references sessions(id);

-- ---------- Estoque de materiais ----------
create table if not exists materials (
  id serial primary key,
  name text not null,
  activity text not null default 'handson' check (activity in ('handson','palestra')),
  quantity int not null default 100,
  low_threshold int not null default 20,
  unit text not null default '%',
  usage_per_checkin int not null default 5
);

insert into materials (name, activity, quantity, low_threshold, unit, usage_per_checkin)
select * from (values
  ('Resina composta', 'handson', 100, 20, '%', 6),
  ('Ionômero de vidro', 'handson', 100, 20, '%', 4)
) as v(name, activity, quantity, low_threshold, unit, usage_per_checkin)
where not exists (select 1 from materials);

create or replace function use_material(p_material_id int, p_amount int)
returns void
language plpgsql
security definer
as $$
begin
  update materials set quantity = greatest(quantity - p_amount, 0) where id = p_material_id;
end;
$$;

create or replace function restock_material(p_material_id int)
returns void
language plpgsql
security definer
as $$
begin
  update materials set quantity = 100 where id = p_material_id;
end;
$$;

grant execute on function use_material(int, int) to anon, authenticated;
grant execute on function restock_material(int) to anon, authenticated;

-- ---------- Escala de turnos ----------
create table if not exists shifts (
  id serial primary key,
  staff_id int references staff(id) on delete cascade,
  area text not null check (area in ('handson','palestra')),
  day date not null,
  start_time text not null,
  end_time text not null
);

-- ---------- Segurança e tempo real ----------
alter table sessions enable row level security;
alter table materials enable row level security;
alter table shifts enable row level security;

drop policy if exists "acesso interno" on sessions;
drop policy if exists "acesso interno" on materials;
drop policy if exists "acesso interno" on shifts;

create policy "acesso interno" on sessions for all using (true) with check (true);
create policy "acesso interno" on materials for all using (true) with check (true);
create policy "acesso interno" on shifts for all using (true) with check (true);

alter publication supabase_realtime add table sessions, materials, shifts;

-- ============================================================
-- Migração: Almoço vira autoatendimento — cada pessoa da equipe
-- ganha login individual e aperta o próprio botão ("fui almoçar" /
-- "terminei o almoço"), sem precisar de aprovação de admin. O
-- admin (comercial/técnica) só acompanha em tempo real e pode,
-- como rede de segurança, marcar alguém como "voltou" manualmente
-- se a pessoa esquecer (celular descarregou etc.).
--
-- ATENÇÃO — muda o modelo de dados do almoço:
-- - `lunch_sessions` (par fixo de até 2 pessoas por sessão) é
--   substituída por `lunch_attendance` (uma linha por pessoa por
--   almoço) — cada um entra/sai na hora que quiser, não em dupla
--   fixa. Isso apaga o histórico de teste que tinha em
--   lunch_sessions (não tem dado real do evento ainda).
-- - `enter_lunch_queue_group` (admin escolhia 1-2 pessoas) é
--   removida — ninguém manda mais ninguém, cada um se manda sozinho.
--
-- Roda isso no SQL Editor do Supabase (depois de restaura-almoco.sql
-- e almoco-por-departamento.sql).
-- ============================================================

-- ---------- login individual ----------
alter table profiles add column if not exists staff_id int references staff(id);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, department, level, staff_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'department', 'tecnica'),
    coalesce(new.raw_user_meta_data->>'level', 'staff'),
    nullif(new.raw_user_meta_data->>'staff_id', '')::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- nova tabela: uma linha por pessoa por almoço ----------
drop table if exists lunch_sessions;

create table if not exists lunch_attendance (
  id serial primary key,
  staff_id int references staff(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table lunch_attendance enable row level security;
drop policy if exists "acesso interno" on lunch_attendance;
create policy "acesso interno" on lunch_attendance for all using (true) with check (true);

alter publication supabase_realtime add table lunch_attendance;

-- ---------- funções ----------
drop function if exists enter_lunch_queue_group(int[]);
drop function if exists return_from_lunch(int);
drop function if exists try_fill_copa();

-- Preenche quantas vagas estiverem livres na mesa (0, 1 ou 2 de uma vez),
-- puxando por ordem de chegada na fila — diferente da versão antiga, que
-- só preenchia quando as DUAS vagas estavam livres ao mesmo tempo.
create or replace function try_fill_copa_slots()
returns void
language plpgsql
security definer
as $$
declare
  open_count int;
  free_slots int;
  picked record;
begin
  select count(*) into open_count from lunch_attendance where ended_at is null;
  free_slots := 2 - open_count;
  if free_slots <= 0 then
    return;
  end if;

  for picked in
    select lq.id as queue_id, lq.staff_id
    from lunch_queue lq
    order by lq.joined_at
    limit free_slots
    for update of lq skip locked
  loop
    delete from lunch_queue where id = picked.queue_id;
    insert into lunch_attendance (staff_id) values (picked.staff_id);
    update staff set status = 'eating' where id = picked.staff_id;
  end loop;
end;
$$;

create or replace function self_enter_lunch()
returns void
language plpgsql
security definer
as $$
declare
  my_staff_id int;
  my_status text;
  open_count int;
begin
  select staff_id into my_staff_id from profiles where id = auth.uid();
  if my_staff_id is null then
    raise exception 'sua conta não está vinculada a ninguém da equipe.';
  end if;

  select status into my_status from staff where id = my_staff_id;
  if my_status is distinct from 'pending' then
    raise exception 'você já está no almoço, na fila ou já almoçou hoje.';
  end if;

  select count(*) into open_count from lunch_attendance where ended_at is null;
  if open_count < 2 then
    insert into lunch_attendance (staff_id) values (my_staff_id);
    update staff set status = 'eating' where id = my_staff_id;
  else
    insert into lunch_queue (staff_id) values (my_staff_id);
    update staff set status = 'queued' where id = my_staff_id;
  end if;
end;
$$;

create or replace function self_return_from_lunch()
returns void
language plpgsql
security definer
as $$
declare
  my_staff_id int;
begin
  select staff_id into my_staff_id from profiles where id = auth.uid();
  if my_staff_id is null then
    raise exception 'sua conta não está vinculada a ninguém da equipe.';
  end if;

  update lunch_attendance set ended_at = now() where staff_id = my_staff_id and ended_at is null;
  if not found then
    raise exception 'você não está almoçando agora.';
  end if;
  update staff set status = 'done' where id = my_staff_id;

  perform try_fill_copa_slots();
end;
$$;

-- Rede de segurança pro admin (comercial/técnica) — só usa se a pessoa
-- esqueceu de apertar "terminei" (celular descarregou etc.).
create or replace function admin_end_lunch(p_staff_id int)
returns void
language plpgsql
security definer
as $$
declare
  caller_dept text;
  caller_level text;
begin
  select department, level into caller_dept, caller_level from profiles where id = auth.uid();
  if caller_level is distinct from 'admin' or caller_dept not in ('comercial', 'tecnica') then
    raise exception 'Sem permissão.';
  end if;

  update lunch_attendance set ended_at = now() where staff_id = p_staff_id and ended_at is null;
  if not found then
    raise exception 'essa pessoa não está almoçando agora.';
  end if;
  update staff set status = 'done' where id = p_staff_id;

  perform try_fill_copa_slots();
end;
$$;

create or replace function reset_lunch_day()
returns void
language plpgsql
security definer
as $$
begin
  update staff set status = 'pending' where true;
  delete from lunch_queue where true;
  delete from lunch_attendance where true;
end;
$$;

grant execute on function try_fill_copa_slots() to anon, authenticated;
grant execute on function self_enter_lunch() to anon, authenticated;
grant execute on function self_return_from_lunch() to anon, authenticated;
grant execute on function admin_end_lunch(int) to anon, authenticated;

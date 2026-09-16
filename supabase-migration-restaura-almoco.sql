-- ============================================================
-- Migração: restaura a funcionalidade de Almoço (fila da copa),
-- que tinha sido removida por completo em remove-almoco.sql.
--
-- Mesma estrutura de antes (staff.status, lunch_queue,
-- lunch_sessions, try_fill_copa/enter_lunch_queue_group/
-- return_from_lunch/reset_lunch_day + cron de meia-noite) — só o
-- enter_lunch_queue_group (a versão que deixa o admin escolher 1
-- ou 2 pessoas de uma vez), não a versão antiga de fila individual.
--
-- Igual às outras tabelas do lado Técnica (staff, checkins,
-- sessions, shifts, alerts), fica com RLS "acesso interno" aberto
-- pra quem tá logado — o controle de quem pode ver essa tela
-- (admin comercial e admin técnica) é feito no front, na rota
-- /almoco.
--
-- Roda isso no SQL Editor do Supabase.
-- ============================================================

alter table staff add column if not exists status text not null default 'pending'
  check (status in ('pending','queued','eating','done'));

create table if not exists lunch_queue (
  id serial primary key,
  staff_id int references staff(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists lunch_sessions (
  id serial primary key,
  member_ids int[] not null,
  member_names text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz
);

create or replace function try_fill_copa()
returns void
language plpgsql
security definer
as $$
declare
  open_count int;
  picked record;
  ids int[] := '{}';
  names text[] := '{}';
begin
  select count(*) into open_count from lunch_sessions where end_time is null;
  if open_count > 0 then
    return;
  end if;

  for picked in
    select lq.id as queue_id, s.id as staff_id, s.name as staff_name
    from lunch_queue lq
    join staff s on s.id = lq.staff_id
    order by lq.joined_at
    limit 2
    for update of lq skip locked
  loop
    ids := array_append(ids, picked.staff_id);
    names := array_append(names, picked.staff_name);
    delete from lunch_queue where id = picked.queue_id;
    update staff set status = 'eating' where id = picked.staff_id;
  end loop;

  if array_length(ids,1) > 0 then
    insert into lunch_sessions (member_ids, member_names, start_time)
    values (ids, array_to_string(names, ' + '), now());
  end if;
end;
$$;

create or replace function enter_lunch_queue_group(p_staff_ids int[])
returns void
language plpgsql
security definer
as $$
declare
  sid int;
begin
  if array_length(p_staff_ids, 1) is null or array_length(p_staff_ids, 1) > 2 then
    raise exception 'Escolha 1 ou 2 pessoas por vez.';
  end if;

  foreach sid in array p_staff_ids loop
    update staff set status = 'queued' where id = sid and status = 'pending';
    if found then
      insert into lunch_queue (staff_id) values (sid);
    end if;
  end loop;

  perform try_fill_copa();
end;
$$;

create or replace function return_from_lunch(p_session_id int)
returns void
language plpgsql
security definer
as $$
declare
  sess record;
  sid int;
begin
  select * into sess from lunch_sessions where id = p_session_id and end_time is null;
  if not found then return; end if;
  update lunch_sessions set end_time = now() where id = p_session_id;
  foreach sid in array sess.member_ids loop
    update staff set status = 'done' where id = sid;
  end loop;
  perform try_fill_copa();
end;
$$;

create or replace function reset_lunch_day()
returns void
language plpgsql
security definer
as $$
begin
  -- "where true" não filtra nada, mas o Supabase bloqueia UPDATE/DELETE
  -- sem WHERE nenhum (erro "UPDATE requires a WHERE clause") mesmo
  -- quando a intenção é mesmo afetar a tabela inteira.
  update staff set status = 'pending' where true;
  delete from lunch_queue where true;
  delete from lunch_sessions where true;
end;
$$;

grant execute on function try_fill_copa() to anon, authenticated;
grant execute on function enter_lunch_queue_group(int[]) to anon, authenticated;
grant execute on function return_from_lunch(int) to anon, authenticated;
grant execute on function reset_lunch_day() to anon, authenticated;

alter table lunch_queue enable row level security;
alter table lunch_sessions enable row level security;

drop policy if exists "acesso interno" on lunch_queue;
drop policy if exists "acesso interno" on lunch_sessions;

create policy "acesso interno" on lunch_queue for all using (true) with check (true);
create policy "acesso interno" on lunch_sessions for all using (true) with check (true);

alter publication supabase_realtime add table lunch_queue, lunch_sessions;

-- Reset automático à meia-noite (precisa da extensão pg_cron —
-- Database > Extensions no painel do Supabase). Se a extensão não
-- estiver disponível no seu plano, comenta esse bloco e reseta o
-- dia manualmente pelo botão "Resetar o dia" na tela de Almoço.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'reset-almoco-meia-noite') then
    perform cron.unschedule('reset-almoco-meia-noite');
  end if;
end $$;

select cron.schedule(
  'reset-almoco-meia-noite',
  '0 3 * * *',
  $$select reset_lunch_day()$$
);

-- ============================================================
-- Sistema Consultoria Técnica — CIOSP 2027
-- Rode este script inteiro no Supabase: Project > SQL Editor > New query > Run
-- ============================================================

-- Sequência garante que dois check-ins ao mesmo tempo nunca gerem a mesma pulseira
create sequence if not exists wristband_seq start 1;

create table if not exists staff (
  id serial primary key,
  name text not null,
  team text not null check (team in ('Comercial','Técnica')),
  status text not null default 'pending' check (status in ('pending','queued','eating','done'))
);

create table if not exists checkins (
  id serial primary key,
  visitor_name text not null,
  visitor_info text,
  activity text not null check (activity in ('handson','palestra')),
  wristband text not null default ('P' || lpad(nextval('wristband_seq')::text, 3, '0')),
  redeemed boolean not null default false,
  created_at timestamptz not null default now()
);

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

create table if not exists alerts (
  id serial primary key,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists session_config (
  activity text primary key,
  session_time text
);

-- Dados iniciais (só roda se as tabelas estiverem vazias)
insert into staff (name, team)
select * from (values
  ('Carlos Mendes','Comercial'),
  ('Fernanda Alves','Comercial'),
  ('Juliana Prado','Comercial'),
  ('Beatriz Santos','Técnica'),
  ('Rafael Costa','Técnica'),
  ('Eduardo Nunes','Técnica')
) as v(name, team)
where not exists (select 1 from staff);

insert into session_config (activity, session_time)
select * from (values ('handson','14:30'), ('palestra','14:30')) as v(activity, session_time)
where not exists (select 1 from session_config);

-- ============================================================
-- Funções: evitam condição de corrida quando 2 tablets clicam
-- ao mesmo tempo (ex: dois funcionários entrando na fila do
-- almoço no mesmo segundo).
-- ============================================================

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

create or replace function enter_lunch_queue(p_staff_id int)
returns void
language plpgsql
security definer
as $$
begin
  update staff set status = 'queued' where id = p_staff_id and status = 'pending';
  if found then
    insert into lunch_queue (staff_id) values (p_staff_id);
    perform try_fill_copa();
  end if;
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

grant execute on function try_fill_copa() to anon, authenticated;
grant execute on function enter_lunch_queue(int) to anon, authenticated;
grant execute on function return_from_lunch(int) to anon, authenticated;

-- Sem isso o painel do Supabase pode deixar a tabela "staff" sem SELECT
-- pra anon/authenticated (aconteceu em produção — a lista de equipe da
-- tela de Almoço ficava vazia mesmo com a policy de RLS liberada).
grant select, insert, update, delete on staff to anon, authenticated;

-- ============================================================
-- Segurança de linha (RLS). Como este é um sistema interno de
-- operação do estande (sem login individual), liberamos leitura
-- e escrita para quem tiver o link + a chave anon do site — a
-- mesma chave que já está embutida no HTML do sistema.
-- ============================================================

alter table staff enable row level security;
alter table checkins enable row level security;
alter table lunch_queue enable row level security;
alter table lunch_sessions enable row level security;
alter table alerts enable row level security;
alter table session_config enable row level security;

drop policy if exists "acesso interno" on staff;
drop policy if exists "acesso interno" on checkins;
drop policy if exists "acesso interno" on lunch_queue;
drop policy if exists "acesso interno" on lunch_sessions;
drop policy if exists "acesso interno" on alerts;
drop policy if exists "acesso interno" on session_config;

create policy "acesso interno" on staff for all using (true) with check (true);
create policy "acesso interno" on checkins for all using (true) with check (true);
create policy "acesso interno" on lunch_queue for all using (true) with check (true);
create policy "acesso interno" on lunch_sessions for all using (true) with check (true);
create policy "acesso interno" on alerts for all using (true) with check (true);
create policy "acesso interno" on session_config for all using (true) with check (true);

-- ============================================================
-- Tempo real: garante que as tabelas avisem o site quando algo
-- muda (é isso que faz os tablets se atualizarem sozinhos).
-- Se der erro "already member of publication", pode ignorar.
-- ============================================================
alter publication supabase_realtime add table staff, checkins, lunch_queue, lunch_sessions, alerts, session_config;

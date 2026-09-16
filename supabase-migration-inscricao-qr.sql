-- ============================================================
-- Migração: inscrição pública com QR, fila de espera e desistência
-- automática. Remove o controle de estoque (materiais são
-- reaproveitados, não descartados).
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores).
-- ============================================================

-- ---------- Remover estoque ----------
drop function if exists use_material(int, int);
drop function if exists restock_material(int);
drop table if exists materials;

-- ---------- Checkins vira o registro de inscrição ----------
alter table checkins add column if not exists status text not null default 'confirmed'
  check (status in ('waitlisted','confirmed','checked_in','no_show','cancelled'));
alter table checkins add column if not exists qr_token text unique default gen_random_uuid()::text;
alter table checkins add column if not exists checked_in_at timestamptz;

-- registros antigos (do sistema anterior) já entram como checked_in, pra não sumir do histórico
update checkins set status = 'checked_in', checked_in_at = created_at where checked_in_at is null and status = 'confirmed';

-- ---------- Inscrição do visitante (respeitando lotação, com trava de concorrência) ----------
create or replace function register_visitor(p_session_id int, p_name text, p_info text)
returns table(out_token text, out_status text, out_wristband text)
language plpgsql
security definer
as $$
declare
  cap int;
  filled int;
  new_status text;
  new_token text := gen_random_uuid()::text;
  new_wb text;
begin
  select capacity into cap from sessions where id = p_session_id for update;
  if not found then
    raise exception 'sessão não encontrada';
  end if;
  select count(*) into filled from checkins
    where session_id = p_session_id and status in ('confirmed','checked_in');
  if filled < cap then
    new_status := 'confirmed';
  else
    new_status := 'waitlisted';
  end if;
  insert into checkins (visitor_name, visitor_info, activity, session_id, status, qr_token)
    select p_name, p_info, s.activity, p_session_id, new_status, new_token
    from sessions s where s.id = p_session_id
    returning wristband into new_wb;
  return query select new_token, new_status, new_wb;
end;
$$;
grant execute on function register_visitor(int, text, text) to anon, authenticated;

-- ---------- Check-in por QR (escaneado pela equipe) ----------
create or replace function checkin_by_qr(p_token text)
returns table(out_result text, out_name text, out_activity text, out_wristband text)
language plpgsql
security definer
as $$
declare
  rec checkins%rowtype;
begin
  select * into rec from checkins where qr_token = p_token;
  if not found then
    return query select 'not_found', null::text, null::text, null::text;
    return;
  end if;
  if rec.checked_in_at is not null then
    return query select 'already', rec.visitor_name, rec.activity, rec.wristband;
    return;
  end if;
  if rec.status = 'waitlisted' then
    return query select 'waitlisted', rec.visitor_name, rec.activity, rec.wristband;
    return;
  end if;
  if rec.status in ('no_show','cancelled') then
    return query select 'expired', rec.visitor_name, rec.activity, rec.wristband;
    return;
  end if;
  update checkins set status = 'checked_in', checked_in_at = now() where id = rec.id;
  return query select 'ok', rec.visitor_name, rec.activity, rec.wristband;
end;
$$;
grant execute on function checkin_by_qr(text) to anon, authenticated;

-- ---------- Cadastro + check-in manual (visitante sem celular) ----------
create or replace function manual_checkin(p_session_id int, p_name text, p_info text)
returns table(out_status text, out_wristband text)
language plpgsql
security definer
as $$
declare
  cap int;
  filled int;
  new_wb text;
begin
  select capacity into cap from sessions where id = p_session_id for update;
  if not found then
    raise exception 'sessão não encontrada';
  end if;
  select count(*) into filled from checkins
    where session_id = p_session_id and status in ('confirmed','checked_in');
  if filled >= cap then
    return query select 'lotada', null::text;
    return;
  end if;
  insert into checkins (visitor_name, visitor_info, activity, session_id, status, qr_token, checked_in_at)
    select p_name, p_info, s.activity, p_session_id, 'checked_in', gen_random_uuid()::text, now()
    from sessions s where s.id = p_session_id
    returning wristband into new_wb;
  return query select 'ok', new_wb;
end;
$$;
grant execute on function manual_checkin(int, text, text) to anon, authenticated;

-- ---------- Desistência automática (15 min antes do início) ----------
create or replace function expire_noshows()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
  promoted_id int;
begin
  for rec in
    select c.id, c.session_id
    from checkins c
    join sessions s on s.id = c.session_id
    where c.status = 'confirmed'
      and c.checked_in_at is null
      and now() > (s.session_time - interval '15 minutes')
  loop
    update checkins set status = 'no_show' where id = rec.id;
    select id into promoted_id from checkins
      where session_id = rec.session_id and status = 'waitlisted'
      order by created_at asc limit 1;
    if found then
      update checkins set status = 'confirmed' where id = promoted_id;
    end if;
  end loop;
end;
$$;
grant execute on function expire_noshows() to anon, authenticated;

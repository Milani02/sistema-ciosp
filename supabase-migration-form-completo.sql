-- ============================================================
-- Migração: campos completos no formulário de inscrição do
-- visitante (CRO, especialidade, telefone, e-mail).
-- Roda isso no SQL Editor do Supabase (depois das migrações
-- anteriores, em especial a de inscrição/QR).
-- ============================================================

alter table checkins add column if not exists cro text;
alter table checkins add column if not exists especialidade text;
alter table checkins add column if not exists telefone text;
alter table checkins add column if not exists email text;

create or replace function register_visitor(
  p_session_id int,
  p_name text,
  p_cro text,
  p_especialidade text,
  p_telefone text,
  p_email text
)
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
  insert into checkins (visitor_name, cro, especialidade, telefone, email, activity, session_id, status, qr_token)
    select p_name, p_cro, p_especialidade, p_telefone, p_email, s.activity, p_session_id, new_status, new_token
    from sessions s where s.id = p_session_id
    returning wristband into new_wb;
  return query select new_token, new_status, new_wb;
end;
$$;

-- Remove a assinatura antiga (p_info) pra não ficar duas versões
-- conflitando na hora do PostgREST escolher qual chamar.
drop function if exists register_visitor(int, text, text);

grant execute on function register_visitor(int, text, text, text, text, text) to anon, authenticated;

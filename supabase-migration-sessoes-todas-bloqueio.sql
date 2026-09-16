-- ============================================================
-- Migração: agora o formulário mostra TODAS as sessões de hands-on/
-- palestra, com cadeado nas que ainda não abriram (só desbloqueia
-- 1h antes do início) — antes elas simplesmente não apareciam na
-- lista. Isso reforça no banco a mesma janela de 1h que já existe
-- no front, pra não dar pra inscrever numa sessão bloqueada
-- chamando a função direto (sem passar pela tela).
-- Roda isso no SQL Editor do Supabase (depois de form-completo.sql).
-- ============================================================

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
  s_time timestamptz;
  filled int;
  new_status text;
  new_token text := gen_random_uuid()::text;
  new_wb text;
begin
  select capacity, session_time into cap, s_time from sessions where id = p_session_id for update;
  if not found then
    raise exception 'sessão não encontrada';
  end if;
  if now() < s_time - interval '1 hour' then
    raise exception 'inscrição ainda não abriu pra essa sessão';
  end if;
  if now() > s_time then
    raise exception 'essa sessão já encerrou';
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

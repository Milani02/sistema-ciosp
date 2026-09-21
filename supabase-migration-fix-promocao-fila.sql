-- ============================================================
-- Migração: promoção automática da fila de espera quando a
-- equipe libera uma vaga manualmente (não compareceu / cancelar).
-- Antes só a expiração automática (expire_noshows, 15 min antes
-- da sessão) promovia o próximo da fila — staff_set_checkin_status
-- não fazia isso, então quem estava esperando ficava preso em
-- "fila de espera" e o QR nunca aparecia.
-- Roda isso no SQL Editor do Supabase (depois das migrações
-- anteriores, em especial a de auditoria/avaliações).
-- ============================================================

create or replace function staff_set_checkin_status(p_checkin_id int, p_status text)
returns void
language plpgsql
security definer
as $$
declare
  actor profiles%rowtype;
  prev text;
  sess_id int;
  promoted_id int;
begin
  if p_status not in ('waitlisted','confirmed','checked_in','no_show','cancelled') then
    raise exception 'status inválido: %', p_status;
  end if;

  select * into actor from profiles where id = auth.uid();
  if not found then
    raise exception 'apenas usuários autenticados podem alterar status.';
  end if;

  select status, session_id into prev, sess_id from checkins where id = p_checkin_id for update;
  if not found then
    raise exception 'inscrição não encontrada.';
  end if;

  update checkins
    set status = p_status,
        checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end
    where id = p_checkin_id;

  insert into checkin_audit (checkin_id, actor_id, actor_name, from_status, to_status)
    values (p_checkin_id, actor.id, actor.name, prev, p_status);

  -- vaga liberada (saiu de confirmed/checked_in pra algo que não ocupa vaga):
  -- promove automaticamente o mais antigo da fila de espera dessa sessão
  if prev in ('confirmed','checked_in') and p_status not in ('confirmed','checked_in') then
    select id into promoted_id from checkins
      where session_id = sess_id and status = 'waitlisted'
      order by created_at asc limit 1
      for update skip locked;
    if found then
      update checkins set status = 'confirmed' where id = promoted_id;
      insert into checkin_audit (checkin_id, actor_id, actor_name, from_status, to_status)
        values (promoted_id, actor.id, actor.name, 'waitlisted', 'confirmed');
    end if;
  end if;
end;
$$;

grant execute on function staff_set_checkin_status(int, text) to authenticated;

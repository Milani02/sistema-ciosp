-- ============================================================
-- Migração: permite o admin escolher 1 ou 2 pessoas específicas
-- pra mandar pro almoço de uma vez, em vez de cada pessoa entrar
-- na fila sozinha e o sistema formar a dupla por ordem de chegada.
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores).
-- ============================================================

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

grant execute on function enter_lunch_queue_group(int[]) to anon, authenticated;

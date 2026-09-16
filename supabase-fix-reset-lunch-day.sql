-- ============================================================
-- Fix: reset_lunch_day() dava erro "UPDATE requires a WHERE clause"
-- porque o Supabase bloqueia UPDATE/DELETE sem WHERE nenhum, mesmo
-- quando a intenção é mesmo afetar a tabela inteira (resetar o dia).
-- Roda isso no SQL Editor do Supabase.
-- ============================================================

create or replace function reset_lunch_day()
returns void
language plpgsql
security definer
as $$
begin
  update staff set status = 'pending' where true;
  delete from lunch_queue where true;
  delete from lunch_sessions where true;
end;
$$;

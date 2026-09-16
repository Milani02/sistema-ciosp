-- ============================================================
-- Migração: reset automático do almoço à meia-noite.
-- O CIOSP dura 4 dias (27–30/01/2027) — sem isso, no segundo dia
-- todo mundo já apareceria como "já almoçou" (fica assim pra sempre
-- depois que vira 'done' uma vez).
-- Roda isso no SQL Editor do Supabase (depois das migrações anteriores).
-- ============================================================

create or replace function reset_lunch_day()
returns void
language plpgsql
security definer
as $$
begin
  update staff set status = 'pending';
  delete from lunch_queue;
  delete from lunch_sessions;
end;
$$;

grant execute on function reset_lunch_day() to anon, authenticated;

-- Precisa da extensão pg_cron pra agendar o job (Database > Extensions
-- no painel do Supabase, ou o create extension abaixo já resolve).
create extension if not exists pg_cron;

-- Remove um agendamento antigo com esse nome, se já existir, pra não
-- duplicar caso você rode essa migração de novo.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'reset-almoco-meia-noite') then
    perform cron.unschedule('reset-almoco-meia-noite');
  end if;
end $$;

-- '0 3 * * *' = 03:00 UTC, que é meia-noite em São Paulo (UTC-3 o ano
-- todo, sem horário de verão desde 2019). Se o banco não estiver em
-- UTC, roda "show timezone;" pra conferir e ajusta o horário abaixo.
select cron.schedule(
  'reset-almoco-meia-noite',
  '0 3 * * *',
  $$select reset_lunch_day()$$
);

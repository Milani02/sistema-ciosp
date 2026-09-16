-- ============================================================
-- Migração: remove a funcionalidade de Almoço por completo
-- (fila da copa, sessões, reset automático à meia-noite e o
-- campo status da equipe, que só existia pra controlar isso).
-- Roda isso no SQL Editor do Supabase.
--
-- ATENÇÃO: isso apaga o histórico de quem já almoçou e quando
-- (tabela lunch_sessions) e a fila atual (lunch_queue). Não tem
-- volta depois de rodar.
-- ============================================================

-- Cron job do reset diário
do $$
begin
  if exists (select 1 from cron.job where jobname = 'reset-almoco-meia-noite') then
    perform cron.unschedule('reset-almoco-meia-noite');
  end if;
end $$;

-- Funções
drop function if exists reset_lunch_day();
drop function if exists enter_lunch_queue_group(int[]);
drop function if exists enter_lunch_queue(int);
drop function if exists return_from_lunch(int);
drop function if exists try_fill_copa();

-- Tabelas (removidas automaticamente da publication supabase_realtime)
drop table if exists lunch_queue;
drop table if exists lunch_sessions;

-- Coluna que só existia pra controlar o estado do almoço
alter table staff drop column if exists status;

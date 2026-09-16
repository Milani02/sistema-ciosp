-- Roda isso no SQL Editor do Supabase pra apagar os dados de teste
-- que eu gerei validando o sistema, e deixar tudo pronto pro dia real.
-- Não mexe na estrutura das tabelas.

delete from checkins;
delete from lunch_sessions;
delete from lunch_queue;
delete from alerts;
delete from sessions;
delete from shifts;
delete from visitors;
update staff set status = 'pending';

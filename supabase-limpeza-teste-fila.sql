-- ============================================================
-- Limpeza dos dados criados durante o teste da promoção
-- automática de fila (Visitante Teste 1-4, sessões TESTE FILA
-- HANDSON / TESTE FILA PALESTRA). Roda isso no SQL Editor do
-- Supabase quando quiser tirar esse lixo de teste do sistema.
-- ============================================================

delete from checkins where visitor_name like 'Visitante Teste %';
delete from sessions where title in ('TESTE FILA HANDSON', 'TESTE FILA PALESTRA');

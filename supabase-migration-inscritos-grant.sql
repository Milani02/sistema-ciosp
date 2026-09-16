-- ============================================================
-- Migração: garante que a tela "Inscritos" consiga alterar status
-- (check-in manual, cancelar, etc.) direto pela conta do admin
-- logado. Preventivo — mesmo tipo de problema que aconteceu com a
-- tabela "staff" (RLS liberada mas faltando o grant da tabela).
-- Roda isso no SQL Editor do Supabase.
-- ============================================================

grant select, insert, update, delete on checkins to anon, authenticated;

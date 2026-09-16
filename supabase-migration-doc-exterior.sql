-- ============================================================
-- Migração: permite doc_type = 'exterior' em customers, pra
-- cadastrar visitante estrangeiro na Venda (documento livre, sem
-- checagem de CPF/CNPJ — passaporte, ID etc.).
-- Roda isso no SQL Editor do Supabase.
-- ============================================================

alter table customers drop constraint if exists customers_doc_type_check;
alter table customers add constraint customers_doc_type_check
  check (doc_type in ('cpf', 'cnpj', 'exterior'));

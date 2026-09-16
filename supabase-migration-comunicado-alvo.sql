-- ============================================================
-- Migração: comunicado direcionado — admin escolhe se o aviso vai
-- só pra Consultoria Técnica, só pro Comercial, ou pras duas equipes.
-- Roda isso no SQL Editor do Supabase (depois da migração de
-- comunicados).
-- ============================================================

alter table announcements add column if not exists target text not null default 'ambas'
  check (target in ('tecnica', 'comercial', 'ambas'));

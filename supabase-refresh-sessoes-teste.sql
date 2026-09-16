-- ============================================================
-- Atualiza os horários das sessões de teste (mesmos títulos do
-- supabase-seed-sessoes-teste.sql) pra ficarem abertas de novo a
-- partir de agora. Roda toda vez que os horários de teste "expirarem".
-- ============================================================

update sessions set session_time = now() + interval '30 minutes' where title = 'Cimentação Adesiva na Prática';
update sessions set session_time = now() + interval '2 hours'    where title = 'Técnicas de Restauração em Resina Composta';
update sessions set session_time = now() + interval '4 hours'    where title = 'Protocolo de Clareamento Dental';
update sessions set session_time = now() + interval '6 hours'    where title = 'Moldagem Digital e Escaneamento Intraoral';
update sessions set session_time = now() + interval '1 hour'     where title = 'Tendências em Odontologia Digital 2027';
update sessions set session_time = now() + interval '3 hours'    where title = 'Biomateriais: Inovações em Regeneração Óssea';
update sessions set session_time = now() + interval '5 hours'    where title = 'Gestão de Consultório Odontológico';
update sessions set session_time = now() + interval '7 hours'    where title = 'Estética em Dentística Restauradora';

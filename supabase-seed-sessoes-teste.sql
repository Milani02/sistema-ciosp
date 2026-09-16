-- ============================================================
-- Dados fake pra testar Hands-on e Palestra: horários relativos a
-- "agora" (não datas fixas), pra já aparecerem abertos pra
-- inscrição assim que você rodar isso. São só pra teste — quando
-- tiver a grade real do CIOSP 2027, apaga essas linhas e cadastra
-- as de verdade (pela tela Agenda do admin, ou por SQL).
-- Roda isso no SQL Editor do Supabase (depois das migrações
-- anteriores).
-- ============================================================

insert into sessions (activity, title, session_time, capacity)
select v.activity, v.title, v.session_time, v.capacity
from (values
  ('handson', 'Cimentação Adesiva na Prática',              now() + interval '30 minutes', 8),
  ('handson', 'Técnicas de Restauração em Resina Composta', now() + interval '2 hours',    8),
  ('handson', 'Protocolo de Clareamento Dental',             now() + interval '4 hours',    10),
  ('handson', 'Moldagem Digital e Escaneamento Intraoral',   now() + interval '6 hours',    6),
  ('palestra', 'Tendências em Odontologia Digital 2027',           now() + interval '1 hour',  40),
  ('palestra', 'Biomateriais: Inovações em Regeneração Óssea',     now() + interval '3 hours', 40),
  ('palestra', 'Gestão de Consultório Odontológico',                now() + interval '5 hours', 40),
  ('palestra', 'Estética em Dentística Restauradora',               now() + interval '7 hours', 40)
) as v(activity, title, session_time, capacity)
where not exists (select 1 from sessions s where s.title = v.title);

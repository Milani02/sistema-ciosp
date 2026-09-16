-- Confirma as duas contas de teste do comercial que já foram criadas
-- (ficaram "aguardando confirmação" porque foram criadas com a chave
-- anon, sem acesso admin pra confirmar automaticamente).
-- Depois disso já dá pra logar com admincomercial@gmail.com /
-- staffcomercial@gmail.com, senha 123456.

update auth.users
set email_confirmed_at = now()
where email in ('admincomercial@gmail.com', 'staffcomercial@gmail.com')
  and email_confirmed_at is null;

-- Confere se os perfis (profiles) foram criados certinho pelo gatilho:
select id, name, department, level from profiles
where id in (
  select id from auth.users where email in ('admincomercial@gmail.com', 'staffcomercial@gmail.com')
);
